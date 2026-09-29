class AuthManager {
    constructor() {
        this.tokenKey = 'estrely_token';
        this.userKey = 'estrely_user';
        this.guestKey = 'estrely_is_guest';
    }

    isGuest() {
        return localStorage.getItem(this.guestKey) === 'true';
    }

    setGuestMode(enabled) {
        if (enabled) {
            localStorage.setItem(this.guestKey, 'true');
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
        } else {
            localStorage.removeItem(this.guestKey);
        }
    }

    async register(username, email, password) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Registration failed');
            
            this.setGuestMode(false);
            this.setSession(data.token, data.user);
            return data;
        } catch (error) {
            throw error;
        }
    }

    async login(username, password) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Login failed');
            
            this.setGuestMode(false);
            this.setSession(data.token, data.user);
            return data;
        } catch (error) {
            throw error;
        }
    }

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.guestKey);
        window.location.reload();
    }

    setSession(token, user) {
        this.setGuestMode(false);
        if (token && token !== 'undefined') {
            localStorage.setItem(this.tokenKey, token);
        }
        if (user) {
            localStorage.setItem(this.userKey, JSON.stringify(user));
        }
    }

    getToken() {
        if (this.isGuest()) return null;
        const token = localStorage.getItem(this.tokenKey);
        return (token && token !== 'undefined') ? token : null;
    }

    getUser() {
        if (this.isGuest()) {
            return {
                id: 'guest',
                username: 'Guest Explorer',
                email: 'Temporary Session (Unsaved)',
                role: 'guest'
            };
        }
        const userStr = localStorage.getItem(this.userKey);
        return (userStr && userStr !== 'undefined') ? JSON.parse(userStr) : null;
    }

    isAuthenticated() {
        if (this.isGuest()) return true;
        
        const token = this.getToken();
        if (!token) return false;
        
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) {
                base64 += '=';
            }
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            const payload = JSON.parse(jsonPayload);
            return payload.exp ? (payload.exp > Date.now() / 1000) : true;
        } catch (e) {
            console.warn('JWT verification error:', e);
            return false;
        }
    }
}

window.authManager = new AuthManager();
