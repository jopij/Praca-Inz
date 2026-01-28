let appInstance = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting app...');
    
    appInstance = new App();
    window.app = appInstance;
});

class App {
    constructor() {
        console.log('App constructor called');
        

        this.webrtc = new WebRTCManager();
        this.chat = new ChatManager();
        this.ui = new UIManager(this.webrtc, this.chat);
        
        this.clientId = null;
        this.username = 'Uzytkownik';
        this.ws = null;
        this.isConnected = false;
        
        console.log('App initialized');
    }
    
    initialize() {
        console.log('App.initialize() called');
        

        this.ui.initialize(this);
        this.webrtc.initialize(this.ui);
        this.chat.initialize(this.ui);
        
        this.setupEventListeners();
        this.connectWebSocket();
        

        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        console.log('App fully initialized');
    }
    
    setupEventListeners() {
        console.log('Setting up event listeners');

        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('Page became visible, updating UI');
                this.ui.updateUI();
            }
        });
    }
    
    connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const wsUrl = wsProtocol + window.location.host;
        
        console.log('Connecting to WebSocket: ' + wsUrl);
        console.log('Current protocol: ' + window.location.protocol);
        
        this.ui.log('Laczenie z WebSocket: ' + wsUrl, 'info');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket CONNECTED successfully');
            this.isConnected = true;
            this.ui.setConnectionStatus(true);
            this.ui.log('Polaczono z serwerem', 'success');
            this.ui.showNotification('Polaczono z serwerem');
        };
        
        this.ws.onmessage = (event) => {
            console.log('WebSocket message received: ' + event.data.substring(0, 100));
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed message type: ' + data.type);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message: ' + error);
                this.ui.log('Blad parsowania wiadomosci: ' + error, 'error');
            }
        };
        
        this.ws.onclose = (event) => {
            console.log('WebSocket DISCONNECTED: ' + event.code + ' ' + event.reason);
            this.isConnected = false;
            this.ui.setConnectionStatus(false);
            this.ui.log('Rozlaczono z serwerem. Ponowne laczenie za 3s...', 'error');
            
            setTimeout(() => {
                console.log('Reconnecting WebSocket...');
                this.connectWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket ERROR');
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
                this.ui.showNotification('Nowy uzytkownik: ' + data.username);
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
                break;
                
            case 'call-started':
                this.webrtc.handleCallStarted(data);
                this.chat.enableChat(data.callerId, data.callerUsername);
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
                console.log('Otrzymano ofertę WebRTC');
                this.webrtc.handleIncomingOffer(data);
                break;
                
            case 'answer':
                console.log('Otrzymano odpowiedź WebRTC');
                this.webrtc.handleIncomingAnswer(data);
                break;
                
            case 'ice-candidate':
                console.log('Otrzymano kandydata ICE');
                this.webrtc.handleIncomingIceCandidate(data);
                break;
                
            case 'error':
                this.ui.showNotification('Blad: ' + data.message);
                break;
            
            case 'users-in-call':
                console.log('Users in call updated');
                break;
    
            case 'users-available':
                console.log('Users available updated');
                break;

            default:
                console.log('Unknown message type: ' + data.type);
                this.ui.log('Nieznany typ wiadomosci: ' + data.type, 'warning');
        }
    }
    
    handleWelcome(data) {
        this.clientId = data.id;
        this.username = data.username;
        
        this.ui.setUserInfo(this.clientId, this.username);
        this.ui.log('Witaj ' + this.username + '! ID: ' + this.clientId.substring(0, 12) + '...', 'success');
        
        // Request users list
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
            console.log('Sent ' + type + ' message');
            return true;
        } else {
            console.log('Cannot send ' + type + ' - WebSocket not ready: ' + (this.ws ? this.ws.readyState : 'no ws'));
            return false;
        }
    }
    
    // Public methods for UI
    startCall(userId, username) {
        console.log('Starting call with ' + username + ' (' + userId + ')');
        this.webrtc.startCall(userId, username, this.sendWebSocketMessage.bind(this));
    }
    
    acceptCall(callData) {
        console.log('Accepting call from ' + callData.callerUsername);
        this.sendWebSocketMessage('accept-call', {
            callId: callData.callId
        });
        this.webrtc.acceptCall(callData);
    }
    
    rejectCall(callData) {
        console.log('Rejecting call from ' + callData.callerUsername);
        this.sendWebSocketMessage('reject-call', {
            callId: callData.callId,
            reason: 'user-rejected'
        });
    }
    
    endCall() {
        if (this.webrtc.currentCallId) {
            console.log('Ending current call');
            this.sendWebSocketMessage('end-call', {
                callId: this.webrtc.currentCallId,
                reason: 'user-ended'
            });
            this.webrtc.endCall('user-ended');
        }
    }
    
    toggleVideo(enabled) {
        console.log('Toggling video: ' + (enabled ? 'ON' : 'OFF'));
        this.webrtc.toggleVideo(enabled);
        this.sendWebSocketMessage('toggle-video', {
            enabled: enabled,
            callId: this.webrtc.currentCallId
        });
    }
    
    toggleAudio(enabled) {
        console.log('Toggling audio: ' + (enabled ? 'ON' : 'OFF'));
        this.webrtc.toggleAudio(enabled);
        this.sendWebSocketMessage('toggle-audio', {
            enabled: enabled,
            callId: this.webrtc.currentCallId
        });
    }
    
    updateUsername(newUsername) {
        if (newUsername && newUsername !== this.username) {
            console.log('Updating username to: ' + newUsername);
            this.sendWebSocketMessage('update-username', {
                username: newUsername
            });
        }
    }
    
    sendChatMessage(message) {
        if (this.webrtc.currentCallId && message.trim()) {
            console.log('Sending chat message: ' + message.substring(0, 50) + '...');
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
        console.log('Refreshing users list');
        this.sendWebSocketMessage('get-clients');
    }
    
    cleanup() {
        console.log('Cleaning up...');
        // End current call
        this.endCall();
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }
        
        // Stop media streams
        this.webrtc.cleanup();
    }
}