import axios from "axios";

// Change this to match your DRF backend route for doctor APIs
const BASE_URL = 'https://api.docdoor.muhammedafsal.online/api/doctor/';

const doctorAxios = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,  // Needed for sending cookies
});

// Token refresh function specifically for doctors
export const refreshDoctorToken = () => {
    return axios.post(
        "https://api.docdoor.muhammedafsal.online/api/auth/token/refresh/", 
        {}, 
        { withCredentials: true }
    );
};

// Add response interceptor
doctorAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                console.log("Doctor token expired, attempting refresh...");
                
                const refreshResponse = await refreshDoctorToken();
                
                if (refreshResponse.status === 200) {
                    console.log("Doctor token refresh successful");
                    // Retry original doctor request
                    return doctorAxios(originalRequest);
                }
            } catch (refreshError) {
                console.error("Doctor token refresh failed:", refreshError);
                
                
                window.location.href = "/login";
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default doctorAxios;