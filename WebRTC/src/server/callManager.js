const { v4: uuidv4 } = require('uuid');

class CallManager {
    constructor() {
        this.activeCalls = new Map();
    }
    
    generateCallId() {
        return `call_${uuidv4()}`;
    }
    
    handleStartCall(ws, callerData, data, signalingServer) {
        const targetId = data.target;
        const targetClient = signalingServer.getClientById(targetId);
        
        if (!targetClient) {
            signalingServer.sendError(ws, 'Target user not found');
            return;
        }
        
        if (targetClient.isInCall) {
            signalingServer.sendError(ws, 'Target user is already in a call');
            return;
        }
        
        if (callerData.isInCall) {
            signalingServer.sendError(ws, 'You are already in a call');
            return;
        }
        
        const callId = this.generateCallId();
        
        this.activeCalls.set(callId, {
            participants: [callerData.id, targetId],
            createdAt: new Date().toISOString(),
            status: 'pending'
        });
        
        callerData.isInCall = true;
        callerData.callId = callId;
        
        signalingServer.sendToClientById(targetId, {
            type: 'incoming-call',
            callId: callId,
            callerId: callerData.id,
            callerUsername: callerData.username,
            timestamp: new Date().toISOString(),
            videoEnabled: data.videoEnabled || false,
            audioEnabled: data.audioEnabled || false
        });
        
        signalingServer.sendToClient(ws, {
            type: 'call-initiated',
            callId: callId,
            targetId: targetId,
            targetUsername: targetClient.username,
            timestamp: new Date().toISOString()
        });
        
        return callId;
    }
    
    handleAcceptCall(ws, receiverData, data, signalingServer) {
        const callId = data.callId;
        const call = this.activeCalls.get(callId);
        
        if (!call) {
            signalingServer.sendError(ws, 'Call not found or expired');
            return;
        }
        
        const callerId = call.participants[0];
        const callerClient = signalingServer.getClientById(callerId);
        
        if (!callerClient) {
            signalingServer.sendError(ws, 'Caller not found');
            return;
        }
        
        receiverData.isInCall = true;
        receiverData.callId = callId;
        
        call.status = 'active';
        call.startedAt = new Date().toISOString();
        
        signalingServer.sendToClientById(callerId, {
            type: 'call-accepted',
            callId: callId,
            receiverId: receiverData.id,
            receiverUsername: receiverData.username,
            timestamp: new Date().toISOString()
        });
        
        signalingServer.sendToClient(ws, {
            type: 'call-started',
            callId: callId,
            callerId: callerId,
            callerUsername: callerClient.username,
            timestamp: new Date().toISOString()
        });
        
        signalingServer.sendToClientById(callerId, {
            type: 'call-started',
            callId: callId,
            callerId: callerId,
            callerUsername: callerClient.username,
            timestamp: new Date().toISOString()
        });
        
        return callId;
    }
    
    handleRejectCall(ws, receiverData, data, signalingServer) {
        const callId = data.callId;
        const call = this.activeCalls.get(callId);
        
        if (!call) return;
        
        const callerId = call.participants[0];
        
        this.activeCalls.delete(callId);
        
        const callerClient = signalingServer.getClientById(callerId);
        if (callerClient && callerClient.callId === callId) {
            callerClient.isInCall = false;
            callerClient.callId = null;
        }
        
        signalingServer.sendToClientById(callerId, {
            type: 'call-rejected',
            callId: callId,
            receiverId: receiverData.id,
            receiverUsername: receiverData.username,
            reason: data.reason || 'User rejected the call',
            timestamp: new Date().toISOString()
        });
    }
    
    handleEndCall(ws, clientData, data, signalingServer) {
        const callId = data.callId || clientData.callId;
        if (!callId) return;
        
        const call = this.activeCalls.get(callId);
        if (!call) return;
        
        const otherParticipantId = call.participants.find(id => id !== clientData.id);
        
        this.activeCalls.delete(callId);
        
        call.participants.forEach(participantId => {
            const participant = signalingServer.getClientById(participantId);
            if (participant) {
                participant.isInCall = false;
                participant.callId = null;
            }
        });
        
        if (otherParticipantId) {
            signalingServer.sendToClientById(otherParticipantId, {
                type: 'call-ended',
                callId: callId,
                reason: data.reason || 'call-ended-by-peer',
                endedBy: clientData.id,
                endedByUsername: clientData.username,
                timestamp: new Date().toISOString()
            });
        }
        
        signalingServer.sendToClient(ws, {
            type: 'call-ended',
            callId: callId,
            reason: data.reason || 'call-ended',
            timestamp: new Date().toISOString()
        });
        
        return callId;
    }
    
    handleUserDisconnected(userId, callId, signalingServer) {
        const call = this.activeCalls.get(callId);
        if (!call) return;
        
        const otherParticipantId = call.participants.find(id => id !== userId);
        
        this.activeCalls.delete(callId);
        
        if (otherParticipantId) {
            const disconnectedUser = signalingServer.getClientById(userId);
            signalingServer.sendToClientById(otherParticipantId, {
                type: 'call-ended',
                callId: callId,
                reason: 'peer-disconnected',
                endedBy: userId,
                endedByUsername: disconnectedUser?.username || 'Unknown',
                timestamp: new Date().toISOString()
            });
            
            const otherParticipant = signalingServer.getClientById(otherParticipantId);
            if (otherParticipant) {
                otherParticipant.isInCall = false;
                otherParticipant.callId = null;
            }
        }
    }
    
    getCall(callId) {
        return this.activeCalls.get(callId);
    }
}

module.exports = new CallManager();