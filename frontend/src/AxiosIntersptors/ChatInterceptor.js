import axios from "axios";

// Change this to match your DRF backend route for chat APIs
const BASE_URL = 'http://localhost:8000/api/chat/';

const chatAxios = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,  // Needed for sending cookies
});

// Token refresh function specifically for chat
export const refreshChatToken = () => {
    return axios.post(
        "http://localhost:8000/api/auth/token/refresh/", 
        {}, 
        { withCredentials: true }
    );
};

// Add response interceptor
chatAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                console.log("Chat token expired, attempting refresh...");
                
                const refreshResponse = await refreshChatToken();
                
                if (refreshResponse.status === 200) {
                    console.log("Chat token refresh successful");
                    // Retry original chat request
                    return chatAxios(originalRequest);
                }
            } catch (refreshError) {
                console.error("Chat token refresh failed:", refreshError);
                
                // Clear any stored chat tokens/data if you have any
                // localStorage.removeItem('chatToken'); // if you store any
                
                // Redirect to login page
                window.location.href = "/login";  // Update to your login route
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default chatAxios;