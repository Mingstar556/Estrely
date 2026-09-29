import { CONFIG } from '../config';

class ApiClient {
  constructor() {
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Chat
  sendMessage(conversationId, message) {
    return this.request('/chat/send', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, conversationId, message }),
    });
  }

  sendGuestMessage(message, history = []) {
    return this.request('/chat/guest', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  }

  getConversations() {
    return this.request('/chat/conversations');
  }

  getMessages(conversationId) {
    return this.request(`/chat/conversations/${conversationId}`);
  }

  createConversation(title = 'New Conversation') {
    return this.request('/chat/conversations', { 
      method: 'POST',
      body: JSON.stringify({ title })
    });
  }

  updateConversation(id, title) {
    return this.request(`/chat/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  }

  deleteConversation(id) {
    return this.request(`/chat/conversations/${id}`, { method: 'DELETE' });
  }

  clearAllConversations() {
    return this.request('/chat/conversations', { method: 'DELETE' });
  }

  // Users
  getProfile() {
    return this.request('/users/profile');
  }

  getUsage() {
    return this.request('/users/usage');
  }

  // Auth
  login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  register(username, email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }
}

const apiClient = new ApiClient();
export default apiClient;
