"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Paperclip, MoreVertical, Phone, Video, Edit2, Trash2 } from "lucide-react"
import { getChatSocket, sendChatMessage, sendTyping, closeChatSocket, getConnectionStatus, markMessageAsRead } from "../service/websocket"
import { getConversationMessages } from "../endpoints/Chat"

export default function ChatArea({ 
  conversation, 
  currentUser, 
  onConversationUpdate, 
  messages: propMessages, 
  onDeleteMessage, 
  onEditMessage, 
  onSendMessage 
}) {
  const [message, setMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState(new Set())
  const [editingMessage, setEditingMessage] = useState(null)
  const [editText, setEditText] = useState("")
  const [localMessages, setLocalMessages] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [retryCount, setRetryCount] = useState(0)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const websocketInitialized = useRef(false)
  const componentMounted = useRef(true)
  const loadedConversationId = useRef(null) // Track which conversation we loaded
  const maxRetries = 5




  const activePatient = conversation?.participants?.find(p => {
        // Convert both IDs to strings for comparison
        const pId = String(p.id || p.user_id || '');
        const currentId = String(currentUser?.id || '');
        console.log('Comparing participant:', pId, 'with current user:', currentId);
        return pId !== currentId;
    }) || {};

    console.log('Active patient (other participant):', activePatient);
    console.log('Current user:', currentUser);

  // Use prop messages if provided, otherwise use local messages
  const messages = propMessages || localMessages

  // Get the other participant for header display


  const scrollToBottom = useCallback(() => {
    if (componentMounted.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])


  useEffect(() => {
    console.log('=== CONVERSATION DEBUG ===');
    console.log('Conversation:', conversation);
    console.log('Conversation ID:', conversation?.id);
    console.log('Current User:', currentUser);
    console.log('Current User ID:', currentUser?.id, typeof currentUser?.id);
    
    if (conversation?.participants) {
        console.log('All participants:');
        conversation.participants.forEach((p, index) => {
            console.log(`  ${index}: ID=${p.id || p.user_id}, Name=${p.full_name || p.username}, Type=${typeof (p.id || p.user_id)}`);
        });
    }
    
    console.log('Active Patient (other participant):', activePatient);
    console.log('Active Patient ID:', activePatient.id || activePatient.user_id);
    console.log('========================');
}, [conversation, currentUser, activePatient]);

  // FIXED: Simplified message loading logic
  useEffect(() => {
    const loadConversationMessages = async () => {
      // Skip if prop messages are provided or no conversation
      if (propMessages || !conversation?.id || !componentMounted.current) {
        return
      }

      // Skip if we already loaded messages for this conversation
      if (loadedConversationId.current === conversation.id) {
        return
      }

      setIsLoadingMessages(true)
      
      try {
        console.log('📥 Loading messages for conversation:', conversation.id)
        const response = await getConversationMessages(conversation.id)
        
        if (componentMounted.current && response.data) {
          const fetchedMessages = response.data.results || response.data || []
          console.log('✅ Messages loaded successfully:', fetchedMessages.length, 'messages')
          
          setLocalMessages(fetchedMessages)
          loadedConversationId.current = conversation.id // Mark as loaded
          
          // Update conversation if callback provided
          if (onConversationUpdate && fetchedMessages.length > 0) {
            const updatedConversation = {
              ...conversation,
              messages: fetchedMessages,
              last_message: fetchedMessages[fetchedMessages.length - 1]
            }
            onConversationUpdate(updatedConversation)
          }
        }
      } catch (error) {
        console.error('❌ Error loading conversation messages:', error)
        // Set empty array on error to avoid infinite loading
        if (componentMounted.current) {
          setLocalMessages([])
          loadedConversationId.current = conversation.id // Mark as attempted
        }
      } finally {
        if (componentMounted.current) {
          setIsLoadingMessages(false)
        }
      }
    }

    // Reset loaded state when conversation changes
    if (conversation?.id && loadedConversationId.current !== conversation.id) {
      loadedConversationId.current = null
      setLocalMessages([]) // Clear previous messages
      loadConversationMessages()
    }
  }, [conversation?.id, propMessages, onConversationUpdate])

  // FIXED: Simplified fallback message loading
  useEffect(() => {
    if (conversation && !propMessages && componentMounted.current && !isLoadingMessages) {
      // Only use conversation messages if we haven't loaded from API
      if (loadedConversationId.current !== conversation.id && conversation.messages) {
        setLocalMessages(conversation.messages || [])
      }
    }
  }, [conversation, propMessages, isLoadingMessages])

  // Component mounted flag
  useEffect(() => {
    componentMounted.current = true
    return () => {
      componentMounted.current = false
    }
  }, [])

  // Initialize WebSocket connection with proper cleanup
  useEffect(() => {
    if (conversation?.id && currentUser?.id && !websocketInitialized.current) {
      console.log('🔌 Setting up WebSocket for conversation:', conversation.id)
      initializeWebSocket()
      websocketInitialized.current = true
    }

    return () => {
      console.log('🧹 Cleaning up ChatArea WebSocket')
      cleanupWebSocket()
      websocketInitialized.current = false
    }
  }, [conversation?.id, currentUser?.id])

  // WebSocket message listener
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      if (!componentMounted.current) return

      const { conversationId, data } = event.detail
      // Only process messages for this conversation
      if (conversationId !== conversation?.id) return

      handleWebSocketData(data)
    }

    window.addEventListener('websocket_message', handleWebSocketMessage)
    return () => {
      window.removeEventListener('websocket_message', handleWebSocketMessage)
    }
  }, [conversation?.id, currentUser?.id, propMessages, onEditMessage, onDeleteMessage, onConversationUpdate])

  const initializeWebSocket = useCallback(async () => {
    if (!componentMounted.current || connectionStatus === 'connecting') return

    setConnectionStatus('connecting')
    try {
      const socket = await getChatSocket(conversation.id, currentUser.id)
      if (socket && componentMounted.current) {
        console.log('🔌 WebSocket connection initiated')
        
        // Check connection status
        const checkStatus = () => {
          if (!componentMounted.current) return
          const status = getConnectionStatus(conversation.id, currentUser.id)
          if (status.connected) {
            setConnectionStatus('connected')
            setRetryCount(0)
          } else if (status.state === 'error') {
            setConnectionStatus('error')
          }
        }
        
        // Check status after a short delay
        setTimeout(checkStatus, 100)
      } else if (componentMounted.current) {
        setConnectionStatus('error')
        scheduleReconnect()
      }
    } catch (error) {
      console.error('❌ Error initializing WebSocket:', error)
      if (componentMounted.current) {
        setConnectionStatus('error')
        scheduleReconnect()
      }
    }
  }, [conversation?.id, currentUser?.id, connectionStatus])

  const cleanupWebSocket = useCallback(() => {
    // Clear timeouts
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Close WebSocket for this specific conversation
    if (conversation?.id && currentUser?.id) {
      closeChatSocket(conversation.id, currentUser.id)
    }
    
    setConnectionStatus('disconnected')
    setRetryCount(0)
  }, [conversation?.id, currentUser?.id])

  const scheduleReconnect = useCallback(() => {
    if (!componentMounted.current || retryCount >= maxRetries) {
      if (retryCount >= maxRetries) {
        console.log('❌ Max reconnection attempts reached')
      }
      return
    }

    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
    console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${retryCount + 1})`)
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (componentMounted.current) {
        setRetryCount(prev => prev + 1)
        initializeWebSocket()
      }
    }, delay)
  }, [retryCount, initializeWebSocket])

  const handleWebSocketData = useCallback((data) => {
    if (!componentMounted.current) return

    console.log('📨 Processing WebSocket message:', data)

    switch (data.type) {
      case 'chat_message':
        if (data.message && data.message.sender.id !== currentUser.id) {
          handleNewMessage(data.message)
        }
        break
      case 'message_sent':
        console.log('✅ Message sent confirmation received:', data.message)
        if (data.message && data.message.sender.id === currentUser.id) {
          handleMessageSentConfirmation(data.message)
        }
        break
      case 'typing_indicator':
        handleTypingIndicator(data)
        break
      case 'message_edited':
        if (onEditMessage) {
          onEditMessage(data.message.id, data.message.content)
        } else {
          handleLocalMessageEdit(data.message.id, data.message.content)
        }
        break
      case 'message_deleted':
        if (onDeleteMessage) {
          onDeleteMessage(data.message_id)
        } else {
          handleLocalMessageDelete(data.message_id)
        }
        break
      case 'message_read':
        console.log('📖 Message marked as read:', data.message_id)
        handleMessageRead(data.message_id, data.read_by)
        break
      case 'user_status_changed':
        handleUserPresence(data)
        break
      case 'connection_established':
        console.log('✅ Connection established by server')
        setConnectionStatus('connected')
        break
      case 'connection_confirmed':
        console.log('✅ Connection confirmed by server')
        setConnectionStatus('connected')
        break
      case 'error':
        // Filter out typing indicator errors since server doesn't support them yet
        if (!data.message.includes('typing_indicator')) {
          console.error('❌ WebSocket error message:', data.message)
        } else {
          console.log('ℹ️ Server doesn\'t support typing indicators yet:', data.message)
        }
        break
      default:
        console.log('🤷 Unknown message type:', data.type)
    }
  }, [currentUser.id, onEditMessage, onDeleteMessage])

  const handleNewMessage = useCallback((newMessage) => {
    if (!componentMounted.current) return

    if (!propMessages) {
      setLocalMessages(prev => {
        // Avoid duplicates
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev
        }
        return [...prev, newMessage]
      })
    }

    // Update conversation if callback provided
    if (onConversationUpdate) {
      const updatedConversation = {
        ...conversation,
        last_message: newMessage,
        messages: [...(conversation.messages || []), newMessage]
      }
      onConversationUpdate(updatedConversation)
    }

    // Auto-mark as read if conversation is active
    setTimeout(() => {
      if (componentMounted.current) {
        handleMarkAsRead(newMessage.id)
      }
    }, 1000)
  }, [propMessages, onConversationUpdate, conversation])

  const handleMessageSentConfirmation = useCallback((confirmedMessage) => {
    if (!componentMounted.current || propMessages) return

    console.log('✅ Message confirmation received:', confirmedMessage)
    setLocalMessages(prev => prev.map(msg => {
      // Match by temp_id first, then by content and sender as fallback
      const isMatch = (
        (msg.temp_id && confirmedMessage.temp_id && msg.temp_id === confirmedMessage.temp_id) ||
        (msg.content === confirmedMessage.content && msg.sender.id === currentUser.id)
      )

      if (isMatch) {
        console.log('🔄 Updating message from temp to confirmed:', msg.id, '->', confirmedMessage.id)
        return confirmedMessage // Replace with confirmed message
      }
      return msg
    }))
  }, [propMessages, currentUser.id])

  const handleLocalMessageEdit = useCallback((messageId, newContent) => {
    if (!componentMounted.current || propMessages) return

    setLocalMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: newContent, edited: true, edited_at: new Date().toISOString() }
        : msg
    ))
  }, [propMessages])

  const handleLocalMessageDelete = useCallback((messageId) => {
    if (!componentMounted.current || propMessages) return

    setLocalMessages(prev => prev.filter(msg => msg.id !== messageId))
  }, [propMessages])

  const handleTypingIndicator = useCallback((data) => {
    if (!componentMounted.current || data.user_id === currentUser.id) return

    console.log('⌨️ Typing indicator received:', data)
    setTypingUsers(prev => {
      const newSet = new Set(prev)
      if (data.is_typing) {
        newSet.add(data.user_id)
      } else {
        newSet.delete(data.user_id)
      }
      return newSet
    })

    // Clear typing indicator after 3 seconds
    if (data.is_typing) {
      setTimeout(() => {
        if (componentMounted.current) {
          setTypingUsers(prev => {
            const newSet = new Set(prev)
            newSet.delete(data.user_id)
            return newSet
          })
        }
      }, 3000)
    }
  }, [currentUser.id])

  const handleMessageRead = useCallback((messageId, readBy) => {
    if (!componentMounted.current || propMessages) return

    setLocalMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, read_by: [...(msg.read_by || []), readBy] }
        : msg
    ))
  }, [propMessages])

  const handleUserPresence = useCallback((data) => {
    console.log('👤 User presence update:', data)
    // Update user presence in the UI if needed
  }, [])

  const handleSubmit = async (e) => {
        e.preventDefault()
        if (!message.trim() || !conversation || !componentMounted.current) return

        const messageText = message.trim()
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // FIXED: Ensure we're getting the correct receiver ID
        // ✅ AFTER - Proper receiver ID extraction
          const getReceiverId = () => {
            // Try different possible ID fields
            const possibleIds = [
              activePatient?.id,
              activePatient?.user_id,
              activePatient?.participant_id
            ];
            
            for (const id of possibleIds) {
              if (id) {
                const normalizedId = String(id).trim();
                if (normalizedId && normalizedId !== 'undefined' && normalizedId !== 'null') {
                  return normalizedId;
                }
              }
            }
            return null;
          };

          const receiverId = getReceiverId();

          console.log('🎯 Receiver ID Analysis:', {
            activePatient,
            possibleIds: {
              id: activePatient?.id,
              user_id: activePatient?.user_id,
              participant_id: activePatient?.participant_id
            },
            selectedReceiverId: receiverId,
            currentUserId: String(currentUser?.id)
          });

          if (!receiverId) {
            console.error('❌ No valid receiver ID found');
            console.error('Available participant data:', activePatient);
            alert('Cannot send message: Recipient not found. Please refresh the page.');
            return;
          }

        const tempMessage = {
            id: tempId,
            temp_id: tempId,
            content: messageText,
            sender: currentUser,
            created_at: new Date().toISOString(),
            conversation_id: conversation.id
        }

        setMessage("")

        try {
            // Add message to local state immediately for better UX
            if (!propMessages && componentMounted.current) {
                setLocalMessages(prev => [...prev, tempMessage])
            }

            // Send via WebSocket if connected
            if (connectionStatus === 'connected') {
                const result = await sendChatMessage(conversation.id, {
                    type: 'chat_message',
                    message: messageText,
                    content: messageText,
                    conversation_id: conversation.id,
                    receiver_id: receiverId, // Use the correct receiver ID
                    temp_id: tempId
                }, currentUser.id)

                if (result.success) {
                    console.log('📤 Message sent via WebSocket with temp_id:', tempId)
                } else {
                    throw new Error(result.error || 'WebSocket send failed')
                }
            } else {
                // Fallback to HTTP API if WebSocket not available
                console.log('📤 Sending via HTTP API (WebSocket not connected)')
                if (onSendMessage) {
                    await onSendMessage(messageText)
                } else {
                    throw new Error('No send method available')
                }
            }
        } catch (error) {
            console.error('❌ Error sending message:', error)
            if (!componentMounted.current) return

            // Restore message text on error
            setMessage(messageText)

            // Remove the temporary message on error
            if (!propMessages) {
                setLocalMessages(prev => prev.filter(msg => msg.id !== tempId))
            }
        }
    }

  const handleInputChange = (e) => {
    if (!componentMounted.current) return

    setMessage(e.target.value)

    // Send typing indicator
    if (!isTyping && connectionStatus === 'connected') {
      setIsTyping(true)
      sendTypingIndicator(true)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (componentMounted.current && isTyping) {
        setIsTyping(false)
        sendTypingIndicator(false)
      }
    }, 2000)
  }

  const sendTypingIndicator = useCallback((typing) => {
    if (!componentMounted.current) return

    if (connectionStatus === 'connected') {
      try {
        sendTyping(conversation.id, typing, currentUser.id)
      } catch (error) {
        // Silently handle typing indicator errors since server may not support them
        console.log('ℹ️ Typing indicator not supported by server')
      }
    }
  }, [connectionStatus, conversation?.id, currentUser?.id])

  const handleEditMessage = (msg) => {
    if (!componentMounted.current) return
    setEditingMessage(msg.id)
    setEditText(msg.content)
  }

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingMessage || !componentMounted.current) return

    try {
      const status = getConnectionStatus(conversation.id, currentUser.id)
      if (status.connected) {
        // Send via WebSocket
        sendChatMessage(conversation.id, {
          type: 'edit_message',
          message_id: editingMessage,
          content: editText.trim(),
          conversation_id: conversation.id
        }, currentUser.id)
      }

      if (onEditMessage) {
        onEditMessage(editingMessage, editText.trim())
      } else {
        handleLocalMessageEdit(editingMessage, editText.trim())
      }

      setEditingMessage(null)
      setEditText("")
    } catch (error) {
      console.error('❌ Error editing message:', error)
    }
  }

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return
    if (!componentMounted.current) return

    try {
      const status = getConnectionStatus(conversation.id, currentUser.id)
      if (status.connected) {
        // Send via WebSocket
        sendChatMessage(conversation.id, {
          type: 'delete_message',
          message_id: messageId,
          conversation_id: conversation.id
        }, currentUser.id)
      }

      if (onDeleteMessage) {
        onDeleteMessage(messageId)
      } else {
        handleLocalMessageDelete(messageId)
      }
    } catch (error) {
      console.error('❌ Error deleting message:', error)
    }
  }

  const handleMarkAsRead = useCallback((messageId) => {
    if (!componentMounted.current) return

    const status = getConnectionStatus(conversation.id, currentUser.id)
    if (status.connected) {
      markMessageAsRead(conversation.id, messageId, currentUser.id)
    }
  }, [conversation?.id, currentUser?.id])

  // Early return if no conversation
  if (!conversation) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation selected</h3>
          <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50 flex flex-col">
      {/* Chat Header */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
              {activePatient.avatar || activePatient.full_name?.charAt(0) || activePatient.username?.charAt(0) || 'U'}
            </div>
            {activePatient.isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {activePatient.full_name || activePatient.username || 'Unknown User'}
            </h3>
            <p className="text-xs text-gray-500">
              {activePatient.isOnline ? "Online" : `Last seen ${activePatient.timestamp || 'recently'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* DEBUG: Add this temporarily to see message data */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400 p-2 bg-gray-100 rounded">
            Debug: {messages.length} messages loaded | Current user: {currentUser?.id} (type: {typeof currentUser?.id})
            {messages.length > 0 && (
              <div>
                First message sender: {JSON.stringify(messages[0]?.sender?.id)} (type: {typeof messages[0]?.sender?.id})
                <br />Message content: "{messages[0]?.content}"
              </div>
            )}
          </div>
        )}
        
        {isLoadingMessages ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <p>Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            // More robust sender comparison with type conversion
            // ✅ AFTER - Robust ID comparison
            const normalizeId = (id) => {
              if (!id) return '';
              return String(id).trim();
            };

            const currentUserId = normalizeId(currentUser?.id);
            const msgSenderId = normalizeId(msg.sender?.id || msg.sender_id);
            const isCurrentUser = currentUserId && msgSenderId && (msgSenderId === currentUserId);

            console.log('🔍 ID Comparison:', { 
              currentUserId, 
              msgSenderId, 
              isCurrentUser,
              types: { current: typeof currentUser?.id, sender: typeof msg.sender?.id }
            });
            const isEditing = editingMessage === msg.id
            
            // Fallback key in case msg.id is undefined
            const messageKey = msg.id || msg.temp_id || `msg-${index}`
            
            // Debug individual message
            console.log('Message comparison:', {
              msgSenderId,
              currentUserId,
              isCurrentUser,
              content: msg.content
            })

            return (
              <div key={messageKey} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                <div className="max-w-xs lg:max-w-md group relative">
                  {isEditing ? (
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                      <div className="flex justify-end space-x-2 mt-2">
                        <button
                          onClick={() => setEditingMessage(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        isCurrentUser
                          ? "bg-blue-500 text-white rounded-br-sm"
                          : "bg-white text-gray-900 border border-gray-200 rounded-bl-sm"
                      }`}
                      onClick={() => !isCurrentUser && handleMarkAsRead(msg.id)}
                    >
                      <p className="break-words">{msg.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className={`text-xs ${isCurrentUser ? "text-blue-100" : "text-gray-500"}`}>
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : msg.timestamp}
                          {msg.edited && <span className="ml-1">(edited)</span>}
                        </p>
                        {isCurrentUser && (
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditMessage(msg)}
                              className="text-xs text-blue-200 hover:text-white"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="text-xs text-red-200 hover:text-white"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {/* Typing Indicator */}
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg rounded-bl-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <input
              type="text"
              value={message}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim()}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  )
}