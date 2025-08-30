// contexts/VideoCallContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import videoCallService from '../service/webrtc';

// Updated WebRTC Configuration with TURN server
const rtcConfiguration = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Your TURN server
    {
      urls: ['turn:api.docdoor.muhammedafsal.online:3478'],
      username: 'webrtcuser',
      credential: 'strongpassword'
    },
    // TURN over TLS (secure)
    {
      urls: ['turns:api.docdoor.muhammedafsal.online:5349'],
      username: 'webrtcuser',
      credential: 'strongpassword'
    }
  ],
  iceCandidatePoolSize: 10
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

  // Process queued ICE candidates
  const processQueuedIceCandidates = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection || pendingIceCandidatesRef.current.length === 0) return;

    console.log(`🧊 Processing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
    
    for (const candidateData of pendingIceCandidatesRef.current) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
        console.log('✅ Queued ICE candidate added successfully');
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error);
      }
    }
    
    pendingIceCandidatesRef.current = [];
  }, []);

  // Initialize WebRTC peer connection
  const createPeerConnection = useCallback(() => {
    pendingIceCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    console.log('🔗 Creating peer connection with config:', rtcConfiguration);
    const peerConnection = new RTCPeerConnection(rtcConfiguration);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && currentRoomRef.current) {
        console.log('🧊 Sending ICE candidate for room:', currentRoomRef.current);
        console.log('ICE Candidate:', event.candidate);
        videoCallService.sendICECandidate(event.candidate, currentRoomRef.current);
      } else if (!event.candidate) {
        console.log('🧊 ICE candidate gathering complete');
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE Connection state:', peerConnection.iceConnectionState);
      setConnectionStatus(peerConnection.iceConnectionState);
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('📹 Received remote stream:', event.streams[0]);
      remoteStreamRef.current = event.streams[0];
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log('📹 Remote video element updated');
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        console.log('✅ WebRTC connection established successfully!');
      } else if (peerConnection.connectionState === 'failed') {
        console.log('❌ WebRTC connection failed');
      }
    };

    // Handle signaling state changes
    peerConnection.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', peerConnection.signalingState);
      
      // Process queued ICE candidates when remote description is set
      if (peerConnection.signalingState === 'stable' && 
          remoteDescriptionSetRef.current && 
          pendingIceCandidatesRef.current.length > 0) {
        processQueuedIceCandidates();
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [processQueuedIceCandidates]);

  // Get user media with better error handling
  const getUserMedia = useCallback(async () => {
    try {
      console.log('📹 Requesting user media...');
      
      const constraints = {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('📹 Local video element updated');
      }
      
      console.log('✅ User media obtained successfully');
      return stream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      throw error;
    }
  }, []);

  // Cleanup resources
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up WebRTC resources');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped local track:', track.kind);
      });
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;
    currentRoomRef.current = null;
    isInitiator.current = false;
    pendingIceCandidatesRef.current = [];
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
      isInitiator.current = true;
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
          console.log('➕ Adding local track:', track.kind);
          peerConnection.addTrack(track, stream);
        });

        // Only the initiator creates the offer
        if (isInitiator.current) {
          console.log('📤 Creating offer as initiator');
          const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          await peerConnection.setLocalDescription(offer);
          console.log('📤 Local description (offer) set');
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
      console.log('📥 Received WebRTC offer:', data);
      
      if (isInitiator.current) {
        console.warn('⚠️ Received offer but we are the initiator - ignoring');
        return;
      }

      try {
        const stream = await getUserMedia();
        const peerConnection = createPeerConnection();

        // Add local stream tracks
        stream.getTracks().forEach(track => {
          console.log('➕ Adding local track:', track.kind);
          peerConnection.addTrack(track, stream);
        });

        // Set remote description (offer)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('📥 Remote description (offer) set');
        remoteDescriptionSetRef.current = true;

        // Process any queued ICE candidates
        processQueuedIceCandidates();

        // Create and send answer
        const answer = await peerConnection.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        await peerConnection.setLocalDescription(answer);
        console.log('📤 Local description (answer) set');
        
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
        console.log('✅ Remote description (answer) set successfully');
        remoteDescriptionSetRef.current = true;

        // Process any queued ICE candidates
        processQueuedIceCandidates();
      } catch (error) {
        console.error('❌ Error setting remote description (answer):', error);
      }
    };

    const handleICECandidate = async (data) => {
      console.log('🧊 Received ICE candidate:', data);
      const peerConnection = peerConnectionRef.current;
      
      if (peerConnection && remoteDescriptionSetRef.current) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('✅ ICE candidate added successfully');
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      } else {
        console.warn('⚠️ Queueing ICE candidate - remote description not set yet');
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

  // Action methods
  const initiateCall = useCallback(async (receiverId, appointmentId) => {
    try {
      console.log('📞 Initiating call to:', receiverId);
      const success = videoCallService.initiateCall(receiverId, appointmentId);
      if (success) {
        setIsCalling(true);
      }
    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
      setIsCalling(false);
    }
  }, []);

  const acceptCall = useCallback(async (callId, roomName) => {
    try {
      console.log('✅ Accepting call:', callId);
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
    endCall
  };

  return (
    <VideoCallContext.Provider value={contextValue}>
      {children}
    </VideoCallContext.Provider>
  );
};