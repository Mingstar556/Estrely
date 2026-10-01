class ApiClient {
    constructor(authManager) {
        this.auth = authManager;
    }

    async fetchWithAuth(endpoint, options = {}) {
        const token = this.auth.getToken();
        if (!token) {
            this.auth.logout();
            throw new Error('No authentication token');
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };

        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
                ...options,
                headers
            });

            if (response.status === 401) {
                this.auth.logout();
                throw new Error('Session expired');
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            if (error instanceof TypeError && error.message.includes('fetch')) {
                window.dispatchEvent(new CustomEvent('estrely:server_disconnected'));
                throw new Error('Cannot connect to your live Estrely server. Please check your connection.');
            }
            throw error;
        }
    }

    async getConversations() {
        return this.fetchWithAuth('/chat/conversations');
    }

    async getMessages(conversationId) {
        return this.fetchWithAuth(`/chat/conversations/${conversationId}`);
    }

    async createConversation() {
        return this.fetchWithAuth('/chat/conversations', { method: 'POST' });
    }

    async deleteConversation(id) {
        return this.fetchWithAuth(`/chat/conversations/${id}`, { method: 'DELETE' });
    }

    async updateConversation(id, title) {
        return this.fetchWithAuth(`/chat/conversations/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ title })
        });
    }

    async clearAllConversations() {
        return this.fetchWithAuth('/chat/conversations', { method: 'DELETE' });
    }

    async sendMessage(conversationId, message) {
        return this.fetchWithAuth('/chat/send', {
            method: 'POST',
            body: JSON.stringify({ conversation_id: conversationId, conversationId, message })
        });
    }

    async sendGuestMessage(message, history = []) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/chat/guest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message, history })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Guest request failed');
            }
            return data;
        } catch (error) {
            console.error('Guest API Error:', error);
            if (error instanceof TypeError && error.message.includes('fetch')) {
                window.dispatchEvent(new CustomEvent('estrely:server_disconnected'));
                throw new Error('Cannot connect to your live Estrely server. Please check your connection.');
            }
            throw error;
        }
    }

    async getProfile() {
        return this.fetchWithAuth('/users/profile');
    }

    async updateProfile(data) {
        return this.fetchWithAuth('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async getUsage() {
        return this.fetchWithAuth('/users/usage');
    }
}

window.apiClient = new ApiClient(window.authManager);
