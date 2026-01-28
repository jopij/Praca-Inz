class ChatManager {
    constructor() {
        this.chatMessages = new Map(); // callId -> messages[]
    }
    
    handleChatMessage(ws, clientData, data, signalingServer) {
        const callId = data.callId || clientData.callId;
        if (!callId) {
            signalingServer.sendError(ws, 'Not in a call');
            return;
        }
        
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const chatMessage = {
            id: messageId,
            senderId: clientData.id,
            senderUsername: clientData.username,
            message: data.message,
            timestamp: new Date().toISOString(),
            type: data.messageType || 'text'
        };
        
        if (!this.chatMessages.has(callId)) {
            this.chatMessages.set(callId, []);
        }
        this.chatMessages.get(callId).push(chatMessage);
        
        const clients = signalingServer.getAllClients();
        clients.forEach(participant => {
            if (participant.callId === callId && participant.id !== clientData.id) {
                signalingServer.sendToClientById(participant.id, {
                    type: 'chat-message',
                    callId: callId,
                    message: chatMessage,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        signalingServer.sendToClient(ws, {
            type: 'chat-message-sent',
            callId: callId,
            message: chatMessage,
            timestamp: new Date().toISOString()
        });
        
        console.log(`💬 Call ${callId}: ${clientData.username}: ${data.message.substring(0, 50)}...`);
    }
    
    handleGetChatHistory(ws, clientData, data, signalingServer) {
        const callId = data.callId;
        const messages = this.chatMessages.get(callId) || [];
        
        signalingServer.sendToClient(ws, {
            type: 'chat-history',
            callId: callId,
            messages: messages,
            timestamp: new Date().toISOString()
        });
    }
    
    cleanupCallMessages(callId) {
        this.chatMessages.delete(callId);
    }
}

module.exports = new ChatManager();