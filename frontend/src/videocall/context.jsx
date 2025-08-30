// contexts/VideoCallContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import videoCallService from '../service/webrtc';

// WebRTC Configuration
const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // {
    //   urls: [
    //     'stun:turn.muhammedafsal.online:3478', 
    //     'turn:turn.muhammedafsal.online:3478'  
    //   ],
    //   username: 'webrtcuser',
    //   credential: 'strongpassword'
    // }
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

  // Helper function to check if peer connection is ready
  const ensurePeerConnectionReady = useCallback(() => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) {
      console.warn('⚠️ No peer connection available');
      return false;
    }
    
    if (!remoteDescriptionSetRef.current) {
      console.warn('⚠️ Remote description not set yet');
      return false;
    }
    
    if (peerConnection.signalingState === 'closed') {
      console.warn('⚠️ Peer connection is closed');
      return false;
    }
    
    return true;
  }, []);

  // Process queued ICE candidates
  const processQueuedIceCandidates = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection || pendingIceCandidatesRef.current.length === 0) return;

    console.log(`🧊 Processing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
    
    // Create a copy of pending candidates and clear the original array
    const candidatesToProcess = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];
    
    for (const candidateData of candidatesToProcess) {
      try {
        // Double-check peer connection state before adding
        if (peerConnection.remoteDescription && remoteDescriptionSetRef.current) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
          console.log('✅ Queued ICE candidate added successfully');
        } else {
          // Re-queue if still not ready
          console.log('🧊 Re-queueing ICE candidate - not ready yet');
          pendingIceCandidatesRef.current.push(candidateData);
        }
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error);
        // Don't re-queue if there's a permanent error
        if (error.name === 'InvalidStateError') {
          console.log('🧊 Re-queueing failed ICE candidate');
          pendingIceCandidatesRef.current.push(candidateData);
        }
      }
    }
    
    console.log(`🧊 Finished processing candidates. ${pendingIceCandidatesRef.current.length} remaining queued.`);
  }, []);

  // Retry queued candidates (can be called with timeout if needed)
  const retryQueuedCandidates = useCallback(() => {
    if (pendingIceCandidatesRef.current.length > 0 && ensurePeerConnectionReady()) {
      console.log('🔄 Retrying queued ICE candidates');
      processQueuedIceCandidates();
    }
  }, [processQueuedIceCandidates, ensurePeerConnectionReady]);

  // Initialize WebRTC peer connection
  const createPeerConnection = useCallback(() => {
    pendingIceCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const peerConnection = new RTCPeerConnection(rtcConfiguration);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && currentRoomRef.current) {
        console.log('🧊 Sending ICE candidate for room:', currentRoomRef.current);
        videoCallService.sendICECandidate(event.candidate, currentRoomRef.current);
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('📹 Received remote stream');
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', peerConnection.connectionState);
      setConnectionStatus(peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        console.log('✅ WebRTC connection established successfully!');
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, []);

  // Get user media
  const getUserMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      throw error;
    }
  }, []);

  // Cleanup resources
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
    pendingIceCandidatesRef.current = []; // Clear queue
    remoteDescriptionSetRef.current = false;
  }, []);

  // Initialize video call service connection
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        const userData = videoCallService.getCurrentUser();
        if (userData?.id) {
          await videoCallService.connect(userData.id);
          console.log('✅ Connected to video call service');
        }
      } catch (error) {
        console.error('❌ Failed to connect to video call service:', error);
      }
    };

    initializeConnection();

    // Event handlers
    const handleIncomingCall = (data) => {
      console.log('📞 Incoming call received:', data);
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
      isInitiator.current = true; // Only the call initiator should be true
      currentRoomRef.current = data.room_name;
      setCurrentCall({
        callId: data.call_id,
        roomName: data.room_name,
        status: 'initiated'
      });
      setIsCalling(true);
    };

    const handleCallAccepted = async (data) => {
      console.log('✅ Call accepted:', data);
      setIsCalling(true);
      setIsReceiving(false);
      setIncomingCall(null);
      currentRoomRef.current = data.room_name;

      try {
        const stream = await getUserMedia();
        const peerConnection = createPeerConnection();
        
        // Add local stream tracks to connection
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });

        // Only the initiator creates the offer
        if (isInitiator.current) {
          console.log('📤 Creating offer as initiator');
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          videoCallService.sendOffer(offer, data.room_name);
        } else {
          console.log('📥 Waiting for offer as receiver');
        }
      } catch (error) {
        console.error('❌ Error setting up WebRTC connection:', error);
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
      console.log('🔚 Call ended:', data);
      setIsCalling(false);
      setIsReceiving(false);
      setCurrentCall(null);
      setIncomingCall(null);
      cleanup();
    };

    const handleWebRTCOffer = async (data) => {
      console.log('📤 Received WebRTC offer:', data);
      
      if (isInitiator.current) {
        console.warn('⚠️ Received offer but we are the initiator - ignoring');
        return;
      }

      try {
        const stream = await getUserMedia();
        const peerConnection = createPeerConnection();
        
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });

        // Set remote description (offer)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        remoteDescriptionSetRef.current = true; // Mark remote description as set
        console.log('✅ Remote description (offer) set successfully');
        
        // Process any queued ICE candidates
        await processQueuedIceCandidates();
        
        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        videoCallService.sendAnswer(answer, currentRoomRef.current);
        console.log('📥 Answer sent successfully');
      } catch (error) {
        console.error('❌ Error handling WebRTC offer:', error);
      }
    };

    const handleWebRTCAnswer = async (data) => {
      console.log('📥 Received WebRTC answer:', data);
      const peerConnection = peerConnectionRef.current;
      
      if (!peerConnection) {
        console.warn('⚠️ No peer connection available.');
        return;
      }

      if (peerConnection.signalingState !== "have-local-offer") {
        console.warn('⚠️ Cannot set answer in state:', peerConnection.signalingState);
        return;
      }

      if (!isInitiator.current) {
        console.warn('⚠️ Received answer but we are not the initiator - ignoring');
        return;
      }

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        remoteDescriptionSetRef.current = true; // Mark remote description as set
        console.log('✅ Remote description (answer) set successfully');
        
        // Process any queued ICE candidates
        await processQueuedIceCandidates();
      } catch (error) {
        console.error('❌ Error setting remote description (answer):', error);
      }
    };

    const handleICECandidate = async (data) => {
      console.log('🧊 Received ICE candidate:', data);
      const peerConnection = peerConnectionRef.current;
      
      if (!peerConnection) {
        console.warn('⚠️ No peer connection available - queueing candidate');
        pendingIceCandidatesRef.current.push(data.candidate);
        return;
      }

      // Check if remote description is set and peer connection is ready
      if (remoteDescriptionSetRef.current && peerConnection.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('✅ ICE candidate added successfully');
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
          // If adding fails, queue it for retry
          if (error.name === 'InvalidStateError') {
            console.log('🧊 Queueing failed ICE candidate for retry');
            pendingIceCandidatesRef.current.push(data.candidate);
          }
        }
      } else {
        // Queue the ICE candidate for later processing
        console.log('🧊 Queueing ICE candidate - remote description not set yet');
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

    // Cleanup on unmount
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

  // Optional: Debug logging to track WebRTC status (remove in production)
  useEffect(() => {
    if (isCalling) {
      const logStatus = () => {
        console.log('📊 WebRTC Status:', {
          hasPeerConnection: !!peerConnectionRef.current,
          remoteDescriptionSet: remoteDescriptionSetRef.current,
          queuedCandidates: pendingIceCandidatesRef.current.length,
          connectionState: peerConnectionRef.current?.connectionState,
          signalingState: peerConnectionRef.current?.signalingState
        });
      };
      
      const interval = setInterval(logStatus, 5000); // Log every 5 seconds during calls
      return () => clearInterval(interval);
    }
  }, [isCalling]);

  // Action methods
  const initiateCall = useCallback(async (receiverId, appointmentId) => {
    try {
      console.log('📞 Initiating call to:', receiverId, 'for appointment:', appointmentId);
      
      if (!receiverId) {
        console.error('❌ receiverId is required');
        return false;
      }
      
      if (!appointmentId) {
        console.error('❌ appointmentId is required');
        return false;
      }
      
      // Pass both receiverId and appointmentId to the service
      const success = videoCallService.initiateCall(receiverId, appointmentId);
      if (success) {
        setIsCalling(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
      setIsCalling(false);
      return false;
    }
  }, []);

  const acceptCall = useCallback(async (callId, roomName) => {
    try {
      console.log('✅ Accepting call:', callId);
      isInitiator.current = false; // Receiver is not the initiator
      currentRoomRef.current = roomName;
      
      const success = videoCallService.acceptCall(callId, roomName);
      if (success) {
        setCurrentCall({
          callId,
          roomName,
          status: 'accepted'
        });
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
      console.log('❌ Rejecting call:', callId);
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
        console.log('🔚 Ending call:', currentCall.callId);
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
    endCall,
    // Debug helper (remove in production)
    retryQueuedCandidates
  };

  return (
    <VideoCallContext.Provider value={contextValue}>
      {children}
    </VideoCallContext.Provider>
  );
};