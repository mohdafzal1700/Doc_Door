import axios from "axios";

// Change this to match your DRF backend route for chat APIs
const BASE_URL = 'http://localhost:8000/api/chat/';

const chatAxios = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,  // Needed for sending cookies
    headers: {
        'Content-Type': 'application/json',  // Ensure JSON content type
    },
});

// Token refresh function specifically for chat
export const refreshChatToken = () => {
    return axios.post(
        "http://localhost:8000/api/auth/token/refresh/", 
        {}, 
        { withCredentials: true }
    );
};

// ADD REQUEST INTERCEPTOR - This was missing!
chatAxios.interceptors.request.use(
    (config) => {
        // Get token from localStorage, sessionStorage, or cookies
        const token = localStorage.getItem('access_token') || 
                      localStorage.getItem('authToken') ||
                      sessionStorage.getItem('access_token') ||
                      getCookieValue('access_token'); // If you store in cookies
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        console.log('📤 Chat Request:', config.method?.toUpperCase(), config.url, {
            hasAuth: !!token,
            contentType: config.headers['Content-Type']
        });
        
        return config;
    },
    (error) => {
        console.error('❌ Chat Request Error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor (your existing code with small improvements)
chatAxios.interceptors.response.use(
    (response) => {
        console.log('📥 Chat Response:', response.status, response.config.url);
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                console.log("Chat token expired, attempting refresh...");
                
                const refreshResponse = await refreshChatToken();
                
                if (refreshResponse.status === 200) {
                    console.log("Chat token refresh successful");
                    
                    // Update the stored token if refresh returns a new one
                    if (refreshResponse.data?.access) {
                        localStorage.setItem('access_token', refreshResponse.data.access);
                        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access}`;
                    }
                    
                    // Retry original chat request
                    return chatAxios(originalRequest);
                }
            } catch (refreshError) {
                console.error("Chat token refresh failed:", refreshError);
                
                // Clear any stored tokens
                localStorage.removeItem('access_token');
                localStorage.removeItem('authToken');
                localStorage.removeItem('refresh_token');
                
                // Redirect to login page
                window.location.href = "/login";
                return Promise.reject(refreshError);
            }
        }

        console.error('❌ Chat Response Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
    }
);

// Helper function to get cookie value (if you store tokens in cookies)
function getCookieValue(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

export default chatAxios;