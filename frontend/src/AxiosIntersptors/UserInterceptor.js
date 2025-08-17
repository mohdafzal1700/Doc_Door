// AxiosInterceptors/UserInterceptor.js - UPDATED VERSION
import axios from "axios";

const BASE_URL = 'http://localhost:8000/api/auth/';

// Create axios instance
const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // CRITICAL: This sends cookies automatically
    timeout: 10000,
});

// Track if we're already refreshing to avoid multiple refresh calls
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    
    failedQueue = [];
};

// 🔑 REQUEST INTERCEPTOR - Cookies are sent automatically
axiosInstance.interceptors.request.use(
    (config) => {
        // Log request for debugging
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        console.log(`🍪 Cookies will be sent automatically`);
        return config;
    },
    (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
    }
);

// 🔄 RESPONSE INTERCEPTOR - Handle token refresh for cookie-based auth
axiosInstance.interceptors.response.use(
    (response) => {
        console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, response.status);
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        
        console.error(`❌ API Error: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, {
            status: error.response?.status,
            message: error.message,
            data: error.response?.data
        });

        // Handle 401 Unauthorized - Token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
            
            // If already refreshing, queue the request
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => {
                    return axiosInstance(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }
            
            originalRequest._retry = true;
            isRefreshing = true;

            try {
                console.log('🔄 Attempting cookie-based token refresh...');
                
                // Call your refresh endpoint - it will read refresh_token from cookies
                const refreshResponse = await axios.post(
                    `${BASE_URL}token/refresh/`, // Your CustomTokenRefreshView endpoint
                    {}, // Empty body - refresh token comes from cookies
                    { 
                        withCredentials: true, // Ensures cookies are sent
                        timeout: 10000
                    }
                );

                if (refreshResponse.status === 200) {
                    console.log('✅ Token refreshed successfully via cookies');
                    
                    // Process any queued requests
                    processQueue(null);
                    
                    // The new access_token cookie is automatically set by your backend
                    // Just retry the original request
                    return axiosInstance(originalRequest);
                } else {
                    throw new Error('Refresh request failed');
                }

            } catch (refreshError) {
                console.error('❌ Token refresh failed:', refreshError);
                
                // Process failed queue
                processQueue(refreshError);
                
                // Clear any localStorage auth data (if you have any)
                const authKeys = ['access_token', 'refresh_token', 'user_details', 'isAuthenticated', 'user_type'];
                authKeys.forEach(key => {
                    localStorage.removeItem(key);
                });

                // Clear cookies by calling logout endpoint
                try {
                    await axios.post(`${BASE_URL}logout/`, {}, { 
                        withCredentials: true,
                        timeout: 5000
                    });
                    console.log('🚪 Logout endpoint called to clear cookies');
                } catch (logoutError) {
                    console.log('⚠️ Logout endpoint failed, but continuing with cleanup');
                }

                // Dispatch auth state change
                window.dispatchEvent(new Event("authStateChanged"));

                // Redirect to login (avoid infinite redirects)
                if (typeof window !== 'undefined' && 
                    !window.location.pathname.includes('/login') && 
                    !window.location.pathname.includes('/register')) {
                    
                    console.log('🔄 Redirecting to login...');
                    window.location.href = "/login";
                }

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // Handle other status codes
        if (error.response?.status === 500) {
            console.error('🔥 Server Error 500:', error.response?.data);
        } else if (error.response?.status === 403) {
            console.error('🚫 Access Forbidden');
        } else if (!error.response) {
            console.error('🌐 Network Error:', error.message);
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;