// services/VideoCallService.js - One-on-One Call Service
import { getStoredUserData, isUserAuthenticated, getValidAccessToken } from "../utils/auth"

class VideoCallService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.connected = false; // Fixed: use consistent property name
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.messageQueue = []; // Queue messages while disconnected
    this.currentCall = null; // Store current call info
    this.roomName = null; // Store current room name
  }

  // Fixed: Consistent isConnected method
  isConnected() {
    return this.connected && 
           this.socket && 
           this.socket.readyState === WebSocket.OPEN;
  }

  // Get JWT token
  getJWTToken() {
    try {
      const token = getValidAccessToken();
      return token || null;
    } catch (error) {
      console.error('Error during token retrieval:', error);
      return null;
    }
  }

  // Get current user data
  getCurrentUser() {
    try {
      return getStoredUserData();
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  async connect(userId) {
    // Close existing connection if different user or if connection exists
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (this.userId === userId) {
        console.log('Already connected for the same user');
        return Promise.resolve();
      }
      this.disconnect();
    }

    this.userId = userId;
    const token = this.getJWTToken();
    
    if (!token) {
      console.error("Cannot connect: token not found");
      throw new Error("Authentication token not found");
    }

    if (!isUserAuthenticated()) {
      console.error("Cannot connect: user not authenticated");
      throw new Error("User not authenticated");
    }

    const wsUrl = `ws://localhost:8000/ws/video_call/${userId}/`;

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(wsUrl);
        this.setupEventListeners(resolve, reject);
        console.log(`🔌 Connecting to video call service for user: ${userId}`);
      } catch (error) {
        console.error('VideoCall WebSocket connection error:', error);
        reject(error);
      }
    });
  }

  setupEventListeners(connectResolve = null, connectReject = null) {
    if (!this.socket) return;

    // Connection timeout
    const connectionTimeout = setTimeout(() => {
      if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
        const error = new Error('Connection timeout');
        console.error('❌ VideoCall connection timeout');
        if (connectReject) connectReject(error);
      }
    }, 10000);

    this.socket.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log('✅ VideoCall WebSocket connected');
      this.connected = true; // Fixed: use consistent property
      this.reconnectAttempts = 0;

      // Send queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.socket.send(JSON.stringify(message));
      }

      this.triggerHandler('connection', { status: 'connected' });
      if (connectResolve) connectResolve();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 VideoCall message received:', data);
        this.handleMessage(data);
      } catch (error) {
        console.error('❌ Error parsing VideoCall WebSocket message:', error);
      }
    };

    this.socket.onclose = async (event) => {
      clearTimeout(connectionTimeout);
      console.log('🔌 VideoCall WebSocket disconnected:', event.code, event.reason);
      this.connected = false; // Fixed: use consistent property
      this.triggerHandler('connection', { status: 'disconnected' });
      this.triggerHandler('disconnect', { code: event.code, reason: event.reason });

      // Auto-reconnect logic (only if not a clean disconnect)
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(async () => {
          this.reconnectAttempts++;
          console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
          
          const token = this.getJWTToken();
          if (token && this.userId && isUserAuthenticated()) {
            try {
              await this.connect(this.userId);
            } catch (error) {
              console.error('❌ Reconnection failed:', error);
            }
          }
        }, this.reconnectInterval);
      }

      // If initial connection failed
      if (this.socket && this.socket.readyState === WebSocket.CONNECTING && connectReject) {
        connectReject(new Error(`Connection failed: ${event.code} ${event.reason}`));
      }
    };

    this.socket.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error('❌ VideoCall WebSocket error:', error);
      this.triggerHandler('error', { error });
      
      // If initial connection failed
      if (connectReject) {
        connectReject(error);
      }
    };
  }

  handleMessage(data) {
    const { type } = data;
    
    switch (type) {
      case 'incoming_call':
        this.currentCall = {
          callId: data.call_id,
          callerId: data.caller_id,
          callerName: data.caller_name,
          roomName: data.room_name,
          status: 'incoming'
        };
        this.triggerHandler('incoming_call', data);
        break;

      case 'call_initiated':
        this.currentCall = {
          callId: data.call_id,
          roomName: data.room_name,
          status: data.status || 'initiated'
        };
        this.roomName = data.room_name;
        this.triggerHandler('call_initiated', data);
        break;

      case 'call_accepted':
        if (this.currentCall) {
          this.currentCall.status = 'accepted';
        }
        this.triggerHandler('call_accepted', data);
        break;

      case 'call_rejected':
        if (this.currentCall) {
          this.currentCall.status = 'rejected';
        }
        this.triggerHandler('call_rejected', data);
        break;

      case 'call_ended':
        if (this.currentCall) {
          this.currentCall.status = 'ended';
        }
        this.triggerHandler('call_ended', data);
        break;

      case 'offer':
      case 'webrtc_offer':
        this.triggerHandler('webrtc_offer', data);
        break;

      case 'answer':
      case 'webrtc_answer':
        this.triggerHandler('webrtc_answer', data);
        break;

      case 'ice_candidate':
        this.triggerHandler('ice_candidate', data);
        break;

      default:
        console.log('❓ Unknown VideoCall message type:', type, data);
        this.triggerHandler('unknown_message', data);
    }
  }

  // Register event handlers
  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event).push(handler);
  }

  // Remove event handlers
  off(event, handler) {
    if (this.messageHandlers.has(event)) {
      const handlers = this.messageHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Remove all handlers for an event
  removeAllHandlers(event) {
    if (this.messageHandlers.has(event)) {
      this.messageHandlers.delete(event);
    }
  }

  // Fixed: Add removeAllListeners alias for compatibility
  removeAllListeners(event) {
    this.removeAllHandlers(event);
  }

  // Trigger event handlers
  triggerHandler(event, data) {
    if (this.messageHandlers.has(event)) {
      this.messageHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in ${event} handler:`, error);
        }
      });
    }
  }

  // Fixed: Add emit alias for compatibility
  emit(event, data) {
    this.triggerHandler(event, data);
  }

  // Send messages
  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('❌ Error sending message:', error);
        return false;
      }
    } else {
      // Queue message if not connected
      this.messageQueue.push(data);
      console.warn('⚠️ VideoCall WebSocket is not connected, message queued');
      return false;
    }
  }

  // Call management methods
  initiateCall(calleeId) {
    console.log(`📞 Initiating call to user: ${calleeId}`);
    return this.send({
      type: 'call_initiate',
      callee_id: calleeId
    });
  }

  acceptCall(callId, roomName) {
    console.log(`✅ Accepting call: ${callId}`);
    this.roomName = roomName;
    return this.send({
      type: 'call_accept',
      call_id: callId,
      room_name: roomName
    });
  }

  rejectCall(callId, roomName) {
    console.log(`❌ Rejecting call: ${callId}`);
    return this.send({
      type: 'call_reject',
      call_id: callId,
      room_name: roomName
    });
  }

  endCall(callId, roomName) {
    console.log(`🔚 Ending call: ${callId}`);
    return this.send({
      type: 'call_end',
      call_id: callId,
      room_name: roomName || this.roomName
    });
  }

  // WebRTC signaling methods
  sendOffer(offer, roomName) {
  if (!roomName) {
    console.error('❌ Room name is required to send offer');
    return;
  }
  
  const message = {
    type: 'offer',
    offer: offer,
    room_name: roomName
  };
  
  console.log('📤 Sending WebRTC offer to room:', roomName);
  this.send(message);
}

  sendAnswer(answer, roomName) {
  if (!roomName) {
    console.error('❌ Room name is required to send answer');
    return;
  }
  
  const message = {
    type: 'answer',
    answer: answer,
    room_name: roomName
  };
  
  console.log('📤 Sending WebRTC answer to room:', roomName);
  this.send(message);
}

  sendICECandidate(candidate, roomName) {
  if (!roomName) {
    console.error('❌ Room name is required to send ICE candidate');
    return;
  }
  
  const message = {
    type: 'ice_candidate',
    candidate: candidate,
    room_name: roomName
  };
  
  console.log('🧊 Sending ICE candidate to room:', roomName);
  this.send(message);
}

  // Utility methods
  getCurrentCall() {
    return this.currentCall;
  }

  getCurrentRoomName() {
    return this.roomName;
  }

  // Fixed: Complete getConnectionStatus method
  getConnectionStatus() {
    if (!this.socket) return 'disconnected';
    
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }

  isInCall() {
    return this.currentCall && ['calling', 'accepted', 'initiated'].includes(this.currentCall.status);
  }

  // Clean up current call
  clearCurrentCall() {
    this.currentCall = null;
    this.roomName = null;
  }

  disconnect() {
    console.log('🔌 Disconnecting VideoCall WebSocket');
    
    // End current call if active
    if (this.isInCall()) {
      this.endCall(this.currentCall?.callId, this.roomName);
    }

    // Close socket cleanly
    if (this.socket) {
      try {
        this.socket.close(1000, 'User disconnected');
      } catch (error) {
        console.error('Error closing socket:', error);
      }
      this.socket = null;
    }
    
    // Reset all state
    this.connected = false;
    this.userId = null;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.clearCurrentCall();
    
    // Clear all handlers
    this.messageHandlers.clear();
  }

  // Debug methods
  getDebugInfo() {
    return {
      isConnected: this.isConnected(),
      connected: this.connected,
      userId: this.userId,
      currentCall: this.currentCall,
      roomName: this.roomName,
      messageQueueLength: this.messageQueue.length,
      socketState: this.getConnectionStatus(),
      reconnectAttempts: this.reconnectAttempts,
      handlersCount: Array.from(this.messageHandlers.entries()).map(([event, handlers]) => ({
        event,
        count: handlers.length
      }))
    };
  }
}

// Create singleton instance
const videoCallService = new VideoCallService();

export default videoCallService;