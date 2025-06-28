import axios from "axios";

// Change this to match your DRF backend route for admin APIs
const BASE_URL = 'http://localhost:8000/api/admins/';

const adminAxios = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,  // Needed for sending cookies
});

// Add response interceptor for admin requests
adminAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                await axios.post(
                    'http://localhost:8000/api/admins/token/refresh/', // Admin token refresh endpoint
                    {},
                    { withCredentials: true }
                );

                // Retry original admin request
                return adminAxios(originalRequest);
            } catch (err) {
                console.error("Admin token refresh failed:", err);
                // Clear any stored admin tokens/data
                localStorage.removeItem('admin_access_token');
                localStorage.removeItem('admin_user_details');
                
                // Redirect admin to their login page
                window.location.href = "/admin/login";
            }
        }

        return Promise.reject(error);
    }
);

// Add request interceptor to include auth headers if needed
adminAxios.interceptors.request.use(
    (config) => {
        // If you're storing tokens in localStorage as backup
        const token = localStorage.getItem('admin_access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default adminAxios;