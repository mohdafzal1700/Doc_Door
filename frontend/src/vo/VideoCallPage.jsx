import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, X } from 'lucide-react';
import videoCallService from '../service/webrtc';
import { getStoredUserData } from '../utils/auth';

export default function VideoCallPage() {
  const { receiverId } = useParams();
  const navigate = useNavigate();
  
  // Get current user data
  const currentUser = getStoredUserData();
  const isReceiver = currentUser?.id === receiverId; // Check if current user is the receiver

  // State management
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [currentCallId, setCurrentCallId] = useState(null);
  const [roomName, setRoomName] = useState(null);
  
  // Add receiver-specific states
  const [waitingForCall, setWaitingForCall] = useState(false);

  

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    // Prevent self-calling
    if (currentUser?.id === receiverId) {
      alert('You cannot call yourself!');
      navigate('/dashboard');
      return;
    }

    initializeVideoCallService();
    return () => {
      cleanup();
    };
  }, []);

  const initializeVideoCallService = async () => {
    try {
      const userData = getStoredUserData();
      if (!userData || !userData.id) {
        console.error('No user data found');
        navigate('/login');
        return;
      }

      // Connect to video call service
      await videoCallService.connect(userData.id);
      
      // Set up event handlers
      setupVideoCallHandlers();
      setConnectionStatus('connected');

      // If current user is the receiver, just wait for incoming calls
      if (isReceiver) {
        setWaitingForCall(true);
        console.log('Receiver mode: Waiting for incoming calls...');
      }
    } catch (error) {
      console.error('Failed to initialize video call service:', error);
      setConnectionStatus('error');
    }
  };

  const setupVideoCallHandlers = () => {
    // Connection status
    videoCallService.on('connection', (data) => {
      setConnectionStatus(data.status);
    });

    // Incoming call - This will trigger for the RECEIVER
    videoCallService.on('incoming_call', (data) => {
      console.log('Incoming call received:', data);
      setIncomingCall(true);
      setWaitingForCall(false);
      setCallerInfo({
        id: data.caller_id,
        name: data.caller_name,
        callId: data.call_id,
        roomName: data.room_name
      });
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('Incoming Video Call', {
          body: `${data.caller_name || 'Someone'} is calling you`,
          icon: '/phone-icon.png', // Add your app icon
          tag: 'video-call'
        });
      }
    });

    // Call initiated - This triggers for the CALLER
    videoCallService.on('call_initiated', (data) => {
      console.log('Call initiated:', data);
      setCurrentCallId(data.call_id);
      setRoomName(data.room_name);
      setIsConnecting(true);
    });

    // Call accepted
    videoCallService.on('call_accepted', async (data) => {
      console.log('Call accepted:', data);
      setIsConnecting(true);
      await initializeWebRTC();
    });

    // Call rejected
    videoCallService.on('call_rejected', (data) => {
      console.log('Call rejected:', data);
      alert('Call was rejected');
      setIsConnecting(false);
      cleanup();
    });

    // Call ended
    videoCallService.on('call_ended', (data) => {
      console.log('Call ended:', data);
      handleCallEnded();
    });

    // WebRTC signaling
    videoCallService.on('webrtc_offer', async (data) => {
      console.log('Received WebRTC offer:', data);
      await handleOffer(data.offer);
    });

    videoCallService.on('webrtc_answer', async (data) => {
      console.log('Received WebRTC answer:', data);
      await handleAnswer(data.answer);
    });

    videoCallService.on('ice_candidate', async (data) => {
      console.log('Received ICE candidate:', data);
      await handleIceCandidate(data.candidate);
    });

    // Error handling
    videoCallService.on('error', (data) => {
      console.error('Video call service error:', data);
      setConnectionStatus('error');
    });
  };

  // Request notification permission on component mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Rest of your existing methods remain the same...
  const initializeMediaStream = async () => {
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
      console.error('Error accessing media devices:', error);
      alert('Unable to access camera and microphone. Please check permissions.');
      throw error;
    }
  };

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection(rtcConfiguration);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        videoCallService.sendICECandidate(event.candidate, roomName);
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setIsConnecting(false);
        setIsCallActive(true);
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        handleCallEnded();
      }
    };

    return peerConnection;
  };

  const initializeWebRTC = async () => {
    try {
      const stream = await initializeMediaStream();
      const peerConnection = createPeerConnection();
      peerConnectionRef.current = peerConnection;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      return peerConnection;
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      throw error;
    }
  };

  const startCall = async () => {
    try {
      setIsConnecting(true);
      
      // Initialize WebRTC first
      await initializeWebRTC();
      
      // Initiate call through service
      const success = videoCallService.initiateCall(receiverId);
      if (!success) {
        throw new Error('Failed to initiate call - service not connected');
      }
    } catch (error) {
      console.error('Error starting call:', error);
      setIsConnecting(false);
      alert('Failed to start call. Please try again.');
    }
  };

  const acceptCall = async () => {
    try {
      setIncomingCall(false);
      setIsConnecting(true);
      
      // Initialize WebRTC
      await initializeWebRTC();
      
      // Accept call through service
      const success = videoCallService.acceptCall(callerInfo.callId, callerInfo.roomName);
      if (success) {
        setCurrentCallId(callerInfo.callId);
        setRoomName(callerInfo.roomName);
      } else {
        throw new Error('Failed to accept call');
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      setIsConnecting(false);
      alert('Failed to accept call. Please try again.');
    }
  };

  const rejectCall = () => {
    setIncomingCall(false);
    if (callerInfo) {
      videoCallService.rejectCall(callerInfo.callId, callerInfo.roomName);
    }
    setCallerInfo(null);
    setWaitingForCall(true); // Go back to waiting mode
  };

  // ... (rest of your existing methods remain the same)
  const endCall = () => {
    if (currentCallId) {
      videoCallService.endCall(currentCallId, roomName);
    }
    handleCallEnded();
  };

  const handleCallEnded = () => {
    setIsCallActive(false);
    setIsConnecting(false);
    setCurrentCallId(null);
    setRoomName(null);
    cleanup();
    
    // If receiver, go back to waiting mode
    if (isReceiver) {
      setWaitingForCall(true);
    }
  };

  // Auto-initiate call ONLY if user is the CALLER (not receiver)
  useEffect(() => {
    if (connectionStatus === 'connected' && 
        receiverId && 
        !isReceiver && // Only auto-call if NOT the receiver
        !isCallActive && 
        !isConnecting && 
        !incomingCall) {
      
      const timer = setTimeout(() => {
        startCall();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, receiverId, isReceiver]);

  // ... (include all your existing handler methods here)
  const handleOffer = async (offer) => {
    if (!peerConnectionRef.current) {
      await initializeWebRTC();
    }
    try {
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      videoCallService.sendAnswer(answer, roomName);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer) => {
    if (!peerConnectionRef.current) return;
    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate) => {
    if (!peerConnectionRef.current) return;
    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
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
    videoCallService.clearCurrentCall();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex justify-between items-center">
          <button
            onClick={() => {
              if (isCallActive || isConnecting) {
                endCall();
              }
              navigate(-1);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-semibold">Video Call</h1>
            <p className="text-sm text-gray-300">
              {isCallActive ? 'Connected' : 
               isConnecting ? 'Connecting...' : 
               waitingForCall ? 'Waiting for caller...' :
               'Ready to call'}
            </p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Video Container */}
      <div className="relative h-screen">
        {/* Remote Video (Full Screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-gray-800"
        />

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-20 right-4 w-32 h-24 sm:w-48 sm:h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {isVideoOff && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Different placeholders for caller vs receiver */}
        {!isCallActive && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-12 h-12 text-gray-400" />
              </div>
              
              {waitingForCall ? (
                <>
                  <p className="text-xl font-semibold mb-2">Waiting for incoming calls</p>
                  <p className="text-gray-400">You'll be notified when someone calls you</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-semibold mb-2">Ready to start video call</p>
                  <p className="text-gray-400">
                    {connectionStatus === 'connected' ? 'Click the call button to begin' : 'Connecting to service...'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex justify-center space-x-4">
          {/* Show call button only for callers, not receivers waiting */}
          {!isCallActive && !isConnecting && !waitingForCall && (
            <button
              onClick={startCall}
              disabled={connectionStatus !== 'connected'}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 p-4 rounded-full transition-colors"
            >
              <Phone className="w-6 h-6" />
            </button>
          )}

          {(isCallActive || isConnecting) && (
            <>
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors ${
                  isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>

              <button
                onClick={endCall}
                className="bg-red-600 hover:bg-red-700 p-4 rounded-full transition-colors"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Incoming Call Modal
      {incomingCall && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-xl max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Phone className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Incoming Call</h3>
              <p className="text-gray-600 mb-6">
                {callerInfo?.name || 'Someone'} is calling you
              </p>
              <div className="flex gap-4">
                <button
                  onClick={rejectCall}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={acceptCall}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )} */}

      {/* Connection Status */}
      {connectionStatus !== 'connected' && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg">
          {connectionStatus === 'disconnected' && 'Disconnected from server'}
          {connectionStatus === 'error' && 'Connection error'}
          {connectionStatus === 'connecting' && 'Connecting to service...'}
        </div>
      )}
    </div>
  );
}