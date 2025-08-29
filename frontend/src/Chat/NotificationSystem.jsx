"use client"
import { useState, useEffect, useRef } from "react"
import { Bell, X, MessageCircle, UserPlus, Settings, Check, CheckCheck } from "lucide-react"

export default function NotificationSystem({ currentUser, conversations = [], onNotificationClick }) {
  const [notifications, setNotifications] = useState([])
  const [permission, setPermission] = useState("default")
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  const notificationSocket = useRef(null)
  const audioRef = useRef(null)
  const processedNotificationIds = useRef(new Set()) // Track processed notifications
  const isReconnecting = useRef(false)

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission)
      if (Notification.permission === "default") {
        Notification.requestPermission().then((result) => {
          setPermission(result)
        })
      }
    }

    // Initialize WebSocket connection
    initializeWebSocket()

    // Listen for custom notification events
    const handleNotificationEvent = (event) => {
      const { data } = event.detail
      handleWebSocketMessage({ data: JSON.stringify(data) })
    }

    window.addEventListener('notification_received', handleNotificationEvent)

    return () => {
      window.removeEventListener('notification_received', handleNotificationEvent)
      if (notificationSocket.current) {
        notificationSocket.current.close()
      }
    }
  }, [])

  // Monitor conversations for new messages
  useEffect(() => {
    checkForNewMessages()
  }, [conversations])

  const initializeWebSocket = async () => {
    try {
      setLoading(true)
      
      // Connect to notification WebSocket
      if (window.getNotificationSocket) {
        const socket = await window.getNotificationSocket()
        
        if (socket) {
          notificationSocket.current = socket
          
          // Override the onmessage handler to use our function
          const originalOnMessage = socket.onmessage
          socket.onmessage = (event) => {
            handleWebSocketMessage(event)
            if (originalOnMessage) originalOnMessage(event)
          }

          // Handle reconnection
          const originalOnOpen = socket.onopen
          socket.onopen = (event) => {
            console.log('✅ Notification WebSocket connected')
            isReconnecting.current = false
            if (originalOnOpen) originalOnOpen(event)
          }

          const originalOnClose = socket.onclose
          socket.onclose = (event) => {
            console.log('❌ Notification WebSocket disconnected')
            if (!isReconnecting.current && event.code !== 1000) {
              isReconnecting.current = true
              setTimeout(() => initializeWebSocket(), 3000)
            }
            if (originalOnClose) originalOnClose(event)
          }
        }
      }
    } catch (error) {
      console.error('❌ Error initializing WebSocket:', error)
    } finally {
      setLoading(false)
      setIsInitialized(true)
    }
  }

  const handleWebSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('🔔 WebSocket notification received:', data)

      switch (data.type) {
        case 'unread_notifications':
          // Handle batch of unread notifications (on reconnect/initial load)
          handleUnreadNotifications(data.notifications)
          break
        case 'notification':
          // Handle single new notification
          handleNewNotification(data.data)
          break
        case 'new_message':
          handleNewMessageNotification(data)
          break
        case 'notification_read':
          handleNotificationRead(data.notification_id)
          break
        case 'user_status_changed':
          handleUserStatusNotification(data)
          break
        default:
          console.log('Unknown notification type:', data.type)
      }
    } catch (error) {
      console.error('❌ Error parsing notification WebSocket message:', error)
    }
  }

  const handleUnreadNotifications = (unreadNotifications) => {
    if (!Array.isArray(unreadNotifications)) return

    console.log(`📥 Received ${unreadNotifications.length} unread notifications`)

    // Filter out notifications we've already processed
    const newNotifications = unreadNotifications.filter(notif => {
      const notifId = notif.id || `${notif.type}_${notif.created_at}`
      return !processedNotificationIds.current.has(notifId)
    })

    if (newNotifications.length === 0) {
      console.log('📋 No new unread notifications to process')
      return
    }

    // Mark these notifications as processed
    newNotifications.forEach(notif => {
      const notifId = notif.id || `${notif.type}_${notif.created_at}`
      processedNotificationIds.current.add(notifId)
    })

    // Add to state without showing browser notifications (these are old)
    setNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id))
      const uniqueNew = newNotifications.filter(notif => !existingIds.has(notif.id))
      return [...uniqueNew, ...prev]
    })

    // Update unread count
    const unreadNewNotifications = newNotifications.filter(notif => !notif.is_read)
    setUnreadCount(prev => prev + unreadNewNotifications.length)

    console.log(`✅ Added ${newNotifications.length} unread notifications to UI`)
  }

  const handleNewNotification = (notification) => {
    if (!notification) return

    const notifId = notification.id || `${notification.type}_${Date.now()}`
    
    // Check if we've already processed this notification
    if (processedNotificationIds.current.has(notifId)) {
      console.log('🔄 Duplicate notification ignored:', notifId)
      return
    }

    // Mark as processed
    processedNotificationIds.current.add(notifId)

    // Ensure notification has required fields
    const processedNotification = {
      id: notifId,
      type: notification.type || 'message',
      title: notification.title || 'New Notification',
      message: notification.message || notification.body || '',
      created_at: notification.created_at || new Date().toISOString(),
      is_read: notification.is_read || false,
      conversation_id: notification.conversation_id,
      sender: notification.sender
    }

    console.log('🆕 Processing new notification:', processedNotification)

    setNotifications(prev => [processedNotification, ...prev])
    
    if (!processedNotification.is_read) {
      setUnreadCount(prev => prev + 1)
    }

    // Show browser notification and play sound for truly new notifications
    showBrowserNotification(processedNotification.title, processedNotification.message)
    playNotificationSound()
  }

  const checkForNewMessages = () => {
    // Count unread messages across all conversations
    const totalUnread = conversations.reduce((total, conv) => {
      return total + (conv.unread_count || 0)
    }, 0)
    
    // Only update if this is from conversations, not notifications
    // setUnreadCount(totalUnread)
  }

  const handleNewMessageNotification = (data) => {
    const notification = {
      id: `message_${data.message_id || Date.now()}`,
      type: 'message',
      title: 'New Message',
      message: `${data.sender_name || 'Someone'}: ${data.message_preview || 'Sent you a message'}`,
      created_at: new Date().toISOString(),
      is_read: false,
      conversation_id: data.conversation_id
    }

    handleNewNotification(notification)
  }

  const handleUserStatusNotification = (data) => {
    if (data.status === 'online') {
      const notification = {
        id: `status_${data.user_id}_${Date.now()}`,
        type: 'user_joined',
        title: 'User Online',
        message: `${data.user_name || 'A user'} is now online`,
        created_at: new Date().toISOString(),
        is_read: false
      }

      handleNewNotification(notification)
    }
  }

  
  const handleNotificationRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, is_read: true }
          : notif
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const showBrowserNotification = (title, body) => {
    if (permission === "granted" && document.hidden) {
      try {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "chat-notification",
          requireInteraction: false,
          silent: false
        })

        // Auto close after 5 seconds
        setTimeout(() => {
          notification.close()
        }, 5000)

        // Handle click
        notification.onclick = () => {
          window.focus()
          notification.close()
          setShowNotifications(true)
        }
      } catch (error) {
        console.error('❌ Error showing browser notification:', error)
      }
    }
  }

  const playNotificationSound = () => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      console.log('🔊 Could not play notification sound:', error)
    }
  }

  const handleMarkAsRead = async (notificationId) => {
    try {
      // Mark locally first
      handleNotificationRead(notificationId)

      // Send to server via WebSocket
      if (window.markNotificationAsRead) {
        await window.markNotificationAsRead(notificationId)
      }

      // If this is a message notification, handle it
      const notification = notifications.find(n => n.id === notificationId)
      if (notification && notification.conversation_id && onNotificationClick) {
        onNotificationClick(notification.conversation_id)
      }
    } catch (error) {
      console.error('❌ Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })))
      setUnreadCount(0)

      // Send to server via WebSocket
      if (window.markAllNotificationsAsRead) {
        await window.markAllNotificationsAsRead()
      }
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error)
    }
  }

  const handleDismiss = async (notificationId) => {
    await handleMarkAsRead(notificationId)
    
    // Remove from UI after a short delay
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId))
      processedNotificationIds.current.delete(notificationId)
    }, 300)
  }

  const handleNotificationItemClick = (notification) => {
    // Mark as read
    handleMarkAsRead(notification.id)

    // If it's a message notification, navigate to that conversation
    if (notification.conversation_id && onNotificationClick) {
      onNotificationClick(notification.conversation_id)
    }

    // Close notifications panel
    setShowNotifications(false)
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'message':
        return <MessageCircle className="w-5 h-5 text-blue-500" />
      case 'user_joined':
        return <UserPlus className="w-5 h-5 text-green-500" />
      case 'appointment':
        return <Bell className="w-5 h-5 text-purple-500" />
      case 'system':
        return <Settings className="w-5 h-5 text-gray-500" />
      default:
        return <Bell className="w-5 h-5 text-blue-500" />
    }
  }

  const formatNotificationTime = (timestamp) => {
    if (!timestamp) return 'Just now'
    
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Create a sample notification for demo purposes
  const addSampleNotification = () => {
    const sampleNotification = {
      id: `sample_${Date.now()}`,
      type: 'message',
      title: 'Demo Notification',
      message: 'This is a sample notification for testing',
      created_at: new Date().toISOString(),
      is_read: false
    }

    handleNewNotification(sampleNotification)
  }

  // Clear processed IDs when component unmounts or user logs out
  const clearNotificationCache = () => {
    processedNotificationIds.current.clear()
    setNotifications([])
    setUnreadCount(0)
  }

  return (
    <>
      {/* Notification Bell Icon */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-3 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        >
          <Bell className="w-6 h-6 text-gray-600" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </button>
      </div>

      {/* Notification Panel */}
      {showNotifications && (
        <div className="fixed top-16 right-4 z-50 w-96 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {/* Demo button - remove in production */}
                <button
                  onClick={addSampleNotification}
                  className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded border border-green-200"
                >
                  Demo
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && !isInitialized ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No notifications yet</p>
                <p className="text-sm mt-2">You'll see new messages and updates here</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationItemClick(notification)}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message || notification.body}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatNotificationTime(notification.created_at || notification.timestamp)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMarkAsRead(notification.id)
                              }}
                              className="text-blue-600 hover:text-blue-800"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDismiss(notification.id)
                            }}
                            className="text-gray-400 hover:text-gray-600"
                            title="Dismiss"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with unread count */}
          {unreadCount > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
              <p className="text-sm text-gray-600">
                {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Overlay to close notifications when clicking outside */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </>
  )
}