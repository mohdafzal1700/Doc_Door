import chatAxios from "../AxiosIntersptors/ChatInterceptor";




export const getConversations = () => chatAxios.get('conversations/');


export const createConversation = (participantId) => 
    chatAxios.post('conversations/', { participants: [participantId] });


export const getConversation = (id) => chatAxios.get(`conversations/${id}/`);


export const deleteConversation = (id) => chatAxios.delete(`conversations/${id}/`);


export const getMessages = (conversationId, page = 1) => 
    chatAxios.get(`conversations/${conversationId}/messages/`, { 
        params: { page } 
    });


export const createMessage = (data) => chatAxios.post('messages/', data);


export const updateMessage = (id, content) => 
    chatAxios.patch(`messages/${id}/`, { content });


export const deleteMessage = (id) => chatAxios.delete(`messages/${id}/`);


export const markConversationRead = (conversationId) => 
    chatAxios.post(`conversations/${conversationId}/mark_all_read/`);


export const getUsers = () => chatAxios.get('users/');


export const searchUsers = (query) => 
    chatAxios.get('users/', { params: { search: query } });


export const getNotifications = () => chatAxios.get('notifications/');


export const markNotificationRead = (id) => 
    chatAxios.post(`notifications/${id}/mark_read/`);


export const markAllNotificationsRead = () => 
    chatAxios.post('notifications/mark_all_read/');