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
    // Server Connection & Dynamic Bridge Manager
    // ==========================================
    const serverModal = document.getElementById('server-modal');
    const serverBtn = document.getElementById('connection-status-btn');
    const serverStatusDot = document.getElementById('connection-status');
    const serverStatusLabel = document.getElementById('server-status-label');
    const serverUrlInput = document.getElementById('server-url-input');
    const testConnectBtn = document.getElementById('test-connect-btn');
    const resetServerBtn = document.getElementById('reset-server-btn');
    const closeServerModalBtn = document.getElementById('close-server-modal-btn');
    const modalServerStatus = document.getElementById('modal-server-status');
    const serverErrorMsg = document.getElementById('server-error-msg');

    const updateServerIndicator = async () => {
        if (!CONFIG.hasServer()) {
            if (serverStatusDot) {
                serverStatusDot.className = 'status-indicator status-disconnected';
                serverStatusDot.title = 'No live server connected — Click to connect';
            }
            if (serverStatusLabel) serverStatusLabel.textContent = 'Disconnected';
            return;
        }

        if (serverStatusDot) {
            serverStatusDot.className = 'status-indicator status-connecting';
            serverStatusDot.title = 'Checking server health...';
        }
        if (serverStatusLabel) serverStatusLabel.textContent = 'Checking...';

        const isHealthy = await CONFIG.checkHealth();
        if (isHealthy) {
            if (serverStatusDot) {
                serverStatusDot.className = 'status-indicator status-connected';
                serverStatusDot.title = `Estrely Online (${CONFIG.SERVER_BASE})`;
            }
            if (serverStatusLabel) serverStatusLabel.textContent = 'Live';
        } else {
            if (serverStatusDot) {
                serverStatusDot.className = 'status-indicator status-disconnected';
                serverStatusDot.title = `Server unreachable at ${CONFIG.SERVER_BASE}`;
            }
            if (serverStatusLabel) serverStatusLabel.textContent = 'Offline';
        }
    };

    const openServerModal = () => {
        if (!serverModal) return;
        if (serverUrlInput) {
            serverUrlInput.value = CONFIG.SERVER_BASE;
        }
        if (serverErrorMsg) serverErrorMsg.textContent = '';
        if (resetServerBtn) {
            resetServerBtn.style.display = localStorage.getItem('estrely_backend_url') ? 'inline-block' : 'none';
        }
        if (modalServerStatus) {
            const hasSrv = CONFIG.hasServer();
            modalServerStatus.innerHTML = hasSrv 
                ? `<span class="status-dot status-connected"></span><span>Target: <strong>${CONFIG.SERVER_BASE}</strong></span>`
                : `<span class="status-dot status-disconnected"></span><span>No backend connected yet.</span>`;
        }
        serverModal.classList.add('active');
    };

    const closeServerModal = () => {
        if (serverModal) serverModal.classList.remove('active');
    };

    if (serverBtn) {
        serverBtn.addEventListener('click', openServerModal);
    }
    if (closeServerModalBtn) {
        closeServerModalBtn.addEventListener('click', closeServerModal);
    }
    if (serverModal) {
        serverModal.addEventListener('click', (e) => {
            if (e.target === serverModal) closeServerModal();
        });
    }

    if (testConnectBtn) {
        testConnectBtn.addEventListener('click', async () => {
            const inputVal = (serverUrlInput?.value || '').trim();
            if (!inputVal) {
                if (serverErrorMsg) serverErrorMsg.textContent = 'Please enter a server URL (e.g. your Cloudflare Tunnel link).';
                return;
            }
            testConnectBtn.disabled = true;
            testConnectBtn.textContent = 'Testing...';
            if (serverErrorMsg) serverErrorMsg.textContent = '';

            const isOk = await CONFIG.checkHealth(inputVal);
            testConnectBtn.disabled = false;
            testConnectBtn.textContent = 'Test & Connect';

            if (isOk) {
                CONFIG.setServer(inputVal);
                if (modalServerStatus) {
                    modalServerStatus.innerHTML = `<span class="status-dot status-connected"></span><span>Connected to <strong>${CONFIG.SERVER_BASE}</strong>!</span>`;
                }
                updateServerIndicator();
                setTimeout(() => {
                    closeServerModal();
                    if (window.chatManager) {
                        window.chatManager.showToast('Connected to live server!', 'success');
                    }
                }, 800);
            } else {
                if (serverErrorMsg) {
                    serverErrorMsg.textContent = 'Could not reach server. Verify that your server is running (e.g., START_LIVE_WEBSITE.bat) and the link is active.';
                }
            }
        });
    }

    if (resetServerBtn) {
        resetServerBtn.addEventListener('click', () => {
            CONFIG.setServer('');
            if (serverUrlInput) serverUrlInput.value = '';
            updateServerIndicator();
            if (modalServerStatus) {
                modalServerStatus.innerHTML = `<span class="status-dot status-disconnected"></span><span>Reset to default origin.</span>`;
            }
            if (resetServerBtn) resetServerBtn.style.display = 'none';
        });
    }

    // Window event for API client when server is disconnected
    window.addEventListener('estrely:server_disconnected', () => {
        openServerModal();
    });

    // Check health on initial load
    updateServerIndicator();

    // If on static hosting without configured server, gently notify
    if (CONFIG.isStaticHosting && !CONFIG.hasServer()) {
        setTimeout(() => {
            if (window.chatManager) {
                window.chatManager.showToast('Please connect your live server using the status pill at the top.', 'info');
            }
        }, 1500);
    }

    // ==========================================
    // Progressive Web App (PWA) Service Worker
    // ==========================================
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch((err) => {
                console.log('PWA ServiceWorker registration info:', err.message);
            });
        });
    }
});


