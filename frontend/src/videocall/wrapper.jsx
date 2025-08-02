// components/GlobalVideoCallWrapper.js
import React from 'react';
import { useVideoCall } from './context';
import IncomingCallModal from './incomingcall';
import VideoCallPage from './videocallpage';


const GlobalVideoCallWrapper = ({ children }) => {
  const { isCalling, currentCall } = useVideoCall();

  return (
    <>
   
      {children}
      
      
      <IncomingCallModal />
      
     
      {isCalling && currentCall && (
        <VideoCallPage 
          callData={currentCall}
        />
      )}
    </>
  );
};

export default GlobalVideoCallWrapper;