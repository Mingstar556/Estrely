import uuid
from database.db import DatabaseManager
from config import Config

class PaymentService:
    def __init__(self):
        self.db = DatabaseManager(Config.DB_PATH)

    def create_payment(self, user_id, amount, currency, description):
        payment_id = str(uuid.uuid4())
        self.db.execute(
            "INSERT INTO payments (id, user_id, amount, currency, description, status) VALUES (?, ?, ?, ?, ?, ?)",
            (payment_id, user_id, amount, currency, description, 'pending')
        )
        return payment_id

    def verify_payment(self, payment_id, transaction_id):
        self.db.execute(
            "UPDATE payments SET status = ?, transaction_id = ?, verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            ('completed', transaction_id, payment_id)
        )

    def get_payment_history(self, user_id):
        return self.db.fetch_all("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC", (user_id,))

    def refund_payment(self, payment_id):
        self.db.execute(
            "UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            ('refunded', payment_id)
        )
