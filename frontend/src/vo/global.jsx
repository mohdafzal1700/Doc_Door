import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Wifi, WifiOff } from 'lucide-react';
import videoCallService from '../service/webrtc';
import { getStoredUserData } from '../utils/auth';

const GlobalCallListener = ({ children }) => {
  const [incomingCall, setIncomingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const navigate = useNavigate();

  // Use refs to prevent duplicate initialization
  const initializeCalledRef = useRef(false);
  const ringtoneRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializeCalledRef.current) {
      console.log('🔄 GlobalCallService already initialized, skipping...');
      return;
    }
    
    initializeCalledRef.current = true;
    console.log('🚀 Initializing GlobalCallListener...');
    initializeGlobalCallService();

    return () => {
      console.log('🧹 Cleaning up GlobalCallListener');
      cleanup();
    };
  }, []);

  // Debug effect to show connection status
  useEffect(() => {
    const interval = setInterval(() => {
      const userData = getStoredUserData();
      const debug = `User: ${userData?.id || 'None'} | Connected: ${isConnected} | Service: ${videoCallService.isConnected() ? 'Connected' : 'Disconnected'}`;
      setDebugInfo(debug);
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const initializeGlobalCallService = async () => {
    if (isInitializing) {
      console.log('🔄 GlobalCallService already initializing, skipping...');
      return;
    }

    setIsInitializing(true);
    
    try {
      const userData = getStoredUserData();
      if (!userData || !userData.id) {
        console.log('❌ No user data found for global call service');
        setIsInitializing(false);
        return;
      }

      console.log('👤 Current user data:', { id: userData.id, name: userData.name });

      // Check if already connected to avoid duplicate connections
      if (videoCallService.isConnected()) {
        console.log('✅ Video call service already connected');
        setIsConnected(true);
        setupGlobalCallHandlers();
        setIsInitializing(false);
        return;
      }

      console.log('🔌 Connecting to video call service for user:', userData.id);
      await videoCallService.connect(userData.id);
      
      setIsConnected(true);
      setupGlobalCallHandlers();
      console.log('✅ Global call service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize global call service:', error);
      setIsConnected(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const setupGlobalCallHandlers = () => {
    console.log('🔧 Setting up global call handlers');
    
    // Remove existing listeners to prevent duplicates
    videoCallService.removeAllListeners('incoming_call');
    videoCallService.removeAllListeners('call_ended');
    videoCallService.removeAllListeners('call_rejected');

    // Listen for incoming calls globally
    videoCallService.on('incoming_call', (data) => {
      console.log('📞 Global incoming call received:', data);
      
      // Don't show incoming call if user is already on a call
      if (incomingCall) {
        console.log('📞 Already handling an incoming call, ignoring...');
        return;
      }

      setIncomingCall(true);
      setCallerInfo({
        id: data.caller_id,
        name: data.caller_name,
        callId: data.call_id,
        roomName: data.room_name
      });

      // Show browser notification
      showNotification(data.caller_name || 'Unknown Caller');
      
      // Play ringtone
      playRingtone();
    });

    // Handle call rejection/end
    videoCallService.on('call_ended', (data) => {
      console.log('📴 Call ended globally:', data);
      handleCallEnd();
    });

    videoCallService.on('call_rejected', (data) => {
      console.log('📵 Call rejected globally:', data);
      handleCallEnd();
    });

    // Handle connection status changes
    videoCallService.on('connection', (data) => {
      console.log('🔗 Connection status changed:', data.status);
      setIsConnected(data.status === 'connected');
    });

    videoCallService.on('error', (error) => {
      console.error('❌ Video call service error:', error);
      setIsConnected(false);
    });
  };

  const showNotification = (callerName) => {
    if (Notification.permission === 'granted') {
      // Close any existing notification
      if (notificationRef.current) {
        notificationRef.current.close();
      }

      notificationRef.current = new Notification('Incoming Video Call', {
        body: `${callerName} is calling you`,
        icon: '/phone-icon.png',
        tag: 'video-call',
        requireInteraction: true,
        silent: false
      });

      notificationRef.current.onclick = () => {
        window.focus();
        notificationRef.current.close();
        notificationRef.current = null;
      };

      notificationRef.current.onclose = () => {
        notificationRef.current = null;
      };
    }
  };

  const playRingtone = () => {
    try {
      // Stop any existing ringtone
      stopRingtone();
      
      const audio = new Audio('/ringtone.mp3');
      audio.loop = true;
      audio.volume = 0.7;
      audio.play().catch(e => {
        console.log('Could not play ringtone:', e);
      });
      
      ringtoneRef.current = audio;
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }
  };

  const handleCallEnd = () => {
    setIncomingCall(false);
    setCallerInfo(null);
    stopRingtone();
    
    // Close notification if exists
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
  };

  const acceptCall = () => {
    if (!callerInfo) return;
    
    stopRingtone();
    
    // Close notification
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
    
    setIncomingCall(false);
    
    // Navigate to video call page in receiver mode
    navigate(`/video-call/${callerInfo.id}`, {
      state: {
        mode: 'receiver',
        callerInfo: callerInfo,
        callId: callerInfo.callId,
        roomName: callerInfo.roomName
      }
    });
  };

  const rejectCall = () => {
    if (!callerInfo) return;
    
    stopRingtone();
    
    // Close notification
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
    
    try {
      videoCallService.rejectCall(callerInfo.callId, callerInfo.roomName);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
    
    handleCallEnd();
  };

  const cleanup = () => {
    stopRingtone();
    
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }

    // Remove all listeners
    if (videoCallService.isConnected()) {
      videoCallService.removeAllListeners('incoming_call');
      videoCallService.removeAllListeners('call_ended');
      videoCallService.removeAllListeners('call_rejected');
      videoCallService.removeAllListeners('connection');
      videoCallService.removeAllListeners('error');
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('📢 Notification permission:', permission);
      });
    }
  }, []);

  return (
    <>
      {children}
      
      {/* Debug Info - Remove in production */}
      <div className="fixed bottom-4 left-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-[9997]">
        {debugInfo}
      </div>
      
      {/* Connection Status Indicator */}
      {isInitializing && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm z-[9998] flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          Connecting to call service...
        </div>
      )}
      
      {!isConnected && !isInitializing && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-lg text-sm z-[9998] flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          Call service disconnected
        </div>
      )}

      {isConnected && !isInitializing && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-lg text-sm z-[9998] flex items-center gap-2">
          <Wifi className="w-4 h-4" />
          Call service connected
        </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && callerInfo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] backdrop-blur-sm">
          <div className="bg-white text-black p-8 rounded-2xl max-w-sm w-full mx-4 shadow-2xl border border-gray-200">
            <div className="text-center">
              {/* Animated Phone Icon */}
              <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-200 rounded-full mx-auto mb-6 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
                <Phone className="w-12 h-12 text-green-600 animate-bounce z-10" />
              </div>
              
              <h3 className="text-2xl font-bold mb-2 text-gray-800">Incoming Call</h3>
              <p className="text-gray-800 mb-2 text-xl font-semibold">
                {callerInfo.name || 'Unknown Caller'}
              </p>
              <p className="text-gray-600 text-sm mb-8">
                Wants to start a video call with you
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={rejectCall}
                  className="flex-1 bg-red-600 text-white py-4 px-6 rounded-xl hover:bg-red-700 active:bg-red-800 transition-all duration-200 flex items-center justify-center gap-3 font-semibold shadow-lg"
                >
                  <PhoneOff className="w-5 h-5" />
                  Decline
                </button>
                <button
                  onClick={acceptCall}
                  className="flex-1 bg-green-600 text-white py-4 px-6 rounded-xl hover:bg-green-700 active:bg-green-800 transition-all duration-200 flex items-center justify-center gap-3 font-semibold shadow-lg"
                >
                  <Phone className="w-5 h-5" />
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalCallListener;