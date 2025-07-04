import adminAxios from '../AxiosIntersptors/AdminInterceptor';

// Admin login
export const adminLogin = (formBody) => adminAxios.post('login/', formBody);




// Admin logout
export const adminLogout = () => adminAxios.post('logout/');

export const patientManagement = () => adminAxios.get('patient-management/');

export const togglePatientStatusSimple = (patientId, isActive) => 
    adminAxios.patch(`patient-management/${patientId}/toggle/`, {
        is_active: isActive
    });

export const getPatientDetails = (patientId) => 
    adminAxios.get(`patient-management/${patientId}/`);


export const doctorManagement = () => adminAxios.get('doctor-management/');

export const toggle_doctorStatusSimple = (doctorId, isActive) => 
    adminAxios.patch(`doctor-management/${doctorId}/toggle/`, {
        is_active: isActive
    });

export const get_doctor_Details = (doctorId) => 
    adminAxios.get(`doctor-management/${doctorId}/`);


export const getDoctorApplications = () => 
    adminAxios.get('doctor-applications/');

// Get detailed view of a specific doctor application
export const getDoctorApplicationDetail = (doctorId) =>
    adminAxios.get(`doctor-applications/${doctorId}/`);

// Approve or reject a doctor application
export const doctorApprovalAction = (doctorId, action, adminComment = '') =>
    adminAxios.patch(`doctor-applications/${doctorId}/action/`, {
        action: action, // 'approve' or 'reject'
        admin_comment: adminComment
    });


