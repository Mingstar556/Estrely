from flask import Blueprint, request, jsonify
from routes.auth_routes import require_auth
from database.db import DatabaseManager
from services.token_guard import TokenGuard
from config import Config

user_bp = Blueprint('users', __name__)
db = DatabaseManager(Config.DB_PATH)
token_guard = TokenGuard()

@user_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    try:
        user = db.fetch_one(
            "SELECT id, username, email, display_name, avatar_url, role, created_at FROM users WHERE id = ?",
            (request.user_id,)
        )
        if not user:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'profile': user})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@user_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    try:
        data = request.json
        display_name = data.get('display_name')
        avatar_url = data.get('avatar_url')
        
        updates = []
        params = []
        if display_name is not None:
            updates.append("display_name = ?")
            params.append(display_name)
        if avatar_url is not None:
            updates.append("avatar_url = ?")
            params.append(avatar_url)
            
        if not updates:
            return jsonify({'error': 'Bad request', 'message': 'No fields to update'}), 400
            
        params.append(request.user_id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        
        db.execute(query, tuple(params))
        
        user = db.fetch_one("SELECT id, username, email, display_name, avatar_url, role FROM users WHERE id = ?", (request.user_id,))
        return jsonify({'message': 'Profile updated', 'profile': user})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@user_bp.route('/usage', methods=['GET'])
@require_auth
def get_usage():
    try:
        usage = token_guard.get_usage(request.user_id)
        return jsonify({'usage': usage})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
