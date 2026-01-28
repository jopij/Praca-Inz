class UIManager {
    constructor(webrtc, chat) {
        console.log(' UIManager created');
        
        this.webrtc = webrtc;
        this.chat = chat;
        this.app = null; 
        
        this.clientId = null;
        this.username = 'Użytkownik';
        
        this.elements = {};
    }
    
    initialize(app) {
        console.log(' UIManager.initialize() called');
        this.app = app; 
        this.initializeElements();
        this.setupEventListeners();
        this.initializeTabs();
        this.updateUI();
        
        this.log('UI zainicjalizowane', 'success');
    }
    
    initializeElements() {
        console.log(' Initializing UI elements');
        this.elements.clientId = document.getElementById('clientId');
        this.elements.usernameDisplay = document.getElementById('usernameDisplay');
        this.elements.connectionStatus = document.getElementById('connectionStatus');
        
        this.elements.localVideo = document.getElementById('localVideo');
        this.elements.remoteVideo = document.getElementById('remoteVideo');
        this.elements.localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        this.elements.remoteVideoPlaceholder = document.getElementById('remoteVideoPlaceholder');
        this.elements.videoStatusBadge = document.getElementById('videoStatusBadge');
        this.elements.audioStatusBadge = document.getElementById('audioStatusBadge');
        this.elements.remoteStatusBadge = document.getElementById('remoteStatusBadge');
        
        this.elements.startVideoBtn = document.getElementById('startVideoBtn');
        this.elements.stopVideoBtn = document.getElementById('stopVideoBtn');
        this.elements.toggleAudioBtn = document.getElementById('toggleAudioBtn');
        this.elements.toggleRemoteAudioBtn = document.getElementById('toggleRemoteAudioBtn');
        this.elements.callBtn = document.getElementById('callBtn');
        this.elements.hangupBtn = document.getElementById('hangupBtn');
        this.elements.refreshUsersBtn = document.getElementById('refreshUsersBtn');
        
        this.elements.iceState = document.getElementById('iceState');
        this.elements.signalingState = document.getElementById('signalingState');
        this.elements.callIdDisplay = document.getElementById('callIdDisplay');
        this.elements.connectedTo = document.getElementById('connectedTo');
        
        this.elements.usersList = document.getElementById('usersList');
        this.elements.userCount = document.getElementById('userCount');
        
        this.elements.chatMessages = document.getElementById('chatMessages');
        this.elements.chatWith = document.getElementById('chatWith');
        this.elements.chatStatus = document.getElementById('chatStatus');
        this.elements.chatInputContainer = document.getElementById('chatInputContainer');
        this.elements.chatInput = document.getElementById('chatInput');
        this.elements.sendMessageBtn = document.getElementById('sendMessageBtn');
        
        this.elements.usernameInput = document.getElementById('usernameInput');
        this.elements.updateUsernameBtn = document.getElementById('updateUsernameBtn');
        this.elements.autoAnswerCalls = document.getElementById('autoAnswerCalls');
        this.elements.enableSounds = document.getElementById('enableSounds');
        this.elements.clearLogBtn = document.getElementById('clearLogBtn');
        this.elements.testConnectionBtn = document.getElementById('testConnectionBtn');
        
        this.elements.logContent = document.getElementById('logContent');
        this.elements.toggleLogBtn = document.getElementById('toggleLogBtn');
        this.elements.logPanel = document.getElementById('logPanel');
        
        this.elements.incomingCallModal = document.getElementById('incomingCallModal');
        this.elements.callerName = document.getElementById('callerName');
        this.elements.callerId = document.getElementById('callerId');
        this.elements.callVideoStatus = document.getElementById('callVideoStatus');
        this.elements.callAudioStatus = document.getElementById('callAudioStatus');
        this.elements.acceptCallBtn = document.getElementById('acceptCallBtn');
        this.elements.rejectCallBtn = document.getElementById('rejectCallBtn');
        
        this.elements.notificationSound = document.getElementById('notificationSound');
        
        // Dodane do przechowywania tymczasowych danych
        this.elements.currentCallId = null;
        this.elements.currentCallerId = null;
    }
    
    setupEventListeners() {
        this.elements.startVideoBtn.addEventListener('click', () => {
            if (!this.webrtc.localStream) {
                this.webrtc.startMedia().then(success => {
                    if (success) {
                        this.elements.startVideoBtn.disabled = true;
                        this.elements.stopVideoBtn.disabled = false;
                        this.elements.callBtn.disabled = false;
                        this.elements.toggleAudioBtn.disabled = false;
                    }
                });
            } else {
                this.webrtc.toggleVideo(true);
                this.elements.startVideoBtn.disabled = true;
                this.elements.stopVideoBtn.disabled = false;
            }
        });
        
        this.elements.stopVideoBtn.addEventListener('click', () => {
            this.webrtc.toggleVideo(false);
            this.elements.startVideoBtn.disabled = false;
            this.elements.stopVideoBtn.disabled = true;
        });
        
        this.elements.toggleAudioBtn.addEventListener('click', () => {
            const enabled = !this.webrtc.isAudioEnabled;
            this.webrtc.toggleAudio(enabled);
            this.updateAudioBtnText(enabled);
        });
        
        this.elements.toggleRemoteAudioBtn.addEventListener('click', () => {
            const enabled = !this.webrtc.isRemoteAudioEnabled;
            this.webrtc.toggleRemoteAudio(enabled);
            this.updateRemoteAudioBtnText(enabled);
        });
        
        this.elements.callBtn.addEventListener('click', () => {
            const selectedUser = this.getSelectedUser();
            if (selectedUser) {
                this.app.startCall(selectedUser.id, selectedUser.username);
            } else {
                this.showNotification('Wybierz użytkownika z listy');
            }
        });
        
        this.elements.hangupBtn.addEventListener('click', () => {
            this.app.endCall();
        });
        
        this.elements.refreshUsersBtn.addEventListener('click', () => {
            this.app.refreshUsersList();
        });
        
        this.elements.sendMessageBtn.addEventListener('click', () => {
            this.sendChatMessage();
        });
        
        this.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        this.elements.updateUsernameBtn.addEventListener('click', () => {
            const newUsername = this.elements.usernameInput.value.trim();
            if (newUsername) {
                this.app.updateUsername(newUsername);
            }
        });
        
        this.elements.clearLogBtn.addEventListener('click', () => {
            this.clearLog();
        });
        
        this.elements.testConnectionBtn.addEventListener('click', () => {
            this.testConnection();
        });
        
        this.elements.toggleLogBtn.addEventListener('click', () => {
            this.toggleLogPanel();
        });
        
        this.elements.acceptCallBtn.addEventListener('click', () => {
            this.acceptIncomingCall();
        });
        
        this.elements.rejectCallBtn.addEventListener('click', () => {
            this.rejectIncomingCall();
        });
        
        this.elements.incomingCallModal.addEventListener('click', (e) => {
            if (e.target === this.elements.incomingCallModal) {
                this.hideIncomingCallModal();
            }
        });
    }
    
    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                tabPanes.forEach(pane => pane.classList.remove('active'));
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
    }
    
    setUserInfo(clientId, username) {
        this.clientId = clientId;
        this.username = username;
        
        this.elements.clientId.textContent = `${clientId.substring(0, 12)}...`;
        this.elements.usernameDisplay.textContent = username;
        this.elements.usernameInput.value = username;
    }
    
    getClientId() {
        return this.clientId;
    }
    
    getUsername() {
        return this.username;
    }
    
    setConnectionStatus(connected) {
        const indicator = this.elements.connectionStatus;
        indicator.classList.toggle('connected', connected);
        indicator.title = connected ? 'Połączony' : 'Rozłączony';
    }
    
    setLocalVideoStream(stream) {
        this.elements.localVideo.srcObject = stream;
        this.elements.localVideoPlaceholder.style.display = stream ? 'none' : 'flex';
    }
    
    setRemoteVideoStream(stream) {
        this.elements.remoteVideo.srcObject = stream;
        this.elements.remoteVideoPlaceholder.style.display = stream ? 'none' : 'flex';
    }
    
    showRemoteVideo() {
        this.elements.remoteVideoPlaceholder.style.display = 'none';
    }
    
    updateMediaStatus(videoEnabled, audioEnabled) {
        this.updateVideoStatus(videoEnabled);
        this.updateAudioStatus(audioEnabled);
        
        // Aktualizuj przyciski
        if (videoEnabled) {
            this.elements.startVideoBtn.disabled = true;
            this.elements.stopVideoBtn.disabled = false;
        } else {
            this.elements.startVideoBtn.disabled = false;
            this.elements.stopVideoBtn.disabled = true;
        }
        
        this.updateAudioBtnText(audioEnabled);
    }
    
    updateVideoStatus(enabled) {
        const badge = this.elements.videoStatusBadge;
        badge.innerHTML = enabled ? 
            '<i class="fas fa-video"></i> Włączona' : 
            '<i class="fas fa-video-slash"></i> Wyłączona';
        badge.classList.toggle('active', enabled);
    }
    
    updateAudioStatus(enabled) {
        const badge = this.elements.audioStatusBadge;
        badge.innerHTML = enabled ? 
            '<i class="fas fa-microphone"></i> Włączony' : 
            '<i class="fas fa-microphone-slash"></i> Wyłączony';
        badge.classList.toggle('active', enabled);
    }
    
    updateAudioBtnText(enabled) {
        this.elements.toggleAudioBtn.innerHTML = enabled ? 
            '<i class="fas fa-microphone-slash"></i> Wyłącz mikrofon' : 
            '<i class="fas fa-microphone"></i> Włącz mikrofon';
    }
    
    updateRemoteAudioBtnText(enabled) {
        this.elements.toggleRemoteAudioBtn.innerHTML = enabled ? 
            '<i class="fas fa-volume-mute"></i> Wyłącz dźwięk' : 
            '<i class="fas fa-volume-up"></i> Włącz dźwięk';
    }
    
    enableMediaControls(enabled) {
        this.elements.toggleAudioBtn.disabled = !enabled;
        this.updateAudioBtnText(this.webrtc.isAudioEnabled);
    }
    
    enableRemoteAudioControl(enabled) {
        this.elements.toggleRemoteAudioBtn.disabled = !enabled;
        this.updateRemoteAudioBtnText(this.webrtc.isRemoteAudioEnabled);
    }
    
    updateUsersList(users) {
        const container = this.elements.usersList;
        
        if (!users || users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h4>Brak innych użytkowników</h4>
                    <p>Otwórz kolejną zakładkę/przeglądarkę</p>
                </div>
            `;
            this.elements.userCount.textContent = '0';
            this.elements.callBtn.disabled = true;
            return;
        }
        
        let html = '';
        users.forEach(user => {
            html += `
                <div class="user-item ${user.isInCall ? 'in-call' : ''}" data-user-id="${user.id}">
                    <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-name">${user.username}</div>
                        <div class="user-status">
                            <span class="status-dot ${user.isInCall ? 'in-call' : 'available'}"></span>
                            ${user.isInCall ? 'W rozmowie' : 'Dostępny'}
                        </div>
                    </div>
                    ${!user.isInCall ? `
                        <button class="btn btn-primary call-user-btn" data-user-id="${user.id}">
                            <i class="fas fa-phone"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
        this.elements.userCount.textContent = users.length;
        
        container.querySelectorAll('.call-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.getAttribute('data-user-id');
                const userItem = btn.closest('.user-item');
                const userName = userItem.querySelector('.user-name').textContent;
                this.app.startCall(userId, userName);
            });
        });
        
        container.querySelectorAll('.user-item:not(.in-call)').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.user-item').forEach(i => {
                    i.classList.remove('selected');
                });
                
                item.classList.add('selected');
                
                this.elements.callBtn.disabled = false;
            });
        });

        this.elements.callBtn.disabled = this.webrtc.localStream ? false : true;
    }
    
    getSelectedUser() {
        const selectedItem = this.elements.usersList.querySelector('.user-item.selected');
        if (selectedItem) {
            const userId = selectedItem.getAttribute('data-user-id');
            const userName = selectedItem.querySelector('.user-name').textContent;
            return { id: userId, username: userName };
        }
        return null;
    }
    
    addUserToList(userData) {
        this.log(`Nowy użytkownik: ${userData.username}`, 'info');
        this.app.refreshUsersList();
    }
    
    removeUserFromList(userId) {
        const userItem = this.elements.usersList.querySelector(`[data-user-id="${userId}"]`);
        if (userItem) {
            userItem.remove();
            const userCount = this.elements.usersList.querySelectorAll('.user-item').length;
            this.elements.userCount.textContent = userCount;
        }
    }
    
    updateUsernameInList(data) {
        const userItem = this.elements.usersList.querySelector(`[data-user-id="${data.clientId}"]`);
        if (userItem) {
            userItem.querySelector('.user-name').textContent = data.newUsername;
            userItem.querySelector('.user-avatar').textContent = data.newUsername.charAt(0).toUpperCase();
        }
    }

    enableChat(peerUsername) {
        this.elements.chatWith.textContent = `Czat z ${peerUsername}`;
        this.elements.chatStatus.textContent = 'W rozmowie';
        this.elements.chatInputContainer.style.display = 'flex';
        this.elements.chatInput.focus();

        document.querySelector('[data-tab="chat"]').click();
    }
    
    disableChat() {
        this.elements.chatWith.textContent = 'Czat';
        this.elements.chatStatus.textContent = 'Nie jesteś w rozmowie';
        this.elements.chatInputContainer.style.display = 'none';
        this.clearChatMessages();
    }
    
    addChatMessage(messageData, isSentByMe) {
        const time = new Date(messageData.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSentByMe ? 'sent' : 'received'}`;
        messageElement.innerHTML = `
            ${!isSentByMe ? `<div class="message-sender">${messageData.senderUsername}</div>` : ''}
            <div class="message-bubble">${this.escapeHtml(messageData.message)}</div>
            <div class="message-time">${time}</div>
        `;
        
        this.elements.chatMessages.appendChild(messageElement);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
    
    clearChatMessages() {
        this.elements.chatMessages.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <h4>Rozpocznij rozmowę</h4>
                <p>Wiadomości czatu są tymczasowe</p>
            </div>
        `;
    }
    
    sendChatMessage() {
        const message = this.elements.chatInput.value.trim();
        if (message) {
            if (this.app.sendChatMessage(message)) {
                this.elements.chatInput.value = '';
            }
        }
    }
    
    updateIceState(state) {
        this.elements.iceState.textContent = state;
    }
    
    updateSignalingState(state) {
        this.elements.signalingState.textContent = state;
    }
    
    updateCallId(callId) {
        this.elements.callIdDisplay.textContent = callId ? 
            `${callId.substring(0, 12)}...` : '-';
    }
    
    updateConnectedTo(username) {
        this.elements.connectedTo.textContent = username || '-';
    }
    
    resetConnectionInfo() {
        this.updateIceState('-');
        this.updateSignalingState('-');
        this.updateCallId(null);
        this.updateConnectedTo(null);
    }
    
    updateCallUI(inCall) {
        this.elements.hangupBtn.disabled = !inCall;
        this.elements.callBtn.disabled = inCall || !this.webrtc.localStream;
        this.elements.toggleRemoteAudioBtn.disabled = !inCall;
        
        if (inCall) {
            this.elements.remoteStatusBadge.innerHTML = '<i class="fas fa-user-check"></i> Połączony';
            this.elements.remoteStatusBadge.classList.add('active');
        } else {
            this.elements.remoteStatusBadge.innerHTML = '<i class="fas fa-user-clock"></i> Oczekiwanie';
            this.elements.remoteStatusBadge.classList.remove('active');
        }
    }
    
    updatePeerVideoStatus(data) {
        this.log(`${data.enabled ? 'Rozmówca włączył' : 'Rozmówca wyłączył'} kamerę`, 'info');
    }
    
    updatePeerAudioStatus(data) {
        this.log(`${data.enabled ? 'Rozmówca włączył' : 'Rozmówca wyłączył'} mikrofon`, 'info');
    }
    
    showIncomingCallModal(callData) {
        this.elements.callerName.textContent = callData.callerUsername;
        this.elements.callerId.textContent = `ID: ${callData.callerId.substring(0, 12)}...`;
        this.elements.callVideoStatus.textContent = `Kamera: ${callData.videoEnabled ? 'Włączona' : 'Wyłączona'}`;
        this.elements.callAudioStatus.textContent = `Mikrofon: ${callData.audioEnabled ? 'Włączony' : 'Wyłączony'}`;
        
        // ZAPISZ callId DO PÓŹNIEJSZEGO UŻYCIA
        this.elements.currentCallId = callData.callId;
        this.elements.currentCallerId = callData.callerId;
        
        this.elements.incomingCallModal.style.display = 'flex';
        
        if (this.elements.enableSounds.checked) {
            this.elements.notificationSound.currentTime = 0;
            this.elements.notificationSound.play().catch(() => {
            });
        }
        
        if (this.elements.autoAnswerCalls.checked) {
            setTimeout(() => {
                this.acceptIncomingCall();
            }, 2000);
        }
    }
    
    hideIncomingCallModal() {
        this.elements.incomingCallModal.style.display = 'none';
    }
    
    acceptIncomingCall() {
        const callData = {
            callId: this.elements.currentCallId,
            callerId: this.elements.currentCallerId,
            callerUsername: this.elements.callerName.textContent
        };
        
        this.app.acceptCall(callData);
        this.hideIncomingCallModal();
    }
    
    rejectIncomingCall() {
        const callData = {
            callId: this.elements.currentCallId,
            callerId: this.elements.currentCallerId,
            callerUsername: this.elements.callerName.textContent
        };
        
        this.app.rejectCall(callData);
        this.hideIncomingCallModal();
    }
    
    log(message, type = 'info') {
        const time = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-message log-${type}">${this.escapeHtml(message)}</span>
        `;
        
        this.elements.logContent.appendChild(entry);
        this.elements.logContent.scrollTop = this.elements.logContent.scrollHeight;
        
        const consoleMethod = type === 'error' ? 'error' : 
                             type === 'warning' ? 'warn' : 'log';
        console[consoleMethod](`[${type.toUpperCase()}] ${message}`);
    }
    
    clearLog() {
        this.elements.logContent.innerHTML = `
            <div class="log-entry">
                <span class="log-time">[System]</span>
                <span class="log-info">Log wyczyszczony</span>
            </div>
        `;
        this.log('Log wyczyszczony', 'info');
    }
    
    toggleLogPanel() {
        const isVisible = this.elements.logContent.style.display !== 'none';
        this.elements.logContent.style.display = isVisible ? 'none' : 'block';
        this.elements.toggleLogBtn.innerHTML = isVisible ? 
            '<i class="fas fa-chevron-down"></i>' : 
            '<i class="fas fa-chevron-up"></i>';
    }
    
    showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 350px;
            border-left: 4px solid var(--primary-color);
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
        
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    testConnection() {
        if (navigator.onLine) {
            this.showNotification('Połączenie internetowe: OK');
            this.log('Test połączenia: OK', 'success');
        } else {
            this.showNotification('Brak połączenia internetowego');
            this.log('Test połączenia: FAILED', 'error');
        }
    }
    
    updateUI() {
        if (document.visibilityState === 'visible') {
            if (this.app && this.app.refreshUsersList) {
                this.app.refreshUsersList();
            }
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}