// websocketService.js - Clean version with dedicated connect functions
import { getStoredUserData, isUserAuthenticated, getValidAccessToken } from "../utils/auth"

// Base URLs for WebSocket connections
const CHAT_URL = "ws://localhost:8000/ws/chat/"
const NOTIFICATION_URL = "ws://localhost:8000/ws/notifications/"

// WebSocket instances
const chatSockets = new Map()
let notificationSocketInstance = null
const reconnectAttempts = new Map()
const maxReconnectAttempts = 5
const connectionStates = new Map()

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

// Connect to chat WebSocket
export const connectChatSocket = async (conversationId, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`
  
  // Validate inputs
  if (!conversationId || typeof conversationId !== 'string') {
    console.error('Invalid conversation ID provided')
    return null
  }

  if (!isUserAuthenticated()) {
    console.error('User not authenticated - cannot create WebSocket')
    return null
  }

  // Check for existing connection
  const existingSocket = chatSockets.get(socketKey)
  if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
    console.log('Reusing existing WebSocket connection')
    return existingSocket
  } else if (existingSocket) {
    try {
      existingSocket.close(1000, "Replacing connection")
    } catch (e) {
      console.error('Error closing old connection:', e)
    }
    chatSockets.delete(socketKey)
  }

  // Check if already connecting
  const currentState = connectionStates.get(socketKey)
  if (currentState === 'connecting') {
    console.log('Already connecting, waiting...')
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const socket = chatSockets.get(socketKey)
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

  const wsUrl = `${CHAT_URL}${conversationId}/?token=${encodeURIComponent(token)}`

  try {
    const chatSocket = new WebSocket(wsUrl)
    chatSockets.set(socketKey, chatSocket)

    chatSocket.onopen = (event) => {
      console.log('Chat WebSocket connected')
      const currentSocket = chatSockets.get(socketKey)
      if (currentSocket === chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        connectionStates.set(socketKey, 'connected')
        reconnectAttempts.delete(socketKey)
      }
    }

    chatSocket.onclose = (event) => {
      console.log('Chat WebSocket disconnected:', event.code, event.reason)
      const wasCurrentSocket = chatSockets.get(socketKey) === chatSocket
      if (wasCurrentSocket) {
        chatSockets.delete(socketKey)
        connectionStates.delete(socketKey)
      }

      // Reconnection logic
      const authErrors = [4000, 4001, 4003, 4004]
      const shouldNotReconnect = event.code === 1000 || authErrors.includes(event.code)
      const currentAttempts = reconnectAttempts.get(socketKey) || 0
      const hasAttemptsLeft = currentAttempts < maxReconnectAttempts

      if (!shouldNotReconnect && hasAttemptsLeft) {
        const attempts = currentAttempts + 1
        reconnectAttempts.set(socketKey, attempts)
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
        setTimeout(() => {
          if (!chatSockets.has(socketKey)) {
            connectChatSocket(conversationId, currentUserId)
          }
        }, delay)
      } else if (authErrors.includes(event.code)) {
        console.error('Authentication/Authorization failed')
        window.dispatchEvent(new CustomEvent('websocket_auth_error', {
          detail: { code: event.code, reason: event.reason, conversationId, socketKey }
        }))
      }
    }

    chatSocket.onerror = (error) => {
      console.error('Chat WebSocket error:', error)
      if (chatSockets.get(socketKey) === chatSocket) {
        connectionStates.set(socketKey, 'error')
      }
    }

    chatSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'error' && data.message && data.message.toLowerCase().includes('authentication')) {
          window.dispatchEvent(new CustomEvent('websocket_auth_error', {
            detail: { message: data.message, conversationId, socketKey, serverError: true }
          }))
        }

        window.dispatchEvent(new CustomEvent('websocket_message', {
          detail: {
            conversationId,
            data,
            socketKey,
            timestamp: new Date().toISOString(),
            messageType: data.type
          }
        }))
      } catch (parseError) {
        console.error('Failed to parse server message:', parseError)
      }
    }

    // Connection timeout
    const timeoutId = setTimeout(() => {
      if (chatSocket.readyState === WebSocket.CONNECTING) {
        console.error('Chat WebSocket connection timeout')
        chatSocket.close()
        if (chatSockets.get(socketKey) === chatSocket) {
          chatSockets.delete(socketKey)
          connectionStates.delete(socketKey)
        }
      }
    }, 15000)

    const clearTimeoutHandler = () => clearTimeout(timeoutId)
    chatSocket.addEventListener('open', clearTimeoutHandler)
    chatSocket.addEventListener('close', clearTimeoutHandler)

    return chatSocket
  } catch (error) {
    console.error('Error creating Chat WebSocket:', error)
    chatSockets.delete(socketKey)
    connectionStates.delete(socketKey)
    return null
  }
}

// Connect to notification WebSocket
export const connectNotificationSocket = async () => {
  if (!isUserAuthenticated()) {
    console.error('User not authenticated - cannot create notification WebSocket')
    return null
  }

  // Check for existing connection
  if (notificationSocketInstance && notificationSocketInstance.readyState === WebSocket.OPEN) {
    console.log('Reusing existing notification WebSocket connection')
    return notificationSocketInstance
  } else if (notificationSocketInstance) {
    try {
      notificationSocketInstance.close(1000, "Replacing connection")
    } catch (e) {
      console.error('Error closing old notification connection:', e)
    }
    notificationSocketInstance = null
  }

  const token = getJWTToken()
  if (!token) {
    console.error('No authentication token available for notifications')
    return null
  }

  const wsUrl = `${NOTIFICATION_URL}?token=${encodeURIComponent(token)}`

  try {
    const notificationSocket = new WebSocket(wsUrl)
    notificationSocketInstance = notificationSocket

    notificationSocket.onopen = (event) => {
      console.log('Notification WebSocket connected')
    }

    notificationSocket.onclose = (event) => {
      console.log('Notification WebSocket disconnected:', event.code, event.reason)
      if (notificationSocketInstance === notificationSocket) {
        notificationSocketInstance = null
      }

      // Reconnection logic
      const authErrors = [4000, 4001, 4003, 4004]
      const shouldNotReconnect = event.code === 1000 || authErrors.includes(event.code)
      
      if (!shouldNotReconnect) {
        const delay = Math.min(1000 * Math.pow(2, 1), 30000)
        setTimeout(() => {
          if (!notificationSocketInstance) {
            connectNotificationSocket()
          }
        }, delay)
      } else if (authErrors.includes(event.code)) {
        console.error('Notification authentication/authorization failed')
        window.dispatchEvent(new CustomEvent('notification_websocket_auth_error', {
          detail: { code: event.code, reason: event.reason }
        }))
      }
    }

    notificationSocket.onerror = (error) => {
      console.error('Notification WebSocket error:', error)
    }

    notificationSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('📥 Notification received:', data)

        if (data.type === 'error' && data.message && data.message.toLowerCase().includes('authentication')) {
          window.dispatchEvent(new CustomEvent('notification_websocket_auth_error', {
            detail: { message: data.message, serverError: true }
          }))
        }

        window.dispatchEvent(new CustomEvent('notification_websocket_message', {
          detail: {
            data,
            timestamp: new Date().toISOString(),
            messageType: data.type
          }
        }))
      } catch (parseError) {
        console.error('Failed to parse notification message:', parseError)
      }
    }

    // Connection timeout
    const timeoutId = setTimeout(() => {
      if (notificationSocket.readyState === WebSocket.CONNECTING) {
        console.error('Notification WebSocket connection timeout')
        notificationSocket.close()
        if (notificationSocketInstance === notificationSocket) {
          notificationSocketInstance = null
        }
      }
    }, 15000)

    const clearTimeoutHandler = () => clearTimeout(timeoutId)
    notificationSocket.addEventListener('open', clearTimeoutHandler)
    notificationSocket.addEventListener('close', clearTimeoutHandler)

    return notificationSocket
  } catch (error) {
    console.error('Error creating Notification WebSocket:', error)
    notificationSocketInstance = null
    return null
  }
}

// Legacy functions for backward compatibility
export const getChatSocket = connectChatSocket
export const getNotificationSocket = connectNotificationSocket

// Helper function to ensure socket connection
const ensureSocketConnection = async (conversationId, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`
  let socket = chatSockets.get(socketKey)
  
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log('Socket not connected, attempting to connect...')
    socket = await connectChatSocket(conversationId, currentUserId)
  }
  return socket
}

// Send chat message
export const sendChatMessage = async (conversationId, messageData, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)
  
  if (!chatSocket) {
    console.error(`Failed to establish socket connection for ${socketKey}`)
    return { success: false, error: 'Failed to establish socket connection', temp_id: messageData.temp_id }
  }

  if (chatSocket.readyState !== WebSocket.OPEN) {
    console.error(`WebSocket not connected. State: ${chatSocket.readyState}`)
    return { success: false, error: 'WebSocket not connected', temp_id: messageData.temp_id }
  }

  const content = messageData.content || messageData.message || messageData
  const receiverId = messageData.receiver_id

  if (!content || (typeof content === 'string' && content.trim().length === 0)) {
    console.error('Message content is required and cannot be empty')
    return { success: false, error: 'Message content is required', temp_id: messageData.temp_id }
  }

  if (!receiverId) {
    console.error('receiver_id is required')
    return { success: false, error: 'receiver_id is required', temp_id: messageData.temp_id }
  }

  const tempId = messageData.temp_id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const message = {
    type: 'chat_message',
    message: content,
    content: content,
    receiver_id: String(receiverId).trim(),
    conversation_id: String(conversationId).trim(),
    timestamp: new Date().toISOString(),
    temp_id: tempId,
    sender_id: String(currentUserId).trim(),
    ...messageData
  }

  try {
    chatSocket.send(JSON.stringify(message))
    return { success: true, temp_id: tempId, message: message, socketKey: socketKey }
  } catch (error) {
    console.error('Failed to send message:', error)
    return { success: false, error: error.message, temp_id: tempId }
  }
}

// Mark message as read
export const markMessageAsRead = async (conversationId, messageId, currentUserId = null) => {
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)
  
  if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!messageId) {
    return { success: false, error: 'Message ID is required' }
  }

  const markReadMessage = {
    type: 'mark_as_read',
    message_id: messageId,
    conversation_id: conversationId,
    user_id: currentUserId,
    timestamp: new Date().toISOString()
  }

  try {
    chatSocket.send(JSON.stringify(markReadMessage))
    return { success: true, messageId, conversationId }
  } catch (error) {
    console.error('Failed to send mark as read message:', error)
    return { success: false, error: error.message }
  }
}


// NEW: Notify file upload completion
export const notifyFileUploaded = async (conversationId, messageId, currentUserId = null) => {
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)
  
  if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!messageId) {
    return { success: false, error: 'Message ID is required' }
  }

  const fileUploadMessage = {
    type: 'file_uploaded',
    message_id: messageId,
    conversation_id: conversationId,
    timestamp: new Date().toISOString()
  }

  try {
    chatSocket.send(JSON.stringify(fileUploadMessage))
    return { success: true, messageId, conversationId }
  } catch (error) {
    console.error('Failed to send file upload notification:', error)
    return { success: false, error: error.message }
  }
}

// Send typing indicator
export const sendTyping = async (conversationId, isTyping = true, currentUserId = null) => {
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)
  
  if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  const typingMessage = {
    type: 'typing_indicator',
    conversation_id: conversationId,
    user_id: currentUserId,
    is_typing: isTyping,
    timestamp: new Date().toISOString()
  }

  try {
    chatSocket.send(JSON.stringify(typingMessage))
    return { success: true, isTyping, conversationId }
  } catch (error) {
    console.error('Failed to send typing indicator:', error)
    return { success: false, error: error.message }
  }
}


// Edit message
export const editChatMessage = async (conversationId, messageId, newContent, currentUserId = null) => {
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)
  
  if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!messageId || !newContent || newContent.trim().length === 0) {
    return { success: false, error: 'Message ID and content are required' }
  }

  const editMessage = {
    type: 'edit_message',
    message_id: messageId,
    content: newContent.trim(),
    conversation_id: conversationId,
    timestamp: new Date().toISOString()
  }

  try {
    chatSocket.send(JSON.stringify(editMessage))
    return { success: true, messageId, newContent: newContent.trim(), editMessage }
  } catch (error) {
    console.error('Failed to send edit message:', error)
    return { success: false, error: error.message, messageId }
  }
}

// Delete message
export const deleteChatMessage = async (conversationId, messageId, currentUserId = null) => {
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)
  
  if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (!messageId) {
    return { success: false, error: 'Message ID is required' }
  }

  const deleteMessage = {
    type: 'delete_message',
    message_id: messageId,
    conversation_id: conversationId,
    timestamp: new Date().toISOString()
  }

  try {
    chatSocket.send(JSON.stringify(deleteMessage))
    return { success: true, messageId, deleteMessage }
  } catch (error) {
    console.error('Failed to send delete message:', error)
    return { success: false, error: error.message, messageId }
  }
}

// Notification functions
export const sendNotificationMessage = async (messageData) => {
  const notificationSocket = notificationSocketInstance && notificationSocketInstance.readyState === WebSocket.OPEN 
    ? notificationSocketInstance 
    : await connectNotificationSocket()

  if (!notificationSocket || notificationSocket.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Failed to establish notification socket connection' }
  }

  try {
    notificationSocket.send(JSON.stringify(messageData))
    return { success: true, message: messageData }
  } catch (error) {
    console.error('Failed to send notification message:', error)
    return { success: false, error: error.message }
  }
}

export const markNotificationAsRead = async (notificationId) => {
  return await sendNotificationMessage({
    type: 'mark_notification_read',
    notification_id: notificationId,
    timestamp: new Date().toISOString()
  })
}

export const markAllNotificationsAsRead = async () => {
  return await sendNotificationMessage({
    type: 'mark_all_read',
    timestamp: new Date().toISOString()
  })
}

export const getNotifications = async (page = 1, limit = 20) => {
  return await sendNotificationMessage({
    type: 'get_notifications',
    page,
    limit,
    timestamp: new Date().toISOString()
  })
}

// Typing convenience functions
export const sendTypingStart = async (conversationId, currentUserId = null) => {
  return await sendTyping(conversationId, true, currentUserId)
}

export const sendTypingStop = async (conversationId, currentUserId = null) => {
  return await sendTyping(conversationId, false, currentUserId)
}

// Get connection status
export const getConnectionStatus = (conversationId = null, currentUserId = null) => {
  if (conversationId) {
    const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`
    const chatSocket = chatSockets.get(socketKey)
    const state = connectionStates.get(socketKey) || 'disconnected'
    
    return {
      connected: chatSocket?.readyState === WebSocket.OPEN,
      state: state,
      readyState: chatSocket?.readyState || WebSocket.CLOSED,
      socketExists: !!chatSocket,
      socketKey: socketKey
    }
  }

  const status = {
    chatSockets: {},
    notifications: notificationSocketInstance ? notificationSocketInstance.readyState : WebSocket.CLOSED,
    notificationsConnected: notificationSocketInstance?.readyState === WebSocket.OPEN,
    totalSockets: chatSockets.size,
    connectionStates: Object.fromEntries(connectionStates),
    reconnectAttempts: Object.fromEntries(reconnectAttempts)
  }

  chatSockets.forEach((socket, key) => {
    status.chatSockets[key] = {
      connected: socket.readyState === WebSocket.OPEN,
      readyState: socket.readyState,
      state: connectionStates.get(key) || 'unknown'
    }
  })

  return status
}

// Close specific chat socket
export const closeChatSocket = (conversationId = null, currentUserId = null) => {
  if (conversationId) {
    const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`
    const chatSocket = chatSockets.get(socketKey)
    if (chatSocket) {
      try {
        chatSocket.close(1000, "Manual close")
      } catch (e) {
        console.error('Error closing socket:', e)
      }
      chatSockets.delete(socketKey)
      connectionStates.delete(socketKey)
      reconnectAttempts.delete(socketKey)
    }
  } else {
    chatSockets.forEach((socket, key) => {
      try {
        socket.close(1000, "Manual close all")
      } catch (e) {
        console.error(`Error closing socket ${key}:`, e)
      }
    })
    chatSockets.clear()
    connectionStates.clear()
    reconnectAttempts.clear()
  }
}

// Close notification socket
export const closeNotificationSocket = () => {
  if (notificationSocketInstance) {
    try {
      notificationSocketInstance.close(1000, "Manual close")
    } catch (e) {
      console.error('Error closing notification socket:', e)
    }
    notificationSocketInstance = null
  }
}

// Close all sockets
export const closeAllSockets = () => {
  closeChatSocket()
  closeNotificationSocket()
}