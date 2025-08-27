// AxiosInterceptors/UserInterceptor.js - IMPROVED VERSION
import axios from "axios";

const BASE_URL = 'https://api.docdoor.muhammedafsal.online/api/auth/';

// Create axios instance
const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // CRITICAL: This sends cookies automatically
    timeout: 10000,
});

// Track refresh attempts
let isRefreshing = false;
let failedQueue = [];
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

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

// Reset refresh tracking
const resetRefreshTracking = () => {
    isRefreshing = false;
    refreshAttempts = 0;
    failedQueue = [];
};

// REQUEST INTERCEPTOR
axiosInstance.interceptors.request.use(
    (config) => {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
    }
);

// RESPONSE INTERCEPTOR - Improved error handling
axiosInstance.interceptors.response.use(
    (response) => {
        console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, response.status);
        // Reset refresh tracking on successful requests
        if (refreshAttempts > 0) {
            refreshAttempts = 0;
        }
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
            
            // Check if we've exceeded max refresh attempts
            if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
                console.error('❌ Max refresh attempts exceeded, logging out');
                await handleLogout();
                return Promise.reject(error);
            }
            
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
            refreshAttempts++;

            try {
                console.log(`🔄 Attempting token refresh (attempt ${refreshAttempts}/${MAX_REFRESH_ATTEMPTS})...`);
                
                // Call refresh endpoint
                const refreshResponse = await axios.post(
                    `${BASE_URL}token/refresh/`,
                    {}, // Empty body - refresh token comes from cookies
                    { 
                        withCredentials: true,
                        timeout: 10000
                    }
                );

                if (refreshResponse.status === 200 && refreshResponse.data.success) {
                    console.log('✅ Token refreshed successfully via cookies');
                    
                    // Reset refresh tracking
                    isRefreshing = false;
                    
                    // Process any queued requests
                    processQueue(null);
                    
                    // Retry the original request
                    return axiosInstance(originalRequest);
                } else {
                    throw new Error('Refresh response indicates failure');
                }

            } catch (refreshError) {
                console.error('❌ Token refresh failed:', refreshError);
                
                // Reset refresh state
                resetRefreshTracking();
                
                // Process failed queue
                processQueue(refreshError);
                
                // Only logout if it's a real auth failure (not network issues)
                if (refreshError.response?.status === 401 || refreshError.response?.status === 400) {
                    console.log('🚪 Refresh token invalid/expired, logging out');
                    await handleLogout();
                } else if (!refreshError.response) {
                    // Network error - don't logout, just fail this request
                    console.log('🌐 Network error during refresh, not logging out');
                    return Promise.reject(refreshError);
                } else {
                    // Server error - don't logout immediately
                    console.log('🔥 Server error during refresh, not logging out');
                    return Promise.reject(refreshError);
                }
                
                return Promise.reject(refreshError);
            }
        }

        // Handle other errors without logging out
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

// Centralized logout handling
const handleLogout = async () => {
    try {
        // Clear localStorage auth data
        const authKeys = ['access_token', 'refresh_token', 'user_details', 'isAuthenticated', 'user_type'];
        authKeys.forEach(key => {
            localStorage.removeItem(key);
        });

        // Call logout endpoint to clear cookies
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

        // Reset refresh tracking
        resetRefreshTracking();

        // Redirect to login (avoid infinite redirects)
        if (typeof window !== 'undefined' && 
            !window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/register')) {
            console.log('🔄 Redirecting to login...');
            setTimeout(() => {
                window.location.href = "/login";
            }, 100);
        }
    } catch (error) {
        console.error('❌ Error during logout:', error);
    }
};

export default axiosInstance;