let appInstance = null;

document.addEventListener('DOMContentLoaded', function() {
    appInstance = new App();
    window.app = appInstance;
    
    if (appInstance && typeof appInstance.initialize === 'function') {
        appInstance.initialize();
    }
});

class App {
    constructor() {
        this.webrtc = new WebRTCManager();
        this.chat = new ChatManager();
        this.ui = new UIManager(this.webrtc, this.chat);
        
        this.clientId = null;
        this.username = 'Uzytkownik';
        this.ws = null;
        this.isConnected = false;
    }
    
    initialize() {
        try {
            this.ui.initialize(this);
            this.webrtc.initialize(this.ui);
            this.chat.initialize(this.ui);
            
            this.setupEventListeners();
            this.connectWebSocket();
            
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        } catch (error) {
            this.ui.log('Blad inicjalizacji aplikacji: ' + error.message, 'error');
        }
    }
    
    setupEventListeners() {
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.ui.updateUI();
            }
        });
    }
    
    connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const wsUrl = wsProtocol + window.location.host;
        
        this.ui.log('Laczenie z WebSocket: ' + wsUrl, 'info');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            this.ui.setConnectionStatus(true);
            this.ui.log('Polaczono z serwerem', 'success');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                this.ui.log('Blad parsowania wiadomosci: ' + error, 'error');
            }
        };
        
        this.ws.onclose = (event) => {
            this.isConnected = false;
            this.ui.setConnectionStatus(false);
            this.ui.log('Rozlaczono z serwerem. Ponowne laczenie za 3s...', 'error');
            
            setTimeout(() => {
                this.connectWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            this.ui.log('Blad polaczenia WebSocket', 'error');
        };
    }
    
    handleWebSocketMessage(data) {
        switch(data.type) {
            case 'welcome':
                this.handleWelcome(data);
                break;
                
            case 'clients-list':
                this.ui.updateUsersList(data.clients);
                break;
                
            case 'client-joined':
                this.ui.addUserToList(data);
                break;
                
            case 'client-left':
                this.ui.removeUserFromList(data.clientId);
                if (this.webrtc.currentPeerId === data.clientId) {
                    this.webrtc.endCall('peer-disconnected');
                }
                break;
                
            case 'username-changed':
                this.ui.updateUsernameInList(data);
                break;
                
            case 'incoming-call':
                this.ui.showIncomingCallModal(data);
                break;
                
            case 'call-initiated':
                this.webrtc.currentCallId = data.callId;
                this.webrtc.handleCallInitiated(data);
                break;
                
            case 'call-accepted':
                this.webrtc.handleCallAccepted(data);
                break;
                
            case 'call-rejected':
                this.webrtc.handleCallRejected(data);
                this.webrtc.endCall('rejected');
                break;
                
            case 'call-started':
                this.webrtc.currentCallId = data.callId;
                this.webrtc.handleCallStarted(data);
                
                let peerId, peerUsername;
                
                if (data.callerId === this.clientId) {
                    peerId = this.webrtc.currentPeerId;
                    peerUsername = this.webrtc.currentPeerUsername;
                } else {
                    peerId = data.callerId;
                    peerUsername = data.callerUsername;
                }
                
                this.chat.enableChat(peerId, peerUsername);
                break;
                
            case 'call-ended':
                this.webrtc.handleCallEnded(data);
                this.chat.disableChat();
                break;
                
            case 'peer-video-toggled':
                this.ui.updatePeerVideoStatus(data);
                break;
                
            case 'peer-audio-toggled':
                this.ui.updatePeerAudioStatus(data);
                break;
                
            case 'chat-message':
                this.chat.handleIncomingMessage(data);
                break;
                
            case 'chat-message-sent':
                this.chat.handleMessageSent(data);
                break;
                
            case 'chat-history':
                this.chat.loadChatHistory(data.messages);
                break;
                
            case 'video-toggled':
                this.webrtc.handleVideoToggled(data);
                break;
                
            case 'audio-toggled':
                this.webrtc.handleAudioToggled(data);
                break;
                
            case 'username-updated':
                this.handleUsernameUpdated(data);
                break;
                
            case 'offer':
                this.webrtc.handleIncomingOffer(data);
                break;
                
            case 'answer':
                this.webrtc.handleIncomingAnswer(data);
                break;
                
            case 'ice-candidate':
                this.webrtc.handleIncomingIceCandidate(data);
                break;
                
            case 'error':
                this.ui.showNotification('Blad: ' + data.message);
                break;
                
            default:
                this.ui.log('Nieznany typ wiadomosci: ' + data.type, 'warning');
        }
    }
    
    handleWelcome(data) {
        this.clientId = data.id;
        this.username = data.username;
        
        this.ui.setUserInfo(this.clientId, this.username);
        this.ui.log('Witaj ' + this.username + '! ID: ' + this.clientId.substring(0, 12) + '...', 'success');
        
        this.sendWebSocketMessage('get-clients');
    }
    
    handleUsernameUpdated(data) {
        this.username = data.username;
        this.ui.setUserInfo(this.clientId, this.username);
        this.ui.log('Zaktualizowano nazwe na: ' + this.username, 'success');
    }
    
    sendWebSocketMessage(type, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data }));
            return true;
        } else {
            return false;
        }
    }
    
    startCall(userId, username) {
        this.webrtc.startCall(userId, username, this.sendWebSocketMessage.bind(this));
    }
    
    acceptCall(callData) {
        this.sendWebSocketMessage('accept-call', {
            callId: callData.callId
        });
        this.webrtc.acceptCall(callData);
    }
    
    rejectCall(callData) {
        this.sendWebSocketMessage('reject-call', {
            callId: callData.callId,
            reason: 'user-rejected'
        });
    }
    
    endCall() {
        if (this.webrtc.currentCallId) {
            this.sendWebSocketMessage('end-call', {
                callId: this.webrtc.currentCallId,
                reason: 'user-ended'
            });
            this.webrtc.endCall('user-ended');
        } else {
            this.webrtc.endCall('user-ended');
        }
    }
    
    toggleVideo(enabled) {
        this.webrtc.toggleVideo(enabled);
        this.sendWebSocketMessage('toggle-video', {
            enabled: enabled,
            callId: this.webrtc.currentCallId
        });
    }
    
    toggleAudio(enabled) {
        this.webrtc.toggleAudio(enabled);
        this.sendWebSocketMessage('toggle-audio', {
            enabled: enabled,
            callId: this.webrtc.currentCallId
        });
    }
    
    updateUsername(newUsername) {
        if (newUsername && newUsername !== this.username) {
            this.sendWebSocketMessage('update-username', {
                username: newUsername
            });
        }
    }
    
    sendChatMessage(message) {
        if (this.webrtc.currentCallId && message.trim()) {
            this.sendWebSocketMessage('chat-message', {
                callId: this.webrtc.currentCallId,
                message: message.trim(),
                messageType: 'text'
            });
            return true;
        }
        return false;
    }
    
    refreshUsersList() {
        this.sendWebSocketMessage('get-clients');
    }
    
    cleanup() {
        this.endCall();
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.webrtc.cleanup();
    }
}