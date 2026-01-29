const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const callManager = require('./callManager');
const chatManager = require('./chatManager');

class SignalingServer {
    constructor(wss) {
        this.wss = wss;
        this.clients = new Map();
        this.callManager = callManager;
        this.chatManager = chatManager;
        
        this.initialize();
    }
    
    initialize() {
        this.wss.on('connection', (ws, req) => {
            const clientId = uuidv4();
            const ip = req.socket.remoteAddress;
            
            const username = this.generateUniqueUsername();
            
            const clientData = {
                id: clientId,
                ip: ip,
                username: username,
                connectedAt: new Date().toISOString(),
                ws: ws,
                isInCall: false,
                callId: null,
                videoEnabled: false,
                audioEnabled: false,
                pendingCallData: null
            };
            
            this.clients.set(ws, clientData);
            
            this.sendToClient(ws, {
                type: 'welcome',
                id: clientId,
                username: username,
                timestamp: new Date().toISOString()
            });
            
            setTimeout(() => {
                this.sendClientsList(ws);
            }, 500);
            
            this.broadcastToOthers(ws, {
                type: 'client-joined',
                clientId: clientId,
                username: username,
                timestamp: new Date().toISOString()
            });
            
            ws.on('message', (message) => this.handleMessage(ws, message));
            
            ws.on('close', () => this.handleDisconnect(ws));
            
            ws.on('error', (error) => {});
        });
    }
    
    generateUniqueUsername() {
        const adjectives = ['Bystry', 'Szybki', 'Cichy', 'Wesoly', 'Madry', 'Dzielny', 'Sprytny', 'Szczesliwy'];
        const nouns = ['Tygrys', 'Orzel', 'Delfin', 'Feniks', 'Wilk', 'Jastrzab', 'Lew', 'Niedzwiedz'];
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 100);
        
        let username = `${adjective}${noun}${number}`;
        
        const usernames = Array.from(this.clients.values()).map(c => c.username);
        let counter = 1;
        while (usernames.includes(username)) {
            username = `${adjective}${noun}${number + counter}`;
            counter++;
        }
        
        return username;
    }
    
    handleMessage(ws, rawMessage) {
        try {
            const data = JSON.parse(rawMessage);
            const clientData = this.clients.get(ws);
            
            if (!clientData) return;
            
            data.sender = clientData.id;
            data.senderUsername = clientData.username;
            data.timestamp = new Date().toISOString();
            
            switch (data.type) {
                case 'ice-candidate':
                case 'offer':
                case 'answer':
                    if (data.target) {
                        this.sendToClientById(data.target, data);
                    }
                    break;
                    
                case 'start-call':
                    this.callManager.handleStartCall(ws, clientData, data, this);
                    break;
                    
                case 'accept-call':
                    this.callManager.handleAcceptCall(ws, clientData, data, this);
                    break;
                    
                case 'reject-call':
                    this.callManager.handleRejectCall(ws, clientData, data, this);
                    break;
                    
                case 'end-call':
                    this.callManager.handleEndCall(ws, clientData, data, this);
                    break;
                    
                case 'chat-message':
                    this.chatManager.handleChatMessage(ws, clientData, data, this);
                    break;
                    
                case 'get-chat-history':
                    this.chatManager.handleGetChatHistory(ws, clientData, data, this);
                    break;
                    
                case 'toggle-video':
                    this.handleToggleVideo(ws, clientData, data);
                    break;
                    
                case 'toggle-audio':
                    this.handleToggleAudio(ws, clientData, data);
                    break;
                    
                case 'get-clients':
                    this.sendClientsList(ws);
                    break;
                    
                case 'update-username':
                    this.handleUpdateUsername(ws, clientData, data);
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.sendError(ws, 'Invalid message format');
        }
    }
    
    handleToggleVideo(ws, clientData, data) {
        clientData.videoEnabled = data.enabled;
        
        if (clientData.isInCall && clientData.callId) {
            const call = this.callManager.getCall(clientData.callId);
            if (call) {
                const otherParticipant = call.participants.find(p => p !== clientData.id);
                if (otherParticipant) {
                    this.sendToClientById(otherParticipant, {
                        type: 'peer-video-toggled',
                        peerId: clientData.id,
                        enabled: data.enabled,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        this.sendToClient(ws, {
            type: 'video-toggled',
            enabled: data.enabled,
            timestamp: new Date().toISOString()
        });
    }
    
    handleToggleAudio(ws, clientData, data) {
        clientData.audioEnabled = data.enabled;
        
        if (clientData.isInCall && clientData.callId) {
            const call = this.callManager.getCall(clientData.callId);
            if (call) {
                const otherParticipant = call.participants.find(p => p !== clientData.id);
                if (otherParticipant) {
                    this.sendToClientById(otherParticipant, {
                        type: 'peer-audio-toggled',
                        peerId: clientData.id,
                        enabled: data.enabled,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        this.sendToClient(ws, {
            type: 'audio-toggled',
            enabled: data.enabled,
            timestamp: new Date().toISOString()
        });
    }
    
    handleUpdateUsername(ws, clientData, data) {
        const oldUsername = clientData.username;
        const newUsername = data.username?.trim();
        
        if (!newUsername || newUsername === oldUsername) {
            return;
        }
        
        const isUsernameTaken = Array.from(this.clients.values())
            .some(client => client.username === newUsername && client.id !== clientData.id);
        
        if (isUsernameTaken) {
            this.sendError(ws, 'Username already taken');
            return;
        }
        
        clientData.username = newUsername;
        
        this.broadcast({
            type: 'username-changed',
            clientId: clientData.id,
            oldUsername: oldUsername,
            newUsername: newUsername,
            timestamp: new Date().toISOString()
        });
        
        this.sendToClient(ws, {
            type: 'username-updated',
            username: newUsername,
            timestamp: new Date().toISOString()
        });
    }
    
    handleDisconnect(ws) {
        const clientData = this.clients.get(ws);
        if (!clientData) return;
        
        if (clientData.isInCall && clientData.callId) {
            this.callManager.handleUserDisconnected(clientData.id, clientData.callId, this);
        }
        
        this.clients.delete(ws);
        
        this.broadcast({
            type: 'client-left',
            clientId: clientData.id,
            username: clientData.username,
            timestamp: new Date().toISOString()
        });
    }
    
    sendClientsList(ws) {
        const clientData = this.clients.get(ws);
        if (!clientData) return;
        
        const clientsList = Array.from(this.clients.values())
            .filter(client => client.id !== clientData.id)
            .map(client => ({
                id: client.id,
                username: client.username,
                isInCall: client.isInCall,
                videoEnabled: client.videoEnabled,
                audioEnabled: client.audioEnabled
            }));
        
        this.sendToClient(ws, {
            type: 'clients-list',
            clients: clientsList,
            timestamp: new Date().toISOString()
        });
    }
    
    sendToClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending to client:', error);
            }
        }
    }
    
    sendToClientById(clientId, data) {
        for (const [ws, clientData] of this.clients.entries()) {
            if (clientData.id === clientId && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify(data));
                    return true;
                } catch (error) {
                    console.error('Error sending to client by ID:', error);
                    return false;
                }
            }
        }
        return false;
    }
    
    getClientById(clientId) {
        for (const clientData of this.clients.values()) {
            if (clientData.id === clientId) {
                return clientData;
            }
        }
        return null;
    }
    
    broadcast(data, excludeWs = null) {
        const message = JSON.stringify(data);
        this.clients.forEach((clientData, ws) => {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(message);
                } catch (error) {
                    console.error('Error broadcasting:', error);
                }
            }
        });
    }
    
    broadcastToOthers(excludeWs, data) {
        this.broadcast(data, excludeWs);
    }
    
    sendError(ws, message) {
        this.sendToClient(ws, {
            type: 'error',
            message: message,
            timestamp: new Date().toISOString()
        });
    }
    
    getAllClients() {
        return Array.from(this.clients.values());
    }
}

function initializeWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    const signalingServer = new SignalingServer(wss);
    return signalingServer;
}

module.exports = { initializeWebSocket, SignalingServer };