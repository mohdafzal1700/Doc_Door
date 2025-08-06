import chatAxios from "../AxiosIntersptors/ChatInterceptor";

// User API functions
export const searchUsers = (searchQuery = '') => 
  chatAxios.get(`users/?search=${encodeURIComponent(searchQuery)}`);

export const getOnlineUsers = () => 
  chatAxios.get("users/online_users/");

// Conversation API functions
export const getConversations = () => 
  chatAxios.get("conversations/");


export const createConversation = (data) => {
  // If data is a string (userId), format it properly
  if (typeof data === 'string') {
    return chatAxios.post("conversations/", {
      participant_id: data
    });
  }
  
  // If data is already an object, use it directly
  if (typeof data === 'object' && data !== null) {
    return chatAxios.post("conversations/", data);
  }
  
  // Fallback error
  throw new Error('Invalid data format for createConversation');
};

// Alternative function for creating conversation with multiple participants
export const createGroupConversation = (participantIds) => 
  chatAxios.post("conversations/", {
    participants: participantIds
  });

export const getConversationDetail = (conversationId) => 
  chatAxios.get(`conversations/${conversationId}/`);

export const updateConversation = (conversationId, data) => 
  chatAxios.patch(`conversations/${conversationId}/`, data);

export const deleteConversation = (conversationId) => 
  chatAxios.delete(`conversations/${conversationId}/`);

export const getConversationMessages = (conversationId, page = null) => {
  const url = page 
    ? `conversations/${conversationId}/messages/?page=${page}` 
    : `conversations/${conversationId}/messages/`;
  return chatAxios.get(url);
};

export const markAllMessagesRead = (conversationId) => 
  chatAxios.post(`conversations/${conversationId}/mark_all_read/`);

// Message API functions
export const getMessages = () => 
  chatAxios.get("messages/");

export const createMessage = (data) => 
  chatAxios.post("messages/", data);

export const getMessageDetail = (messageId) => 
  chatAxios.get(`messages/${messageId}/`);

export const updateMessage = (messageId, data) => 
  chatAxios.patch(`messages/${messageId}/`, data);

export const deleteMessage = (messageId) => 
  chatAxios.delete(`messages/${messageId}/`);

export const markMessageRead = (messageId) => 
  chatAxios.post(`messages/${messageId}/mark_read/`);

// Notification API functions
export const getNotifications = () => 
  chatAxios.get("notifications/");

export const getNotificationDetail = (notificationId) => 
  chatAxios.get(`notifications/${notificationId}/`);

export const markNotificationRead = (notificationId) => 
  chatAxios.post(`notifications/${notificationId}/mark_read/`);

export const markAllNotificationsRead = () => 
  chatAxios.post("notifications/mark_all_read/");

export const getUnreadNotificationCount = () => 
  chatAxios.get("notifications/unread_count/");

// Additional helper functions for better error handling
export const createConversationWithErrorHandling = async (userId) => {
  try {
    console.log('🔄 Creating conversation with user:', userId);
    
    const response = await createConversation(userId);
    console.log('✅ Conversation created successfully:', response.data);
    
    return response;
  } catch (error) {
    console.error('❌ Error creating conversation:', error);
    
    // Handle specific error types
    if (error.response?.status === 400) {
      throw new Error(error.response.data?.error || 'Invalid request data');
    } else if (error.response?.status === 401) {
      throw new Error('Authentication required');
    } else if (error.response?.status === 403) {
      throw new Error('Permission denied');
    } else if (error.response?.status === 404) {
      throw new Error('User not found');
    } else if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    } else {
      throw new Error(error.message || 'Failed to create conversation');
    }
  }
};

export const uploadFile = (file, conversationId, receiverId) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('conversation_id', conversationId);
  formData.append('receiver_id', receiverId);
  
  return chatAxios.post('upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// Get file message by ID
export const getFileMessage = (messageId) =>
  chatAxios.get(`messages/${messageId}/`);

// Simple download function
export const downloadFile = (fileUrl, fileName) => {
  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = fileName || 'download';
  link.target = '_blank';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Open file in new tab
export const openFile = (fileUrl) => {
  window.open(fileUrl, '_blank');
};

// Smart file handler - download or view based on file type
export const handleFile = (fileUrl, fileName, fileType) => {
  // View these file types in browser
  const viewableTypes = ['image', 'pdf'];
  
  if (viewableTypes.includes(fileType)) {
    openFile(fileUrl);
  } else {
    downloadFile(fileUrl, fileName);
  }
}; // <-- This closing brace was missing!