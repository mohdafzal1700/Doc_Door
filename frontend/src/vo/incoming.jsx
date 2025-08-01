import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useCall } from './callprovider';

export const IncomingCallModal = () => {
  const { incomingCall, callerInfo, acceptCall, rejectCall } = useCall();

  if (!incomingCall || !callerInfo) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] backdrop-blur-sm">
      <div className="bg-white text-black p-8 rounded-2xl max-w-sm w-full mx-4 shadow-2xl">
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
  );
};