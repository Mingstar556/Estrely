document.addEventListener('DOMContentLoaded', () => {
    const authManager = window.authManager;
    const apiClient = window.apiClient;
    const socketManager = window.socketManager;
    let chatManager;
    let isInitialized = false;

    // Elements
    const authModal = document.getElementById('auth-modal');
    const guestWarningModal = document.getElementById('guest-warning-modal');
    const guestLoginBtn = document.getElementById('guest-login-btn');
    const confirmGuestBtn = document.getElementById('confirm-guest-btn');
    const cancelGuestBtn = document.getElementById('cancel-guest-btn');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');
    
    // Check Auth State (including guest mode)
    if (authManager.isAuthenticated()) {
        initApp();
    } else {
        showAuthModal();
    }

    function initApp() {
        if (isInitialized) return;
        isInitialized = true;

        authModal.classList.remove('active');
        if (guestWarningModal) {
            guestWarningModal.classList.remove('active');
        }
        
        // Setup User Info
        const user = authManager.getUser();
        const isGuest = authManager.isGuest();

        if (user) {
            document.getElementById('current-username').textContent = user.username;
            document.getElementById('current-email').textContent = user.email || '';
            const initialsEl = document.getElementById('user-initials');
            initialsEl.textContent = isGuest ? 'G' : user.username.charAt(0).toUpperCase();
            if (isGuest) {
                initialsEl.classList.add('guest-avatar-icon');
            }
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.title = isGuest ? "Exit Guest Mode / Sign In" : "Log out";
        }

        // Init Managers
        if (!isGuest && socketManager) {
            socketManager.connect(authManager.getToken());
        }
        chatManager = new ChatManager(apiClient, isGuest ? null : socketManager);
        window.chatManager = chatManager;
        chatManager.init();

        // Check for 12h+ inactivity and show slick welcome-back notification
        if (window.inactivityManager) {
            window.inactivityManager.init();
        }

        // Setup UI Event Listeners
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (!isGuest && socketManager) {
                    socketManager.disconnect();
                }
                authManager.logout();
            });
        }

        const newChatBtn = document.getElementById('new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                chatManager.createConversation();
            });
        }
        
        // Mobile sidebar & backdrop
        const sidebar = document.getElementById('sidebar');
        const sidebarBackdrop = document.getElementById('sidebar-backdrop');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileCloseBtn = document.getElementById('mobile-close-btn');

        const openMobileSidebar = () => {
            if (sidebar) sidebar.classList.add('open');
            if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
        };

        const closeMobileSidebar = () => {
            if (sidebar) sidebar.classList.remove('open');
            if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
        };

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', openMobileSidebar);
        }
        if (mobileCloseBtn) {
            mobileCloseBtn.addEventListener('click', closeMobileSidebar);
        }
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', closeMobileSidebar);
        }

        // Close mobile sidebar on tap outside
        document.addEventListener('click', (e) => {
            if (sidebar && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
                    closeMobileSidebar();
                }
            }
        });

        dismissAppLoader();
    }

    function dismissAppLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            setTimeout(() => {
                loader.classList.add('hidden');
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 650);
            }, 600);
        }
    }

    function showAuthModal() {
        authModal.classList.add('active');
        if (guestWarningModal) {
            guestWarningModal.classList.remove('active');
        }
        dismissAppLoader();
    }

    // Guest Account flow
    if (guestLoginBtn) {
        guestLoginBtn.addEventListener('click', () => {
            authModal.classList.remove('active');
            if (guestWarningModal) {
                guestWarningModal.classList.add('active');
            }
        });
    }

    if (cancelGuestBtn) {
        cancelGuestBtn.addEventListener('click', () => {
            if (guestWarningModal) {
                guestWarningModal.classList.remove('active');
            }
            showAuthModal();
        });
    }

    if (confirmGuestBtn) {
        confirmGuestBtn.addEventListener('click', () => {
            if (guestWarningModal) {
                guestWarningModal.classList.remove('active');
            }
            authManager.setGuestMode(true);
            initApp();
        });
    }

    if (guestWarningModal) {
        guestWarningModal.addEventListener('click', (e) => {
            if (e.target === guestWarningModal) {
                guestWarningModal.classList.remove('active');
                showAuthModal();
            }
        });
    }

    // Auth UI tabs
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.classList.add('active');
        formRegister.classList.remove('active');
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formRegister.classList.add('active');
        formLogin.classList.remove('active');
    });

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        
        try {
            errEl.textContent = '';
            await authManager.login(user, pass);
            initApp();
        } catch (error) {
            errEl.textContent = error.message;
        }
    });

    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        const errEl = document.getElementById('reg-error');
        
        try {
            errEl.textContent = '';
            await authManager.register(user, email, pass);
            initApp();
        } catch (error) {
            errEl.textContent = error.message;
        }
    });

    // ==========================================
    // Cookie & Session Consent Manager
    // ==========================================
    const cookieBanner = document.getElementById('cookie-banner');
    const cookieAcceptBtn = document.getElementById('cookie-accept-btn');
    const cookieEssentialBtn = document.getElementById('cookie-essential-btn');

    const getCookieConsent = () => {
        return localStorage.getItem('estrely_cookie_consent') || 
            (document.cookie.match(/(^|;\s*)estrely_cookie_consent=([^;]+)/) || [])[2];
    };

    const setCookieConsent = (type) => {
        localStorage.setItem('estrely_cookie_consent', type);
        document.cookie = `estrely_cookie_consent=${type}; path=/; max-age=31536000; SameSite=Lax`;
        if (cookieBanner) {
            cookieBanner.classList.remove('show');
            setTimeout(() => {
                cookieBanner.style.display = 'none';
            }, 400);
        }
    };

    if (!getCookieConsent()) {
        setTimeout(() => {
            if (cookieBanner) {
                cookieBanner.style.display = 'block';
                requestAnimationFrame(() => {
                    cookieBanner.classList.add('show');
                });
            }
        }, 1200);
    }

    if (cookieAcceptBtn) {
        cookieAcceptBtn.addEventListener('click', () => setCookieConsent('accepted'));
    }
    if (cookieEssentialBtn) {
        cookieEssentialBtn.addEventListener('click', () => setCookieConsent('essential'));
    }

    // ==========================================
    // Progressive Web App (PWA) Service Worker
    // ==========================================
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.log('PWA ServiceWorker registration info:', err.message);
            });
        });
    }
});

