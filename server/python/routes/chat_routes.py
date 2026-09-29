from flask import Blueprint, request, jsonify
from routes.auth_routes import require_auth
from services.ai_orchestrator import AIOrchestrator
from services.token_guard import TokenGuard
from services.encryption_service import EncryptionService
from database.db import DatabaseManager
from security.sanitizer import InputSanitizer
from config import Config
import uuid

chat_bp = Blueprint('chat', __name__)
ai_orchestrator = AIOrchestrator()
token_guard = TokenGuard()
encryption_service = EncryptionService()
sanitizer = InputSanitizer()
db = DatabaseManager(Config.DB_PATH)

@chat_bp.route('/send', methods=['POST'])
@require_auth
def send_message():
    try:
        data = request.get_json(silent=True) or {}
        user_id = request.user_id
        conversation_id = data.get('conversation_id') or data.get('conversationId')
        message = data.get('message')
        
        if not message:
            return jsonify({'error': 'Bad request', 'message': 'Message is required'}), 400
            
        message = sanitizer.sanitize_text(message)
        
        if not token_guard.check_limits(user_id):
            return jsonify({'error': 'Rate limited', 'message': 'Token limit exceeded'}), 429
            
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
            conv_title = message[:50]
            db.execute(
                "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
                (conversation_id, user_id, conv_title)
            )
        else:
            conv = db.fetch_one("SELECT * FROM conversations WHERE id = ? AND user_id = ?", (conversation_id, user_id))
            if not conv:
                return jsonify({'error': 'Not found', 'message': 'Conversation not found or unauthorized'}), 404
            conv_title = conv['title']
                
        # Encrypt user message
        encrypted_user_msg = encryption_service.encrypt(message)
        
        # Save user message
        db.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
            (conversation_id, 'user', encrypted_user_msg)
        )
        
        # Get conversation history
        raw_history = db.fetch_all(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC",
            (conversation_id,)
        )
        
        # Decrypt history
        history = []
        for msg in raw_history:
            decrypted_content = encryption_service.decrypt(msg['content'])
            if decrypted_content:
                history.append({'role': msg['role'], 'content': decrypted_content})
                
        # Call Multi-AI Orchestrator with Search & Fallback
        response = ai_orchestrator.generate_response(message, history[:-1])
        
        # Record usage
        usage = response.get('usage', {})
        input_tokens = usage.get('input_tokens', 0)
        output_tokens = usage.get('output_tokens', 0)
        if input_tokens > 0 or output_tokens > 0:
            token_guard.record_usage(user_id, conversation_id, input_tokens, output_tokens, response.get('model', 'estrely'))
            
        # Encrypt AI message
        encrypted_ai_msg = encryption_service.encrypt(response['text'])
        
        # Save AI response
        db.execute(
            "INSERT INTO messages (conversation_id, role, content, emotion) VALUES (?, ?, ?, ?)",
            (conversation_id, 'assistant', encrypted_ai_msg, response['emotion'])
        )
        
        db.execute("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (conversation_id,))
        
        return jsonify({
            'conversation_id': conversation_id,
            'conversation_title': conv_title,
            'response': response['text'],
            'message': response['text'],
            'emotion': response['emotion'],
            'emotion_confidence': response['emotion_confidence']
        })
        
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@chat_bp.route('/guest', methods=['POST'])
def send_guest_message():
    """
    Handle ephemeral messages from guest accounts.
    NO database insertions: messages and conversations are NOT recorded.
    Completely stateless and temporary.
    """
    try:
        data = request.get_json(silent=True) or {}
        message = data.get('message', '').strip()
        history = data.get('history', [])
        
        if not message:
            return jsonify({'error': 'Bad request', 'message': 'Message is required'}), 400
            
        message = sanitizer.sanitize_text(message)
        
        # Format history for GeminiService
        cleaned_history = []
        if isinstance(history, list):
            for h in history[-20:]:
                if isinstance(h, dict) and 'role' in h and 'content' in h:
                    cleaned_history.append({
                        'role': 'user' if h['role'] == 'user' else 'assistant',
                        'content': sanitizer.sanitize_text(str(h['content']))
                    })
        
        # Call Multi-AI Orchestrator directly without writing to the database
        response = ai_orchestrator.generate_response(message, cleaned_history)
        
        return jsonify({
            'response': response['text'],
            'message': response['text'],
            'emotion': response['emotion'],
            'emotion_confidence': response['emotion_confidence'],
            'is_guest': True
        })
        
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@chat_bp.route('/conversations', methods=['GET'])
@require_auth
def get_conversations():
    try:
        user_id = request.user_id
        conversations = db.fetch_all(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,)
        )
        return jsonify({'conversations': conversations})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@chat_bp.route('/conversations/<conversation_id>', methods=['GET'])
@require_auth
def get_conversation_messages(conversation_id):
    try:
        user_id = request.user_id
        conv = db.fetch_one("SELECT * FROM conversations WHERE id = ? AND user_id = ?", (conversation_id, user_id))
        if not conv:
            return jsonify({'error': 'Not found'}), 404
            
        raw_messages = db.fetch_all(
            "SELECT id, role, content, emotion, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC",
            (conversation_id,)
        )
        
        messages = []
        for msg in raw_messages:
            decrypted_content = encryption_service.decrypt(msg['content'])
            if decrypted_content:
                messages.append({
                    'id': msg['id'],
                    'role': msg['role'],
                    'content': decrypted_content,
                    'emotion': msg['emotion'],
                    'created_at': msg['created_at']
                })
                
        return jsonify({'conversation': dict(conv), 'messages': messages})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@chat_bp.route('/conversations/<conversation_id>', methods=['DELETE'])
@require_auth
def delete_conversation(conversation_id):
    try:
        user_id = request.user_id
        conv = db.fetch_one("SELECT * FROM conversations WHERE id = ? AND user_id = ?", (conversation_id, user_id))
        if not conv:
            return jsonify({'error': 'Not found'}), 404
            
        db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        return jsonify({'message': 'Conversation deleted'})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@chat_bp.route('/conversations', methods=['POST'])
@require_auth
def create_conversation():
    try:
        user_id = request.user_id
        data = request.get_json(silent=True) or {}
        title = data.get('title', 'New Conversation')
        conversation_id = str(uuid.uuid4())
        
        db.execute(
            "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
            (conversation_id, user_id, title)
        )
        
        return jsonify({
            'id': conversation_id,
            'title': title
        }), 201
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@chat_bp.route('/conversations/<conversation_id>', methods=['PUT', 'PATCH'])
@require_auth
def update_conversation(conversation_id):
    try:
        user_id = request.user_id
        data = request.get_json(silent=True) or {}
        new_title = data.get('title', '').strip()
        if not new_title:
            return jsonify({'error': 'Bad request', 'message': 'Title cannot be empty'}), 400
        
        conv = db.fetch_one("SELECT * FROM conversations WHERE id = ? AND user_id = ?", (conversation_id, user_id))
        if not conv:
            return jsonify({'error': 'Not found'}), 404
        
        db.execute("UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_title, conversation_id))
        return jsonify({'message': 'Conversation updated', 'id': conversation_id, 'title': new_title})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@chat_bp.route('/conversations', methods=['DELETE'])
@require_auth
def clear_conversations():
    try:
        user_id = request.user_id
        db.execute("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)", (user_id,))
        db.execute("DELETE FROM conversations WHERE user_id = ?", (user_id,))
        return jsonify({'message': 'All conversations cleared'})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
