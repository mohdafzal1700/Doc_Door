// components/CallButton.js
import React, { useState, useEffect } from 'react';
import { Phone, Clock, AlertCircle } from 'lucide-react';
import { useVideoCall } from './context';

const CallButton = ({ 
  receiverId, 
  appointmentId,
  appointmentData, // { appointment_date, slot_time, mode, status }
  doctorName = "Doctor", 
  className = "", 
  size = "md" 
}) => {
  const { initiateCall } = useVideoCall();
  const [isHovered, setIsHovered] = useState(false);
  const [callStatus, setCallStatus] = useState({ canCall: false, reason: '', timeUntil: '' });

  // Check if call is available based on appointment timing
  useEffect(() => {
    const checkCallAvailability = () => {
      if (!appointmentData || !appointmentId) {
        setCallStatus({
          canCall: false,
          reason: 'No appointment data available',
          timeUntil: ''
        });
        return;
      }

      // Check if appointment is online
      if (appointmentData.mode !== 'online') {
        setCallStatus({
          canCall: false,
          reason: 'Video calls only available for online appointments',
          timeUntil: ''
        });
        return;
      }

      // Check appointment status
      if (appointmentData.status?.toLowerCase() !== 'confirmed') {
        setCallStatus({
          canCall: false,
          reason: 'Appointment must be confirmed',
          timeUntil: ''
        });
        return;
      }

      try {
        // Parse appointment date and time
        const appointmentDate = new Date(appointmentData.appointment_date);
        const [hours, minutes] = appointmentData.slot_time.split(':');
        const appointmentDateTime = new Date(appointmentDate);
        appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const now = new Date();
        
        // Allow calls 15 minutes before and 30 minutes after appointment
        const startWindow = new Date(appointmentDateTime.getTime() - 15 * 60 * 1000);
        const endWindow = new Date(appointmentDateTime.getTime() + 30 * 60 * 1000);

        if (now < startWindow) {
          const minutesUntil = Math.ceil((startWindow - now) / (1000 * 60));
          setCallStatus({
            canCall: false,
            reason: `Call available in ${minutesUntil} minutes`,
            timeUntil: `Available at ${startWindow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          });
        } else if (now > endWindow) {
          setCallStatus({
            canCall: false,
            reason: 'Call window has expired',
            timeUntil: ''
          });
        } else {
          setCallStatus({
            canCall: true,
            reason: 'Call available now',
            timeUntil: ''
          });
        }
      } catch (error) {
        console.error('Error parsing appointment time:', error);
        setCallStatus({
          canCall: false,
          reason: 'Error validating appointment time',
          timeUntil: ''
        });
      }
    };

    checkCallAvailability();
    
    // Update every minute
    const interval = setInterval(checkCallAvailability, 60000);
    return () => clearInterval(interval);
  }, [appointmentData, appointmentId]);

  const handleCall = () => {
    if (callStatus.canCall && receiverId && appointmentId) {
      initiateCall(receiverId, appointmentId); // Pass appointmentId to initiateCall
    } else if (!callStatus.canCall) {
      // Show why call is not available
      console.warn('Call not available:', callStatus.reason);
    } else {
      console.warn('Missing required data for call');
    }
  };

  // Size configurations
  const sizeClasses = {
    sm: { button: 'p-2', icon: 'w-4 h-4' },
    md: { button: 'p-3', icon: 'w-5 h-5' },
    lg: { button: 'p-4', icon: 'w-6 h-6' }
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  // Button styling based on availability
  const buttonClass = callStatus.canCall
    ? 'bg-green-500 hover:bg-green-600 text-white'
    : 'bg-gray-400 text-gray-200 cursor-not-allowed';

  return (
    <div className="relative inline-block">
      <button
        onClick={handleCall}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`${buttonClass} rounded-full transition-all duration-200 shadow-lg ${
          callStatus.canCall ? 'hover:shadow-xl transform hover:scale-105' : ''
        } ${currentSize.button} ${className}`}
        disabled={!callStatus.canCall || !receiverId || !appointmentId}
      >
        {callStatus.canCall ? (
          <Phone className={currentSize.icon} />
        ) : (
          <Clock className={currentSize.icon} />
        )}
      </button>

      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded whitespace-nowrap z-50 max-w-xs">
          {callStatus.canCall ? (
            <>Call {doctorName}</>
          ) : (
            <div className="text-center">
              <div className="flex items-center gap-1 mb-1">
                <AlertCircle className="w-3 h-3" />
                <span className="font-medium">Call Not Available</span>
              </div>
              <div className="text-xs">{callStatus.reason}</div>
              {callStatus.timeUntil && (
                <div className="text-xs text-gray-300 mt-1">{callStatus.timeUntil}</div>
              )}
            </div>
          )}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default CallButton;