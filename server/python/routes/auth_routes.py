from flask import Blueprint, request, jsonify
from services.auth_service import AuthService
from security.sanitizer import InputSanitizer
from functools import wraps

auth_bp = Blueprint('auth', __name__)
auth_service = AuthService()
sanitizer = InputSanitizer()

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized', 'message': 'Missing token'}), 401
        
        token = auth_header.split(' ')[1]
        payload = auth_service.verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Unauthorized', 'message': 'Invalid or expired token'}), 401
            
        request.user_id = payload.get('sub')
        return f(*args, **kwargs)
    return decorated

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not sanitizer.sanitize_username(username):
            return jsonify({'error': 'Bad request', 'message': 'Invalid username format'}), 400
            
        if not sanitizer.sanitize_email(email):
            return jsonify({'error': 'Bad request', 'message': 'Invalid email format'}), 400
            
        if not sanitizer.validate_password_strength(password):
            return jsonify({'error': 'Bad request', 'message': 'Password too weak'}), 400
            
        user = auth_service.create_user(username, email, password)
        if not user:
            return jsonify({'error': 'Bad request', 'message': 'Username or email already exists'}), 400
            
        token = auth_service.generate_token(user['id'], user['role'])
        return jsonify({
            'message': 'User registered successfully',
            'user': user,
            'token': token
        }), 201
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        auth_data = auth_service.authenticate(username, password)
        if not auth_data:
            return jsonify({'error': 'Unauthorized', 'message': 'Invalid credentials'}), 401
            
        return jsonify(auth_data), 200
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    return jsonify({'message': 'Logged out successfully'})

@auth_bp.route('/verify', methods=['GET'])
@require_auth
def verify():
    return jsonify({'message': 'Token is valid', 'user_id': request.user_id})
