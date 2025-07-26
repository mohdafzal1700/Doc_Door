import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircle, Send, User, Bot, Plus, Settings } from "lucide-react";
import { 
    getConversations, 
    createConversation, 
    deleteConversation, 
    getMessages, 
    createMessage, 
    updateMessage, 
    deleteMessage, 
    markConversationRead, 
    searchUsers, 
    getNotifications, 
    markNotificationRead, 
    markAllNotificationsRead 
} from '../endpoints/Chat';
import { getUserSocket, getChatSocket, closeAllSockets } from '../service/websocket';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput'
import EmptyChatState from './EmptyChatState'
import ChatSidebar from './ChatSidebar'
import MessageList from './MessageList'



export default function ChatApp() {
    const { userId } = useParams();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [userSocket, setUserSocket] = useState(null);
    const [chatSocket, setChatSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [notifications, setNotifications] = useState([]);
    
    // Get current user from your auth context or localStorage
    const [currentUser, setCurrentUser] = useState(null);

    // Get current user data
    useEffect(() => {
        const getCurrentUser = async () => {
            try {
                // Replace this with your actual current user fetch logic
                const userData = JSON.parse(localStorage.getItem('userData')) || {
                    id: 1,
                    name: "Current User",
                    role: "doctor",
                    avatar: null
                };
                setCurrentUser(userData);
            } catch (error) {
                console.error('Failed to get current user:', error);
                // Set default user or redirect to login
                setCurrentUser({
                    id: 1,
                    name: "Current User",
                    role: "doctor",
                    avatar: null
                });
            }
        };
        
        getCurrentUser();
    }, []);

    useEffect(() => {
        if (currentUser) {
            initializeData();
            setupUserWebSocket();
        }

        return () => {
            closeAllSockets();
        };
    }, [currentUser, userId]);

    const initializeData = async () => {
        try {
            setLoading(true);
            const [conversationsRes, notificationsRes] = await Promise.all([
                getConversations(),
                getNotifications()
            ]);

            console.log('Conversations loaded:', conversationsRes.data);
            console.log('Notifications loaded:', notificationsRes.data);

            setConversations(conversationsRes.data);
            setNotifications(notificationsRes.data);

            // Handle direct navigation to chat with a specific user
            if (userId) {
                await handleDirectChatNavigation(userId, conversationsRes.data);
            } else if (conversationsRes.data.length > 0) {
                setSelectedConversation(conversationsRes.data[0]);
            }
        } catch (error) {
            console.error('Failed to initialize data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDirectChatNavigation = async (targetUserId, existingConversations) => {
        try {
            console.log('Looking for conversation with user:', targetUserId);
            
            // Check if a conversation with this user already exists
            const existingConversation = existingConversations.find(conv => 
                conv.participants.some(p => p.id.toString() === targetUserId.toString())
            );

            if (existingConversation) {
                setSelectedConversation(existingConversation);
                console.log('Found existing conversation:', existingConversation.id);
            } else {
                console.log('Creating new conversation with user:', targetUserId);
                const response = await createConversation(targetUserId);
                const newConversation = response.data;

                setConversations(prev => [newConversation, ...prev]);
                setSelectedConversation(newConversation);
                console.log('Created new conversation:', newConversation.id);
            }
        } catch (error) {
            console.error('Failed to handle direct chat navigation:', error);
            if (existingConversations.length > 0) {
                setSelectedConversation(existingConversations[0]);
            }
        }
    };

    const setupUserWebSocket = () => {
        if (!currentUser) return;

        const ws = getUserSocket(currentUser.id);
        if (ws) {
            setUserSocket(ws);
            
            ws.onopen = () => {
                console.log('✅ User WebSocket connected');
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 User WebSocket message:', data);
                    handleUserWebSocketMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            ws.onclose = () => {
                console.log('❌ User WebSocket disconnected');
                setUserSocket(null);
            };
            
            ws.onerror = (error) => {
                console.error('❌ User WebSocket error:', error);
            };
        }
    };

    const setupChatWebSocket = (conversationId) => {
        if (!conversationId) return;

        // Close existing chat socket
        if (chatSocket) {
            chatSocket.close();
        }

        const ws = getChatSocket(conversationId);
        if (ws) {
            setChatSocket(ws);
            
            ws.onopen = () => {
                console.log('✅ Chat WebSocket connected for conversation:', conversationId);
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 Chat WebSocket message:', data);
                    handleChatWebSocketMessage(data);
                } catch (error) {
                    console.error('Failed to parse chat WebSocket message:', error);
                }
            };
            
            ws.onclose = () => {
                console.log('❌ Chat WebSocket disconnected');
                setChatSocket(null);
            };
            
            ws.onerror = (error) => {
                console.error('❌ Chat WebSocket error:', error);
            };
        }
    };

    const handleUserWebSocketMessage = (data) => {
        switch (data.type) {
            case 'notification':
                setNotifications(prev => [data.notification, ...prev]);
                break;
            case 'user_status_changed':
                if (data.status === 'online') {
                    setOnlineUsers(prev => [...new Set([...prev, data.user_id])]);
                } else {
                    setOnlineUsers(prev => prev.filter(id => id !== data.user_id));
                }
                break;
            default:
                console.log('Unknown user WebSocket message type:', data.type);
        }
    };

    const handleChatWebSocketMessage = (data) => {
        switch (data.type) {
            case 'chat_message':
                handleNewMessage(data.message);
                break;
            case 'message_edited':
                handleMessageUpdated(data.message);
                break;
            case 'message_deleted':
                handleMessageDeleted(data.message_id);
                break;
            case 'typing_indicator':
                if (data.is_typing) {
                    setTypingUsers(prev => [...new Set([...prev, data.user_id])]);
                } else {
                    setTypingUsers(prev => prev.filter(id => id !== data.user_id));
                }
                break;
            case 'delivery_status_updated':
                // Handle message delivery status updates
                break;
            default:
                console.log('Unknown chat WebSocket message type:', data.type);
        }
    };

    const handleNewMessage = (message) => {
        console.log('📨 New message received:', message);
        
        if (message.conversation_id === selectedConversation?.id) {
            setMessages(prev => [...prev, message]);
        }

        // Update conversation list
        setConversations(prev => prev.map(conv => 
            conv.id === message.conversation_id 
                ? {
                    ...conv,
                    last_message: {
                        content: message.content,
                        created_at: message.created_at,
                        sender: message.sender
                    },
                    unread_count: conv.id === selectedConversation?.id ? 0 : (conv.unread_count || 0) + 1
                } 
                : conv
        ));
    };

    const handleMessageUpdated = (updatedMessage) => {
        if (updatedMessage.conversation_id === selectedConversation?.id) {
            setMessages(prev => prev.map(msg => 
                msg.id === updatedMessage.id ? updatedMessage : msg
            ));
        }
    };

    const handleMessageDeleted = (messageId) => {
        if (selectedConversation) {
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
        }
    };

    // Set up chat WebSocket when conversation is selected
    useEffect(() => {
        if (selectedConversation) {
            loadMessages(selectedConversation.id);
            setupChatWebSocket(selectedConversation.id);
        }
    }, [selectedConversation]);

    const loadMessages = async (conversationId) => {
        try {
            const response = await getMessages(conversationId);
            const messagesData = response.data.results || response.data || [];
            console.log('Messages loaded:', messagesData);
            setMessages(messagesData);
        } catch (error) {
            console.error('Failed to load messages:', error);
            setMessages([]);
        }
    };

    const handleSendMessage = async (content, attachments = []) => {
        if (!selectedConversation || (!content.trim() && attachments.length === 0)) return;

        setSendingMessage(true);
        try {
            // Get the other participant (receiver)
            const receiver = selectedConversation.participants.find(p => p.id !== currentUser.id);
            
            const messageData = {
                message: content.trim(),
                receiver_id: receiver.id,
                conversation_id: selectedConversation.id
            };

            console.log('Sending message:', messageData);

            // Send via WebSocket first for real-time delivery
            if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                chatSocket.send(JSON.stringify({
                    type: 'chat_message',
                    ...messageData
                }));
            }

            // Also save to database via API
            const response = await createMessage({
                content: content.trim(),
                conversation: selectedConversation.id,
                receiver_id: receiver.id
            });

            console.log('Message saved to database:', response.data);

        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setSendingMessage(false);
        }
    };

    const handleSelectConversation = async (conversation) => {
        console.log('Selecting conversation:', conversation);
        setSelectedConversation(conversation);

        if (conversation.unread_count > 0) {
            try {
                await markConversationRead(conversation.id);
                setConversations(prev => prev.map(conv => 
                    conv.id === conversation.id 
                        ? { ...conv, unread_count: 0 } 
                        : conv
                ));
            } catch (error) {
                console.error('Failed to mark conversation as read:', error);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
                    <div className="text-gray-600 dark:text-gray-400">Loading conversations...</div>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <div className="text-gray-600 dark:text-gray-400">Loading user data...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            <ChatSidebar
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                onSearchUsers={searchUsers}
                onDeleteConversation={deleteConversation}
                currentUser={currentUser}
                notifications={notifications}
                onMarkNotificationRead={markNotificationRead}
                onMarkAllNotificationsRead={markAllNotificationsRead}
            />
            
            <div className="flex-1 flex flex-col">
                {selectedConversation ? (
                    <>
                        <ChatHeader
                            conversation={selectedConversation}
                            currentUser={currentUser}
                            onlineUsers={onlineUsers}
                        />
                        <MessageList
                            messages={messages}
                            currentUserId={currentUser.id}
                            typingUsers={typingUsers}
                            participants={selectedConversation.participants}
                            onDeleteMessage={deleteMessage}
                            onEditMessage={updateMessage}
                        />
                        <ChatInput
                            onSendMessage={handleSendMessage}
                            disabled={sendingMessage}
                            socket={chatSocket}
                            conversationId={selectedConversation.id}
                            currentUserId={currentUser.id}
                        />
                    </>
                ) : (
                    <EmptyChatState
                        conversations={conversations}
                        currentUser={currentUser}
                    />
                )}
            </div>
        </div>
    );
}