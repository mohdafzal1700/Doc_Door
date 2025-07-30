// videoCallService.js - Video call WebSocket service with fixed reconnection logic
import { getValidAccessToken, isUserAuthenticated } from "../utils/auth"

// Base URL for video call WebSocket connections
const VIDEO_CALL_URL = "ws://localhost:8000/ws/video_call/"

// WebSocket instances for video calls
const videoCallSockets = new Map()
const reconnectAttempts = new Map()
const maxReconnectAttempts = 3 // Reduced from 5
const connectionStates = new Map()
const reconnectTimeouts = new Map() // Track active reconnection timeouts

// Get JWT token
const getJWTToken = () => {
  try {
    const token = getValidAccessToken()
    return token || null
  } catch (error) {
    console.error('Error during token retrieval:', error)
    return null
  }
}

// Simple validation helper
const isValidUserId = (userId) => {
  return userId && (typeof userId === 'string' || typeof userId === 'number')
}

// Clear reconnection timeout for a socket
const clearReconnectionTimeout = (socketKey) => {
  const timeoutId = reconnectTimeouts.get(socketKey)
  if (timeoutId) {
    clearTimeout(timeoutId)
    reconnectTimeouts.delete(socketKey)
  }
}

// Connect to video call WebSocket
export const connectVideoCallSocket = async (userId) => {
  const socketKey = `video_call_${userId}`
  
  // Validate inputs
  if (!isValidUserId(userId)) {
    console.error('Invalid user ID provided')
    return null
  }

  if (!isUserAuthenticated()) {
    console.error('User not authenticated - cannot create WebSocket')
    return null
  }

  // Check for existing connection
  const existingSocket = videoCallSockets.get(socketKey)
  if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
    console.log('Reusing existing video call WebSocket connection')
    return existingSocket
  } else if (existingSocket) {
    try {
      existingSocket.close(1000, "Replacing connection")
    } catch (e) {
      console.error('Error closing old video call connection:', e)
    }
    videoCallSockets.delete(socketKey)
  }

  // Clear any pending reconnection
  clearReconnectionTimeout(socketKey)

  // Check if already connecting
  const currentState = connectionStates.get(socketKey)
  if (currentState === 'connecting') {
    console.log('Already connecting to video call, waiting...')
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const socket = videoCallSockets.get(socketKey)
        const state = connectionStates.get(socketKey)
        if (socket && socket.readyState === WebSocket.OPEN) {
          clearInterval(checkInterval)
          resolve(socket)
        } else if (state !== 'connecting') {
          clearInterval(checkInterval)
          resolve(null)
        }
      }, 100)
      
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve(null)
      }, 10000)
    })
  }

  connectionStates.set(socketKey, 'connecting')

  const token = getJWTToken()
  if (!token) {
    console.error('No authentication token available')
    connectionStates.delete(socketKey)
    return null
  }

  const wsUrl = `${VIDEO_CALL_URL}${userId}/?token=${encodeURIComponent(token)}`

  try {
    const videoCallSocket = new WebSocket(wsUrl)
    videoCallSockets.set(socketKey, videoCallSocket)

    videoCallSocket.onopen = (event) => {
      console.log('Video call WebSocket connected')
      const currentSocket = videoCallSockets.get(socketKey)
      if (currentSocket === videoCallSocket && videoCallSocket.readyState === WebSocket.OPEN) {
        connectionStates.set(socketKey, 'connected')
        reconnectAttempts.delete(socketKey) // Reset attempts on successful connection
        clearReconnectionTimeout(socketKey) // Clear any pending reconnection
      }
    }

    videoCallSocket.onclose = (event) => {
      console.log('Video call WebSocket disconnected:', event.code, event.reason)
      
      const wasCurrentSocket = videoCallSockets.get(socketKey) === videoCallSocket
      if (wasCurrentSocket) {
        videoCallSockets.delete(socketKey)
        connectionStates.delete(socketKey)
      }

      // Improved reconnection logic
      const authErrors = [4000, 4001, 4003, 4004]
      const serverErrors = [1011] // Add server internal error
      const shouldNotReconnect = 
        event.code === 1000 || // Normal closure
        authErrors.includes(event.code) ||
        serverErrors.includes(event.code) // Don't reconnect on server errors

      const currentAttempts = reconnectAttempts.get(socketKey) || 0
      const hasAttemptsLeft = currentAttempts < maxReconnectAttempts

      if (!shouldNotReconnect && hasAttemptsLeft && wasCurrentSocket) {
        const attempts = currentAttempts + 1
        reconnectAttempts.set(socketKey, attempts)
        
        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempts), 30000)
        const jitter = Math.random() * 1000 // Add randomness to prevent thundering herd
        const delay = baseDelay + jitter
        
        console.log(`Reconnecting video call in ${Math.round(delay)}ms (attempt ${attempts}/${maxReconnectAttempts})`)
        
        const timeoutId = setTimeout(() => {
          // Only reconnect if no active socket exists
          if (!videoCallSockets.has(socketKey)) {
            console.log(`Attempting reconnection ${attempts}/${maxReconnectAttempts}`)
            connectVideoCallSocket(userId)
          } else {
            console.log('Socket already exists, skipping reconnection')
          }
          reconnectTimeouts.delete(socketKey)
        }, delay)
        
        reconnectTimeouts.set(socketKey, timeoutId)
        
      } else {
        // Cleanup and stop reconnecting
        reconnectAttempts.delete(socketKey)
        clearReconnectionTimeout(socketKey)
        
        if (shouldNotReconnect) {
          if (authErrors.includes(event.code)) {
            console.error('Video call authentication/authorization failed - stopping reconnection')
            window.dispatchEvent(new CustomEvent('video_call_auth_error', { 
              detail: { 
                code: event.code, 
                reason: event.reason, 
                userId, 
                socketKey 
              } 
            }))
          } else if (serverErrors.includes(event.code)) {
            console.error('Server error - stopping reconnection')
            window.dispatchEvent(new CustomEvent('video_call_server_error', { 
              detail: { 
                code: event.code, 
                reason: event.reason, 
                userId, 
                socketKey 
              } 
            }))
          }
        } else if (!hasAttemptsLeft) {
          console.error(`Max reconnection attempts (${maxReconnectAttempts}) reached for video call`)
          window.dispatchEvent(new CustomEvent('video_call_max_retries_exceeded', { 
            detail: { 
              userId, 
              socketKey,
              attempts: currentAttempts
            } 
          }))
        }
      }
    }

    videoCallSocket.onerror = (error) => {
      console.error('Video call WebSocket error:', error)
      if (videoCallSockets.get(socketKey) === videoCallSocket) {
        connectionStates.set(socketKey, 'error')
      }
    }

    videoCallSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'error' && data.message && data.message.toLowerCase().includes('authentication')) {
          // Stop reconnection on auth errors from server messages
          reconnectAttempts.delete(socketKey)
          clearReconnectionTimeout(socketKey)
          
          window.dispatchEvent(new CustomEvent('video_call_auth_error', { 
            detail: { 
              message: data.message, 
              userId, 
              socketKey, 
              serverError: true 
            } 
          }))
        }
        
        window.dispatchEvent(new CustomEvent('video_call_message', { 
          detail: { 
            userId, 
            data, 
            socketKey, 
            timestamp: new Date().toISOString(), 
            messageType: data.type 
          } 
        }))
      } catch (parseError) {
        console.error('Failed to parse video call server message:', parseError)
      }
    }

    // Connection timeout
    const timeoutId = setTimeout(() => {
      if (videoCallSocket.readyState === WebSocket.CONNECTING) {
        console.error('Video call WebSocket connection timeout')
        videoCallSocket.close()
        if (videoCallSockets.get(socketKey) === videoCallSocket) {
          videoCallSockets.delete(socketKey)
          connectionStates.delete(socketKey)
        }
      }
    }, 15000)

    const clearTimeoutHandler = () => clearTimeout(timeoutId)
    videoCallSocket.addEventListener('open', clearTimeoutHandler)
    videoCallSocket.addEventListener('close', clearTimeoutHandler)

    return videoCallSocket

  } catch (error) {
    console.error('Error creating video call WebSocket:', error)
    videoCallSockets.delete(socketKey)
    connectionStates.delete(socketKey)
    return null
  }
}

// Helper function to ensure socket connection
const ensureVideoCallSocketConnection = async (userId) => {
  const socketKey = `video_call_${userId}`
  let socket = videoCallSockets.get(socketKey)
  
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log('Video call socket not connected, attempting to connect...')
    socket = await connectVideoCallSocket(userId)
  }
  
  return socket
}

// Initiate a video call
export const initiateCall = async (userId, calleeId) => {
  const socket = await ensureVideoCallSocketConnection(userId)
  if (!socket) {
    console.error('Failed to establish video call socket connection')
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (socket.readyState !== WebSocket.OPEN) {
    console.error(`Video call WebSocket not connected. State: ${socket.readyState}`)
    return { success: false, error: 'WebSocket not connected' }
  }

  if (!calleeId) {
    console.error('Callee ID is required')
    return { success: false, error: 'Callee ID is required' }
  }

  const message = {
    type: 'call_initiate',
    callee_id: String(calleeId).trim(),
    timestamp: new Date().toISOString()
  }

  try {
    socket.send(JSON.stringify(message))
    return { success: true, calleeId, message }
  } catch (error) {
    console.error('Failed to initiate call:', error)
    return { success: false, error: error.message }
  }
}

// Accept an incoming call
export const acceptCall = async (userId, callId, roomName) => {
  const socket = await ensureVideoCallSocketConnection(userId)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!callId || !roomName) {
    return { success: false, error: 'Call ID and room name are required' }
  }

  const message = {
    type: 'call_accept',
    call_id: callId,
    room_name: roomName,
    timestamp: new Date().toISOString()
  }

  try {
    socket.send(JSON.stringify(message))
    return { success: true, callId, roomName, message }
  } catch (error) {
    console.error('Failed to accept call:', error)
    return { success: false, error: error.message }
  }
}

// Reject an incoming call
export const rejectCall = async (userId, callId, roomName) => {
  const socket = await ensureVideoCallSocketConnection(userId)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!callId || !roomName) {
    return { success: false, error: 'Call ID and room name are required' }
  }

  const message = {
    type: 'call_reject',
    call_id: callId,
    room_name: roomName,
    timestamp: new Date().toISOString()
  }

  try {
    socket.send(JSON.stringify(message))
    return { success: true, callId, roomName, message }
  } catch (error) {
    console.error('Failed to reject call:', error)
    return { success: false, error: error.message }
  }
}

// End an active call
export const endCall = async (userId, callId, roomName) => {
  const socket = await ensureVideoCallSocketConnection(userId)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!callId || !roomName) {
    return { success: false, error: 'Call ID and room name are required' }
  }

  const message = {
    type: 'call_end',
    call_id: callId,
    room_name: roomName,
    timestamp: new Date().toISOString()
  }

  try {
    socket.send(JSON.stringify(message))
    return { success: true, callId, roomName, message }
  } catch (error) {
    console.error('Failed to end call:', error)
    return { success: false, error: error.message }
  }
}

// WebRTC signaling functions
// Send WebRTC offer
export const sendOffer = async (userId, roomName, offer) => {
  const socket = await ensureVideoCallSocketConnection(userId)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!roomName || !offer) {
    return { success: false, error: 'Room name and offer are required' }
  }

  const message = {
    type: 'offer',
    room_name: roomName,
    offer: offer,
    timestamp: new Date().toISOString()
  }

  try {
    socket.send(JSON.stringify(message))
    return { success: true, roomName, offer, message }
  } catch (error) {
    console.error('Failed to send offer:', error)
    return { success: false, error: error.message }
  }
}

// Send WebRTC answer
export const sendAnswer = async (userId, roomName, answer) => {
  const socket = await ensureVideoCallSocketConnection(userId)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!roomName || !answer) {
    return { success: false, error: 'Room name and answer are required' }
  }

  const message = {
    type: 'answer',
    room_name: roomName,
    answer: answer,
    timestamp: new Date().toISOString()
  }

  try {
    socket.send(JSON.stringify(message))
    return { success: true, roomName, answer, message }
  } catch (error) {
    console.error('Failed to send answer:', error)
    return { success: false, error: error.message }
  }
}

// Send ICE candidate
export const sendIceCandidate = async (userId, roomName, candidate) => {
  const socket = await ensureVideoCallSocketConnection(userId)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!roomName || !candidate) {
    return { success: false, error: 'Room name and candidate are required' }
  }

  const message = {
    type: 'ice_candidate',
    room_name: roomName,
    candidate: candidate,
    timestamp: new Date().toISOString()
  }

  try {
    socket.send(JSON.stringify(message))
    return { success: true, roomName, candidate, message }
  } catch (error) {
    console.error('Failed to send ICE candidate:', error)
    return { success: false, error: error.message }
  }
}

// Get video call connection status
export const getVideoCallConnectionStatus = (userId = null) => {
  if (userId) {
    const socketKey = `video_call_${userId}`
    const socket = videoCallSockets.get(socketKey)
    const state = connectionStates.get(socketKey) || 'disconnected'
    const reconnectCount = reconnectAttempts.get(socketKey) || 0
    const hasReconnectTimeout = reconnectTimeouts.has(socketKey)
    
    return {
      connected: socket?.readyState === WebSocket.OPEN,
      state: state,
      readyState: socket?.readyState || WebSocket.CLOSED,
      socketExists: !!socket,
      socketKey: socketKey,
      reconnectAttempts: reconnectCount,
      isReconnecting: hasReconnectTimeout
    }
  }

  const status = {
    videoCallSockets: {},
    totalSockets: videoCallSockets.size,
    connectionStates: Object.fromEntries(connectionStates),
    reconnectAttempts: Object.fromEntries(reconnectAttempts),
    activeReconnections: reconnectTimeouts.size
  }

  videoCallSockets.forEach((socket, key) => {
    status.videoCallSockets[key] = {
      connected: socket.readyState === WebSocket.OPEN,
      readyState: socket.readyState,
      state: connectionStates.get(key) || 'unknown',
      reconnectAttempts: reconnectAttempts.get(key) || 0,
      isReconnecting: reconnectTimeouts.has(key)
    }
  })

  return status
}

// Close specific video call socket
export const closeVideoCallSocket = (userId = null) => {
  if (userId) {
    const socketKey = `video_call_${userId}`
    const socket = videoCallSockets.get(socketKey)
    
    // Clear any pending reconnection
    clearReconnectionTimeout(socketKey)
    
    if (socket) {
      try {
        socket.close(1000, "Manual close")
      } catch (e) {
        console.error('Error closing video call socket:', e)
      }
      videoCallSockets.delete(socketKey)
      connectionStates.delete(socketKey)
      reconnectAttempts.delete(socketKey)
    }
  } else {
    // Close all video call sockets
    videoCallSockets.forEach((socket, key) => {
      clearReconnectionTimeout(key)
      try {
        socket.close(1000, "Manual close all")
      } catch (e) {
        console.error(`Error closing video call socket ${key}:`, e)
      }
    })
    videoCallSockets.clear()
    connectionStates.clear()
    reconnectAttempts.clear()
    reconnectTimeouts.clear()
  }
}

// Force stop all reconnections
export const stopAllReconnections = () => {
  reconnectTimeouts.forEach((timeoutId, socketKey) => {
    clearTimeout(timeoutId)
    console.log(`Stopped reconnection for ${socketKey}`)
  })
  reconnectTimeouts.clear()
  reconnectAttempts.clear()
}

// Legacy function for backward compatibility
export const getVideoCallSocket = connectVideoCallSocket

// Close all video call sockets
export const closeAllVideoCallSockets = () => {
  closeVideoCallSocket()
}