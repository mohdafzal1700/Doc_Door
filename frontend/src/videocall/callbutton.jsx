// components/CallButton.js
import React, { useState, useEffect } from 'react';
import { Phone, Clock, AlertCircle } from 'lucide-react';
import { useVideoCall } from './context';

const CallButton = ({
  receiverId,
  appointmentId,
  appointmentData, 
  doctorName = "Doctor",
  className = "",
  size = "md"
}) => {
  const { initiateCall } = useVideoCall();
  const [isHovered, setIsHovered] = useState(false);
  const [callStatus, setCallStatus] = useState({
    canCall: false,
    reason: '',
    timeUntil: ''
  });

  // Debug logging for received props
  useEffect(() => {
    console.log('🔍 CallButton DEBUG - Props received:');
    console.log('   receiverId:', receiverId);
    console.log('   appointmentId:', appointmentId);
    console.log('   appointmentData:', appointmentData);
    console.log('   appointmentData type:', typeof appointmentData);
    console.log('   doctorName:', doctorName);
    console.log('   size:', size);
    console.log('   className:', className);

    if (appointmentData) {
      console.log('🔍 CallButton DEBUG - appointmentData details:');
      console.log('   appointment_date:', appointmentData.appointment_date);
      console.log('   slot_time:', appointmentData.slot_time);
      console.log('   mode:', appointmentData.mode);
      console.log('   status:', appointmentData.status);
      console.log('   All appointmentData keys:', Object.keys(appointmentData));
    }
  }, [receiverId, appointmentId, appointmentData, doctorName, size, className]);

  // FIXED: Proper timezone handling function
  const parseAppointmentDateTime = (appointment_date, slot_time) => {
    try {
      // Parse date components properly for local timezone
      const [year, month, day] = appointment_date.split('-');
      const [hours, minutes] = slot_time.split(':');
      
      // Create date in LOCAL timezone (not UTC)
      const appointmentDateTime = new Date(
        parseInt(year),
        parseInt(month) - 1, // Month is 0-indexed
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        0, // seconds
        0  // milliseconds
      );
      
      return appointmentDateTime;
    } catch (error) {
      console.error('❌ Error parsing appointment datetime:', error);
      return null;
    }
  };

  // Check if call is available based on appointment timing
  useEffect(() => {
    const checkCallAvailability = () => {
      console.log('🔄 CallButton DEBUG - Checking call availability...');

      if (!appointmentData || !appointmentId) {
        console.log('❌ CallButton DEBUG - Missing data:', {
          hasAppointmentData: !!appointmentData,
          hasAppointmentId: !!appointmentId
        });
        setCallStatus({
          canCall: false,
          reason: 'No appointment data available',
          timeUntil: ''
        });
        return;
      }

      // Check if appointment is online
      console.log('🔍 CallButton DEBUG - Checking mode:', appointmentData.mode);
      if (appointmentData.mode !== 'online') {
        console.log('❌ CallButton DEBUG - Not online appointment');
        setCallStatus({
          canCall: false,
          reason: 'Video calls only available for online appointments',
          timeUntil: ''
        });
        return;
      }

      // Check appointment status
      console.log('🔍 CallButton DEBUG - Checking status:', appointmentData.status);
      if (appointmentData.status?.toLowerCase() !== 'confirmed') {
        console.log('❌ CallButton DEBUG - Not confirmed appointment');
        setCallStatus({
          canCall: false,
          reason: 'Appointment must be confirmed',
          timeUntil: ''
        });
        return;
      }

      try {
        // FIXED: Use proper timezone parsing
        console.log('🔍 CallButton DEBUG - Parsing datetime:', {
          appointment_date: appointmentData.appointment_date,
          slot_time: appointmentData.slot_time
        });

        const appointmentDateTime = parseAppointmentDateTime(
          appointmentData.appointment_date, 
          appointmentData.slot_time
        );

        if (!appointmentDateTime) {
          throw new Error('Failed to parse appointment datetime');
        }

        console.log('🔍 CallButton DEBUG - Parsed datetime:', {
          appointmentDateTime: appointmentDateTime.toISOString(),
          localString: appointmentDateTime.toString(),
          hours: appointmentDateTime.getHours(),
          minutes: appointmentDateTime.getMinutes()
        });

        const now = new Date();

        // FIXED: Proper call window calculation
        // Allow calls from 15 minutes before to 30 minutes after appointment time
        const startWindow = new Date(appointmentDateTime.getTime() - 15 * 60 * 1000); // 15 min before
        const endWindow = new Date(appointmentDateTime.getTime() + 30 * 60 * 1000);   // 30 min after

        console.log('🔍 CallButton DEBUG - Time windows:', {
          now: now.toISOString(),
          nowLocal: now.toString(),
          startWindow: startWindow.toISOString(),
          startWindowLocal: startWindow.toString(),
          endWindow: endWindow.toISOString(),
          endWindowLocal: endWindow.toString(),
          appointmentDateTime: appointmentDateTime.toISOString(),
          appointmentLocal: appointmentDateTime.toString()
        });

        if (now < startWindow) {
          const minutesUntil = Math.ceil((startWindow - now) / (1000 * 60));
          console.log('⏰ CallButton DEBUG - Too early, minutes until:', minutesUntil);
          setCallStatus({
            canCall: false,
            reason: `Call available in ${minutesUntil} minutes`,
            timeUntil: `Available at ${startWindow.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}`
          });
        } else if (now > endWindow) {
          console.log('❌ CallButton DEBUG - Call window expired');
          const appointmentTime = appointmentDateTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });
          const endTime = endWindow.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });
          setCallStatus({
            canCall: false,
            reason: `Call window expired. Was available from ${appointmentTime} to ${endTime}`,
            timeUntil: ''
          });
        } else {
          // Calculate remaining time in the call window
          const remainingMinutes = Math.floor((endWindow - now) / (1000 * 60));
          console.log('✅ CallButton DEBUG - Call available now! Remaining minutes:', remainingMinutes);
          setCallStatus({
            canCall: true,
            reason: `Call available - ${remainingMinutes} minutes remaining`,
            timeUntil: `Available until ${endWindow.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}`
          });
        }
      } catch (error) {
        console.error('❌ CallButton DEBUG - Error parsing appointment time:', error);
        console.error('   appointmentData was:', appointmentData);
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
    console.log('📞 CallButton DEBUG - Handle call clicked:', {
      canCall: callStatus.canCall,
      receiverId,
      appointmentId,
      reason: callStatus.reason
    });

    if (callStatus.canCall && receiverId && appointmentId) {
      console.log('✅ CallButton DEBUG - Initiating call...');
      initiateCall(receiverId, appointmentId);
    } else if (!callStatus.canCall) {
      // Show why call is not available
      console.warn('❌ CallButton DEBUG - Call not available:', callStatus.reason);
    } else {
      console.warn('❌ CallButton DEBUG - Missing required data for call:', {
        hasReceiverId: !!receiverId,
        hasAppointmentId: !!appointmentId
      });
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
            <div className="text-center">
              <div>Call {doctorName}</div>
              <div className="text-xs text-gray-300 mt-1">{callStatus.reason}</div>
              {callStatus.timeUntil && (
                <div className="text-xs text-gray-300">{callStatus.timeUntil}</div>
              )}
            </div>
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