class SocketManager {
    constructor() {
        this.socket = null;
        this.statusIndicator = document.getElementById('connection-status');
    }

    connect(token) {
        this.setStatus('connecting');
        
        this.socket = io(`${CONFIG.WS_URL}/chat`, {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.setupEvents();
    }

    setupEvents() {
        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.setStatus('connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.setStatus('disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.setStatus('disconnected');
        });
    }

    authenticate() {
        // usually handled in auth payload during connection, but can emit if needed
    }

    sendMessage(conversationId, message) {
        if (!this.socket || !this.socket.connected) {
            throw new Error('Socket not connected');
        }
        this.socket.emit('send_message', { conversationId, message });
    }

    onResponse(callback) {
        if (this.socket) {
            this.socket.on('response', callback);
        }
    }

    onTyping(callback) {
        if (this.socket) {
            this.socket.on('typing', callback);
        }
    }

    joinConversation(id) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('join_conversation', { conversationId: id });
        }
    }

    leaveConversation(id) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('leave_conversation', { conversationId: id });
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    setStatus(status) {
        if (!this.statusIndicator) return;
        this.statusIndicator.className = `status-indicator status-${status}`;
        this.statusIndicator.title = status.charAt(0).toUpperCase() + status.slice(1);
    }
}

window.socketManager = new SocketManager();
