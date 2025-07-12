import axios from '../AxiosIntersptors/UserInterceptor';

axios.defaults.withCredentials = true;

// -------------------- Auth --------------------
export const login = (data) => axios.post("login/", data);
export const register = (data) => axios.post("register/", data);
export const logout = () => axios.post("logout/");
export const refreshToken = () => axios.post("token/refresh/");

// -------------------- Email & OTP --------------------
export const verifyEmailOtp = (data) => axios.post("verify-email/", data);
export const resendOtp = (email) => axios.post("resend-otp/", { email });

// -------------------- Password Reset --------------------
export const forgotPassword = (email) => axios.post("forgot-password/", { email });
export const verifyForgotOtp = (data) => axios.post("verify-forgot-password-otp/", data);
export const resetPassword = (data) => axios.post("reset-password/", data);

// -------------------- Profile --------------------
export const getUserProfile = () => axios.get("profile/");
export const updateUserProfile = (data) => {
    const payload = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone,
        age: data.age ? parseInt(data.age) : null,
        gender: data.gender,
        blood_group: data.bloodGroup,
    };

    // Remove empty values
    Object.keys(payload).forEach(key => {
        if (payload[key] === undefined || payload[key] === '') delete payload[key];
    });

    return axios.patch("profile/", payload);
};

// -------------------- Profile Picture --------------------
export const uploadProfilePicture = (formData) => 
    axios.post(`profile/picture/`, formData);


export const deleteProfilePicture = () => 
    axios.delete(`profile/picture/`);
// -------------------- Address --------------------
const formatAddress = (data) => ({
    address_line_1: data.street1 || data.address_line_1,
    street: data.street2 || data.street,
    city: data.city,
    state: data.state,
    postal_code: data.zipCode || data.postal_code,
    country: data.country,
    address_type: data.address_type || 'home',
    label: data.label || 'Home',
    is_primary: data.is_primary || false,
});

export const getAddresses = () => axios.get("addresses/");
export const createAddress = (data) => axios.post("addresses/", formatAddress(data));
export const getAddress = (id) => axios.get(`addresses/${id}/`);
export const updateAddress = (id, data) => axios.patch(`addresses/${id}/`, formatAddress(data));
export const deleteAddress = (id) => axios.delete(`addresses/${id}/`);

// -------------------- Error Handler --------------------
export const handleApiError = (error) => {
    if (error.response) {
        const { status, data } = error.response;
        const defaultMsg = 'Something went wrong';

        switch (status) {
            case 400: return { type: 'validation', message: data.message || defaultMsg, fieldErrors: data.field_errors || {} };
            case 401: return { type: 'auth', message: 'Session expired. Please login again.' };
            case 403: return { type: 'permission', message: 'Access denied.' };
            case 404: return { type: 'notfound', message: 'Resource not found.' };
            case 500: return { type: 'server', message: 'Server error. Try later.' };
            default:  return { type: 'unknown', message: data.message || defaultMsg };
        }
    }

    if (error.request) return { type: 'network', message: 'Network issue. Check your connection.' };
    return { type: 'unknown', message: error.message || 'Unexpected error occurred.' };
};

// -------------------- Profile + Address Combo Update --------------------
export const updateUserProfileWithAddress = async (data) => {
    const profileRes = await updateUserProfile(data);

    if (data.address && Object.values(data.address).some(v => v)) {
        try {
            const addressRes = await getAddresses();
            const existingPrimary = addressRes.data.data?.addresses?.find(a => a.is_primary);

            const address = {
                ...data.address,
                is_primary: true,
                address_type: 'home',
                label: 'Home',
            };

            if (existingPrimary) {
                await updateAddress(existingPrimary.id, address);
            } else {
                await createAddress(address);
            }
        } catch (err) {
            console.warn("Address update failed", err);
        }
    }

    return profileRes;
};

export const getPatientDoctors = () => axios.get("patient_doctor/");
export const getPatientDoctor = (id) => axios.get(`patient_doctor/${id}/`);


export const getMedicalRecord = () => axios.get("medical_records/");
export const createMedicalRecord = (data) => axios.post("medical_records/", data);
export const updateMedicalRecord = (data) => axios.patch("medical_records/", data);
export const deleteMedicalRecord = () => axios.delete("medical_records/");


export const getAppointments = () => axios.get("appointments/");

export const createAppointment = (data) => axios.post("appointments/", data);

export const getAppointmentDetail = (appointmentId) => axios.get(`appointments/${appointmentId}/`);

export const updateAppointment = (appointmentId, data) => axios.patch(`appointments/${appointmentId}/`, data);

export const cancelAppointment = (appointmentId) => axios.delete(`appointments/${appointmentId}/`);

export const getDoctorBookingDetail = (id) => axios.get(`booking/doctor/${id}/`);

export const getDoctorSchedules = (doctorId, params = {}) => {
    return axios.get(`booking/doctor/${doctorId}/schedules/`, { params });
};

export const getDoctorSchedulesWithParams = (doctorId, date, mode = 'online', serviceId = null) => {
    const params = { date, mode };
    if (serviceId) {
        params.service_id = serviceId;
    }
    return axios.get(`booking/doctor/${doctorId}/schedules/`, { params });
};

export const processPayment = (appointmentId, paymentData) => {
    return axios.post(`appointments/${appointmentId}/payment/`, paymentData);
};

export const getAppointmentsWithFilters = (filters = {}) => {
    return axios.get("appointments/", { params: filters });
};

export const getAppointmentsByStatus = (status) => {
    return axios.get("appointments/", { params: { status } });
};

export const updatePatientLocation = (data) => axios.post("patients/location/update/", data);

export const getPatientLocationHistory = () => axios.get("patients/location/history/");

export const getCurrentPatientLocation = () => axios.get("patients/location/current/");

export const searchNearbyDoctors = (latitude, longitude, radius = 10) => {
    const params = { latitude, longitude, radius };
    return axios.get("search/nearby-doctors/", { params });
};

export const getAppointmentLocationDetail = (appointmentId) => 
    axios.get(`appointments/${appointmentId}/location/`);