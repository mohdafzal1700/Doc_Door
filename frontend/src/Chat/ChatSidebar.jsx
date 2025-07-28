"use client"
import { useState, useEffect } from "react"
import { Search, Settings, LogOut, Plus, Users } from "lucide-react"
import { searchUsers, getOnlineUsers, createConversation } from '../endpoints/Chat'
import { getNotificationSocket } from "../service/websocket"

export default function ChatSidebar({ 
  conversations, 
  selectedConversation, 
  currentUser, 
  onSelectConversation, 
  onConversationUpdate, 
  onConversationDelete, 
  onNewConversation 
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [notifications, setNotifications] = useState([])
  const notificationSocket = useState(null)

  // Helper function to get avatar image or initials
  const getAvatarDisplay = (user, size = "w-10 h-10") => {
    const avatarUrl = user?.avatar || user?.profile_picture_url
    const initials = user?.name?.charAt(0) || 
                    user?.full_name?.charAt(0) || 
                    user?.username?.charAt(0) || 'U'
    
    if (avatarUrl) {
      return (
        <img 
          src={avatarUrl} 
          alt={user?.name || user?.full_name || user?.username || 'User'}
          className={`${size} rounded-full object-cover`}
          onError={(e) => {
            // Fallback to initials if image fails to load
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      )
    }
    
    return (
      <div className={`${size} bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-700`}>
        {initials}
      </div>
    )
  }

  // Filter conversations based on search term
  const filteredConversations = conversations.filter((conversation) => {
    const otherParticipant = conversation.participants?.find(p => p.id !== currentUser?.id)
    const participantName = otherParticipant?.full_name || otherParticipant?.username || ''
    return participantName.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Initialize notification WebSocket
  useEffect(() => {
    const socket = getNotificationSocket()
    if (socket) {
      socket.onmessage = handleNotificationMessage
    }
  }, [])

  // Load online users
  useEffect(() => {
    loadOnlineUsers()
  }, [])

  const handleNotificationMessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('🔔 Notification received:', data)
      
      switch (data.type) {
        case 'user_status_changed':
          if (data.status === 'online') {
            setOnlineUsers(prev => [...new Set([...prev, data.user_id])])
          } else {
            setOnlineUsers(prev => prev.filter(id => id !== data.user_id))
          }
          break
        case 'new_notification':
          setNotifications(prev => [...prev, data.notification])
          console.log('📨 New notification:', data.notification)
          break
      }
    } catch (error) {
      console.error('❌ Error parsing notification:', error)
    }
  }

  const loadOnlineUsers = async () => {
    try {
      const response = await getOnlineUsers()
      setOnlineUsers(response.data.map(user => user.id))
    } catch (error) {
      console.error('❌ Error loading online users:', error)
    }
  }

  const handleSearch = async (query) => {
    setSearchTerm(query)
    if (query.length > 2) {
      setIsSearching(true)
      try {
        const response = await searchUsers(query)
        setSearchResults(response.data)
        setShowUserSearch(true)
      } catch (error) {
        console.error('❌ Error searching users:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    } else {
      setSearchResults([])
      setShowUserSearch(false)
    }
  }

  const handleCreateConversation = async (userId) => {
    try {
      const response = await createConversation(userId)
      const newConversation = response.data
      
      // Use the callback to add new conversation
      onNewConversation(newConversation)
      
      // Select the new conversation
      onSelectConversation(newConversation)
      
      // Clear search
      setSearchTerm("")
      setSearchResults([])
      setShowUserSearch(false)
      
      console.log('✅ New conversation created:', newConversation)
    } catch (error) {
      console.error('❌ Error creating conversation:', error)
    }
  }

  const truncateMessage = (message, maxLength = 50) => {
    if (!message) return "No messages yet"
    return message.length > maxLength ? message.substring(0, maxLength) + "..." : message
  }

  const getLastMessageTime = (conversation) => {
    if (!conversation.last_message?.created_at) return ""
    
    const date = new Date(conversation.last_message.created_at)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return "now"
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString()
  }

  const isUserOnline = (userId) => onlineUsers.includes(userId)

  const onMarkNotificationRead = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const onMarkAllNotificationsRead = () => {
    setNotifications([])
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* User Header */}
      <div className="p-4 border-b border-gray-200 bg-blue-50">
        <div className="flex items-center space-x-3">
          <div className="relative">
            {/* Fixed: Use getAvatarDisplay helper for current user */}
            {getAvatarDisplay(currentUser, "w-12 h-12")}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">
              {currentUser?.name || 
              currentUser?.full_name || 
              currentUser?.username || 
              'Current User'}
            </h3>
            <p className="text-xs text-gray-600">
              {currentUser?.role === 'doctor' ? 'Healthcare Provider' : 
              currentUser?.role === 'patient' ? 'Patient' : 
              currentUser?.role || 'User'}
            </p>
            <p className="text-xs text-green-600">Online</p>
          </div>
          <div className="flex space-x-1">
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Settings className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Notification indicator */}
        {notifications.length > 0 && (
          <div className="mt-2 text-xs text-blue-600">
            {notifications.length} new notification{notifications.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conversations or users..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
      </div>

      {/* User Search Results */}
      {showUserSearch && (
        <div className="border-b border-gray-200 max-h-48 overflow-y-auto">
          <div className="px-4 py-2 bg-gray-50">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center">
              <Users className="w-3 h-3 mr-1" />
              Users ({searchResults.length})
            </h4>
          </div>
          {searchResults.map((user) => (
            <div
              key={user.id}
              onClick={() => handleCreateConversation(user.id)}
              className="p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  {/* Fixed: Use getAvatarDisplay helper for search results */}
                  {getAvatarDisplay(user, "w-8 h-8")}
                  {isUserOnline(user.id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900">
                    {user.full_name || user.username}
                  </h3>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <Plus className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversations Header */}
      <div className="px-4 py-2 border-b border-gray-100">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Conversations ({filteredConversations.length})
        </h4>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchTerm ? "No conversations found" : "No conversations yet"}
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const otherParticipant = conversation.participants?.find(p => p.id !== currentUser?.id) || {}
            const isSelected = selectedConversation?.id === conversation.id
            const lastMessage = conversation.last_message

            return (
              <div
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={`p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                  isSelected ? "bg-blue-50 border-r-2 border-r-blue-500" : ""
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    {/* Fixed: Use getAvatarDisplay helper for conversation participants */}
                    {getAvatarDisplay(otherParticipant, "w-10 h-10")}
                    {isUserOnline(otherParticipant.id) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {otherParticipant.full_name || otherParticipant.username || 'Unknown User'}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {getLastMessageTime(conversation)}
                        </span>
                        {conversation.unread_count > 0 && (
                          <div className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                            {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {lastMessage ? (
                        <>
                          {lastMessage.sender?.id === currentUser?.id && "You: "}
                          {truncateMessage(lastMessage.content)}
                        </>
                      ) : (
                        "No messages yet"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}