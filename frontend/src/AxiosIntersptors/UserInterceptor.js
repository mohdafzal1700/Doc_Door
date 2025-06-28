// AxiosIntersptors/UserInterceptor.js
import axios from "axios";

const BASE_URL = 'http://localhost:8000/api/auth/';

// Create axios instance
const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // CRITICAL: This sends cookies automatically
    timeout: 10000,
});

// 🔑 REQUEST INTERCEPTOR - Cookies are sent automatically, no need to add tokens
axiosInstance.interceptors.request.use(
    (config) => {
        // Log request for debugging
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        console.log(`🍪 Cookies will be sent automatically`);
        
        // NO NEED to manually add Authorization header - cookies handle this
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
            originalRequest._retry = true;
            
            try {
                console.log('🔄 Attempting cookie-based token refresh...');
                
                // Call your refresh endpoint - it will read refresh_token from cookies
                const refreshResponse = await axios.post(
                    `${BASE_URL}token/refresh/`, // Your CustomTokenRefreshView endpoint
                    {}, // Empty body - refresh token comes from cookies
                    { 
                        withCredentials: true // Ensures cookies are sent
                    }
                );
                
                if (refreshResponse.status === 200) {
                    console.log('✅ Token refreshed successfully via cookies');
                    
                    // The new access_token cookie is automatically set by your backend
                    // Just retry the original request
                    return axiosInstance(originalRequest);
                } else {
                    throw new Error('Refresh request failed');
                }
                
            } catch (refreshError) {
                console.error('❌ Token refresh failed:', refreshError);
                
                // Clear any localStorage auth data (if you have any)
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user_details');
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('user_type');
                
                // Clear cookies by calling logout endpoint or manually
                try {
                    await axios.post(`${BASE_URL}logout/`, {}, { withCredentials: true });
                } catch (logoutError) {
                    console.log('Logout endpoint not available, cookies may need manual clearing');
                }
                
                // Dispatch auth state change
                window.dispatchEvent(new Event("authStateChanged"));
                
                // Redirect to login
                if (typeof window !== 'undefined') {
                    window.location.href = "/login";
                }
                
                return Promise.reject(refreshError);
            }
        }

        // Handle other status codes same as before...
        if (error.response?.status === 500) {
            console.error('🔥 Server Error 500:', error.response?.data);
            return Promise.reject(error);
        }

        if (error.response?.status === 403) {
            console.error('🚫 Access Forbidden');
            return Promise.reject(error);
        }

        if (!error.response) {
            console.error('🌐 Network Error:', error.message);
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;