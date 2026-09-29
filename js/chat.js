/**
 * Estrely Chat Manager
 * Full-featured AI Chatbot frontend engine with typewriter streaming,
 * markdown parsing, code blocks, speech synthesis, and conversation management.
 */

class ChatManager {
    constructor(api, socket) {
        this.api = api;
        this.socket = socket;
        this.currentConversationId = null;
        this.isTyping = false;
        this.isStreaming = false;
        this.currentStreamInterval = null;
        this.conversationsCache = [];
        this.lastUserMessage = '';
        this.currentSpeechUtterance = null;
        this.activeSpeakingBtn = null;
        this.isGuest = window.authManager?.isGuest() || false;
        this.guestHistory = [];
        
        this.emoColors = {
            joy: 'var(--emo-joy)',
            sadness: 'var(--emo-sadness)',
            anger: 'var(--emo-anger)',
            love: 'var(--emo-love)',
            humor: 'var(--emo-humor)',
            neutral: 'var(--emo-neutral)',
            calm: '#34d399',
            curiosity: '#38bdf8',
            excitement: '#f59e0b',
            concern: '#f87171',
            gratitude: '#a78bfa'
        };

        this.elements = {
            chatMessages: document.getElementById('chat-messages'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            stopBtn: document.getElementById('stop-btn'),
            charCounter: document.getElementById('char-counter'),
            conversationList: document.getElementById('conversation-list'),
            chatTitle: document.getElementById('current-chat-title'),
            renameChatBtn: document.getElementById('rename-chat-btn'),
            welcomeScreen: document.querySelector('.welcome-screen'),
            scrollBottomBtn: document.getElementById('scroll-bottom-btn'),
            searchChatsInput: document.getElementById('search-chats-input'),
            clearSearchBtn: document.getElementById('clear-search-btn'),
            emptySearchState: document.getElementById('empty-search-state'),
            soundToggleBtn: document.getElementById('sound-toggle-btn'),
            soundIconOn: document.getElementById('sound-icon-on'),
            soundIconOff: document.getElementById('sound-icon-off'),
            clearAllBtn: document.getElementById('clear-all-btn'),
            renameModal: document.getElementById('rename-modal'),
            renameForm: document.getElementById('rename-form'),
            renameInput: document.getElementById('rename-input'),
            cancelRenameBtn: document.getElementById('cancel-rename-btn'),
            welcomeGreeting: document.getElementById('welcome-greeting')
        };
    }

    init() {
        this.setupEventListeners();
        this.setupGreeting();
        this.setupAudioToggle();
        this.loadConversations();
        
        if (this.socket) {
            this.socket.onResponse((data) => {
                if (data.conversationId === this.currentConversationId) {
                    this.removeTypingIndicator();
                    this.renderMessage(data.message, false, data.emotion, true);
                }
            });
            
            this.socket.onTyping((data) => {
                if (data.conversationId === this.currentConversationId) {
                    this.renderTypingIndicator();
                }
            });
        }
    }

    setupGreeting() {
        if (!this.elements.welcomeGreeting) return;
        const hour = new Date().getHours();
        let greeting = "Good morning";
        if (hour >= 12 && hour < 17) greeting = "Good afternoon";
        else if (hour >= 17 && hour < 22) greeting = "Good evening";
        else if (hour >= 22 || hour < 5) greeting = "Working late";

        const user = window.authManager?.getUser();
        const name = this.isGuest ? ', Guest Explorer' : (user?.username ? `, ${user.username}` : '');
        this.elements.welcomeGreeting.textContent = `${greeting}${name}`;
    }

    setupAudioToggle() {
        if (!this.elements.soundToggleBtn) return;
        const updateIcon = () => {
            const isMuted = window.soundManager.isMuted();
            this.elements.soundIconOn.style.display = isMuted ? 'none' : 'block';
            this.elements.soundIconOff.style.display = isMuted ? 'block' : 'none';
            this.elements.soundToggleBtn.title = isMuted ? "Sound muted (click to enable)" : "Sound on (click to mute)";
        };

        updateIcon();
        this.elements.soundToggleBtn.addEventListener('click', () => {
            window.soundManager.toggleMute();
            updateIcon();
            this.showToast(window.soundManager.isMuted() ? 'Audio feedback muted' : 'Audio feedback enabled', 'info');
        });
    }

    setupEventListeners() {
        // Send button
        this.elements.sendBtn.addEventListener('click', () => this.handleSend());
        
        // Stop button
        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.stopGeneration());
        }

        // Textarea input
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        this.elements.messageInput.addEventListener('input', () => {
            this.autoResizeInput();
            this.updateCharCount();
        });

        // Starter Cards Click
        document.querySelectorAll('.starter-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) {
                    this.elements.messageInput.value = prompt;
                    this.autoResizeInput();
                    this.updateCharCount();
                    this.handleSend();
                }
            });
        });

        // Scroll to bottom button
        this.elements.chatMessages.addEventListener('scroll', () => {
            const el = this.elements.chatMessages;
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
            if (!isNearBottom && el.scrollHeight > el.clientHeight + 200) {
                this.elements.scrollBottomBtn.classList.add('visible');
            } else {
                this.elements.scrollBottomBtn.classList.remove('visible');
            }
        });

        this.elements.scrollBottomBtn.addEventListener('click', () => {
            this.scrollToBottom(true);
        });

        // Search conversations
        this.elements.searchChatsInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            this.filterConversations(query);
            this.elements.clearSearchBtn.style.display = query ? 'block' : 'none';
        });

        this.elements.clearSearchBtn.addEventListener('click', () => {
            this.elements.searchChatsInput.value = '';
            this.elements.clearSearchBtn.style.display = 'none';
            this.filterConversations('');
            this.elements.searchChatsInput.focus();
        });

        // Rename conversation
        this.elements.renameChatBtn.addEventListener('click', () => {
            if (!this.currentConversationId) return;
            const currentTitle = this.elements.chatTitle.textContent;
            this.elements.renameInput.value = currentTitle;
            this.elements.renameModal.classList.add('active');
            this.elements.renameInput.focus();
        });

        this.elements.cancelRenameBtn.addEventListener('click', () => {
            this.elements.renameModal.classList.remove('active');
        });

        this.elements.renameModal.addEventListener('click', (e) => {
            if (e.target === this.elements.renameModal) {
                this.elements.renameModal.classList.remove('active');
            }
        });

        this.elements.renameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newTitle = this.elements.renameInput.value.trim();
            if (!newTitle || !this.currentConversationId) return;

            try {
                await this.api.updateConversation(this.currentConversationId, newTitle);
                this.elements.chatTitle.textContent = newTitle;
                this.elements.renameModal.classList.remove('active');
                await this.loadConversations(false);
                this.showToast('Conversation renamed', 'success');
            } catch (err) {
                this.showToast(err.message || 'Failed to rename conversation', 'error');
            }
        });

        // Clear all chats
        if (this.elements.clearAllBtn) {
            this.elements.clearAllBtn.addEventListener('click', async () => {
                if (this.isGuest) {
                    if (!confirm('Clear your temporary chat session?')) return;
                    this.guestHistory = [];
                    this.elements.chatMessages.innerHTML = '';
                    if (this.elements.welcomeScreen) {
                        this.elements.welcomeScreen.style.display = 'flex';
                        this.elements.chatMessages.appendChild(this.elements.welcomeScreen);
                        this.setupGreeting();
                    }
                    this.showToast('Temporary chat cleared', 'info');
                    return;
                }
                if (!confirm('Are you sure you want to clear your entire chat history? This cannot be undone.')) return;
                try {
                    await this.api.clearAllConversations();
                    this.startNewChat();
                    await this.loadConversations();
                    this.showToast('All conversations deleted', 'info');
                } catch (err) {
                    this.showToast('Failed to clear conversations', 'error');
                }
            });
        }

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Escape to close modals
            if (e.key === 'Escape') {
                if (this.elements.renameModal.classList.contains('active')) {
                    this.elements.renameModal.classList.remove('active');
                }
            }
            // Ctrl/Cmd + N: New Chat
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                this.startNewChat();
            }
            // Ctrl/Cmd + K: Focus Search
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.elements.searchChatsInput.focus();
            }
        });
    }

    autoResizeInput() {
        const input = this.elements.messageInput;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    }

    updateCharCount() {
        const len = this.elements.messageInput.value.length;
        this.elements.charCounter.textContent = `${len.toLocaleString()} / ${CONFIG.MAX_MESSAGE_LENGTH.toLocaleString()}`;
        if (len > CONFIG.MAX_MESSAGE_LENGTH) {
            this.elements.charCounter.style.color = 'var(--danger)';
            this.elements.sendBtn.disabled = true;
        } else {
            this.elements.charCounter.style.color = 'var(--text-secondary)';
            this.elements.sendBtn.disabled = len === 0 || this.isStreaming;
        }
    }

    async loadConversations(autoSelectFirst = true) {
        if (this.isGuest) {
            this.renderGuestConversationList();
            this.elements.chatTitle.textContent = 'Guest Session (Temporary)';
            this.elements.renameChatBtn.style.display = 'none';
            return;
        }

        try {
            const data = await this.api.getConversations();
            this.conversationsCache = data.conversations || [];
            this.renderConversationList(this.conversationsCache);
            
            if (autoSelectFirst && this.conversationsCache.length > 0 && !this.currentConversationId) {
                this.loadConversation(this.conversationsCache[0].id);
            }
        } catch (error) {
            this.showToast('Failed to load conversations', 'error');
        }
    }

    renderGuestConversationList() {
        this.elements.conversationList.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'conversation-item active guest-item';
        li.innerHTML = `
            <div class="guest-conv-label">
                <svg class="guest-conv-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span class="conversation-item-title">Temporary Chat</span>
            </div>
            <span class="guest-pill-badge">UNSAVED</span>
        `;
        li.title = 'Guest session: Data is not recorded to database';
        li.addEventListener('click', () => {
            this.showToast('Guest chat is active. Messages are temporary and unsaved.', 'info');
        });
        this.elements.conversationList.appendChild(li);
    }

    showGuestRestrictionNotice() {
        this.showToast('🔒 Guests cannot create new chats. Create an account to unlock multiple conversations!', 'warning');
    }

    filterConversations(query) {
        if (this.isGuest) return;
        if (!query) {
            this.renderConversationList(this.conversationsCache);
            this.elements.emptySearchState.style.display = 'none';
            return;
        }

        const filtered = this.conversationsCache.filter(c => 
            (c.title || '').toLowerCase().includes(query)
        );

        this.renderConversationList(filtered);
        this.elements.emptySearchState.style.display = filtered.length === 0 ? 'block' : 'none';
    }

    startNewChat() {
        if (this.isGuest) {
            this.showGuestRestrictionNotice();
            return;
        }
        this.stopGeneration();
        this.currentConversationId = null;
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar')?.classList.remove('open');
            document.getElementById('sidebar-backdrop')?.classList.remove('active');
        }
        this.elements.chatMessages.innerHTML = '';
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'flex';
            this.elements.chatMessages.appendChild(this.elements.welcomeScreen);
            this.setupGreeting();
        }
        document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
        this.elements.chatTitle.textContent = 'New Conversation';
        this.elements.renameChatBtn.style.display = 'none';
        this.elements.messageInput.value = '';
        this.autoResizeInput();
        this.updateCharCount();
        this.elements.messageInput.focus();
    }

    async createConversation() {
        if (this.isGuest) {
            this.showGuestRestrictionNotice();
            return;
        }
        this.startNewChat();
    }

    renderConversationList(conversations) {
        this.elements.conversationList.innerHTML = '';
        
        conversations.forEach(conv => {
            const li = document.createElement('li');
            li.className = `conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}`;
            li.dataset.id = conv.id;
            li.onclick = () => this.loadConversation(conv.id);
            
            const title = document.createElement('span');
            title.className = 'conversation-item-title';
            title.textContent = conv.title || 'New Conversation';
            
            const actionContainer = document.createElement('div');
            actionContainer.className = 'conv-item-actions';

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-conv-btn';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Delete chat';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteConversation(conv.id);
            };
            
            actionContainer.appendChild(delBtn);
            li.appendChild(title);
            li.appendChild(actionContainer);
            this.elements.conversationList.appendChild(li);
        });
    }

    async deleteConversation(id) {
        if (!confirm('Delete this conversation?')) return;
        try {
            await this.api.deleteConversation(id);
            if (this.currentConversationId === id) {
                this.startNewChat();
            }
            await this.loadConversations(false);
            this.showToast('Conversation deleted', 'info');
        } catch (error) {
            this.showToast('Failed to delete conversation', 'error');
        }
    }

    async loadConversation(id) {
        this.stopGeneration();
        if (this.currentConversationId && this.socket) {
            this.socket.leaveConversation(this.currentConversationId);
        }
        
        this.currentConversationId = id;
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar')?.classList.remove('open');
            document.getElementById('sidebar-backdrop')?.classList.remove('active');
        }
        if (this.socket) {
            this.socket.joinConversation(id);
        }
        
        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });
        
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
        }
        this.elements.chatMessages.innerHTML = '';

        try {
            const data = await this.api.getMessages(id);
            if (data.conversation && data.conversation.title) {
                this.elements.chatTitle.textContent = data.conversation.title;
            } else {
                this.elements.chatTitle.textContent = 'Chat';
            }
            this.elements.renameChatBtn.style.display = 'inline-flex';

            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(msg => {
                    this.renderMessage(msg.content, msg.role === 'user', msg.emotion, false);
                });
            } else if (this.elements.welcomeScreen) {
                this.elements.welcomeScreen.style.display = 'flex';
                this.elements.chatMessages.appendChild(this.elements.welcomeScreen);
            }
            this.scrollToBottom();
        } catch (error) {
            this.showToast('Failed to load messages', 'error');
        }
    }

    async handleSend() {
        if (this.isStreaming) return;
        const text = this.elements.messageInput.value.trim();
        if (!text) return;

        this.lastUserMessage = text;
        this.elements.messageInput.value = '';
        this.autoResizeInput();
        this.updateCharCount();

        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
        }

        // Play subtle sound chime
        window.soundManager.playSend();

        this.renderMessage(text, true);
        this.renderTypingIndicator();
        this.setStreamingState(true);

        try {
            if (this.isGuest) {
                const data = await this.api.sendGuestMessage(text, this.guestHistory);
                this.removeTypingIndicator();
                const reply = data.response || data.message || '';
                
                // Play notification sound
                window.soundManager.playReceive();

                // Maintain temporary in-memory history (never recorded to database)
                this.guestHistory.push({ role: 'user', content: text });
                this.guestHistory.push({ role: 'assistant', content: reply });

                // Stream the response with smooth word typewriter
                await this.renderMessage(reply, false, data.emotion, true);
            } else if (this.socket && this.socket.socket && this.socket.socket.connected && this.currentConversationId) {
                this.socket.sendMessage(this.currentConversationId, text);
            } else {
                const data = await this.api.sendMessage(this.currentConversationId, text);
                this.removeTypingIndicator();
                const reply = data.response || data.message || '';
                
                // Play notification sound
                window.soundManager.playReceive();

                // Stream the response with smooth word typewriter
                await this.renderMessage(reply, false, data.emotion, true);

                if (!this.currentConversationId && data.conversation_id) {
                    this.currentConversationId = data.conversation_id;
                    if (data.conversation_title) {
                        this.elements.chatTitle.textContent = data.conversation_title;
                    }
                    this.elements.renameChatBtn.style.display = 'inline-flex';
                    await this.loadConversations(false);
                }
            }
        } catch (error) {
            this.removeTypingIndicator();
            this.showToast(error.message || 'Failed to send message', 'error');
        } finally {
            this.setStreamingState(false);
        }
    }

    setStreamingState(isStreaming) {
        this.isStreaming = isStreaming;
        if (this.elements.stopBtn) {
            this.elements.stopBtn.style.display = isStreaming ? 'flex' : 'none';
        }
        this.elements.sendBtn.style.display = isStreaming ? 'none' : 'flex';
        this.updateCharCount();
    }

    stopGeneration() {
        if (this.currentStreamInterval) {
            clearInterval(this.currentStreamInterval);
            this.currentStreamInterval = null;
        }
        this.setStreamingState(false);
        this.removeTypingIndicator();
    }

    async renderMessage(text, isUser, emotion = null, shouldStream = false) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUser ? 'user' : 'bot'} message-animate`;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        
        let avatarHtml = '';
        if (!isUser) {
            const emoColor = emotion ? (this.emoColors[emotion.toLowerCase()] || 'var(--gold)') : 'var(--gold)';
            avatarHtml = `<div class="message-avatar bot-avatar" style="--avatar-glow: ${emoColor};">
                <img src="assets/bot-avatar.svg" class="bot-avatar-img" alt="Estrely">
            </div>`;
        } else {
            const initials = window.authManager?.getUser()?.username?.charAt(0).toUpperCase() || 'U';
            avatarHtml = `<div class="message-avatar user-avatar-pill">${initials}</div>`;
        }
        
        let emotionHtml = '';
        if (!isUser && emotion) {
            const color = this.emoColors[emotion.toLowerCase()] || this.emoColors.neutral;
            emotionHtml = `<div class="emotion-badge" style="border-color: ${color}44; color: ${color};">
                <span class="emotion-dot" style="background-color: ${color}"></span>
                ${emotion}
            </div>`;
        }

        // Action Toolbar
        const actionsHtml = `
            <div class="message-action-toolbar">
                <button class="msg-action-btn copy-msg-btn" title="Copy message text" type="button">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Copy</span>
                </button>
                ${!isUser ? `
                    <button class="msg-action-btn speak-msg-btn" title="Read aloud" type="button">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        <span>Listen</span>
                    </button>
                    <button class="msg-action-btn regen-msg-btn" title="Regenerate response" type="button">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        <span>Regenerate</span>
                    </button>
                ` : `
                    <button class="msg-action-btn edit-msg-btn" title="Edit & resend" type="button">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        <span>Edit</span>
                    </button>
                `}
            </div>
        `;

        if (isUser) {
            msgDiv.innerHTML = `
                ${avatarHtml}
                <div class="message-content">
                    <div class="message-bubble user-bubble">${window.markdownRenderer.escapeHtml(text)}</div>
                    <div class="message-meta">
                        <span>${this.formatTime(new Date())}</span>
                        ${actionsHtml}
                    </div>
                </div>
            `;
            wrapper.appendChild(msgDiv);
            this.elements.chatMessages.appendChild(wrapper);
            this.attachMessageActions(wrapper, text, isUser);
            this.scrollToBottom();
            return;
        }

        // Bot Message with Gold Glowing Border & Markdown Rendering
        const renderedHtml = window.markdownRenderer.render(text);
        
        msgDiv.innerHTML = `
            ${avatarHtml}
            <div class="message-content">
                <div class="message-bubble gold-border-glow">
                    <div class="message-inner">${shouldStream ? '' : renderedHtml}</div>
                </div>
                <div class="message-meta">
                    <span>${this.formatTime(new Date())}</span>
                    ${emotionHtml}
                    ${actionsHtml}
                </div>
            </div>
        `;

        wrapper.appendChild(msgDiv);
        this.elements.chatMessages.appendChild(wrapper);
        this.attachMessageActions(wrapper, text, isUser);

        if (shouldStream) {
            await this.typewriterReveal(wrapper.querySelector('.message-inner'), text);
        } else {
            this.scrollToBottom();
        }
    }

    typewriterReveal(container, fullText) {
        return new Promise((resolve) => {
            const words = fullText.split(' ');
            let currentIndex = 0;
            const chunkSize = 2; // Stream 2 words per tick for natural speed

            container.innerHTML = `<span class="typewriter-cursor">▍</span>`;

            this.currentStreamInterval = setInterval(() => {
                if (currentIndex >= words.length) {
                    clearInterval(this.currentStreamInterval);
                    this.currentStreamInterval = null;
                    container.innerHTML = window.markdownRenderer.render(fullText);
                    this.scrollToBottom();
                    resolve();
                    return;
                }

                currentIndex = Math.min(currentIndex + chunkSize, words.length);
                const partialText = words.slice(0, currentIndex).join(' ');
                container.innerHTML = window.markdownRenderer.render(partialText) + `<span class="typewriter-cursor">▍</span>`;
                this.scrollToBottom();
            }, 30);
        });
    }

    attachMessageActions(wrapper, text, isUser) {
        // Copy message
        const copyBtn = wrapper.querySelector('.copy-msg-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(text).then(() => {
                    const span = copyBtn.querySelector('span');
                    const orig = span.textContent;
                    span.textContent = 'Copied!';
                    copyBtn.classList.add('active');
                    setTimeout(() => {
                        span.textContent = orig;
                        copyBtn.classList.remove('active');
                    }, 2000);
                });
            });
        }

        // Text to Speech
        const speakBtn = wrapper.querySelector('.speak-msg-btn');
        if (speakBtn && ('speechSynthesis' in window)) {
            speakBtn.addEventListener('click', () => {
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                    if (this.activeSpeakingBtn === speakBtn) {
                        this.activeSpeakingBtn.classList.remove('speaking');
                        this.activeSpeakingBtn.querySelector('span').textContent = 'Listen';
                        this.activeSpeakingBtn = null;
                        return;
                    }
                }

                if (this.activeSpeakingBtn) {
                    this.activeSpeakingBtn.classList.remove('speaking');
                    this.activeSpeakingBtn.querySelector('span').textContent = 'Listen';
                }

                // Clean text for speech (strip markdown symbols)
                const cleanSpeechText = text
                    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
                    .replace(/`([^`]+)`/g, '$1')
                    .replace(/[*#_~]/g, '');

                const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
                utterance.rate = 1.08; // upbeat, brisk teen cadence
                utterance.pitch = 1.18; // youthful, lively teen voice

                // Pick an expressive, youthful English voice if available
                const voices = window.speechSynthesis.getVoices();
                const teenVoice = voices.find(v => 
                    v.lang.startsWith('en') && 
                    (v.name.includes('Google') || v.name.includes('Alex') || v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Aaron') || v.name.includes('Daniel'))
                ) || voices.find(v => v.lang.startsWith('en'));
                if (teenVoice) utterance.voice = teenVoice;

                speakBtn.classList.add('speaking');
                speakBtn.querySelector('span').textContent = 'Speaking...';
                this.activeSpeakingBtn = speakBtn;

                utterance.onend = () => {
                    speakBtn.classList.remove('speaking');
                    speakBtn.querySelector('span').textContent = 'Listen';
                    this.activeSpeakingBtn = null;
                };

                utterance.onerror = () => {
                    speakBtn.classList.remove('speaking');
                    speakBtn.querySelector('span').textContent = 'Listen';
                    this.activeSpeakingBtn = null;
                };

                window.speechSynthesis.speak(utterance);
            });
        }

        // Regenerate response
        const regenBtn = wrapper.querySelector('.regen-msg-btn');
        if (regenBtn) {
            regenBtn.addEventListener('click', () => {
                if (this.lastUserMessage) {
                    this.elements.messageInput.value = this.lastUserMessage;
                    this.handleSend();
                } else {
                    this.showToast('No recent prompt to regenerate', 'info');
                }
            });
        }

        // Edit message
        const editBtn = wrapper.querySelector('.edit-msg-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.elements.messageInput.value = text;
                this.autoResizeInput();
                this.updateCharCount();
                this.elements.messageInput.focus();
                this.showToast('Message loaded into input', 'info');
            });
        }
    }

    renderTypingIndicator() {
        if (this.isTyping) return;
        this.isTyping = true;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper bot typing-indicator-wrapper message-animate';
        wrapper.id = 'typing-indicator';
        
        wrapper.innerHTML = `
            <div class="message">
                <div class="message-avatar bot-avatar">
                    <img src="assets/bot-avatar.svg" class="bot-avatar-img" alt="Estrely">
                </div>
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        `;
        
        this.elements.chatMessages.appendChild(wrapper);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const el = document.getElementById('typing-indicator');
        if (el) {
            el.remove();
            this.isTyping = false;
        }
    }

    scrollToBottom(smooth = false) {
        const el = this.elements.chatMessages;
        if (smooth) {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        } else {
            el.scrollTop = el.scrollHeight;
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-dot"></span>
            <span>${window.markdownRenderer.escapeHtml(message)}</span>
        `;
        
        container.appendChild(toast);
        
        void toast.offsetWidth; // Trigger reflow
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 3200);
    }

    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}
