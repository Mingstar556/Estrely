// Estrely Configuration & Dynamic Server Discovery
(function() {
    // 1. Check if backend URL was passed as query param (e.g. ?server=https://xxx.trycloudflare.com)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const qServer = urlParams.get('server') || urlParams.get('backend') || urlParams.get('api');
        if (qServer) {
            const cleanUrl = qServer.trim().replace(/\/+$/, '').replace(/\/api$/, '');
            localStorage.setItem('estrely_backend_url', cleanUrl);
        }
    } catch (e) {
        console.warn('Could not read URL params:', e);
    }

    const isHttp = window.location.protocol.startsWith('http');
    const isStaticHost = /github\.io|vercel\.app|netlify\.app|pages\.dev|surge\.sh/i.test(window.location.hostname);

    const getStoredServer = () => {
        try {
            return (localStorage.getItem('estrely_backend_url') || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
        } catch (e) {
            return '';
        }
    };

    window.CONFIG = {
        get SERVER_BASE() {
            const stored = getStoredServer();
            if (stored) return stored;
            if (isStaticHost) return '';
            return isHttp ? window.location.origin : 'http://localhost:5000';
        },
        get API_URL() {
            const base = this.SERVER_BASE;
            return base ? `${base}/api` : '/api';
        },
        get WS_URL() {
            return this.SERVER_BASE || window.location.origin;
        },
        hasServer() {
            return Boolean(this.SERVER_BASE);
        },
        setServer(url) {
            try {
                if (!url) {
                    localStorage.removeItem('estrely_backend_url');
                } else {
                    const clean = url.trim().replace(/\/+$/, '').replace(/\/api$/, '');
                    localStorage.setItem('estrely_backend_url', clean);
                }
            } catch (e) {
                console.warn('Could not set server in storage:', e);
            }
        },
        async checkHealth(targetUrl) {
            let testBase = targetUrl !== undefined ? targetUrl : this.SERVER_BASE;
            testBase = (testBase || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
            if (!testBase) return false;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(`${testBase}/api/health`, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    return data.status === 'ok';
                }
                return false;
            } catch (err) {
                return false;
            }
        },
        isStaticHosting: isStaticHost,
        MAX_MESSAGE_LENGTH: 10000,
        APP_NAME: 'Estrely',
        APP_VERSION: '1.0.0'
    };
})();
