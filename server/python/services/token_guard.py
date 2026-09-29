from database.db import DatabaseManager
from config import Config
import datetime

class TokenGuard:
    def __init__(self):
        self.db = DatabaseManager(Config.DB_PATH)

    def check_limits(self, user_id):
        try:
            self._check_reset(user_id)
            user = self.db.fetch_one("SELECT daily_tokens, monthly_tokens FROM users WHERE id = ?", (user_id,))
            if not user:
                return True
            daily = user['daily_tokens'] or 0
            monthly = user['monthly_tokens'] or 0
            return daily < Config.DAILY_TOKEN_LIMIT and monthly < Config.MONTHLY_TOKEN_LIMIT
        except Exception:
            return True

    def record_usage(self, user_id, conversation_id, input_tokens, output_tokens, model):
        try:
            total = input_tokens + output_tokens
            self.db.insert(
                "INSERT INTO token_usage (user_id, conversation_id, input_tokens, output_tokens, model) VALUES (?, ?, ?, ?, ?)",
                (user_id, conversation_id, input_tokens, output_tokens, model)
            )
            self.db.execute(
                "UPDATE users SET daily_tokens = COALESCE(daily_tokens, 0) + ?, monthly_tokens = COALESCE(monthly_tokens, 0) + ? WHERE id = ?",
                (total, total, user_id)
            )
        except Exception:
            pass

    def get_usage(self, user_id):
        try:
            self._check_reset(user_id)
            user = self.db.fetch_one("SELECT daily_tokens, monthly_tokens FROM users WHERE id = ?", (user_id,))
            return {
                'daily_tokens': (user['daily_tokens'] if user and user['daily_tokens'] else 0),
                'monthly_tokens': (user['monthly_tokens'] if user and user['monthly_tokens'] else 0),
                'daily_limit': Config.DAILY_TOKEN_LIMIT,
                'monthly_limit': Config.MONTHLY_TOKEN_LIMIT
            }
        except Exception:
            return {
                'daily_tokens': 0,
                'monthly_tokens': 0,
                'daily_limit': Config.DAILY_TOKEN_LIMIT,
                'monthly_limit': Config.MONTHLY_TOKEN_LIMIT
            }

    def _check_reset(self, user_id):
        try:
            user = self.db.fetch_one("SELECT last_reset_date FROM users WHERE id = ?", (user_id,))
            if user:
                last_reset = user['last_reset_date']
                today = datetime.date.today().isoformat()
                if last_reset != today:
                    self.db.execute(
                        "UPDATE users SET daily_tokens = 0, last_reset_date = ? WHERE id = ?",
                        (today, user_id)
                    )
        except Exception:
            pass

    def reset_daily(self):
        try:
            today = datetime.date.today().isoformat()
            self.db.execute("UPDATE users SET daily_tokens = 0, last_reset_date = ?", (today,))
        except Exception:
            pass
