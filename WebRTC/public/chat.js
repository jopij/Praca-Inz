class ChatManager {
    constructor() {
        this.messages = [];
        this.currentCallId = null;
        this.peerUsername = 'Rozmówca';
        this.ui = null;
    }
    
    initialize(ui) {
        this.ui = ui;
    }
    
    enableChat(peerId, peerUsername) {
        this.currentCallId = peerId;
        this.peerUsername = peerUsername;
        
        this.ui.enableChat(peerUsername);
        this.messages = [];
        this.ui.clearChatMessages();
        
        this.ui.log(`Czat włączony z ${peerUsername}`, 'success');
    }
    
    disableChat() {
        this.currentCallId = null;
        this.peerUsername = 'Rozmówca';
        this.messages = [];
        
        this.ui.disableChat();
        this.ui.log('Czat wyłączony', 'info');
    }
    
    handleIncomingMessage(data) {
        const message = data.message;
        this.addMessage(message, false);
        
        if (document.visibilityState === 'hidden') {
            this.ui.showNotification(`${message.senderUsername}: ${message.message}`);
        }
    }
    
    handleMessageSent(data) {
        const message = data.message;
        this.addMessage(message, true);
    }
    
    addMessage(messageData, isSentByMe) {
        if (this.messages.some(msg => msg.id === messageData.id)) {
            return;
        }
        
        this.messages.push({
            ...messageData,
            isSentByMe: isSentByMe
        });
        
        this.ui.addChatMessage(messageData, isSentByMe);
    }
    
    loadChatHistory(messages) {
        this.messages = messages.map(msg => ({
            ...msg,
            isSentByMe: msg.senderId === this.ui.getClientId()
        }));
        
        this.ui.clearChatMessages();
        this.messages.forEach(msg => {
            this.ui.addChatMessage(msg, msg.isSentByMe);
        });
        
        this.ui.log(`Załadano historię czatu (${messages.length} wiadomości)`, 'success');
    }
    
    sendMessage(messageText) {
        if (!this.currentCallId || !messageText.trim()) {
            return false;
        }
        
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            message: messageText.trim(),
            timestamp: new Date().toISOString(),
            type: 'text'
        };
        
        this.ui.addChatMessage({
            ...message,
            senderUsername: this.ui.getUsername(),
            senderId: this.ui.getClientId()
        }, true);
        
        return message;
    }
    
    getMessages() {
        return this.messages;
    }
    
    clearMessages() {
        this.messages = [];
        this.ui.clearChatMessages();
    }
}
