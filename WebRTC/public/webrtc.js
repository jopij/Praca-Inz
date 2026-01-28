class WebRTCManager {
    constructor() {
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        this.localStream = null;
        this.remoteStream = new MediaStream();
        this.peerConnection = null;
        this.dataChannel = null;
        
        this.isVideoEnabled = false;
        this.isAudioEnabled = false;
        this.isRemoteAudioEnabled = true;
        
        this.currentCallId = null;
        this.currentPeerId = null;
        this.currentPeerUsername = 'Rozmówca';
        
        this.ui = null;
        this.sendWsMessage = null;
    }
    
    initialize(ui) {
        this.ui = ui;
    }
    
    async startMedia() {
        try {
            this.ui.log('Żądanie dostępu do kamery i mikrofonu...', 'info');
            
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = false;
                this.isVideoEnabled = false;
            }
            
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = false;
                this.isAudioEnabled = false;
            }
            
            this.ui.setLocalVideoStream(this.localStream);
            this.ui.updateMediaStatus(this.isVideoEnabled, this.isAudioEnabled);
            this.ui.enableMediaControls(true);
            
            this.ui.log('Kamera i mikrofon gotowe (domyślnie wyłączone)', 'success');
            this.ui.showNotification('Media gotowe. Kliknij aby włączyć.');
            
            return true;
        } catch (error) {
            this.ui.log(`Błąd dostępu do mediów: ${error.message}`, 'error');
            this.ui.showNotification('Błąd dostępu do kamery/mikrofonu');
            return false;
        }
    }
    
    stopMedia() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
            this.ui.setLocalVideoStream(null);
            this.ui.enableMediaControls(false);
            this.isVideoEnabled = false;
            this.isAudioEnabled = false;
            this.ui.updateMediaStatus(false, false);
            
            this.ui.log('Kamera i mikrofon wyłączone', 'info');
        }
    }
    
    toggleVideo(enabled) {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoEnabled = enabled;
            videoTrack.enabled = enabled;
            this.ui.updateMediaStatus(enabled, this.isAudioEnabled);
            this.ui.log(`Kamera ${enabled ? 'włączona' : 'wyłączona'}`, 'info');
        }
    }
    
    toggleAudio(enabled) {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isAudioEnabled = enabled;
            audioTrack.enabled = enabled;
            this.ui.updateMediaStatus(this.isVideoEnabled, enabled);
            this.ui.log(`Mikrofon ${enabled ? 'włączony' : 'wyłączony'}`, 'info');
        }
    }
    
    toggleRemoteAudio(enabled) {
        this.isRemoteAudioEnabled = enabled;
        
        if (this.remoteStream) {
            this.remoteStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
        
        this.ui.log(`Dźwięk rozmówcy ${enabled ? 'włączony' : 'wyłączony'}`, 'info');
    }

    async startCall(targetId, targetUsername, sendWsMessage) {
    this.currentPeerId = targetId;
    this.currentPeerUsername = targetUsername;
    this.sendWsMessage = sendWsMessage;
    
    try {
        this.peerConnection = this.createPeerConnection(targetId);
        
        const offer = await this.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        
        await this.peerConnection.setLocalDescription(offer);
        
        sendWsMessage('start-call', {
            target: targetId,
            videoEnabled: this.isVideoEnabled,
            audioEnabled: this.isAudioEnabled
        });
        
        sendWsMessage('offer', {
            target: targetId,
            sdp: offer.sdp,
            callId: this.currentCallId 
        });
        
        this.ui.updateConnectedTo(targetUsername);
        this.ui.updateCallUI(true);
        this.ui.log(`Rozpoczęto połączenie z ${targetUsername}`, 'success');
        
        return true;
    } catch (error) {
        this.ui.log(`Błąd rozpoczęcia połączenia: ${error.message}`, 'error');
        this.endCall('call-failed');
        return false;
    }
}
    
    createPeerConnection(targetId) {
        const pc = new RTCPeerConnection(this.config);
        
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            this.ui.updateIceState(state);
            
            if (state === 'connected' || state === 'completed') {
                this.ui.log('Połączenie P2P nawiązane!', 'success');
                this.ui.showNotification('Połączenie P2P nawiązane');
                this.ui.showRemoteVideo();
            } else if (state === 'disconnected' || state === 'failed') {
                this.ui.log(`Połączenie P2P ${state}`, 'error');
                if (state === 'failed') {
                    this.endCall('ice-failed');
                }
            }
        };
        
        pc.onicecandidate = (event) => {
            if (event.candidate && this.sendWsMessage && this.currentCallId) {
                this.sendWsMessage('ice-candidate', {
                    target: targetId,
                    candidate: event.candidate,
                    callId: this.currentCallId
                });
            }
        };
        
        pc.onsignalingstatechange = () => {
            this.ui.updateSignalingState(pc.signalingState);
        };
        
        pc.ontrack = (event) => {
            this.ui.log('Otrzymano zdalny strumień multimedialny', 'success');
            this.remoteStream = event.streams[0];
            this.ui.setRemoteVideoStream(this.remoteStream);
            this.ui.enableRemoteAudioControl(true);
            
            this.toggleRemoteAudio(true);
        };
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }
        
        this.dataChannel = pc.createDataChannel('chat');
        this.setupDataChannel();
        
        return pc;
    }
    
    setupDataChannel() {
        if (!this.dataChannel) return;
        
        this.dataChannel.onopen = () => {
            this.ui.log('Kanał danych otwarty', 'success');
        };
        
        this.dataChannel.onmessage = (event) => {
            this.ui.log(`Wiadomość danych: ${event.data}`, 'info');
        };
        
        this.dataChannel.onclose = () => {
            this.ui.log('Kanał danych zamknięty', 'info');
        };
    }
    
    async handleIncomingOffer(data) {
    try {
        // callId powinien przyjść z serwera w incoming-call
        // Jeśli nie ma, użyj tymczasowego
        this.currentCallId = data.callId || `temp_${data.sender}`;
        this.currentPeerId = data.sender;
        this.currentPeerUsername = data.senderUsername || 'Rozmówca';
        
        this.peerConnection = this.createPeerConnection(data.sender);
        
        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: 'offer', sdp: data.sdp })
        );
        
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        if (this.sendWsMessage) {
            this.sendWsMessage('answer', {
                target: data.sender,
                sdp: answer.sdp,
                callId: this.currentCallId
            });
        }
        
        this.ui.updateCallId(this.currentCallId);
        this.ui.updateConnectedTo(this.currentPeerUsername);
        this.ui.updateCallUI(true);
        this.ui.log(`Odebrano ofertę od ${this.currentPeerUsername}`, 'success');
        
        return true;
        } catch (error) {
            this.ui.log(`Błąd obsługi oferty: ${error.message}`, 'error');
            this.endCall('offer-failed');
            return false;
        }
    }
    
    async handleIncomingAnswer(data) {
        if (!this.peerConnection) return;
        
        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: data.sdp })
            );
            
            this.ui.log('Otrzymano odpowiedź od rozmówcy', 'success');
        } catch (error) {
            this.ui.log(`Błąd ustawiania odpowiedzi: ${error.message}`, 'error');
        }
    }
    
    async handleIncomingIceCandidate(data) {
        if (!this.peerConnection || !data.candidate) return;
        
        try {
            await this.peerConnection.addIceCandidate(
                new RTCIceCandidate(data.candidate)
            );
            this.ui.log('Dodano kandydata ICE', 'info');
        } catch (error) {
            this.ui.log(`Błąd dodawania kandydata ICE: ${error.message}`, 'error');
        }
    }
    
    handleCallInitiated(data) {
        this.currentCallId = data.callId;
        this.ui.updateCallId(data.callId);
        this.ui.updateConnectedTo(data.targetUsername);
    }
    
    handleCallAccepted(data) {
        this.ui.log(`${data.receiverUsername} odebrał połączenie`, 'success');
        this.ui.showNotification(`${data.receiverUsername} odebrał połączenie`);
    }
    
    handleCallRejected(data) {
        this.ui.log(`${data.receiverUsername} odrzucił połączenie`, 'warning');
        this.ui.showNotification(`${data.receiverUsername} odrzucił połączenie`);
        this.endCall('rejected');
    }
    
    handleCallStarted(data) {
        this.currentCallId = data.callId;
        this.currentPeerId = data.callerId;
        this.currentPeerUsername = data.callerUsername;
        
        this.ui.updateCallId(data.callId);
        this.ui.updateConnectedTo(data.callerUsername);
        this.ui.updateCallUI(true);
        
        this.ui.log(`Rozpoczęto rozmowę z ${data.callerUsername}`, 'success');
    }
    
    handleCallEnded(data) {
        this.ui.log(`Rozmowa zakończona: ${data.reason}`, 'warning');
        
        if (data.endedByUsername) {
            this.ui.showNotification(`${data.endedByUsername} zakończył rozmowę`);
        } else {
            this.ui.showNotification('Rozmowa zakończona');
        }
        
        this.endCall(data.reason);
    }
    
    handleVideoToggled(data) {
        this.isVideoEnabled = data.enabled;
        this.ui.updateMediaStatus(data.enabled, this.isAudioEnabled);
    }
    
    handleAudioToggled(data) {
        this.isAudioEnabled = data.enabled;
        this.ui.updateMediaStatus(this.isVideoEnabled, data.enabled);
    }
    
    acceptCall(callData) {
        this.currentCallId = callData.callId;
        this.currentPeerId = callData.callerId;
        this.currentPeerUsername = callData.callerUsername;
        
        this.ui.updateCallId(callData.callId);
        this.ui.updateConnectedTo(callData.callerUsername);
        this.ui.updateCallUI(true);
    }
    
    endCall(reason = 'user-ended') {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = new MediaStream();
            this.ui.setRemoteVideoStream(null);
        }
        
        this.currentCallId = null;
        this.currentPeerId = null;
        this.currentPeerUsername = 'Rozmówca';
        
        this.ui.updateCallUI(false);
        this.ui.resetConnectionInfo();
        this.ui.enableRemoteAudioControl(false);
        
        this.ui.log(`Połączenie zakończone: ${reason}`, 'info');
    }
    
    cleanup() {
        this.endCall('cleanup');
        this.stopMedia();
    }
}