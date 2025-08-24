import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { connectNotificationSocket, markNotificationAsRead, markAllNotificationsAsRead, closeNotificationSocket } from '../../service/websocket'
import { useToast } from '../ui/Toast'

const NotificationContext = createContext()

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [socket, setSocket] = useState(null)
  
  // Track recent messages to prevent duplicates
  const recentMessages = useRef(new Map()) // message -> timestamp
  
  // Get toast functions
  const toast = useToast()

  // Clean up old messages from duplicate detection
  const cleanupOldMessages = useCallback(() => {
    const now = Date.now()
    const fiveMinutesAgo = now - (5 * 60 * 1000)
    
    for (const [message, timestamp] of recentMessages.current.entries()) {
      if (timestamp < fiveMinutesAgo) {
        recentMessages.current.delete(message)
      }
    }
  }, [])

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const notificationSocket = await connectNotificationSocket()
        if (notificationSocket) {
          setSocket(notificationSocket)
          setIsConnected(true)

          // Listen for notification events
          const handleNotification = (event) => {
            const { data } = event.detail
            switch (data.type) {
              case 'notification':
                // New notification received
                const newNotification = {
                  id: data.data.id,
                  type: data.data.type,
                  message: data.data.message,
                  created_at: data.data.created_at,
                  is_read: false
                }
                
                const now = Date.now()
                const messageKey = newNotification.message.trim()
                const recentTimestamp = recentMessages.current.get(messageKey)
                
                // Check if same message was received in last 2 seconds
                if (recentTimestamp && (now - recentTimestamp) < 2000) {
                  console.log('Duplicate message ignored:', messageKey)
                  return // Skip duplicate message
                }
                
                // Record this message
                recentMessages.current.set(messageKey, now)
                
                // Update state
                setNotifications(prev => [newNotification, ...prev])
                setUnreadCount(prev => prev + 1)
                
                // Show toast (clear previous ones first)
                toast.removeAll()
                toast.info(
                  newNotification.message,
                  "🔔 New Notification",
                  {
                    duration: 6000
                  }
                )
                break

              case 'unread_notifications':
                setNotifications(data.notifications || [])
                setUnreadCount(data.count || 0)
                break

              case 'mark_read_response':
                if (data.success) {
                  setNotifications(prev =>
                    prev.map(notif =>
                      notif.id === data.notification_id
                        ? { ...notif, is_read: true }
                        : notif
                    )
                  )
                  setUnreadCount(prev => Math.max(0, prev - 1))
                }
                break

              case 'mark_all_read_response':
                if (data.success) {
                  setNotifications(prev =>
                    prev.map(notif => ({ ...notif, is_read: true }))
                  )
                  setUnreadCount(0)
                }
                break

              default:
                console.log('Unknown notification type:', data.type)
            }
          }

          window.addEventListener('notification_received', handleNotification)

          return () => {
            window.removeEventListener('notification_received', handleNotification)
          }
        }
      } catch (error) {
        console.error('Failed to initialize notification socket:', error)
        setIsConnected(false)
        toast.error(
          'Failed to connect to notification service',
          '⚠️ Connection Error'
        )
      }
    }

    initializeSocket()

    return () => {
      closeNotificationSocket()
      setSocket(null)
      setIsConnected(false)
    }
  }, [toast, cleanupOldMessages])

  // Cleanup old messages periodically
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupOldMessages, 60000) // Every minute
    return () => clearInterval(cleanupInterval)
  }, [cleanupOldMessages])

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const result = await markNotificationAsRead(notificationId)
      if (result.success) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId
              ? { ...notif, is_read: true }
              : notif
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        return true
      } else {
        console.error('Failed to mark notification as read:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const result = await markAllNotificationsAsRead()
      if (result.success) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        )
        setUnreadCount(0)
        
        toast.success(
          'All notifications have been marked as read',
          '✅ Updated'
        )
        return true
      } else {
        console.error('Failed to mark all notifications as read:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }, [toast])

  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(notif => !notif.is_read)
  }, [notifications])

  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.filter(notif => notif.id !== notificationId)
    )
    
    const notification = notifications.find(n => n.id === notificationId)
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }, [notifications])

  const contextValue = {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    removeNotification,
    getUnreadNotifications
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}