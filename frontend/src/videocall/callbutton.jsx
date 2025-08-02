// components/CallButton.js
import React, { useState } from 'react';
import { Phone } from 'lucide-react';
import { useVideoCall } from './context';

const CallButton = ({ 
  receiverId, 
  doctorName = "Doctor", 
  className = "",
  size = "md" // sm, md, lg
}) => {
  const { initiateCall } = useVideoCall();
  const [isHovered, setIsHovered] = useState(false);

  const handleCall = () => {
    if (receiverId) {
      initiateCall(receiverId);
    } else {
      console.warn('No receiver ID provided for call');
    }
  };

  // Size configurations
  const sizeClasses = {
    sm: {
      button: 'p-2',
      icon: 'w-4 h-4'
    },
    md: {
      button: 'p-3',
      icon: 'w-5 h-5'
    },
    lg: {
      button: 'p-4',
      icon: 'w-6 h-6'
    }
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="relative inline-block">
      <button
        onClick={handleCall}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${currentSize.button} ${className}`}
        disabled={!receiverId}
      >
        <Phone className={currentSize.icon} />
      </button>
      
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap z-50">
          Call {doctorName}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default CallButton;