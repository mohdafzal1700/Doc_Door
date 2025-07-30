import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { 
  sendAnswer,
  getVideoCallConnectionStatus, 
  endCall as serviceEndCall, 
  acceptCall as serviceAcceptCall, 
  initiateCall as serviceInitiateCall, 
  rejectCall as serviceRejectCall, 
  sendIceCandidate, 
  sendOffer, 
  connectVideoCallSocket, 
  closeVideoCallSocket 
} from '../service/webrtc';

const VideoCallContext = createContext();

export const useVideoCall = () => {
  const context = useContext(VideoCallContext);
  if (!context) {
    console.error('❌ useVideoCall must be used within VideoCallProvider');
    throw new Error('useVideoCall must be used within VideoCallProvider');
  }
  return context;
};

// Video Call Provider
export const VideoCallProvider = ({ children, currentUserId }) => {
  const [callState, setCallState] = useState({
    isInCall: false,
    isIncomingCall: false,
    callId: null,
    roomName: null,
    callerId: null,
    callerName: null,
    calleeId: null,
    callStatus: 'idle' // idle, calling, ringing, connected, ended
  });

  const [mediaState, setMediaState] = useState({
    isVideoEnabled: true,
    isAudioEnabled: true,
    isSpeakerOn: false
  });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  
  // ICE candidate queue - this is the key addition
  const iceCandidateQueueRef = useRef([]);
  const isRemoteDescriptionSetRef = useRef(false);

  // Enhanced logging function
  const logWithTimestamp = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [VideoCall] ${message}`;
    switch (level) {
      case 'success':
        console.log(`✅ ${logMessage}`, data || '');
        break;
      case 'error':
        console.error(`❌ ${logMessage}`, data || '');
        break;
      case 'warning':
        console.warn(`⚠️ ${logMessage}`, data || '');
        break;
      case 'info':
        console.log(`ℹ️ ${logMessage}`, data || '');
        break;
      default:
        console.log(logMessage, data || '');
    }
  };

  // Process queued ICE candidates
  const processQueuedCandidates = async () => {
    if (!peerConnectionRef.current || !isRemoteDescriptionSetRef.current) {
      return;
    }

    logWithTimestamp('info', `Processing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
    
    const candidates = [...iceCandidateQueueRef.current];
    iceCandidateQueueRef.current = [];

    for (const candidate of candidates) {
      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
        logWithTimestamp('success', 'Queued ICE candidate added successfully');
      } catch (error) {
        logWithTimestamp('error', 'Error adding queued ICE candidate', error);
      }
    }
  };

  // WebSocket connection and event listeners
  useEffect(() => {
    if (!currentUserId) {
      logWithTimestamp('warning', 'No currentUserId provided to VideoCallProvider');
      return;
    }

    logWithTimestamp('info', `Initializing VideoCall for user: ${currentUserId}`);

    const initializeWebSocket = async () => {
      try {
        logWithTimestamp('info', 'Attempting to connect video call WebSocket...');
        await connectVideoCallSocket(currentUserId);
        logWithTimestamp('success', 'Video call WebSocket connected successfully');
      } catch (error) {
        logWithTimestamp('error', 'Failed to connect video call WebSocket', error);
      }
    };

    const handleVideoCallMessage = (event) => {
      const { data } = event.detail;
      logWithTimestamp('info', 'Received video call message', { type: data.type, data });

      switch (data.type) {
        case 'incoming_call':
          logWithTimestamp('info', `Incoming call from ${data.caller_name} (${data.caller_id})`);
          setCallState(prev => ({
            ...prev,
            isIncomingCall: true,
            callId: data.call_id,
            roomName: data.room_name,
            callerId: data.caller_id,
            callerName: data.caller_name,
            callStatus: 'ringing'
          }));
          break;

        case 'call_accepted':
          logWithTimestamp('success', 'Call was accepted by remote peer');
          setCallState(prev => ({
            ...prev,
            isInCall: true,
            callStatus: 'connected'
          }));
          break;

        case 'call_rejected':
          logWithTimestamp('warning', 'Call was rejected by remote peer');
          setCallState(prev => ({
            ...prev,
            callStatus: 'rejected'
          }));
          setTimeout(() => {
            logWithTimestamp('info', 'Resetting call state after rejection');
            resetCallState();
          }, 3000);
          break;

        case 'call_ended':
          logWithTimestamp('info', 'Call ended by remote peer');
          handleCallEnded();
          break;

        case 'offer':
          logWithTimestamp('info', 'Received WebRTC offer');
          handleOffer(data.offer);
          break;

        case 'answer':
          logWithTimestamp('info', 'Received WebRTC answer');
          handleAnswer(data.answer);
          break;

        case 'ice_candidate':
          logWithTimestamp('info', 'Received ICE candidate');
          handleIceCandidate(data.candidate);
          break;

        case 'call_initiated':
          logWithTimestamp('success', `Call initiated successfully. Call ID: ${data.call_id}, Room: ${data.room_name}`);
          setCallState(prev => ({
            ...prev,
            callId: data.call_id,
            roomName: data.room_name,
            callStatus: 'calling'
          }));
          break;

        default:
          logWithTimestamp('warning', `Unknown message type: ${data.type}`, data);
      }
    };

    const handleAuthError = (event) => {
      logWithTimestamp('error', 'Video call authentication error', event.detail);
      resetCallState();
    };

    initializeWebSocket();
    window.addEventListener('video_call_message', handleVideoCallMessage);
    window.addEventListener('video_call_auth_error', handleAuthError);

    return () => {
      logWithTimestamp('info', 'Cleaning up VideoCall WebSocket connection');
      window.removeEventListener('video_call_message', handleVideoCallMessage);
      window.removeEventListener('video_call_auth_error', handleAuthError);
      closeVideoCallSocket(currentUserId);
    };
  }, [currentUserId]);

  // WebRTC functions
  const initializePeerConnection = () => {
    logWithTimestamp('info', 'Initializing peer connection...');
    
    // Reset ICE candidate queue and remote description flag
    iceCandidateQueueRef.current = [];
    isRemoteDescriptionSetRef.current = false;

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    try {
      peerConnectionRef.current = new RTCPeerConnection(configuration);
      logWithTimestamp('success', 'Peer connection created successfully');

      peerConnectionRef.current.onicecandidate = async (event) => {
        if (event.candidate && callState.roomName) {
          logWithTimestamp('info', 'Sending ICE candidate');
          try {
            await sendIceCandidate(currentUserId, callState.roomName, event.candidate);
            logWithTimestamp('success', 'ICE candidate sent successfully');
          } catch (error) {
            logWithTimestamp('error', 'Failed to send ICE candidate', error);
          }
        }
      };

      peerConnectionRef.current.ontrack = (event) => {
        logWithTimestamp('success', 'Received remote track', event.streams[0]?.id);
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        const state = peerConnectionRef.current.connectionState;
        logWithTimestamp('info', `Peer connection state changed: ${state}`);
        if (state === 'connected') {
          logWithTimestamp('success', 'Peer connection established successfully');
          setCallState(prev => ({
            ...prev,
            callStatus: 'connected'
          }));
        } else if (state === 'failed' || state === 'disconnected') {
          logWithTimestamp('error', `Peer connection ${state}`);
        }
      };

      peerConnectionRef.current.onicecandidateerror = (event) => {
        logWithTimestamp('error', 'ICE candidate error', event);
      };

    } catch (error) {
      logWithTimestamp('error', 'Failed to create peer connection', error);
    }
  };

  const startLocalVideo = async () => {
    logWithTimestamp('info', 'Starting local video stream...');
    try {
      const constraints = {
        video: mediaState.isVideoEnabled,
        audio: mediaState.isAudioEnabled
      };

      logWithTimestamp('info', 'Requesting user media with constraints', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      logWithTimestamp('success', `Local stream obtained. Tracks: ${stream.getTracks().length}`);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        logWithTimestamp('success', 'Local video element updated');
      }

      // Add tracks to peer connection
      if (peerConnectionRef.current) {
        stream.getTracks().forEach(track => {
          logWithTimestamp('info', `Adding track to peer connection: ${track.kind}`);
          peerConnectionRef.current.addTrack(track, stream);
        });
        logWithTimestamp('success', 'All tracks added to peer connection');
      }

      return stream;
    } catch (error) {
      logWithTimestamp('error', 'Error accessing media devices', error);
      return null;
    }
  };

  const handleOffer = async (offer) => {
    logWithTimestamp('info', 'Handling WebRTC offer...');
    try {
      initializePeerConnection();
      await startLocalVideo();
      
      await peerConnectionRef.current.setRemoteDescription(offer);
      isRemoteDescriptionSetRef.current = true;
      logWithTimestamp('success', 'Remote description set from offer');

      // Process any queued ICE candidates
      await processQueuedCandidates();

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      logWithTimestamp('success', 'Local description set from answer');

      await sendAnswer(currentUserId, callState.roomName, answer);
      logWithTimestamp('success', 'Answer sent successfully');
    } catch (error) {
      logWithTimestamp('error', 'Error handling offer', error);
    }
  };

  const handleAnswer = async (answer) => {
    logWithTimestamp('info', 'Handling WebRTC answer...');
    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
      isRemoteDescriptionSetRef.current = true;
      logWithTimestamp('success', 'Remote description set from answer');

      // Process any queued ICE candidates
      await processQueuedCandidates();
    } catch (error) {
      logWithTimestamp('error', 'Error handling answer', error);
    }
  };

  const handleIceCandidate = async (candidate) => {
    logWithTimestamp('info', 'Handling ICE candidate...');
    
    if (!peerConnectionRef.current) {
      logWithTimestamp('warning', 'No peer connection available, ignoring ICE candidate');
      return;
    }

    if (!isRemoteDescriptionSetRef.current) {
      logWithTimestamp('info', 'Remote description not set, queuing ICE candidate');
      iceCandidateQueueRef.current.push(candidate);
      return;
    }

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
      logWithTimestamp('success', 'ICE candidate added successfully');
    } catch (error) {
      logWithTimestamp('error', 'Error adding ICE candidate', error);
    }
  };

  // Call control functions
  const initiateCall = async (calleeId) => {
    logWithTimestamp('info', `Initiating call to user: ${calleeId}`);
    try {
      setCallState(prev => ({
        ...prev,
        calleeId,
        callStatus: 'calling'
      }));

      const result = await serviceInitiateCall(currentUserId, calleeId);
      if (result.success) {
        logWithTimestamp('success', 'Call initiated successfully', result);
      } else {
        logWithTimestamp('error', 'Failed to initiate call', result.error);
        setCallState(prev => ({
          ...prev,
          callStatus: 'idle'
        }));
      }
    } catch (error) {
      logWithTimestamp('error', 'Error initiating call', error);
      setCallState(prev => ({
        ...prev,
        callStatus: 'idle'
      }));
    }
  };

  const acceptCall = async () => {
    logWithTimestamp('info', `Accepting call. Call ID: ${callState.callId}, Room: ${callState.roomName}`);
    try {
      const result = await serviceAcceptCall(
        currentUserId,
        callState.callId,
        callState.roomName
      );

      if (result.success) {
        logWithTimestamp('success', 'Call accepted successfully', result);
        setCallState(prev => ({
          ...prev,
          isIncomingCall: false,
          isInCall: true,
          callStatus: 'connected'
        }));

        // Initialize WebRTC connection
        initializePeerConnection();
        await startLocalVideo();

        // Create and send offer
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        await sendOffer(currentUserId, callState.roomName, offer);
        logWithTimestamp('success', 'Offer created and sent');

      } else {
        logWithTimestamp('error', 'Failed to accept call', result.error);
        resetCallState();
      }
    } catch (error) {
      logWithTimestamp('error', 'Error accepting call', error);
      resetCallState();
    }
  };

  const rejectCall = async () => {
    logWithTimestamp('info', `Rejecting call. Call ID: ${callState.callId}`);
    try {
      await serviceRejectCall(
        currentUserId,
        callState.callId,
        callState.roomName
      );
      logWithTimestamp('success', 'Call rejected successfully');
      resetCallState();
    } catch (error) {
      logWithTimestamp('error', 'Error rejecting call', error);
      resetCallState();
    }
  };

  const endCall = async () => {
    logWithTimestamp('info', `Ending call. Call ID: ${callState.callId}`);
    try {
      if (callState.callId && callState.roomName) {
        await serviceEndCall(
          currentUserId,
          callState.callId,
          callState.roomName
        );
        logWithTimestamp('success', 'Call ended successfully');
      }
      handleCallEnded();
    } catch (error) {
      logWithTimestamp('error', 'Error ending call', error);
      handleCallEnded();
    }
  };

  const handleCallEnded = () => {
    logWithTimestamp('info', 'Cleaning up call resources...');
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        logWithTimestamp('info', `Stopped ${track.kind} track`);
      });
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      logWithTimestamp('info', 'Peer connection closed');
    }

    // Clear ICE candidate queue
    iceCandidateQueueRef.current = [];
    isRemoteDescriptionSetRef.current = false;

    // Reset video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    resetCallState();
    logWithTimestamp('success', 'Call cleanup completed');
  };

  const resetCallState = () => {
    logWithTimestamp('info', 'Resetting call state');
    setCallState({
      isInCall: false,
      isIncomingCall: false,
      callId: null,
      roomName: null,
      callerId: null,
      callerName: null,
      calleeId: null,
      callStatus: 'idle'
    });
  };

  const toggleVideo = () => {
    logWithTimestamp('info', 'Toggling video...');
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !mediaState.isVideoEnabled;
        setMediaState(prev => ({
          ...prev,
          isVideoEnabled: !prev.isVideoEnabled
        }));
        logWithTimestamp('success', `Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const toggleAudio = () => {
    logWithTimestamp('info', 'Toggling audio...');
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !mediaState.isAudioEnabled;
        setMediaState(prev => ({
          ...prev,
          isAudioEnabled: !prev.isAudioEnabled
        }));
        logWithTimestamp('success', `Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const value = {
    callState,
    mediaState,
    localVideoRef,
    remoteVideoRef,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleVideo,
    toggleAudio
  };

  return (
    <VideoCallContext.Provider value={value}>
      {children}
    </VideoCallContext.Provider>
  );
};


// Incoming Call Modal Component
export const IncomingCallModal = () => {
  const { callState, acceptCall, rejectCall } = useVideoCall();

  if (!callState.isIncomingCall) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
        <div className="mb-6">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">
              {callState.callerName?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {callState.callerName || 'Unknown Caller'}
          </h3>
          <p className="text-gray-600">Incoming video call</p>
          <div className="mt-4 flex justify-center">
            <div className="animate-pulse bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm">
              Ringing...
            </div>
          </div>
        </div>

        <div className="flex justify-center space-x-6">
          <button
            onClick={rejectCall}
            className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-all duration-200 transform hover:scale-105 shadow-lg"
            title="Reject call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <button
            onClick={acceptCall}
            className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full transition-all duration-200 transform hover:scale-105 shadow-lg"
            title="Accept call"
          >
            <Phone className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Video Call Interface Component
export const VideoCallInterface = () => {
  const { 
    callState, 
    mediaState, 
    localVideoRef, 
    remoteVideoRef, 
    endCall, 
    toggleVideo, 
    toggleAudio 
  } = useVideoCall();

  if (!callState.isInCall) return null;

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Remote Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Local Video */}
      <div className="absolute top-4 right-4 w-40 h-32 bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-white">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
        />
        {!mediaState.isVideoEnabled && (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <VideoOff className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>

      {/* Call Status */}
      {callState.callStatus !== 'connected' && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
          <div className="bg-black bg-opacity-50 text-white px-6 py-3 rounded-full backdrop-blur-sm">
            <div className="flex items-center space-x-2">
              {callState.callStatus === 'calling' && (
                <>
                  <div className="animate-pulse w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>Calling...</span>
                </>
              )}
              {callState.callStatus === 'ringing' && (
                <>
                  <div className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Ringing...</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className="absolute top-4 left-4">
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          callState.callStatus === 'connected' 
            ? 'bg-green-500 text-white' 
            : 'bg-yellow-500 text-black'
        }`}>
          {callState.callStatus === 'connected' ? 'Connected' : 'Connecting...'}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="flex space-x-4 bg-black bg-opacity-50 rounded-full p-4 backdrop-blur-sm">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-all duration-200 transform hover:scale-105 ${
              mediaState.isAudioEnabled
                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={mediaState.isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {mediaState.isAudioEnabled ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all duration-200 transform hover:scale-105 ${
              mediaState.isVideoEnabled
                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={mediaState.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {mediaState.isVideoEnabled ? (
              <Video className="w-6 h-6" />
            ) : (
              <VideoOff className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={endCall}
            className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-all duration-200 transform hover:scale-105"
            title="End call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Call Button Component
export const CallButton = ({ userId, userName, size = 'md', disabled = false }) => {
  const { initiateCall, callState } = useVideoCall();

  const handleCall = () => {
    if (callState.callStatus === 'idle' && !disabled) {
      console.log(`✅ [CallButton] Initiating call to ${userName} (${userId})`);
      initiateCall(userId);
    } else {
      console.log(`⚠️ [CallButton] Call not initiated. Status: ${callState.callStatus}, Disabled: ${disabled}`);
    }
  };

  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const isDisabled = callState.callStatus !== 'idle' || disabled;

  return (
    <button
      onClick={handleCall}
      disabled={isDisabled}
      className={`
        ${sizeClasses[size]}
        ${isDisabled 
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-green-500 hover:bg-green-600 transform hover:scale-105'
        }
        text-white rounded-full transition-all duration-200 shadow-lg
      `}
      title={isDisabled ? 'Call unavailable' : `Call ${userName}`}
    >
      <Video className={iconSizes[size]} />
    </button>
  );
};

// Connection Status Component
export const ConnectionStatus = ({ currentUserId }) => {
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    const checkStatus = () => {
      try {
        const status = getVideoCallConnectionStatus(currentUserId);
        setConnectionStatus(status);
        console.log(`ℹ️ [ConnectionStatus] Connection status for ${currentUserId}:`, status);
      } catch (error) {
        console.error(`❌ [ConnectionStatus] Error checking status for ${currentUserId}:`, error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [currentUserId]);

  if (!connectionStatus) return null;

  return (
    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
      connectionStatus.connected 
        ? 'bg-green-100 text-green-600' 
        : 'bg-red-100 text-red-600'
    }`}>
      {connectionStatus.connected ? 'Online' : 'Offline'}
    </div>
  );
};