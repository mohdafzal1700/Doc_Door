import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { connectNotificationSocket,markNotificationAsRead, 
  markAllNotificationsAsRead,
  closeNotificationSocket  } from '../../service/websocket'
  
const NotificationContext = createContext()

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [socket, setSocket] = useState(null)

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
                
                setNotifications(prev => [newNotification, ...prev])
                setUnreadCount(prev => prev + 1)
                break
                
              case 'unread_notifications':
                // Initial unread notifications on connect
                setNotifications(data.notifications || [])
                setUnreadCount(data.count || 0)
                break
                
              case 'mark_read_response':
                if (data.success) {
                  // Update local state when mark as read succeeds
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
                  // Mark all notifications as read in local state
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
          
          // Add event listener for notifications
          window.addEventListener('notification_received', handleNotification)
          
          // Cleanup function
          return () => {
            window.removeEventListener('notification_received', handleNotification)
          }
        }
      } catch (error) {
        console.error('Failed to initialize notification socket:', error)
        setIsConnected(false)
      }
    }
    
    initializeSocket()
    
    // Cleanup on unmount
    return () => {
      closeNotificationSocket()
      setSocket(null)
      setIsConnected(false)
    }
  }, [])

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const result = await markNotificationAsRead(notificationId)
      
      if (result.success) {
        // Optimistically update UI (will be confirmed by WebSocket response)
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

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const result = await markAllNotificationsAsRead()
      
      if (result.success) {
        // Optimistically update UI (will be confirmed by WebSocket response)
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, is_read: true }))
        )
        setUnreadCount(0)
        return true
      } else {
        console.error('Failed to mark all notifications as read:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }, [])

  // Get unread notifications
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(notif => !notif.is_read)
  }, [notifications])

  // Remove notification from list (optional feature)
  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    )
    // If removing an unread notification, update count
    const notification = notifications.find(n => n.id === notificationId)
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }, [notifications])

  const contextValue = {
    // State
    notifications,
    unreadCount,
    isConnected,
    
    // Actions
    markAsRead,
    markAllAsRead,
    removeNotification,
    
    // Getters
    getUnreadNotifications
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

// Custom hook to use notifications
export const useNotifications = () => {
  const context = useContext(NotificationContext)
  
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  
  return context
}

