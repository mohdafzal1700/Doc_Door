// contexts/VideoCallContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import videoCallService from '../service/webrtc';



// WebRTC Configuration
const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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

  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Initialize WebRTC peer connection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const peerConnection = new RTCPeerConnection(rtcConfiguration);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate');
        videoCallService.sendICECandidate(event.candidate);
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

      try {
        const stream = await getUserMedia();
        const peerConnection = createPeerConnection();

        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        videoCallService.sendOffer(offer);
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
      try {
        const stream = await getUserMedia();
        const peerConnection = createPeerConnection();

        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });

        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        videoCallService.sendAnswer(answer);
      } catch (error) {
        console.error('❌ Error handling WebRTC offer:', error);
      }
    };

    const handleWebRTCAnswer = async (data) => {
      console.log('📥 Received WebRTC answer:', data);
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(data.answer);
        } catch (error) {
          console.error('❌ Error setting remote description:', error);
        }
      }
    };

    const handleICECandidate = async (data) => {
      console.log('🧊 Received ICE candidate:', data);
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(data.candidate);
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
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
  }, [createPeerConnection, getUserMedia, cleanup]);

  // Action methods
  const initiateCall = useCallback(async (receiverId) => {
    try {
      console.log('📞 Initiating call to:', receiverId);
      const success = videoCallService.initiateCall(receiverId);
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