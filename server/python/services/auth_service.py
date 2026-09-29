import bcrypt
import jwt
import datetime
import uuid
from config import Config
from database.db import DatabaseManager

class AuthService:
    def __init__(self):
        self.db = DatabaseManager(Config.DB_PATH)

    def hash_password(self, password):
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def verify_password(self, password, hashed):
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

    def generate_token(self, user_id, role):
        payload = {
            'sub': user_id,
            'role': role,
            'iat': datetime.datetime.utcnow(),
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=Config.JWT_EXPIRY)
        }
        return jwt.encode(payload, Config.JWT_SECRET, algorithm='HS256')

    def verify_token(self, token):
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def create_user(self, username, email, password):
        try:
            user_id = str(uuid.uuid4())
            password_hash = self.hash_password(password)
            self.db.execute(
                "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
                (user_id, username, email, password_hash)
            )
            return {
                'id': user_id,
                'username': username,
                'email': email,
                'role': 'user'
            }
        except Exception as e:
            return None

    def authenticate(self, username, password):
        user = self.db.fetch_one(
            "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)",
            (username, username)
        )
        if user and self.verify_password(password, user['password_hash']):
            token = self.generate_token(user['id'], user['role'])
            return {
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'display_name': user['display_name'],
                    'avatar_url': user['avatar_url'],
                    'role': user['role']
                },
                'token': token
            }
        return None
