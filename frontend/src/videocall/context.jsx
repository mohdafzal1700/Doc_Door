// contexts/VideoCallContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import videoCallService from '../service/webrtc';

const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const VideoCallContext = createContext();

export const useVideoCall = () => {
    const context = useContext(VideoCallContext);
    if (!context) {
        throw new Error('useVideoCall must be used within a VideoCallProvider');
    }
    return context;
};

export const VideoCallProvider = ({ children }) => {
    const [isCalling, setIsCalling] = useState(false);
    const [isReceiving, setIsReceiving] = useState(false);
    const [currentCall, setCurrentCall] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');

    const pendingIceCandidatesRef = useRef([]);
    const remoteDescriptionSetRef = useRef(false);
    const isInitiator = useRef(false);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const currentRoomRef = useRef(null);

    // FIXED: Improved media access with better error handling
    const getUserMedia = useCallback(async () => {
        try {
            console.log('🎥 Requesting media access...');
            
            // First try with video and audio
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 }, 
                    audio: true 
                });
            } catch (videoError) {
                console.warn('⚠️ Video failed, trying audio only:', videoError);
                // Fallback to audio only
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            localStreamRef.current = stream;
            
            // Set local video
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            console.log('✅ Media access successful');
            return stream;
            
        } catch (error) {
            console.error('❌ Media access failed:', error);
            throw new Error('Camera/microphone access denied or unavailable');
        }
    }, []);

    const processQueuedIceCandidates = useCallback(async () => {
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection || pendingIceCandidatesRef.current.length === 0) return;

        console.log(`🧊 Processing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
        for (const candidateData of pendingIceCandidatesRef.current) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
            } catch (error) {
                console.error('❌ Error adding queued ICE candidate:', error);
            }
        }
        pendingIceCandidatesRef.current = [];
    }, []);

    const createPeerConnection = useCallback(() => {
        pendingIceCandidatesRef.current = [];
        remoteDescriptionSetRef.current = false;

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }

        const peerConnection = new RTCPeerConnection(rtcConfiguration);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate && currentRoomRef.current) {
                videoCallService.sendICECandidate(event.candidate, currentRoomRef.current);
            }
        };

        peerConnection.ontrack = (event) => {
            console.log('📹 Received remote stream');
            remoteStreamRef.current = event.streams[0];
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        peerConnection.onconnectionstatechange = () => {
            setConnectionStatus(peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log('✅ WebRTC connection established!');
            }
        };

        peerConnectionRef.current = peerConnection;
        return peerConnection;
    }, []);

    const cleanup = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        remoteStreamRef.current = null;
        currentRoomRef.current = null;
        isInitiator.current = false;
        pendingIceCandidatesRef.current = [];
        remoteDescriptionSetRef.current = false;
    }, []);

    useEffect(() => {
        const initializeConnection = async () => {
            try {
                const userData = videoCallService.getCurrentUser();
                if (userData?.id) {
                    await videoCallService.connect(userData.id);
                }
            } catch (error) {
                console.error('❌ Failed to connect to video call service:', error);
            }
        };

        initializeConnection();

        const handleIncomingCall = (data) => {
            setIncomingCall({
                callId: data.call_id,
                roomName: data.room_name,
                callerName: data.caller_name,
                callerId: data.caller_id
            });
            setIsReceiving(true);
        };

        const handleCallInitiated = (data) => {
            isInitiator.current = true;
            currentRoomRef.current = data.room_name;
            setCurrentCall({
                callId: data.call_id,
                roomName: data.room_name,
                status: 'initiated'
            });
            setIsCalling(true);
        };

        // FIXED: Better error handling in call acceptance
        const handleCallAccepted = async (data) => {
            console.log('✅ Call accepted:', data);
            setIsCalling(true);
            setIsReceiving(false);
            setIncomingCall(null);
            currentRoomRef.current = data.room_name;

            try {
                // Get media first (with improved error handling)
                const stream = await getUserMedia();
                const peerConnection = createPeerConnection();

                // Add tracks
                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });

                // Only initiator creates offer
                if (isInitiator.current) {
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);
                    videoCallService.sendOffer(offer, data.room_name);
                }
            } catch (error) {
                console.error('❌ Error setting up WebRTC:', error);
                // Don't end call immediately, let user try again
                alert('Camera/microphone access failed. Please check permissions and try again.');
            }
        };

        const handleCallRejected = (data) => {
            setIsCalling(false);
            setIsReceiving(false);
            setCurrentCall(null);
            setIncomingCall(null);
            cleanup();
        };

        const handleCallEnded = (data) => {
            setIsCalling(false);
            setIsReceiving(false);
            setCurrentCall(null);
            setIncomingCall(null);
            cleanup();
        };

        const handleWebRTCOffer = async (data) => {
            if (isInitiator.current) return; // Ignore if we're the initiator

            try {
                const stream = await getUserMedia();
                const peerConnection = createPeerConnection();

                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });

                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                remoteDescriptionSetRef.current = true;
                await processQueuedIceCandidates();

                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                videoCallService.sendAnswer(answer, currentRoomRef.current);
            } catch (error) {
                console.error('❌ Error handling offer:', error);
            }
        };

        const handleWebRTCAnswer = async (data) => {
            if (!isInitiator.current) return; // Only initiator handles answers

            const peerConnection = peerConnectionRef.current;
            if (!peerConnection || peerConnection.signalingState !== "have-local-offer") return;

            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                remoteDescriptionSetRef.current = true;
                await processQueuedIceCandidates();
            } catch (error) {
                console.error('❌ Error setting answer:', error);
            }
        };

        const handleICECandidate = async (data) => {
            const peerConnection = peerConnectionRef.current;
            if (!peerConnection) return;

            if (peerConnection.remoteDescription && remoteDescriptionSetRef.current) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (error) {
                    console.error('❌ Error adding ICE candidate:', error);
                }
            } else {
                pendingIceCandidatesRef.current.push(data.candidate);
            }
        };

        // Register event handlers
        videoCallService.on('incoming_call', handleIncomingCall);
        videoCallService.on('call_initiated', handleCallInitiated);
        videoCallService.on('call_accepted', handleCallAccepted);
        videoCallService.on('call_rejected', handleCallRejected);
        videoCallService.on('call_ended', handleCallEnded);
        videoCallService.on('webrtc_offer', handleWebRTCOffer);
        videoCallService.on('webrtc_answer', handleWebRTCAnswer);
        videoCallService.on('ice_candidate', handleICECandidate);

        return () => {
            videoCallService.off('incoming_call', handleIncomingCall);
            videoCallService.off('call_initiated', handleCallInitiated);
            videoCallService.off('call_accepted', handleCallAccepted);
            videoCallService.off('call_rejected', handleCallRejected);
            videoCallService.off('call_ended', handleCallEnded);
            videoCallService.off('webrtc_offer', handleWebRTCOffer);
            videoCallService.off('webrtc_answer', handleWebRTCAnswer);
            videoCallService.off('ice_candidate', handleICECandidate);
            cleanup();
            videoCallService.disconnect();
        };
    }, [createPeerConnection, getUserMedia, cleanup, processQueuedIceCandidates]);

    const initiateCall = useCallback(async (receiverId, appointmentId) => {
        try {
            if (!receiverId || !appointmentId) {
                console.error('❌ receiverId and appointmentId are required');
                return false;
            }
            return videoCallService.initiateCall(receiverId, appointmentId);
        } catch (error) {
            console.error('❌ Failed to initiate call:', error);
            return false;
        }
    }, []);

    const acceptCall = useCallback(async (callId, roomName) => {
        try {
            isInitiator.current = false;
            currentRoomRef.current = roomName;
            const success = videoCallService.acceptCall(callId, roomName);
            if (success) {
                setCurrentCall({ callId, roomName, status: 'accepted' });
                setIncomingCall(null);
                setIsReceiving(false);
                setIsCalling(true);
            }
        } catch (error) {
            console.error('❌ Failed to accept call:', error);
        }
    }, []);

    const rejectCall = useCallback(async (callId, roomName) => {
        try {
            videoCallService.rejectCall(callId, roomName);
            setIncomingCall(null);
            setIsReceiving(false);
        } catch (error) {
            console.error('❌ Failed to reject call:', error);
        }
    }, []);

    const endCall = useCallback(async () => {
        try {
            if (currentCall) {
                videoCallService.endCall(currentCall.callId, currentCall.roomName);
            }
            cleanup();
            setCurrentCall(null);
            setIsCalling(false);
            setIsReceiving(false);
        } catch (error) {
            console.error('❌ Failed to end call:', error);
        }
    }, [currentCall, cleanup]);

    const contextValue = {
        // State
        isCalling,
        isReceiving,
        currentCall,
        incomingCall,
        connectionStatus,
        // Refs
        localVideoRef,
        remoteVideoRef,
        localStream: localStreamRef.current,
        remoteStream: remoteStreamRef.current,
        // Actions
        initiateCall,
        acceptCall,
        rejectCall,
        endCall
    };

    return (
        <VideoCallContext.Provider value={contextValue}>
            {children}
        </VideoCallContext.Provider>
    );
};