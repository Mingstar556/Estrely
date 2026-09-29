/**
 * Estrely Inactivity & Welcome Back Notification Engine
 * Displays a slick, animated greeting if the user returns after 12h to days of inactivity.
 */

class InactivityNotificationManager {
    constructor() {
        this.storageKey = 'estrely_last_visit';
        this.container = null;
        this.activeNotification = null;
        this.timer = null;
        this.thresholdHours = 12; // 12 hours minimum inactivity
    }

    init() {
        this.container = document.getElementById('inactivity-notification-container');
        if (!this.container) return;

        this.checkInactivity();
        this.bindActivityListeners();
    }

    checkInactivity() {
        const lastVisit = localStorage.getItem(this.storageKey);
        const now = Date.now();

        if (lastVisit) {
            const diffMs = now - parseInt(lastVisit, 10);
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours >= this.thresholdHours) {
                // User was away for 12+ hours
                const durationText = this.formatDuration(diffHours);
                // Delay slightly for smooth page load transition
                setTimeout(() => {
                    this.showWelcomeBack(durationText);
                }, 1400);
            }
        }

        // Always update last visit timestamp
        localStorage.setItem(this.storageKey, now.toString());
    }

    bindActivityListeners() {
        // Debounced periodic heartbeat to update last activity
        let timeout;
        const updateActivity = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                localStorage.setItem(this.storageKey, Date.now().toString());
            }, 5000);
        };

        window.addEventListener('click', updateActivity, { passive: true });
        window.addEventListener('keydown', updateActivity, { passive: true });
    }

    formatDuration(hours) {
        if (hours < 24) {
            const h = Math.round(hours);
            return `${h} ${h === 1 ? 'hour' : 'hours'}`;
        }
        const days = Math.round(hours / 24);
        return `${days} ${days === 1 ? 'day' : 'days'}`;
    }

    showWelcomeBack(durationText = 'a while') {
        if (!this.container) return;
        this.dismiss();

        // Audio chime for notification
        if (window.soundManager) {
            window.soundManager.playReceive();
        }

        const user = window.authManager?.getUser();
        const userName = user?.username ? user.username.split(' ')[0] : 'friend';

        const card = document.createElement('div');
        card.className = 'inactivity-card enter-animate';
        card.innerHTML = `
            <div class="inactivity-card-glow"></div>
            <div class="inactivity-header">
                <div class="inactivity-avatar-halo">
                    <img src="assets/bot-avatar.svg" alt="Estrely" class="inactivity-avatar-img">
                </div>
                <div class="inactivity-meta">
                    <div class="inactivity-title-row">
                        <span class="inactivity-brand">ESTRELY</span>
                        <span class="inactivity-badge">Away for ${durationText}</span>
                    </div>
                    <span class="inactivity-sub">Warm companion check-in</span>
                </div>
                <button type="button" class="inactivity-close-btn" aria-label="Dismiss">&times;</button>
            </div>
            
            <div class="inactivity-body">
                <p class="inactivity-greeting">
                    Hey ${userName}! <span class="wave-hand">✨</span> <strong>How are you doing?</strong>
                </p>
                <p class="inactivity-msg">
                    It's wonderful to see you back. I've missed our conversations — how has your day been?
                </p>
            </div>

            <div class="inactivity-actions">
                <button type="button" class="inactivity-chip" data-prompt="I'm doing well, thank you! How have you been?">
                    <span>✨ I'm doing well!</span>
                </button>
                <button type="button" class="inactivity-chip" data-prompt="I've been quite busy lately. Let's catch up!">
                    <span>💬 Let's catch up</span>
                </button>
                <button type="button" class="inactivity-chip" data-prompt="Tell me something inspiring to start my day.">
                    <span>💡 Inspire me</span>
                </button>
            </div>

            <div class="inactivity-progress">
                <div class="inactivity-progress-bar"></div>
            </div>
        `;

        this.container.appendChild(card);
        this.activeNotification = card;

        // Dismiss button handler
        const closeBtn = card.querySelector('.inactivity-close-btn');
        closeBtn.addEventListener('click', () => this.dismiss());

        // Chip prompt handlers
        card.querySelectorAll('.inactivity-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                this.dismiss();
                if (window.chatManager && prompt) {
                    const input = document.getElementById('message-input');
                    if (input) {
                        input.value = prompt;
                        window.chatManager.autoResizeInput();
                        window.chatManager.updateCharCount();
                        window.chatManager.handleSend();
                    }
                }
            });
        });

        // Auto dismiss after 15 seconds
        this.timer = setTimeout(() => {
            this.dismiss();
        }, 15000);
    }

    dismiss() {
        if (!this.activeNotification) return;
        clearTimeout(this.timer);
        const card = this.activeNotification;
        this.activeNotification = null;

        card.classList.remove('enter-animate');
        card.classList.add('exit-animate');
        setTimeout(() => {
            card.remove();
        }, 450);
    }

    // Exposed for manual testing / demo preview
    triggerTest(hours = 16) {
        this.showWelcomeBack(this.formatDuration(hours));
    }
}

window.inactivityManager = new InactivityNotificationManager();
// Expose test helper globally for previewing
window.testWelcomeNotification = (hours) => window.inactivityManager.triggerTest(hours);
