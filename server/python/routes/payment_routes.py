from flask import Blueprint, request, jsonify
from routes.auth_routes import require_auth
from services.payment_service import PaymentService

payment_bp = Blueprint('payments', __name__)
payment_service = PaymentService()

@payment_bp.route('/create', methods=['POST'])
@require_auth
def create_payment():
    try:
        data = request.json
        amount = data.get('amount')
        currency = data.get('currency', 'USD')
        description = data.get('description', 'Subscription')
        
        if not amount:
            return jsonify({'error': 'Bad request', 'message': 'Amount is required'}), 400
            
        payment_id = payment_service.create_payment(request.user_id, amount, currency, description)
        return jsonify({'message': 'Payment created', 'payment_id': payment_id}), 201
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@payment_bp.route('/verify', methods=['POST'])
@require_auth
def verify_payment():
    try:
        data = request.json
        payment_id = data.get('payment_id')
        transaction_id = data.get('transaction_id')
        
        if not payment_id or not transaction_id:
            return jsonify({'error': 'Bad request', 'message': 'payment_id and transaction_id required'}), 400
            
        payment_service.verify_payment(payment_id, transaction_id)
        return jsonify({'message': 'Payment verified successfully'})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@payment_bp.route('/history', methods=['GET'])
@require_auth
def payment_history():
    try:
        history = payment_service.get_payment_history(request.user_id)
        return jsonify({'history': history})
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
