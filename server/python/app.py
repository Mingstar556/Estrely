import os
import sys

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from config import Config
from routes.auth_routes import auth_bp
from routes.chat_routes import chat_bp
from routes.user_routes import user_bp
from routes.payment_routes import payment_bp
from database.db import DatabaseManager

pc_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'pc'))
app = Flask(__name__, static_folder=pc_dir, static_url_path='')
app.config.from_object(Config)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize database
db = DatabaseManager(Config.DB_PATH)
db.init()

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(chat_bp, url_prefix='/api/chat')
app.register_blueprint(user_bp, url_prefix='/api/users')
app.register_blueprint(payment_bp, url_prefix='/api/payments')

@app.route('/')
def index():
    return send_from_directory(pc_dir, 'index.html')

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'estrely-python-backend'})

@app.errorhandler(400)
def bad_request(e):
    return jsonify({'error': 'Bad request', 'message': str(e)}), 400

@app.errorhandler(401)
def unauthorized(e):
    return jsonify({'error': 'Unauthorized', 'message': 'Authentication required'}), 401

@app.errorhandler(403)
def forbidden(e):
    return jsonify({'error': 'Forbidden', 'message': 'Access denied'}), 403

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(429)
def rate_limited(e):
    return jsonify({'error': 'Rate limited', 'message': 'Too many requests'}), 429

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    is_debug = os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
    app.run(host='0.0.0.0', port=Config.PYTHON_PORT, debug=is_debug)
