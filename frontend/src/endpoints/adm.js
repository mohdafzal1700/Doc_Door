import adminAxios from '../AxiosIntersptors/AdminInterceptor';

// Admin login
export const adminLogin = (formBody) => adminAxios.post('login/', formBody);

// Admin token refresh (optional, in case you want to trigger it manually)
export const refreshAdminToken = () => adminAxios.post('token/refresh/');

// Admin logout
export const adminLogout = () => adminAxios.post('logout/');

export const patientManagement = () => adminAxios.get('patient-management/');

export const togglePatientStatusSimple = (patientId, isActive) => 
    adminAxios.patch(`patient-management/${patientId}/toggle/`, {
        is_active: isActive
    });

export const getPatientDetails = (patientId) => 
    adminAxios.get(`patient-management/${patientId}/`);