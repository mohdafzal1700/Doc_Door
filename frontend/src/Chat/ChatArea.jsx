"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Paperclip, MoreVertical, Phone, Video, Edit2, Trash2, Check, X, Image, Film, Music, FileText, Archive, File, Eye, Download } from "lucide-react"
import {
  getChatSocket,
  sendChatMessage,
  sendTyping,
  closeChatSocket,
  getConnectionStatus,
  markMessageAsRead,
  editChatMessage,
  deleteChatMessage,
  notifyFileUploaded,
} from "../service/websocket"
import {
  getConversationMessages,
  uploadFile,
  handleFile,
  openFile,
  downloadFile,
  getFileMessage
} from "../endpoints/Chat"

// File size limits
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB for images
  video: 50 * 1024 * 1024, // 50MB for videos
  document: 10 * 1024 * 1024, // 10MB for documents
  default: 25 * 1024 * 1024 // 25MB for other files
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB absolute maximum

const getFileCategory = (mimeType) => {
  if (!mimeType) return 'other'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('pdf') || 
      mimeType.includes('document') || 
      mimeType.includes('text') || 
      mimeType.includes('spreadsheet') || 
      mimeType.includes('presentation')) return 'document'
  if (mimeType.includes('zip') || 
      mimeType.includes('rar') || 
      mimeType.includes('7z')) return 'archive'
  return 'other'
}

const getFileIcon = (mimeType, size = 'w-5 h-5') => {
  const category = getFileCategory(mimeType)
  switch (category) {
    case 'image':
      return <Image className={size} />
    case 'video':
      return <Film className={size} />
    case 'audio':
      return <Music className={size} />
    case 'document':
    case 'pdf':
      return <FileText className={size} />
    case 'archive':
      return <Archive className={size} />
    default:
      return <File className={size} />
  }
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

const validateFileSize = (file) => {
  const category = getFileCategory(file.type)
  const limit = FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.default
  
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${formatFileSize(MAX_FILE_SIZE)}`
    }
  }
  
  if (file.size > limit) {
    return {
      valid: false,
      error: `${category} files must be smaller than ${formatFileSize(limit)}`
    }
  }
  
  return { valid: true }
}

export default function ChatArea({
  conversation,
  currentUser,
  onConversationUpdate,
  messages: propMessages,
  onDeleteMessage,
  onEditMessage
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(new Set())
  const [imageLoadErrors, setImageLoadErrors] = useState(new Set()) // Track image load errors

  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const websocketInitialized = useRef(false)
  const componentMounted = useRef(true)
  const loadedConversationId = useRef(null)
  const editInputRef = useRef(null)

  const maxRetries = 5

  // Get the other participant for header display
  const activePatient = conversation?.participants?.find(p => {
    const pId = String(p.id || p.user_id || '').trim()
    const currentId = String(currentUser?.id || '').trim()
    return pId !== currentId && pId !== 'undefined' && pId !== 'null' && pId !== ''
  }) || {}

  // Use prop messages if provided, otherwise use local messages
  const messages = propMessages || localMessages

  const scrollToBottom = useCallback(() => {
    if (componentMounted.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Component mounted flag
  useEffect(() => {
    componentMounted.current = true
    return () => {
      componentMounted.current = false
    }
  }, [])

  // Enhanced message loading logic
  useEffect(() => {
    const loadConversationMessages = async () => {
      if (propMessages || !conversation?.id || !componentMounted.current) {
        return
      }

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
          loadedConversationId.current = conversation.id

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
        if (componentMounted.current) {
          setLocalMessages([])
          loadedConversationId.current = conversation.id
        }
      } finally {
        if (componentMounted.current) {
          setIsLoadingMessages(false)
        }
      }
    }

    if (conversation?.id && loadedConversationId.current !== conversation.id) {
      loadedConversationId.current = null
      setLocalMessages([])
      setImageLoadErrors(new Set()) // Reset image load errors
      loadConversationMessages()
    }
  }, [conversation?.id, propMessages, onConversationUpdate])

  // Initialize WebSocket connection
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
      if (conversationId !== conversation?.id) return

      handleWebSocketData(data)
    }

    window.addEventListener('websocket_message', handleWebSocketMessage)
    return () => {
      window.removeEventListener('websocket_message', handleWebSocketMessage)
    }
  }, [conversation?.id, currentUser?.id])

  const initializeWebSocket = useCallback(async () => {
    if (!componentMounted.current || connectionStatus === 'connecting') return

    setConnectionStatus('connecting')

    try {
      const socket = await getChatSocket(conversation.id, currentUser.id)
      
      if (socket && componentMounted.current) {
        console.log('🔌 WebSocket connection initiated')
        
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

  const getReceiverId = useCallback(() => {
    const possibleIds = [
      activePatient?.id,
      activePatient?.user_id,
      activePatient?.participant_id
    ]

    for (const id of possibleIds) {
      if (id) {
        const normalizedId = String(id).trim()
        if (normalizedId && normalizedId !== 'undefined' && normalizedId !== 'null') {
          return normalizedId
        }
      }
    }

    return null
  }, [activePatient])

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    if (!files.length || !conversation || !componentMounted.current) return

    const receiverId = getReceiverId()
    if (!receiverId) {
      alert('Cannot upload file: Recipient not found. Please refresh the page.')
      return
    }

    const validFiles = []
    const errors = []

    // Validate each file
    files.forEach(file => {
      const validation = validateFileSize(file)
      if (validation.valid) {
        validFiles.push(file)
      } else {
        errors.push(`${file.name}: ${validation.error}`)
      }
    })

    // Show errors if any
    if (errors.length > 0) {
      alert(`File validation errors:\n${errors.join('\n')}`)
    }

    // Process valid files only
    for (const file of validFiles) {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${currentUser.id}`

      try {
        setUploadingFiles(prev => new Set([...prev, fileId]))
        console.log('📎 Uploading file:', file.name, formatFileSize(file.size))

        const response = await uploadFile(file, conversation.id, receiverId)

        if (response.data && response.data.id) {
          console.log('✅ File uploaded successfully:', response.data)
          
          // Get the file category and determine MIME type
          const mimeType = file.type || 'application/octet-stream'
          const category = getFileCategory(mimeType)
          
          const tempMessage = {
            id: fileId,
            temp_id: fileId,
            file_url: response.data.url,
            file_name: file.name,
            file_type: mimeType,
            file_size: file.size,
            mime_type: mimeType,
            sender: currentUser,
            created_at: new Date().toISOString(),
            conversation_id: conversation.id,
            content: `Shared a ${category}: ${file.name}`
          }

          if (!propMessages) {
            setLocalMessages(prev => [...prev, tempMessage])
          }

          if (connectionStatus === 'connected') {
            await notifyFileUploaded(conversation.id, response.data.id, currentUser.id)
          }

          if (onConversationUpdate) {
            const updatedConversation = {
              ...conversation,
              last_message: tempMessage,
              messages: [...(conversation.messages || []), tempMessage]
            }
            onConversationUpdate(updatedConversation)
          }
        }
      } catch (error) {
        console.error('❌ Error uploading file:', error)
        alert(`Failed to upload ${file.name}. Please try again.`)
      } finally {
        if (componentMounted.current) {
          setUploadingFiles(prev => {
            const newSet = new Set(prev)
            newSet.delete(fileId)
            return newSet
          })
        }
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileMessage = useCallback((fileMessage) => {
    if (!componentMounted.current) return
    
    console.log('📎 File message received:', fileMessage)

    // Add file message to local messages if not using prop messages
    if (!propMessages) {
      setLocalMessages(prev => {
        if (prev.some(msg => msg.id === fileMessage.id)) {
          return prev
        }
        return [...prev, fileMessage]
      })
    }

    // Update conversation
    if (onConversationUpdate) {
      const updatedConversation = {
        ...conversation,
        last_message: fileMessage,
        messages: [...(conversation.messages || []), fileMessage]
      }
      onConversationUpdate(updatedConversation)
    }
  }, [propMessages, onConversationUpdate, conversation])

  const cleanupWebSocket = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

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
        console.log('✅ Message edit confirmation received:', data.message)
        if (onEditMessage) {
          onEditMessage(data.message.id, data.message.content)
        } else {
          handleLocalMessageEdit(data.message.id, data.message.content)
        }
        break

      case 'message_deleted':
        console.log('✅ Message delete confirmation received:', data.message_id)
        if (onDeleteMessage) {
          onDeleteMessage(data.message_id)
        } else {
          handleLocalMessageDelete(data.message_id)
        }
        break

      case 'file_message':
        if (data.message && data.message.sender.id !== currentUser.id) {
          handleFileMessage(data.message)
        }
        break

      case 'file_uploaded':
        console.log('📎 File upload notification received:', data.message_id)
        break

      case 'message_read':
        console.log('📖 Message marked as read:', data.message_id)
        handleMessageRead(data.message_id, data.read_by)
        break

      case 'connection_established':
      case 'connection_confirmed':
        console.log('✅ Connection confirmed by server')
        setConnectionStatus('connected')
        break

      case 'error':
        if (!data.message.includes('typing_indicator')) {
          console.error('❌ WebSocket error message:', data.message)
          if (data.message.includes('edit') || data.message.includes('delete')) {
            alert('Operation failed: ' + data.message)
          }
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
        // Check if message already exists by ID
        if (prev.some(msg => msg.id === newMessage.id)) {
          console.log('⚠️ Message already exists, skipping duplicate:', newMessage.id)
          return prev
        }

        // Check for potential duplicates by content and timestamp (fallback)
        const isDuplicate = prev.some(msg =>
          msg.content === newMessage.content &&
          msg.sender.id === newMessage.sender.id &&
          Math.abs(new Date(msg.created_at) - new Date(newMessage.created_at)) < 1000 // Within 1 second
        )

        if (isDuplicate) {
          console.log('⚠️ Potential duplicate message detected, skipping')
          return prev
        }

        return [...prev, newMessage]
      })
    }

    if (onConversationUpdate) {
      const updatedConversation = {
        ...conversation,
        last_message: newMessage,
        messages: [...(conversation.messages || []), newMessage]
      }
      onConversationUpdate(updatedConversation)
    }

    setTimeout(() => {
      if (componentMounted.current) {
        handleMarkAsRead(newMessage.id)
      }
    }, 1000)
  }, [propMessages, onConversationUpdate, conversation])

  const handleMessageSentConfirmation = useCallback((confirmedMessage) => {
    if (!componentMounted.current || propMessages) return

    console.log('✅ Message confirmation received:', confirmedMessage)

    setLocalMessages(prev => {
      // First, check if this confirmed message already exists
      const existingIndex = prev.findIndex(msg => msg.id === confirmedMessage.id)
      if (existingIndex !== -1) {
        console.log('⚠️ Confirmed message already exists, skipping duplicate')
        return prev
      }

      // Find and replace temporary message
      const tempIndex = prev.findIndex(msg => {
        const isMatch = (
          (msg.temp_id && confirmedMessage.temp_id && msg.temp_id === confirmedMessage.temp_id) ||
          (msg.content === confirmedMessage.content && msg.sender.id === currentUser.id && !msg.id)
        )
        return isMatch
      })

      if (tempIndex !== -1) {
        console.log('🔄 Updating message from temp to confirmed:', prev[tempIndex].temp_id || prev[tempIndex].id, '->', confirmedMessage.id)
        const newMessages = [...prev]
        newMessages[tempIndex] = confirmedMessage
        return newMessages
      }

      // If no temp message found, add as new (but this shouldn't normally happen)
      console.log('⚠️ No matching temp message found, adding as new')
      return [...prev, confirmedMessage]
    })
  }, [propMessages, currentUser.id])

  const handleLocalMessageEdit = useCallback((messageId, newContent) => {
    if (!componentMounted.current || propMessages) return

    setLocalMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: newContent, edited: true }
          : msg
      )
    )
  }, [propMessages])

  const handleLocalMessageDelete = useCallback((messageId) => {
    if (!componentMounted.current || propMessages) return

    console.log('🗑️ Removing message locally after server confirmation:', messageId)
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

    setLocalMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, read_by: [...(msg.read_by || []), readBy] }
          : msg
      )
    )
  }, [propMessages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim() || !conversation || !componentMounted.current || isSubmitting) return

    const messageText = message.trim()
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${currentUser.id}`

    setIsSubmitting(true)
    setMessage("")

    const receiverId = getReceiverId()
    if (!receiverId) {
      console.error('❌ No valid receiver ID found')
      alert('Cannot send message: Recipient not found. Please refresh the page.')
      setMessage(messageText)
      setIsSubmitting(false)
      return
    }

    const tempMessage = {
      id: tempId,
      temp_id: tempId,
      content: messageText,
      sender: currentUser,
      created_at: new Date().toISOString(),
      conversation_id: conversation.id
    }

    try {
      if (!propMessages && componentMounted.current) {
        setLocalMessages(prev => [...prev, tempMessage])
      }

      if (connectionStatus === 'connected') {
        const result = await sendChatMessage(
          conversation.id,
          {
            type: 'chat_message',
            message: messageText,
            content: messageText,
            conversation_id: conversation.id,
            receiver_id: receiverId,
            temp_id: tempId
          },
          currentUser.id
        )

        if (result.success) {
          console.log('📤 Message sent via WebSocket with temp_id:', tempId)
        } else {
          throw new Error(result.error || 'WebSocket send failed')
        }
      } else {
        throw new Error('WebSocket not connected and no HTTP fallback available')
      }
    } catch (error) {
      console.error('❌ Error sending message:', error)
      if (!componentMounted.current) return

      setMessage(messageText)
      if (!propMessages) {
        setLocalMessages(prev => prev.filter(msg => msg.id !== tempId))
      }
      alert('Failed to send message. Please try again.')
    } finally {
      if (componentMounted.current) {
        setIsSubmitting(false)
      }
    }
  }

  const handleInputChange = (e) => {
    if (!componentMounted.current) return

    setMessage(e.target.value)

    if (!isTyping && connectionStatus === 'connected') {
      setIsTyping(true)
      sendTypingIndicator(true)
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (componentMounted.current && isTyping) {
        setIsTyping(false)
        sendTypingIndicator(false)
      }
    }, 2000)
  }

  const sendTypingIndicator = useCallback((typing) => {
    if (!componentMounted.current || connectionStatus !== 'connected') return

    try {
      sendTyping(conversation.id, typing, currentUser.id)
    } catch (error) {
      console.log('ℹ️ Typing indicator not supported by server')
    }
  }, [connectionStatus, conversation?.id, currentUser?.id])

  const handleEditMessage = (msg) => {
    if (!componentMounted.current) return

    setEditingMessage(msg.id)
    setEditText(msg.content)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingMessage || !componentMounted.current) return

    const originalContent = editText.trim()

    try {
      if (connectionStatus === 'connected') {
        const result = await editChatMessage(
          conversation.id,
          editingMessage,
          originalContent,
          currentUser.id
        )

        if (!result.success) {
          throw new Error(result.error || 'Failed to edit message')
        }

        console.log('✅ Edit message sent, waiting for server confirmation...')
        setEditingMessage(null)
        setEditText("")
      } else {
        throw new Error('WebSocket not connected')
      }
    } catch (error) {
      console.error('❌ Error editing message:', error)
      alert('Failed to edit message. Please try again.')
      setEditingMessage(null)
      setEditText("")
    }
  }

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return
    if (!componentMounted.current) return

    try {
      if (connectionStatus === 'connected') {
        const result = await deleteChatMessage(
          conversation.id,
          messageId,
          currentUser.id
        )

        if (!result.success) {
          throw new Error(result.error || 'Failed to delete message')
        }

        console.log('✅ Delete message sent, waiting for server confirmation...')
      } else {
        throw new Error('WebSocket not connected')
      }
    } catch (error) {
      console.error('❌ Error deleting message:', error)
      alert('Failed to delete message. Please try again.')
    }
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setEditText("")
  }

  const handleMarkAsRead = useCallback((messageId) => {
    if (!componentMounted.current) return

    const status = getConnectionStatus(conversation.id, currentUser.id)
    if (status.connected) {
      markMessageAsRead(conversation.id, messageId, currentUser.id)
    }
  }, [conversation?.id, currentUser?.id])

  const normalizeId = (id) => {
    if (!id) return ''
    return String(id).trim()
  }

  const handleFileClick = (fileUrl, fileName, fileType, mimeType) => {
    if (!fileUrl) {
      console.warn('No file URL provided')
      return
    }

    const category = getFileCategory(mimeType || fileType)
    
    if (category === 'image' || category === 'pdf') {
      // Open in new tab for preview
      window.open(fileUrl, '_blank')
    } else {
      // Download file
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = fileName || 'download'
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleImageError = useCallback((messageId) => {
    setImageLoadErrors(prev => new Set([...prev, messageId]))
  }, [])

  const isImageBroken = useCallback((messageId) => {
    return imageLoadErrors.has(messageId)
  }, [imageLoadErrors])

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
            <div className="flex items-center space-x-2">
              <p className="text-xs text-gray-500">
                {activePatient.isOnline ? "Online" : `Last seen ${activePatient.timestamp || 'recently'}`}
              </p>
              {connectionStatus === 'connected' && (
                <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>
              )}
              {connectionStatus === 'connecting' && (
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Connecting"></div>
              )}
              {connectionStatus === 'error' && (
                <div className="w-2 h-2 bg-red-500 rounded-full" title="Connection Error"></div>
              )}
            </div>
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
            const currentUserId = normalizeId(currentUser?.id)
            const msgSenderId = normalizeId(msg.sender?.id || msg.sender_id)
            const isCurrentUser = currentUserId && msgSenderId && (msgSenderId === currentUserId)
            const isEditing = editingMessage === msg.id
            const messageKey = msg.id ? `msg-${msg.id}` : msg.temp_id ? `temp-${msg.temp_id}` : `fallback-${index}-${msg.created_at || Date.now()}`

            return (
              <div key={messageKey} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                <div className="max-w-xs lg:max-w-md group relative">
                  {isEditing ? (
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleSaveEdit()
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                      />
                      <div className="flex justify-end space-x-2 mt-2">
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-500 hover:text-blue-700 rounded"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Regular text message or file message content */}
                      {(!msg.file_url || msg.content) && (
                        <div
                          className={`px-4 py-2 rounded-lg cursor-pointer ${
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
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditMessage(msg)
                                  }}
                                  className="text-xs text-blue-200 hover:text-white p-1 rounded"
                                  title="Edit message"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteMessage(msg.id)
                                  }}
                                  className="text-xs text-red-200 hover:text-white p-1 rounded"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* File Attachment Rendering */}
                      {msg.file_url && (
                        <div className={`mt-2 ${!msg.content ? 'mt-0' : ''}`}>
                          {/* Image Preview */}
                          {getFileCategory(msg.mime_type || msg.file_type) === 'image' && !isImageBroken(msg.id) && (
                            <div className="relative group mb-2">
                              <img
                                src={msg.file_url}
                                alt={msg.file_name || 'Shared image'}
                                className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => handleFileClick(msg.file_url, msg.file_name, msg.file_type, msg.mime_type)}
                                onError={() => handleImageError(msg.id)}
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-8 h-8 text-white" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* PDF Preview Icon */}
                          {getFileCategory(msg.mime_type || msg.file_type) === 'pdf' && (
                            <div className="mb-2">
                              <div
                                className="w-32 h-20 bg-red-100 border-2 border-red-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-200 transition-colors"
                                onClick={() => handleFileClick(msg.file_url, msg.file_name, msg.file_type, msg.mime_type)}
                              >
                                <div className="text-center">
                                  <FileText className="w-8 h-8 text-red-600 mx-auto mb-1" />
                                  <span className="text-xs text-red-700 font-medium">PDF</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* File Attachment Card */}
                          <div
                            className={`inline-flex items-center space-x-3 px-4 py-3 rounded-lg cursor-pointer border transition-colors max-w-xs ${
                              isCurrentUser
                                ? 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200'
                                : 'bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200'
                            }`}
                            onClick={() => handleFileClick(msg.file_url, msg.file_name, msg.file_type, msg.mime_type)}
                          >
                            <div className="flex-shrink-0">
                              {getFileIcon(msg.mime_type || msg.file_type, 'w-6 h-6')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {msg.file_name || 'Unknown file'}
                              </p>
                              <div className="flex items-center space-x-2 text-xs opacity-75">
                                <span>{formatFileSize(msg.file_size)}</span>
                                <span>•</span>
                                <span className="capitalize">
                                  {getFileCategory(msg.mime_type || msg.file_type)}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center space-x-1">
                              {(getFileCategory(msg.mime_type || msg.file_type) === 'image' || 
                                getFileCategory(msg.mime_type || msg.file_type) === 'pdf') && (
                                <Eye className="w-4 h-4" />
                              )}
                              <Download className="w-4 h-4" />
                            </div>
                          </div>

                          {/* Fallback for broken images */}
                          {getFileCategory(msg.mime_type || msg.file_type) === 'image' && isImageBroken(msg.id) && (
                            <div className="mb-2 p-4 bg-gray-100 border border-gray-200 rounded-lg text-center">
                              <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-600">Image unavailable</p>
                              <p className="text-xs text-gray-500">{msg.file_name}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
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

        {/* Upload progress indicator */}
        {uploadingFiles.size > 0 && (
          <div className="flex justify-end">
            <div className="bg-blue-100 border border-blue-200 px-4 py-2 rounded-lg rounded-br-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-sm text-blue-700">
                  Uploading {uploadingFiles.size} file{uploadingFiles.size > 1 ? 's' : ''}...
                </span>
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
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFiles.size > 0}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            {uploadingFiles.size > 0 ? (
              <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            accept="*/*"
          />
          <div className="flex-1">
            <input
              type="text"
              value={message}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim() || isSubmitting}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}