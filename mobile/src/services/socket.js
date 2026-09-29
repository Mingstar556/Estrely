import { io } from 'socket.io-client';
import { CONFIG } from '../config';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket && this.socket.connected) return;
    
    this.socket = io(`${CONFIG.WS_URL}/chat`, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }

  sendMessage(conversationId, message) {
    if (this.socket) {
      this.socket.emit('send_message', { conversationId, message });
    }
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
    if (this.socket) {
      this.socket.emit('join', id);
    }
  }

  leaveConversation(id) {
    if (this.socket) {
      this.socket.emit('leave', id);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

const socketService = new SocketService();
export default socketService;
