import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from config import Config

class EncryptionService:
    def __init__(self):
        password = Config.ENCRYPTION_KEY.encode()
        salt = b'estrely_static_salt_for_db'
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password))
        self.fernet = Fernet(key)

    def encrypt(self, plaintext):
        if not plaintext:
            return plaintext
        if isinstance(plaintext, str):
            plaintext = plaintext.encode('utf-8')
        ciphertext = self.fernet.encrypt(plaintext)
        return base64.urlsafe_b64encode(ciphertext).decode('utf-8')

    def decrypt(self, ciphertext):
        if not ciphertext:
            return ciphertext
        try:
            decoded = base64.urlsafe_b64decode(ciphertext.encode('utf-8'))
            plaintext = self.fernet.decrypt(decoded)
            return plaintext.decode('utf-8')
        except Exception:
            return None
