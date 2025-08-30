// contexts/VideoCallContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import videoCallService from '../service/webrtc';

// CORRECTED: Simple authentication method that works in browsers
const rtcConfiguration = {
    iceServers: [
        // Google STUN servers (keep as backup)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Your TURN server - Using domain and simple auth
        {
            urls: [
                'turn:api.docdoor.muhammedafsal.online:3478',
                'turns:api.docdoor.muhammedafsal.online:5349'
            ],
            username: 'webrtcuser',
            credential: 'strongpassword'
        }
    ],
    // ADDED: ICE transport policy for better connectivity
    iceTransportPolicy: 'all', // Use both STUN and TURN
    iceCandidatePoolSize: 10 // Pre-gather ICE candidates
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
    const [mediaError, setMediaError] = useState(null); // NEW: Track media errors

    const pendingIceCandidatesRef = useRef([]);
    const remoteDescriptionSetRef = useRef(false);
    const isInitiator = useRef(false);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const currentRoomRef = useRef(null);
    const connectionTimeoutRef = useRef(null); // NEW: Connection timeout

    // IMPROVED: Enhanced media access with progressive fallback
    const getUserMedia = useCallback(async () => {
        try {
            console.log('🎥 Requesting media access...');
            setMediaError(null);
            
            // Progressive fallback strategy
            const constraints = [
                // HD video with audio
                { video: { width: 1280, height: 720, frameRate: 30 }, audio: true },
                // Standard video with audio
                { video: { width: 640, height: 480, frameRate: 30 }, audio: true },
                // Low quality video with audio
                { video: { width: 320, height: 240 }, audio: true },
                // Audio only
                { audio: true }
            ];

            let stream = null;
            let lastError = null;

            for (const constraint of constraints) {
                try {
                    console.log('🔄 Trying constraint:', constraint);
                    stream = await navigator.mediaDevices.getUserMedia(constraint);
                    console.log('✅ Media constraint successful:', constraint);
                    break;
                } catch (error) {
                    console.warn('⚠️ Constraint failed:', constraint, error);
                    lastError = error;
                    continue;
                }
            }

            if (!stream) {
                throw lastError || new Error('All media constraints failed');
            }

            localStreamRef.current = stream;
            
            // Set local video
            if (localVideoRef.current && stream.getVideoTracks().length > 0) {
                localVideoRef.current.srcObject = stream;
                // Ensure video plays
                try {
                    await localVideoRef.current.play();
                } catch (playError) {
                    console.warn('⚠️ Local video autoplay failed:', playError);
                }
            }
            
            console.log('✅ Media access successful');
            return stream;
            
        } catch (error) {
            console.error('❌ Media access failed:', error);
            setMediaError(error.message);
            throw new Error('Camera/microphone access denied or unavailable');
        }
    }, []);

    const processQueuedIceCandidates = useCallback(async () => {
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection || pendingIceCandidatesRef.current.length === 0) return;

        console.log(`🧊 Processing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
        for (const candidateData of pendingIceCandidatesRef.current) {
            try {
                if (candidateData && candidateData.candidate) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
                    console.log('✅ ICE candidate added successfully');
                }
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

        console.log('🔗 Creating peer connection with TURN server...');
        const peerConnection = new RTCPeerConnection(rtcConfiguration);

        // ENHANCED: Better ICE candidate handling
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && currentRoomRef.current) {
                console.log('🧊 Sending ICE candidate:', event.candidate.type);
                videoCallService.sendICECandidate(event.candidate, currentRoomRef.current);
            } else if (!event.candidate) {
                console.log('🧊 ICE gathering complete');
            }
        };

        // ENHANCED: Better track handling
        peerConnection.ontrack = (event) => {
            console.log('📹 Received remote stream:', event.streams[0]);
            remoteStreamRef.current = event.streams[0];
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
                // Ensure remote video plays
                remoteVideoRef.current.play().catch(error => {
                    console.warn('⚠️ Remote video autoplay failed:', error);
                });
            }
        };

        // ENHANCED: Detailed connection state monitoring
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            console.log('🔗 Connection state changed:', state);
            setConnectionStatus(state);
            
            if (state === 'connected') {
                console.log('✅ WebRTC connection established!');
                // Clear any connection timeout
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }
            } else if (state === 'failed' || state === 'disconnected') {
                console.warn('⚠️ Connection failed or disconnected');
                // Auto-cleanup on failure
                setTimeout(() => cleanup(), 1000);
            }
        };

        // NEW: ICE connection state monitoring
        peerConnection.oniceconnectionstatechange = () => {
            console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
        };

        // NEW: ICE gathering state monitoring
        peerConnection.onicegatheringstatechange = () => {
            console.log('🧊 ICE gathering state:', peerConnection.iceGatheringState);
        };

        peerConnectionRef.current = peerConnection;
        return peerConnection;
    }, []);

    const cleanup = useCallback(() => {
        console.log('🧹 Cleaning up video call resources...');
        
        // Clear timeout
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log('🛑 Stopped track:', track.kind);
            });
            localStreamRef.current = null;
        }

        // Clear video elements
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        remoteStreamRef.current = null;
        currentRoomRef.current = null;
        isInitiator.current = false;
        pendingIceCandidatesRef.current = [];
        remoteDescriptionSetRef.current = false;
        setMediaError(null);
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
            console.log('📞 Incoming call:', data);
            setIncomingCall({
                callId: data.call_id,
                roomName: data.room_name,
                callerName: data.caller_name,
                callerId: data.caller_id
            });
            setIsReceiving(true);
        };

        const handleCallInitiated = (data) => {
            console.log('📞 Call initiated:', data);
            isInitiator.current = true;
            currentRoomRef.current = data.room_name;
            setCurrentCall({
                callId: data.call_id,
                roomName: data.room_name,
                status: 'initiated'
            });
            setIsCalling(true);
        };

        // ENHANCED: Better error handling and timeout management
        const handleCallAccepted = async (data) => {
            console.log('✅ Call accepted:', data);
            setIsCalling(true);
            setIsReceiving(false);
            setIncomingCall(null);
            currentRoomRef.current = data.room_name;

            // Set connection timeout (30 seconds)
            connectionTimeoutRef.current = setTimeout(() => {
                console.warn('⏰ Connection timeout reached');
                if (peerConnectionRef.current?.connectionState !== 'connected') {
                    alert('Connection timeout. Please check your network and try again.');
                    endCall();
                }
            }, 30000);

            try {
                // Get media first with enhanced error handling
                const stream = await getUserMedia();
                const peerConnection = createPeerConnection();

                // Add tracks with better error handling
                stream.getTracks().forEach(track => {
                    try {
                        peerConnection.addTrack(track, stream);
                        console.log('✅ Added track:', track.kind);
                    } catch (error) {
                        console.error('❌ Error adding track:', error);
                    }
                });

                // Only initiator creates offer
                if (isInitiator.current) {
                    console.log('📤 Creating and sending offer...');
                    const offer = await peerConnection.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: true
                    });
                    await peerConnection.setLocalDescription(offer);
                    videoCallService.sendOffer(offer, data.room_name);
                }
            } catch (error) {
                console.error('❌ Error setting up WebRTC:', error);
                setMediaError(error.message);
                // Show user-friendly error message
                alert(`Media setup failed: ${error.message}. Please check permissions and try again.`);
            }
        };

        const handleCallRejected = (data) => {
            console.log('❌ Call rejected:', data);
            setIsCalling(false);
            setIsReceiving(false);
            setCurrentCall(null);
            setIncomingCall(null);
            cleanup();
        };

        const handleCallEnded = (data) => {
            console.log('📞 Call ended:', data);
            setIsCalling(false);
            setIsReceiving(false);
            setCurrentCall(null);
            setIncomingCall(null);
            cleanup();
        };

        // ENHANCED: Better offer handling with timeout
        const handleWebRTCOffer = async (data) => {
            if (isInitiator.current) {
                console.log('⚠️ Ignoring offer - we are the initiator');
                return;
            }

            console.log('📥 Handling WebRTC offer...');
            try {
                const stream = await getUserMedia();
                const peerConnection = createPeerConnection();

                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                    console.log('✅ Added track for answer:', track.kind);
                });

                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                remoteDescriptionSetRef.current = true;
                console.log('✅ Remote description set');

                // Process any queued ICE candidates
                await processQueuedIceCandidates();

                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                console.log('📤 Sending answer...');
                videoCallService.sendAnswer(answer, currentRoomRef.current);
            } catch (error) {
                console.error('❌ Error handling offer:', error);
                setMediaError(error.message);
            }
        };

        const handleWebRTCAnswer = async (data) => {
            if (!isInitiator.current) {
                console.log('⚠️ Ignoring answer - we are not the initiator');
                return;
            }

            const peerConnection = peerConnectionRef.current;
            if (!peerConnection) {
                console.warn('⚠️ No peer connection for answer');
                return;
            }

            if (peerConnection.signalingState !== "have-local-offer") {
                console.warn('⚠️ Wrong signaling state for answer:', peerConnection.signalingState);
                return;
            }

            try {
                console.log('📥 Setting remote answer...');
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                remoteDescriptionSetRef.current = true;
                console.log('✅ Remote answer set');
                await processQueuedIceCandidates();
            } catch (error) {
                console.error('❌ Error setting answer:', error);
            }
        };

        // ENHANCED: Better ICE candidate handling
        const handleICECandidate = async (data) => {
            const peerConnection = peerConnectionRef.current;
            if (!peerConnection) {
                console.warn('⚠️ No peer connection for ICE candidate');
                return;
            }

            console.log('🧊 Received ICE candidate:', data.candidate?.type || 'unknown');

            if (peerConnection.remoteDescription && remoteDescriptionSetRef.current) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('✅ ICE candidate added immediately');
                } catch (error) {
                    console.error('❌ Error adding ICE candidate:', error);
                }
            } else {
                console.log('🔄 Queuing ICE candidate (no remote description yet)');
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
            console.log('📞 Initiating call to:', receiverId);
            return videoCallService.initiateCall(receiverId, appointmentId);
        } catch (error) {
            console.error('❌ Failed to initiate call:', error);
            return false;
        }
    }, []);

    const acceptCall = useCallback(async (callId, roomName) => {
        try {
            console.log('✅ Accepting call:', callId, roomName);
            isInitiator.current = false;
            currentRoomRef.current = roomName;
            const success = videoCallService.acceptCall(callId, roomName);
            if (success) {
                setCurrentCall({ callId, roomName, status: 'accepted' });
                setIncomingCall(null);
                setIsReceiving(false);
                setIsCalling(true);
            }
            return success;
        } catch (error) {
            console.error('❌ Failed to accept call:', error);
            return false;
        }
    }, []);

    const rejectCall = useCallback(async (callId, roomName) => {
        try {
            console.log('❌ Rejecting call:', callId, roomName);
            videoCallService.rejectCall(callId, roomName);
            setIncomingCall(null);
            setIsReceiving(false);
        } catch (error) {
            console.error('❌ Failed to reject call:', error);
        }
    }, []);

    const endCall = useCallback(async () => {
        try {
            console.log('📞 Ending call...');
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

    // NEW: Retry connection function
    const retryConnection = useCallback(async () => {
        console.log('🔄 Retrying connection...');
        if (currentCall) {
            try {
                // Clean up current connection
                if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                }
                
                // Get fresh media
                const stream = await getUserMedia();
                const peerConnection = createPeerConnection();

                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });

                // If we're the initiator, create new offer
                if (isInitiator.current) {
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);
                    videoCallService.sendOffer(offer, currentCall.roomName);
                }
            } catch (error) {
                console.error('❌ Retry failed:', error);
                setMediaError(error.message);
            }
        }
    }, [currentCall, getUserMedia, createPeerConnection]);

    const contextValue = {
        // State
        isCalling,
        isReceiving,
        currentCall,
        incomingCall,
        connectionStatus,
        mediaError, // NEW: Expose media errors
        // Refs
        localVideoRef,
        remoteVideoRef,
        localStream: localStreamRef.current,
        remoteStream: remoteStreamRef.current,
        // Actions
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        retryConnection // NEW: Allow manual retry
    };

    return (
        <VideoCallContext.Provider value={contextValue}>
            {children}
        </VideoCallContext.Provider>
    );
};