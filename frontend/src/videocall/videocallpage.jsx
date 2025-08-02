// components/VideoCallPage.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  MessageCircle, 
  Signal, 
  X, 
  Move 
} from 'lucide-react';
import { useVideoCall } from './context';

const VideoCallPage = ({ 
  callData, 
  onEndCall,
  className = "" 
}) => {
  const { 
    localVideoRef, 
    remoteVideoRef, 
    connectionStatus, 
    endCall 
  } = useVideoCall();
  
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [localVideoPosition, setLocalVideoPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle microphone
  const toggleMute = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const audioTracks = localVideoRef.current.srcObject.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle camera
  const toggleCamera = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const videoTracks = localVideoRef.current.srcObject.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  // Get connection quality display
  const getConnectionQuality = () => {
    switch (connectionStatus) {
      case 'connected':
        return { text: 'Excellent', color: 'text-green-400' };
      case 'connecting':
        return { text: 'Connecting...', color: 'text-yellow-400' };
      case 'disconnected':
        return { text: 'Disconnected', color: 'text-red-400' };
      case 'failed':
        return { text: 'Failed', color: 'text-red-400' };
      default:
        return { text: 'Unknown', color: 'text-gray-400' };
    }
  };

  // Dragging functionality for local video
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX - localVideoPosition.x,
      startY: e.clientY - localVideoPosition.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setLocalVideoPosition({
      x: e.clientX - dragRef.current.startX,
      y: e.clientY - dragRef.current.startY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Handle end call
  const handleEndCall = () => {
    endCall();
    if (onEndCall) {
      onEndCall();
    }
  };

  const quality = getConnectionQuality();

  return (
    <div className={`fixed inset-0 bg-black ${className}`}>
      {/* Remote Video (Full Screen) */}
      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-cover"
        />
        {!remoteVideoRef?.current?.srcObject && (
          <div className="text-white text-center absolute">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center text-6xl">
              👤
            </div>
            <p className="text-xl">Connecting...</p>
            <p className="text-gray-400">Waiting for remote video</p>
          </div>
        )}
      </div>

      {/* Local Video (Draggable) */}
      <div 
        className="absolute w-48 h-36 bg-gray-700 rounded-lg overflow-hidden shadow-2xl cursor-move"
        style={{ 
          right: `${localVideoPosition.x}px`, 
          bottom: `${localVideoPosition.y}px` 
        }}
        onMouseDown={handleMouseDown}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted={true}
          className="w-full h-full object-cover"
        />
        {(!localVideoRef?.current?.srcObject || isCameraOff) && (
          <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
            <div className="text-white text-center">
              {isCameraOff ? (
                <CameraOff className="w-8 h-8 mx-auto" />
              ) : (
                <div className="text-2xl">👤</div>
              )}
              <p className="text-xs mt-1">You</p>
            </div>
          </div>
        )}
        <Move className="absolute top-2 right-2 w-4 h-4 text-white opacity-50" />
      </div>

      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex justify-between items-center text-white">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm">{formatDuration(callDuration)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Signal className="w-4 h-4" />
              <span className={`text-xs ${quality.color}`}>{quality.text}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6">
        <div className="flex justify-center items-center space-x-6">
          {/* Mic Toggle */}
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-all duration-200 ${
              isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5 text-white" />
            ) : (
              <Mic className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`p-3 rounded-full transition-all duration-200 ${
              isCameraOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isCameraOff ? (
              <CameraOff className="w-5 h-5 text-white" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-full transition-all duration-200"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Chat</h3>
            <button onClick={() => setShowChat(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 p-4">
            <p className="text-gray-500 text-center">No messages yet</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallPage;