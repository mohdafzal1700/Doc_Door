import React, { useState } from 'react';
import { Search, Bell, BellOff, Trash2 } from "lucide-react";
import { formatTime } from '../utils/helpers';
import { searchUsers } from '../endpoints/Chat';
import {Avatar ,AvatarImage, AvatarFallback} from '../components/ui/Avatar';
import ScrollArea from '../components/ui/ScrollArea';
import Input from '../components/ui/Input';

export default function ChatSidebar({ 
  conversations, 
  selectedConversation, 
  onSelectConversation, 
  onSelectUser, // This needs to be passed as a function from parent component
  onDeleteConversation, 
  currentUser, 
  notifications, 
  onMarkNotificationRead, 
  onMarkAllNotificationsRead 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearching(true);
      try {
        const response = await searchUsers(query);
        setSearchResults(response.data);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleUserSelect = (user) => {
    // Add error checking to prevent the TypeError
    if (typeof onSelectUser === 'function') {
      onSelectUser(user);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      console.error('onSelectUser is not a function. Make sure to pass it as a prop from the parent component.');
    }
  };

  const getOtherParticipant = (conversation) => {
    return conversation.participants.find(p => p.id !== currentUser?.id) || conversation.participants[0];
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="hidden md:flex flex-col w-80 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <Input
            type="search"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 rounded-lg bg-gray-100 dark:bg-gray-800 border-none text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="ml-2 relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {unreadNotificationsCount > 0 ? (
            <Bell className="h-5 w-5 text-gray-900 dark:text-gray-100" />
          ) : (
            <BellOff className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          )}
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {showNotifications ? (
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Notifications</h3>
                <button
                  onClick={onMarkAllNotificationsRead}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Mark all as read
                </button>
              </div>
              {notifications.length === 0 ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  No notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${
                      !notification.read
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => onMarkNotificationRead(notification.id)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {notification.title}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {notification.message}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatTime(notification.created_at)}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : searchQuery && searchResults.length > 0 ? (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-3">
                Search Results
              </div>
              {isSearching ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  Searching...
                </div>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => handleUserSelect(user)}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} />
                      <AvatarFallback>
                        {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() ||
                        `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() ||
                        user.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        @{user.username}
                      </div>
                      {user.is_online && (
                        <div className="text-xs text-green-500">Online</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : searchQuery && !isSearching ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No users found
            </div>
          ) : (
            conversations.map((conversation) => {
              const otherParticipant = getOtherParticipant(conversation);
              return (
                <div
                  key={conversation.id}
                  className={`group flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${
                    selectedConversation?.id === conversation.id
                      ? 'bg-gray-100 dark:bg-gray-800'
                      : ''
                  }`}
                  onClick={() => onSelectConversation(conversation)}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={otherParticipant?.avatar || "/placeholder.svg"} />
                    <AvatarFallback>
                      {otherParticipant?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {otherParticipant?.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {conversation.last_message ? formatTime(conversation.last_message.timestamp) : ''}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {conversation.last_message?.content || 'No messages yet'}
                    </div>
                  </div>
                  {conversation.unread_count > 0 && (
                    <div className="bg-black text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {conversation.unread_count}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conversation.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}