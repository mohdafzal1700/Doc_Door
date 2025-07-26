    // websocket.js - Fixed version
    const user_url = "ws://localhost:8000/ws/user/";
    const chat_url = "ws://localhost:8000/ws/chat/";

    let userSocketInstance = null;
    let chatSocketInstance = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    // Function to get authentication token (you'll need to implement this based on your auth system)
    const getAuthToken = () => {
        // Return your authentication token here
        // This could be from localStorage, cookies, or your auth context
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    };

    // Function to get CSRF token if needed
    const getCSRFToken = () => {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return null;
    };

    export const getUserSocket = (userId) => {
        if (!userSocketInstance || userSocketInstance.readyState === WebSocket.CLOSED) {
            console.log(`🔌 Creating new User WebSocket connection for user ${userId}`);
            
            // Build WebSocket URL with authentication parameters
            const token = getAuthToken();
            const wsUrl = `${user_url}${userId}/${token ? `?token=${token}` : ''}`;
            
            console.log(`🔗 Connecting to: ${wsUrl}`);
            
            try {
                userSocketInstance = new WebSocket(wsUrl);
                
                userSocketInstance.onopen = () => {
                    console.log("✅ User WebSocket connected successfully");
                    reconnectAttempts = 0;
                };
                
                userSocketInstance.onclose = (event) => {
                    console.log("❌ User WebSocket disconnected:", event);
                    userSocketInstance = null;
                    
                    // Attempt to reconnect for certain close codes
                    if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        console.log(`🔄 Reconnecting User Socket... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                        setTimeout(() => getUserSocket(userId), 1000 * reconnectAttempts);
                    }
                };
                
                userSocketInstance.onerror = (error) => {
                    console.error("❌ User WebSocket error:", error);
                };
                
            } catch (error) {
                console.error("❌ Error creating User WebSocket:", error);
                return null;
            }
        }
        
        return userSocketInstance;
    };

    export const getChatSocket = (conversationId) => {
        if (!chatSocketInstance || chatSocketInstance.readyState === WebSocket.CLOSED) {
            console.log(`🔌 Creating new Chat WebSocket connection for conversation ${conversationId}`);
            
            const token = getAuthToken();
            const wsUrl = `${chat_url}${conversationId}/${token ? `?token=${token}` : ''}`;
            
            console.log(`🔗 Connecting to: ${wsUrl}`);
            
            try {
                chatSocketInstance = new WebSocket(wsUrl);
                
                chatSocketInstance.onopen = () => {
                    console.log("✅ Chat WebSocket connected successfully");
                    reconnectAttempts = 0;
                };
                
                chatSocketInstance.onclose = (event) => {
                    console.log("❌ Chat WebSocket disconnected:", event);
                    chatSocketInstance = null;
                    
                    if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        console.log(`🔄 Reconnecting Chat Socket... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                        setTimeout(() => getChatSocket(conversationId), 1000 * reconnectAttempts);
                    }
                };
                
                chatSocketInstance.onerror = (error) => {
                    console.error("❌ Chat WebSocket error:", error);
                };
                
            } catch (error) {
                console.error("❌ Error creating Chat WebSocket:", error);
                return null;
            }
        }
        
        return chatSocketInstance;
    };

    export const closeUserSocket = () => {
        if (userSocketInstance) {
            console.log("🔌 Manually closing User WebSocket connection");
            userSocketInstance.close(1000, "Manual close");
            userSocketInstance = null;
        }
    };

    export const closeChatSocket = () => {
        if (chatSocketInstance) {
            console.log("🔌 Manually closing Chat WebSocket connection");
            chatSocketInstance.close(1000, "Manual close");
            chatSocketInstance = null;
        }
    };

    export const closeAllSockets = () => {
        closeUserSocket();
        closeChatSocket();
    };

    // Backward compatibility
    export const getSocket = getUserSocket;
    export const closeSocket = closeAllSockets;