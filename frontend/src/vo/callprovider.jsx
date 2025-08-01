import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import videoCallService from '../service/webrtc';
import { getStoredUserData } from '../utils/auth';

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const [incomingCall, setIncomingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const navigate = useNavigate();

  // Initialize video call service
  useEffect(() => {
    initializeVideoCallService();
    return () => cleanup();
  }, []);

  const initializeVideoCallService = async () => {
    if (isInitialized) return;
    
    try {
      const userData = getStoredUserData();
      if (!userData?.id) {
        console.log('❌ No user data found');
        return;
      }

      console.log('🔌 Initializing video call service for:', userData.id);
      
      // Connect to video call service
      await videoCallService.connect(userData.id);
      setIsConnected(true);
      setIsInitialized(true);
      
      // Set up event listeners
      setupEventListeners();
      
      console.log('✅ Video call service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize video call service:', error);
      setIsConnected(false);
    }
  };

  const setupEventListeners = () => {
    // Clear existing listeners
    videoCallService.removeAllListeners('incoming_call');
    videoCallService.removeAllListeners('call_ended');
    videoCallService.removeAllListeners('call_rejected');
    videoCallService.removeAllListeners('connection');

    // Incoming call listener
    videoCallService.on('incoming_call', (data) => {
      console.log('📞 Incoming call received:', data);
      
      setIncomingCall(true);
      setCallerInfo({
        id: data.caller_id,
        name: data.caller_name,
        callId: data.call_id,
        roomName: data.room_name
      });

      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification('Incoming Video Call', {
          body: `${data.caller_name || 'Someone'} is calling you`,
          icon: '/phone-icon.png'
        });
      }
    });

    // Call ended listener
    videoCallService.on('call_ended', () => {
      console.log('📴 Call ended');
      handleCallEnd();
    });

    // Call rejected listener
    videoCallService.on('call_rejected', () => {
      console.log('📵 Call rejected');
      handleCallEnd();
    });

    // Connection status listener
    videoCallService.on('connection', (data) => {
      console.log('🔗 Connection status:', data.status);
      setIsConnected(data.status === 'connected');
    });
  };

  const handleCallEnd = () => {
    setIncomingCall(false);
    setCallerInfo(null);
  };

  const acceptCall = () => {
    if (!callerInfo) return;
    
    console.log('✅ Accepting call from:', callerInfo.name);
    setIncomingCall(false);
    
    // Navigate to video call page
    navigate(`/video-call/${callerInfo.id}`, {
      state: {
        mode: 'receiver',
        callerInfo,
        callId: callerInfo.callId,
        roomName: callerInfo.roomName
      }
    });
  };

  const rejectCall = () => {
    if (!callerInfo) return;
    
    console.log('❌ Rejecting call from:', callerInfo.name);
    
    try {
      videoCallService.rejectCall(callerInfo.callId, callerInfo.roomName);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
    
    handleCallEnd();
  };

  const cleanup = () => {
    if (videoCallService.isConnected()) {
      videoCallService.removeAllListeners('incoming_call');
      videoCallService.removeAllListeners('call_ended');
      videoCallService.removeAllListeners('call_rejected');
      videoCallService.removeAllListeners('connection');
    }
  };

  const value = {
    incomingCall,
    callerInfo,
    isConnected,
    isInitialized,
    acceptCall,
    rejectCall
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};