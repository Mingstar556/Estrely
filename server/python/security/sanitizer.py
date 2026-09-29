import re
import html

class InputSanitizer:
    def sanitize_text(self, text):
        if not text:
            return ""
        # Strip HTML tags
        clean_text = re.sub(r'<[^>]*>', '', str(text))
        # Escape special chars
        clean_text = html.escape(clean_text)
        # Limit length to 10000 chars
        return clean_text[:10000]
        
    def sanitize_email(self, email):
        if not email:
            return False
        pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
        return bool(re.match(pattern, str(email)))
        
    def sanitize_username(self, username):
        if not username:
            return False
        pattern = r'^[a-zA-Z0-9_]{3,30}$'
        return bool(re.match(pattern, str(username)))
        
    def validate_password_strength(self, password):
        if not password:
            return False
        if len(password) < 8:
            return False
        if not re.search(r'[A-Z]', password):
            return False
        if not re.search(r'[a-z]', password):
            return False
        if not re.search(r'\d', password):
            return False
        return True
