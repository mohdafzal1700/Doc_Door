// websocketService.js - Complete version with notifications
import { getStoredUserData, isUserAuthenticated, getValidAccessToken } from "../utils/auth"

// Base URLs for WebSocket connections
const CHAT_URL = "ws://localhost:8000/ws/chat/"
const NOTIFICATION_URL = "ws://localhost:8000/ws/notifications/"

// WebSocket instances - using Map to track multiple conversations
const chatSockets = new Map()
let notificationSocketInstance = null
const reconnectAttempts = new Map()
const maxReconnectAttempts = 5

// Connection state management
const connectionStates = new Map()

// Get JWT token
const getJWTToken = () => {
  try {
    const token = getValidAccessToken()
    if (token) {
      return token
    } else {
      return null
    }
  } catch (error) {
    console.error('Error during token retrieval:', error)
    return null
  }
}

// Create chat WebSocket connection
export const getChatSocket = async (conversationId, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`

  // Validate inputs
  if (!conversationId || typeof conversationId !== 'string') {
    console.error('Invalid conversation ID provided')
    return null
  }

  // Check authentication
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

  // Check connection state
  const currentState = connectionStates.get(socketKey)
  if (currentState === 'connecting') {
    console.log('Already connecting, waiting...')
    // Wait for existing connection attempt
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

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve(null)
      }, 10000)
    })
  }

  connectionStates.set(socketKey, 'connecting')

  // Get authentication token
  const token = getJWTToken()
  if (!token) {
    console.error('No authentication token available')
    connectionStates.delete(socketKey)
    return null
  }

  // Build WebSocket URL
  const wsUrl = `${CHAT_URL}${conversationId}/?token=${encodeURIComponent(token)}`

  try {
    // Create WebSocket connection
    const chatSocket = new WebSocket(wsUrl)
    chatSockets.set(socketKey, chatSocket)

    // Set up event handlers
    chatSocket.onopen = (event) => {
      console.log('Chat WebSocket connected')
      const currentSocket = chatSockets.get(socketKey)
      const isCurrentSocket = currentSocket === chatSocket
      const isOpen = chatSocket.readyState === WebSocket.OPEN

      if (isCurrentSocket && isOpen) {
        connectionStates.set(socketKey, 'connected')
        reconnectAttempts.delete(socketKey)

        // Send connection test
        const testMessage = {
          type: 'connection_test',
          timestamp: new Date().toISOString(),
          user_id: currentUserId,
          conversation_id: conversationId
        }

        try {
          chatSocket.send(JSON.stringify(testMessage))
        } catch (err) {
          console.error('Failed to send connection test:', err)
        }
      }
    }

    chatSocket.onclose = (event) => {
      console.log('Chat WebSocket disconnected:', event.code, event.reason)
      const wasCurrentSocket = chatSockets.get(socketKey) === chatSocket

      if (wasCurrentSocket) {
        chatSockets.delete(socketKey)
        connectionStates.delete(socketKey)
      }

      // Determine if we should reconnect
      const authErrors = [4000, 4001, 4003, 4004]
      const shouldNotReconnect = event.code === 1000 || authErrors.includes(event.code)
      const currentAttempts = reconnectAttempts.get(socketKey) || 0
      const hasAttemptsLeft = currentAttempts < maxReconnectAttempts
      const shouldReconnect = !shouldNotReconnect && hasAttemptsLeft

      if (shouldReconnect) {
        const attempts = currentAttempts + 1
        reconnectAttempts.set(socketKey, attempts)
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000)

        setTimeout(() => {
          if (!chatSockets.has(socketKey)) {
            getChatSocket(conversationId, currentUserId)
          }
        }, delay)
      } else if (authErrors.includes(event.code)) {
        console.error('Authentication/Authorization failed')
        window.dispatchEvent(new CustomEvent('websocket_auth_error', {
          detail: {
            code: event.code,
            reason: event.reason,
            conversationId,
            socketKey
          }
        }))
      }
    }

    chatSocket.onerror = (error) => {
      console.error('Chat WebSocket error:', error)
      const isCurrentSocket = chatSockets.get(socketKey) === chatSocket
      if (isCurrentSocket) {
        connectionStates.set(socketKey, 'error')
      }
    }

    chatSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // Handle authentication errors
        if (data.type === 'error' && data.message && data.message.toLowerCase().includes('authentication')) {
          window.dispatchEvent(new CustomEvent('websocket_auth_error', {
            detail: {
              message: data.message,
              conversationId,
              socketKey,
              serverError: true
            }
          }))
        }

        // Dispatch custom event for React components
        const eventDetail = {
          conversationId,
          data,
          socketKey,
          timestamp: new Date().toISOString(),
          messageType: data.type
        }

        window.dispatchEvent(new CustomEvent('websocket_message', { detail: eventDetail }))
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

    // Clear timeout when connection changes state
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

// Create notification WebSocket connection
export const getNotificationSocket = async () => {
  // Check authentication
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

  // Get authentication token
  const token = getJWTToken()
  if (!token) {
    console.error('No authentication token available for notifications')
    return null
  }

  // Build WebSocket URL
  const wsUrl = `${NOTIFICATION_URL}?token=${encodeURIComponent(token)}`

  try {
    // Create WebSocket connection
    const notificationSocket = new WebSocket(wsUrl)
    notificationSocketInstance = notificationSocket

    // Set up event handlers
    notificationSocket.onopen = (event) => {
      console.log('Notification WebSocket connected')

      // Send connection test
      const testMessage = {
        type: 'connection_test',
        timestamp: new Date().toISOString()
      }

      try {
        notificationSocket.send(JSON.stringify(testMessage))
      } catch (err) {
        console.error('Failed to send notification connection test:', err)
      }
    }

    notificationSocket.onclose = (event) => {
      console.log('Notification WebSocket disconnected:', event.code, event.reason)
      
      if (notificationSocketInstance === notificationSocket) {
        notificationSocketInstance = null
      }

      // Determine if we should reconnect
      const authErrors = [4000, 4001, 4003, 4004]
      const shouldNotReconnect = event.code === 1000 || authErrors.includes(event.code)

      if (!shouldNotReconnect) {
        // Reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, 1), 30000)
        setTimeout(() => {
          if (!notificationSocketInstance) {
            getNotificationSocket()
          }
        }, delay)
      } else if (authErrors.includes(event.code)) {
        console.error('Notification authentication/authorization failed')
        window.dispatchEvent(new CustomEvent('notification_websocket_auth_error', {
          detail: {
            code: event.code,
            reason: event.reason
          }
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

        // Handle authentication errors
        if (data.type === 'error' && data.message && data.message.toLowerCase().includes('authentication')) {
          window.dispatchEvent(new CustomEvent('notification_websocket_auth_error', {
            detail: {
              message: data.message,
              serverError: true
            }
          }))
        }

        // Dispatch custom event for React components
        const eventDetail = {
          data,
          timestamp: new Date().toISOString(),
          messageType: data.type
        }

        window.dispatchEvent(new CustomEvent('notification_websocket_message', { detail: eventDetail }))
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

    // Clear timeout when connection changes state
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

// Helper function to ensure socket connection
const ensureSocketConnection = async (conversationId, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`
  let socket = chatSockets.get(socketKey)

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log('Socket not connected, attempting to connect...')
    socket = await getChatSocket(conversationId, currentUserId)
  }

  return socket
}

// Send chat message
export const sendChatMessage = async (conversationId, messageData, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`

  // Ensure socket connection
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)

  if (!chatSocket) {
    console.error(`Failed to establish socket connection for ${socketKey}`)
    return {
      success: false,
      error: 'Failed to establish socket connection',
      temp_id: messageData.temp_id
    }
  }

  // Check connection state
  if (chatSocket.readyState !== WebSocket.OPEN) {
    console.error(`WebSocket not connected. State: ${chatSocket.readyState}`)
    return {
      success: false,
      error: 'WebSocket not connected',
      temp_id: messageData.temp_id
    }
  }

  // Validate message data
  const content = messageData.content || messageData.message || messageData
  const receiverId = messageData.receiver_id

  if (!content || (typeof content === 'string' && content.trim().length === 0)) {
    console.error('Message content is required and cannot be empty')
    return {
      success: false,
      error: 'Message content is required',
      temp_id: messageData.temp_id
    }
  }

  if (!receiverId) {
    console.error('receiver_id is required')
    return {
      success: false,
      error: 'receiver_id is required',
      temp_id: messageData.temp_id
    }
  }

  // Generate temp_id if not provided
  const tempId = messageData.temp_id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Prepare message object with all required fields
  const message = {
    type: 'chat_message',
    message: content,
    content: content,
    receiver_id: String(receiverId).trim(), // Ensure string
    conversation_id: String(conversationId).trim(),
    timestamp: new Date().toISOString(),
    temp_id: tempId,
    sender_id: String(currentUserId).trim(), // Add for debugging
    ...messageData
  }

  console.log('📤 WebSocket Message Debug:', {
    temp_id: tempId,
    sender_id: message.sender_id,
    receiver_id: message.receiver_id,
    conversation_id: message.conversation_id,
    content_length: content.length
  });

  try {
    chatSocket.send(JSON.stringify(message))
    return {
      success: true,
      temp_id: tempId,
      message: message,
      socketKey: socketKey
    }
  } catch (error) {
    console.error('Failed to send message:', error)
    return {
      success: false,
      error: error.message,
      temp_id: tempId
    }
  }
}

// Notification WebSocket functions
export const sendNotificationMessage = async (messageData) => {
  // Ensure notification socket connection
  const notificationSocket = notificationSocketInstance && notificationSocketInstance.readyState === WebSocket.OPEN 
    ? notificationSocketInstance 
    : await getNotificationSocket()

  if (!notificationSocket) {
    console.error('Failed to establish notification socket connection')
    return {
      success: false,
      error: 'Failed to establish notification socket connection'
    }
  }

  // Check connection state
  if (notificationSocket.readyState !== WebSocket.OPEN) {
    console.error(`Notification WebSocket not connected. State: ${notificationSocket.readyState}`)
    return {
      success: false,
      error: 'Notification WebSocket not connected'
    }
  }

  try {
    notificationSocket.send(JSON.stringify(messageData))
    return {
      success: true,
      message: messageData
    }
  } catch (error) {
    console.error('Failed to send notification message:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Mark notification as read
export const markNotificationAsRead = async (notificationId) => {
  return await sendNotificationMessage({
    type: 'mark_notification_read',
    notification_id: notificationId,
    timestamp: new Date().toISOString()
  })
}

// Mark all notifications as read
export const markAllNotificationsAsRead = async () => {
  return await sendNotificationMessage({
    type: 'mark_all_read',
    timestamp: new Date().toISOString()
  })
}

// Get notifications
export const getNotifications = async (page = 1, limit = 20) => {
  return await sendNotificationMessage({
    type: 'get_notifications',
    page,
    limit,
    timestamp: new Date().toISOString()
  })
}

// Mark message as read
export const markMessageAsRead = async (conversationId, messageId, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`

  // Ensure socket connection
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)

  if (!chatSocket) {
    console.error(`Failed to establish socket connection for ${socketKey}`)
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (chatSocket.readyState !== WebSocket.OPEN) {
    console.error(`WebSocket not connected. State: ${chatSocket.readyState}`)
    return { success: false, error: 'WebSocket not connected' }
  }

  if (!messageId) {
    console.error('Message ID is required')
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

// Send typing indicator
export const sendTyping = async (conversationId, isTyping = true, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`

  // Ensure socket connection
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)

  if (!chatSocket) {
    console.error(`Failed to establish socket connection for ${socketKey}`)
    return { success: false, error: 'Failed to establish socket connection' }
  }

  if (chatSocket.readyState !== WebSocket.OPEN) {
    console.error(`WebSocket not connected. State: ${chatSocket.readyState}`)
    return { success: false, error: 'WebSocket not connected' }
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

// Edit message function
export const editChatMessage = async (conversationId, messageId, newContent, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`

  // Ensure socket connection
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)

  if (!chatSocket) {
    console.error(`Failed to establish socket connection for ${socketKey}`)
    return { success: false, error: 'Failed to establish socket connection' }
  }

  // Check connection state
  if (chatSocket.readyState !== WebSocket.OPEN) {
    console.error(`WebSocket not connected. State: ${chatSocket.readyState}`)
    return { success: false, error: 'WebSocket not connected' }
  }

  // Validate inputs
  if (!messageId) {
    console.error('Message ID is required')
    return { success: false, error: 'Message ID is required' }
  }

  if (!newContent || (typeof newContent === 'string' && newContent.trim().length === 0)) {
    console.error('Message content is required and cannot be empty')
    return { success: false, error: 'Message content is required' }
  }

  // Prepare edit message object
  const editMessage = {
    type: 'edit_message',
    message_id: messageId,
    content: newContent.trim(),
    conversation_id: conversationId,
    timestamp: new Date().toISOString()
  }

  try {
    chatSocket.send(JSON.stringify(editMessage))
    console.log('📤 Edit message sent via WebSocket')
    return {
      success: true,
      messageId,
      newContent: newContent.trim(),
      editMessage
    }
  } catch (error) {
    console.error('Failed to send edit message:', error)
    return { success: false, error: error.message, messageId }
  }
}

// Delete message function
export const deleteChatMessage = async (conversationId, messageId, currentUserId = null) => {
  const socketKey = `${conversationId}_${currentUserId || 'anonymous'}`

  // Ensure socket connection
  const chatSocket = await ensureSocketConnection(conversationId, currentUserId)

  if (!chatSocket) {
    console.error(`Failed to establish socket connection for ${socketKey}`)
    return { success: false, error: 'Failed to establish socket connection' }
  }

  // Check connection state
  if (chatSocket.readyState !== WebSocket.OPEN) {
    console.error(`WebSocket not connected. State: ${chatSocket.readyState}`)
    return { success: false, error: 'WebSocket not connected' }
  }

  // Validate message ID
  if (!messageId) {
    console.error('Message ID is required')
    return { success: false, error: 'Message ID is required' }
  }

  // Prepare delete message object
  const deleteMessage = {
    type: 'delete_message',
    message_id: messageId,
    conversation_id: conversationId,
    timestamp: new Date().toISOString()
  }

  try {
    chatSocket.send(JSON.stringify(deleteMessage))
    console.log('📤 Delete message sent via WebSocket')
    return { success: true, messageId, deleteMessage }
  } catch (error) {
    console.error('Failed to send delete message:', error)
    return { success: false, error: error.message, messageId }
  }
}

// Convenience functions for typing
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

  // Return status for all connections
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
    // Close all chat sockets
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
  closeChatSocket() // Close all chat sockets
  closeNotificationSocket()
}

// Test token and connection
export const testTokenAndConnection = async (conversationId, currentUserId = null) => {
  const results = {
    auth: false,
    token: false,
    userData: false,
    socket: false,
    notificationSocket: false,
    details: {},
    errors: []
  }

  try {
    // Test authentication
    const isAuth = isUserAuthenticated()
    results.auth = isAuth
    results.details.authenticated = isAuth

    if (!isAuth) {
      results.errors.push("User is not authenticated")
    }

    // Test token retrieval
    const token = getJWTToken()
    results.token = !!token
    results.details.tokenExists = !!token

    if (token) {
      results.details.tokenPreview = token.substring(0, 50) + '...'
      results.details.tokenLength = token.length
    } else {
      results.errors.push("No authentication token available")
    }

    // Test user data
    const userData = getStoredUserData()
    results.userData = !!userData
    results.details.userDataExists = !!userData

    if (userData) {
      results.details.userData = {
        hasId: !!userData.id,
        hasUsername: !!userData.username,
        hasEmail: !!userData.email,
        username: userData.username
      }
    } else {
      results.errors.push("No user data available")
    }

    // Test WebSocket connection
    if (!conversationId) {
      results.errors.push("No conversation ID provided for WebSocket test")
    } else {
      try {
        const socket = await getChatSocket(conversationId, currentUserId)
        results.socket = !!socket
        results.details.socketCreated = !!socket

        if (socket) {
          results.details.socketState = socket.readyState
          results.details.socketStateText = {
            0: 'CONNECTING',
            1: 'OPEN',
            2: 'CLOSING',
            3: 'CLOSED'
          }[socket.readyState]
        } else {
          results.errors.push("Failed to create WebSocket connection")
        }
      } catch (socketError) {
        results.errors.push(`WebSocket error: ${socketError.message}`)
      }
    }

    // Test notification socket
    try {
      const notificationSocket = await getNotificationSocket()
      results.notificationSocket = !!notificationSocket
      results.details.notificationSocketCreated = !!notificationSocket

      if (notificationSocket) {
        results.details.notificationSocketState = notificationSocket.readyState
        results.details.notificationSocketStateText = {
          0: 'CONNECTING',
          1: 'OPEN',
          2: 'CLOSING',
          3: 'CLOSED'
        }[notificationSocket.readyState]
      } else {
        results.errors.push("Failed to create notification WebSocket connection")
      }
    } catch (notificationError) {
      results.errors.push(`Notification WebSocket error: ${notificationError.message}`)
    }

    // Connection states
    results.details.connectionStates = Object.fromEntries(connectionStates)
    results.details.activeSocketsCount = chatSockets.size
    results.details.reconnectAttempts = Object.fromEntries(reconnectAttempts)
    results.details.notificationSocketExists = !!notificationSocketInstance
  } catch (error) {
    console.error('Test suite error:', error)
    results.errors.push(`Test suite error: ${error.message}`)
  }

  return results
}