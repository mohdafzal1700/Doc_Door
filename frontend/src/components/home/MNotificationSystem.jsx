import { useState, useEffect } from "react"
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react"
import { connectNotificationSocket, markNotificationAsRead, markAllNotificationsAsRead } from "../../service/websocket"

const MobileNotificationSystem = ({ isLoggedIn, className = "" }) => {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Initialize notification WebSocket
  useEffect(() => {
    if (isLoggedIn) {
      const initNotifications = async () => {
        try {
          await connectNotificationSocket()
        } catch (error) {
          console.error('Failed to connect notification socket:', error)
        }
      }
      initNotifications()
    }
  }, [isLoggedIn])

  // Listen for notification events
  useEffect(() => {
    const handleNotificationReceived = (event) => {
      const { data } = event.detail
      if (data.type === 'notification') {
        // New notification received
        setNotifications(prev => [data.data, ...prev])
        setUnreadCount(prev => prev + 1)
      } else if (data.type === 'unread_notifications') {
        // Initial unread notifications on connect
        setNotifications(data.notifications)
        setUnreadCount(data.notifications.length)
      }
    }

    window.addEventListener('notification_received', handleNotificationReceived)
    return () => {
      window.removeEventListener('notification_received', handleNotificationReceived)
    }
  }, [])

  const handleMarkAsRead = async (notificationId) => {
    try {
      const result = await markNotificationAsRead(notificationId)
      if (result.success) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, is_read: true, read_at: new Date().toISOString() } 
              : notif
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllNotificationsAsRead()
      if (result.success) {
        setNotifications(prev => 
          prev.map(notif => ({
            ...notif,
            is_read: true,
            read_at: new Date().toISOString()
          }))
        )
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  const handleSoftDelete = (notificationId) => {
    // Soft delete - just remove from UI
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId))
    setUnreadCount(prev => {
      const deletedNotif = notifications.find(n => n.id === notificationId)
      return deletedNotif && !deletedNotif.is_read ? Math.max(0, prev - 1) : prev
    })
  }

  const formatNotificationTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  // Don't render if user is not logged in
  if (!isLoggedIn) {
    return null
  }

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsNotificationOpen(!isNotificationOpen)}
          className="relative p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors duration-200"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Mobile Notification Dropdown */}
        {isNotificationOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 w-screen max-w-sm transform -translate-x-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 flex items-center space-x-1"
                >
                  <CheckCheck size={16} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-gray-100 dark:border-gray-700 ${
                      !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white font-medium">
                          {notification.type === 'message' ? 'New Message' : 'Appointment'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {formatNotificationTime(notification.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                            title="Mark as read"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleSoftDelete(notification.id)}
                          className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close notifications */}
      {isNotificationOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsNotificationOpen(false)} 
        />
      )}
    </>
  )
}

export default MobileNotificationSystem