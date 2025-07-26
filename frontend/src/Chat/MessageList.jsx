import React, { useState, useEffect, useRef } from 'react';
import { Trash2 } from "lucide-react";
import { formatTime } from '../utils/helpers';
import {Avatar ,AvatarImage, AvatarFallback} from '../components/ui/Avatar';
import ScrollArea from '../components/ui/ScrollArea';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function MessageList({ 
  conversationId,
  messages: initialMessages, 
  currentUserId, 
  typingUsers: initialTypingUsers, 
  participants,
  onDeleteMessage,
  onEditMessage,
  onNewMessage
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [typingUsers, setTypingUsers] = useState(initialTypingUsers);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const ws = useRef(null);
  const scrollAreaRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!conversationId) return;

    const websocketUrl = `ws://localhost:8000/ws/chat/${conversationId}/`;
    ws.current = new WebSocket(websocketUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      handleWebSocketMessage(data);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [conversationId]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'new_message':
        setMessages(prev => [...prev, data.message]);
        onNewMessage && onNewMessage(data.message);
        break;
      case 'typing_start':
        setTypingUsers(prev => 
          prev.includes(data.user_id) ? prev : [...prev, data.user_id]
        );
        break;
      case 'typing_stop':
        setTypingUsers(prev => prev.filter(id => id !== data.user_id));
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  // Send typing events
  useEffect(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    const timer = setTimeout(() => {
      if (isTyping) {
        ws.current.send(JSON.stringify({
          type: 'typing_stop',
          user_id: currentUserId
        }));
        setIsTyping(false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isTyping, currentUserId]);

  const handleTyping = () => {
    if (!isTyping && ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'typing_start',
        user_id: currentUserId
      }));
      setIsTyping(true);
    }
  };

  const sendMessage = (content) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'new_message',
        content: content
      }));
    }
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const isCurrentUser = (message) => {
    return message.sender.id === currentUserId;
  };

  const getTypingUserNames = () => {
    return typingUsers
      .map(userId => participants?.find(p => p.id === userId)?.name)
      .filter(Boolean);
  };

  const handleStartEdit = (message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (editContent.trim() && editingMessageId) {
      await onEditMessage(editingMessageId, editContent);
      setEditingMessageId(null);
      setEditContent('');
    }
  };

  return (
    <div className="flex-1 relative">
      <ScrollArea ref={scrollAreaRef} className="h-full p-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const isOwn = isCurrentUser(message);
            
            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${isOwn ? "justify-end" : "justify-start"}`}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {!isOwn && (
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={message.sender.avatar || "/placeholder.svg"} />
                    <AvatarFallback>
                      {message.sender.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className="flex flex-col gap-1 max-w-[80%]">
                  {editingMessageId === message.id ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="bg-white dark:bg-gray-800"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm"
                          onClick={handleSaveEdit}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group">
                      <div
                        className={`p-3 rounded-lg ${
                          isOwn
                            ? "bg-black text-white rounded-br-none"
                            : "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100 rounded-bl-none"
                        }`}
                      >
                        {message.content}
                        {message.attachments?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.attachments.map((attachment, index) => (
                              <div key={index} className="w-32 h-32 rounded-md border border-gray-300 overflow-hidden">
                                {attachment.type.startsWith('image/') ? (
                                  <img 
                                    src={attachment.url} 
                                    alt={`Attachment ${index}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <a 
                                    href={attachment.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-full h-full flex flex-col items-center justify-center bg-gray-100 p-2"
                                  >
                                    <Paperclip className="h-6 w-6 text-gray-500" />
                                    <span className="text-xs text-gray-500 truncate w-full text-center">
                                      {attachment.name}
                                    </span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {isOwn && hoveredMessageId === message.id && (
                        <div className={`absolute flex gap-1 ${isOwn ? '-left-12' : '-right-12'} top-1/2 transform -translate-y-1/2`}>
                          <button
                            onClick={() => handleStartEdit(message)}
                            className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => onDeleteMessage(message.id)}
                            className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div
                    className={`text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 ${
                      isOwn ? "justify-end" : ""
                    }`}
                  >
                    {message.edited && (
                      <span className="text-xs italic">(edited)</span>
                    )}
                    {formatTime(message.timestamp)}
                  </div>
                </div>
                
                {isOwn && (
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={message.sender.avatar || "/placeholder.svg"} />
                    <AvatarFallback>
                      {message.sender.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}

          {typingUsers.length > 0 && (
            <div className="flex items-start gap-3 justify-start">
              <Avatar className="w-8 h-8">
                <AvatarFallback>...</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <div className="p-3 rounded-lg bg-gray-200 dark:bg-gray-700">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {getTypingUserNames().join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}