// components/IncomingCallModal.js
import React, { useState, useEffect } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';
import { useVideoCall } from './context';

const IncomingCallModal = () => {
  const { incomingCall, acceptCall, rejectCall } = useVideoCall();
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!incomingCall) return;

    // Reset timer when new call comes in
    setTimeLeft(30);

    // Start countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-reject when timer expires
          rejectCall(incomingCall.callId, incomingCall.roomName);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Play ringtone (you can add actual audio here)
    console.log('🔊 Ringtone playing...');

    return () => {
      clearInterval(timer);
      console.log('🔇 Ringtone stopped');
    };
  }, [incomingCall, rejectCall]);

  if (!incomingCall) return null;

  const handleAccept = () => {
    acceptCall(incomingCall.callId, incomingCall.roomName);
  };

  const handleReject = () => {
    rejectCall(incomingCall.callId, incomingCall.roomName);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl animate-pulse">
        {/* Caller Avatar */}
        <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
          👤
        </div>

        {/* Call Info */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Incoming Call</h2>
        <p className="text-lg text-gray-600 mb-6">
          {incomingCall.callerName || 'Unknown Caller'} is calling you...
        </p>

        {/* Timer */}
        <div className="text-sm text-gray-500 mb-6">
          Auto-reject in {timeLeft}s
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-6">
          <button
            onClick={handleReject}
            className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <button
            onClick={handleAccept}
            className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl animate-bounce"
          >
            <PhoneCall className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;