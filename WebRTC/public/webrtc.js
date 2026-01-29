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
        this.currentPeerUsername = 'Rozmowca';

        this.ui = null;
        this.sendWsMessage = null;
    }

    initialize(ui) {
        this.ui = ui;
    }

    async startMedia() {
        try {
            this.ui.log('Zadanie dostepu do kamery i mikrofonu...', 'info');

            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 }
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

            this.ui.log('Kamera i mikrofon gotowe (domyslnie wylaczone)', 'success');

            return true;
        } catch (error) {
            this.ui.log(`Blad dostepu do mediow: ${error.message}`, 'error');
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

            this.ui.log('Kamera i mikrofon wylaczone', 'info');
        }
    }

    toggleVideo(enabled) {
        if (!this.localStream) return;

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoEnabled = enabled;
            videoTrack.enabled = enabled;
            this.ui.updateMediaStatus(enabled, this.isAudioEnabled);
            this.ui.log(`Kamera ${enabled ? 'wlaczona' : 'wylaczona'}`, 'info');
        }
    }

    toggleAudio(enabled) {
        if (!this.localStream) return;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isAudioEnabled = enabled;
            audioTrack.enabled = enabled;
            this.ui.updateMediaStatus(this.isVideoEnabled, enabled);
            this.ui.log(`Mikrofon ${enabled ? 'wlaczony' : 'wylaczony'}`, 'info');
        }
    }

    toggleRemoteAudio(enabled) {
        this.isRemoteAudioEnabled = enabled;

        if (this.remoteStream) {
            this.remoteStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }

        this.ui.log(`Dzwiek rozmowcy ${enabled ? 'wlaczony' : 'wylaczony'}`, 'info');
    }

    async startCall(targetId, targetUsername, sendWsMessage) {
        this.currentPeerId = targetId;
        this.currentPeerUsername = targetUsername;
        this.sendWsMessage = sendWsMessage;

        try {
            this.peerConnection = this.createPeerConnection(targetId);

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }

            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await this.peerConnection.setLocalDescription(offer);

            if (sendWsMessage) {
                sendWsMessage('start-call', {
                    target: targetId,
                    videoEnabled: this.isVideoEnabled,
                    audioEnabled: this.isAudioEnabled
                });

                sendWsMessage('offer', {
                    target: targetId,
                    sdp: offer.sdp,
                    callId: this.currentCallId,
                    videoEnabled: this.isVideoEnabled,
                    audioEnabled: this.isAudioEnabled
                });
            }

            this.ui.updateConnectedTo(targetUsername);
            this.ui.updateCallUI(true);
            this.ui.log(`Rozpoczeto polaczenie z ${targetUsername}`, 'success');

            return true;
        } catch (error) {
            this.ui.log(`Blad rozpoczecia polaczenia: ${error.message}`, 'error');
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
                this.ui.log('Polaczenie P2P nawiazane!', 'success');
                this.ui.showRemoteVideo();
            } else if (state === 'disconnected' || state === 'failed') {
                this.ui.log(`Polaczenie P2P ${state}`, 'error');
                if (state === 'failed') {
                    this.endCall('ice-failed');
                }
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && this.sendWsMessage) {
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
            this.ui.log('Otrzymano zdalny strumien multimedialny', 'success');

            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }
            this.remoteStream.addTrack(event.track);

            this.ui.setRemoteVideoStream(this.remoteStream);
            this.ui.enableRemoteAudioControl(true);

            this.toggleRemoteAudio(true);
        };

        return pc;
    }

    async handleIncomingOffer(data) {
        try {
            this.currentCallId = data.callId || `temp_${data.sender}`;
            this.currentPeerId = data.sender;
            this.currentPeerUsername = data.senderUsername || 'Rozmowca';

            this.peerConnection = this.createPeerConnection(data.sender);

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }

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
            this.ui.log(`Odebrano oferte od ${this.currentPeerUsername}`, 'success');

            return true;
        } catch (error) {
            this.ui.log(`Blad obslugi oferty: ${error.message}`, 'error');
            this.endCall('offer-failed');
            return false;
        }
    }

    async acceptCall(callData) {
        this.currentCallId = callData.callId;
        this.currentPeerId = callData.callerId;
        this.currentPeerUsername = callData.callerUsername;

        this.ui.updateCallId(callData.callId);
        this.ui.updateConnectedTo(callData.callerUsername);
        this.ui.updateCallUI(true);

        // Rozpocznij media jeśli jeszcze nie są uruchomione
        if (!this.localStream) {
            await this.startMedia();
        }

        // Utwórz połączenie WebRTC jako odpowiadający
        this.peerConnection = this.createPeerConnection(this.currentPeerId);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }
        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await this.peerConnection.setLocalDescription(offer);

            if (this.sendWsMessage) {
                this.sendWsMessage('offer', {
                    target: this.currentPeerId,
                    sdp: offer.sdp,
                    callId: this.currentCallId,
                    videoEnabled: this.isVideoEnabled,
                    audioEnabled: this.isAudioEnabled
                });
            }

            this.ui.log(`Utworzono ofertę WebRTC dla ${this.currentPeerUsername}`, 'success');
        } catch (error) {
            this.ui.log(`Błąd tworzenia oferty WebRTC: ${error.message}`, 'error');
        }
    }

    async handleIncomingAnswer(data) {
        if (!this.peerConnection) return;

        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: data.sdp })
            );

            this.ui.log('Otrzymano odpowiedz od rozmowcy', 'success');
        } catch (error) {
            this.ui.log(`Blad ustawiania odpowiedzi: ${error.message}`, 'error');
        }
    }

    async handleIncomingIceCandidate(data) {
        if (!this.peerConnection || !data.candidate) return;

        try {
            await this.peerConnection.addIceCandidate(
                new RTCIceCandidate(data.candidate)
            );
        } catch (error) {
            this.ui.log(`Blad dodawania kandydata ICE: ${error.message}`, 'error');
        }
    }

    handleCallInitiated(data) {
        this.currentCallId = data.callId;
        this.ui.updateCallId(data.callId);
        this.ui.updateConnectedTo(data.targetUsername);
    }

    handleCallAccepted(data) {
        this.ui.log(`${data.receiverUsername} odebrano polaczenie`, 'success');
    }

    handleCallRejected(data) {
        this.ui.log(`${data.receiverUsername} odrzucono polaczenie`, 'warning');
        this.endCall('rejected');
    }

    handleCallStarted(data) {
        this.currentCallId = data.callId;
        this.currentPeerId = data.callerId;
        this.currentPeerUsername = data.callerUsername;

        this.ui.updateCallId(data.callId);
        this.ui.updateConnectedTo(data.callerUsername);
        this.ui.updateCallUI(true);

        this.ui.log(`Rozpoczeto rozmowe z ${data.callerUsername}`, 'success');
    }

    handleCallEnded(data) {
        this.ui.log(`Rozmowa zakonczona: ${data.reason}`, 'warning');

        if (data.endedByUsername) {
            this.ui.showNotification(`${data.endedByUsername} zakonczyl rozmowe`);
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
        this.currentPeerUsername = 'Rozmowca';

        this.ui.updateCallUI(false);
        this.ui.resetConnectionInfo();
        this.ui.enableRemoteAudioControl(false);

        this.ui.log(`Polaczenie zakonczone: ${reason}`, 'info');
    }

    cleanup() {
        this.endCall('cleanup');
        this.stopMedia();
    }
}