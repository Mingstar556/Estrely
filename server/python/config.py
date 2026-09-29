import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

class Config:
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    JWT_SECRET = os.getenv('JWT_SECRET', 'change-me-in-production')
    JWT_EXPIRY = int(os.getenv('JWT_EXPIRY_HOURS', '24'))
    DB_PATH = os.getenv('DB_PATH', os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'estrely.db'))
    DAILY_TOKEN_LIMIT = int(os.getenv('DAILY_TOKEN_LIMIT', '100000'))
    MONTHLY_TOKEN_LIMIT = int(os.getenv('MONTHLY_TOKEN_LIMIT', '2000000'))
    ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', 'a' * 32)
    PYTHON_PORT = int(os.getenv('PORT', os.getenv('PYTHON_PORT', '5000')))
