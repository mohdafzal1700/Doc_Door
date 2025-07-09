    import axios from '../AxiosIntersptors/DoctorInterceptor';
    axios.defaults.withCredentials = true;

    export const doctorLogin = (formBody) => axios.post('login/', formBody);

    export const checkVerificationStatus = async () => {
        try {
            console.log("🔍 Checking verification status...")
            const response = await axios.get('verification-status/')  // Changed from 'api' to 'axios'
            console.log("Verification status response:", response.data)
            return response
        } catch (error) {
            console.error(" Error checking verification status:", error)
            throw error
        }
    }

    export const refreshVerificationStatus = async () => {
        try {
            console.log(" Refreshing verification status...")
            const response = await axios.post('verification-status/')  // Changed from 'api' to 'axios'
            console.log(" Verification status refreshed:", response.data)
            return response
        } catch (error) {
            console.error(" Error refreshing verification status:", error)
            throw error
        }
    }

    export const getDoctorProfile = () => axios.get("profile/");

    export const updateDoctorProfile = (data) => {
        // Check if data is FormData (has file upload)
        const isFormData = data instanceof FormData;
        
        if (isFormData) {
            // Data is already FormData, send directly
            return axios.patch("profile/", data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
        } else {
            // Use regular JSON payload when no file upload
            const payload = {
                first_name: data.first_name,
                last_name: data.last_name,
                date_of_birth: data.date_of_birth,
                gender: data.gender,
                email: data.email,
                phone_number: data.phone_number,
                department: data.department,
                years_of_experience: data.years_of_experience ? parseInt(data.years_of_experience) : null,
                license_number: data.license_number,
                consultation_fee: data.consultation_fee ? parseFloat(data.consultation_fee) : null,
                consultation_mode_online: data.consultation_mode_online,
                consultation_mode_offline: data.consultation_mode_offline,
                clinic_name: data.clinic_name,
                location: data.location,
            };

            // Remove empty values
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined || payload[key] === '') delete payload[key];
            });

            return axios.patch("profile/", payload);
        }
    };

    export const createDoctorProfile = (data) => {
        // Check if data is FormData (has file upload)
        const isFormData = data instanceof FormData;
        
        if (isFormData) {
            // Data is already FormData, send directly
            return axios.post("profile/", data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
        } else {
            // Use regular JSON payload when no file upload
            const payload = {
                first_name: data.first_name,
                last_name: data.last_name,
                date_of_birth: data.date_of_birth,
                gender: data.gender,
                email: data.email,
                phone_number: data.phone_number,
                department: data.department,
                years_of_experience: data.years_of_experience ? parseInt(data.years_of_experience) : null,
                license_number: data.license_number,
                consultation_fee: data.consultation_fee ? parseFloat(data.consultation_fee) : null,
                consultation_mode_online: data.consultation_mode_online,
                consultation_mode_offline: data.consultation_mode_offline,
                clinic_name: data.clinic_name,
                location: data.location,
            };

            // Remove empty values
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined || payload[key] === '') delete payload[key];
            });

            return axios.post("profile/", payload);
        }
    };

    export const getDoctorEducation = () => axios.get("education/");

    export const createDoctorEducation = (data) => {
        // Since the model doesn't have certificate_file, we only use JSON payload
        const payload = {
            degree_name: data.degree_name,
            institution_name: data.institution_name,
            year_of_completion: data.year_of_completion ? parseInt(data.year_of_completion) : null,
            degree_certificate_id: data.degree_certificate_id, // Required field in model
        };

        // Remove empty values but keep certificate_id as it's required
        Object.keys(payload).forEach(key => {
            if (key !== 'degree_certificate_id' && (payload[key] === undefined || payload[key] === '' || payload[key] === null)) {
                delete payload[key];
            }
        });

        return axios.post("education/", payload);
    };

    export const updateDoctorEducation = (data) => {
        // Ensure we have an ID for update (UUID string)
        if (!data.id) {
            throw new Error('Education ID is required for update');
        }

        // Use regular JSON payload (no file upload in model)
        const payload = {
            id: data.id, // Keep as string (UUID)
            degree_name: data.degree_name,
            institution_name: data.institution_name,
            year_of_completion: data.year_of_completion ? parseInt(data.year_of_completion) : null,
            degree_certificate_id: data.degree_certificate_id,
        };

        // Remove empty values except for id
        Object.keys(payload).forEach(key => {
            if (key !== 'id' && (payload[key] === undefined || payload[key] === '' || payload[key] === null)) {
                delete payload[key];
            }
        });

        console.log('🔍 UPDATE: Sending payload:', payload);
        return axios.patch("education/", payload);
    };

    export const deleteDoctorEducation = (educationId) => {
        return axios.delete("education/", {
            data: { id: educationId } // Keep as string (UUID)
        });
    };


    export const getDoctorCertification = () => axios.get("certification/");

    export const createDoctorCertification = (data) => {
        // Check if data is FormData (has certificate image upload)
        const isFormData = data instanceof FormData;
        
        if (isFormData) {
            // Data is already FormData, send directly
            return axios.post("certification/", data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
        } else {
            // Use regular JSON payload
            const payload = {
                certification_name: data.certification_name,
                issued_by: data.issued_by,
                year_of_issue: data.year_of_issue ? parseInt(data.year_of_issue) : null,
                certification_certificate_id: data.certification_certificate_id, // Required field in model
            };

            // Remove empty values but keep certificate_id as it's required
            Object.keys(payload).forEach(key => {
                if (key !== 'certification_certificate_id' && (payload[key] === undefined || payload[key] === '' || payload[key] === null)) {
                    delete payload[key];
                }
            });

            return axios.post("certification/", payload);
        }
    };

    export const updateDoctorCertification = (data) => {
        // Ensure we have an ID for update (UUID string)
        if (!data.id) {
            throw new Error('Certification ID is required for update');
        }

        // Check if data is FormData (has certificate image upload)
        const isFormData = data instanceof FormData;
        
        if (isFormData) {
            // Add ID to FormData
            data.append('id', data.id);
            return axios.patch("certification/", data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
        } else {
            // Use regular JSON payload
            const payload = {
                id: data.id, // Keep as string (UUID)
                certification_name: data.certification_name,
                issued_by: data.issued_by,
                year_of_issue: data.year_of_issue ? parseInt(data.year_of_issue) : null,
                certification_certificate_id: data.certification_certificate_id,
            };

            // Remove empty values except for id
            Object.keys(payload).forEach(key => {
                if (key !== 'id' && (payload[key] === undefined || payload[key] === '' || payload[key] === null)) {
                    delete payload[key];
                }
            });

            console.log('🔍 UPDATE CERTIFICATION: Sending payload:', payload);
            return axios.patch("certification/", payload);
        }
    };

    export const deleteDoctorCertification = (certificationId) => {
        return axios.delete("certification/", {
            data: { id: certificationId } // Keep as string (UUID)
        });
    }


    export const getDoctorLicense = () => axios.get("license/");

        // Create doctor license/proof record
        export const createDoctorLicense = (data) => {
        // Check if data is FormData (has image uploads)
        const isFormData = data instanceof FormData;
        
        if (isFormData) {
            // Data is already FormData, send directly
            return axios.post("license/", data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            });
        } else {
            // Use regular JSON payload when no file upload
            const payload = {
            medical_license_number: data.medical_license_number,
            license_doc_id: data.license_doc_id,
            };
            
            // Remove empty values
            Object.keys(payload).forEach(key => {
            if (payload[key] === undefined || payload[key] === '' || payload[key] === null) {
                delete payload[key];
            }
            });
            
            return axios.post("license/", payload);
        }
        };

        // Update doctor license/proof record
        export const updateDoctorLicense = (data) => {
        // No ID required since it's OneToOneField with doctor
        
        // Check if data is FormData (has image uploads)
        const isFormData = data instanceof FormData;
        
        if (isFormData) {
            // Data is already FormData, send directly
            return axios.patch("license/", data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            });
        } else {
            // Use regular JSON payload
            const payload = {
            medical_license_number: data.medical_license_number,
            license_doc_id: data.license_doc_id,
            };
            
            // Remove empty values
            Object.keys(payload).forEach(key => {
            if (payload[key] === undefined || payload[key] === '' || payload[key] === null) {
                delete payload[key];
            }
            });
            
            console.log('🔍 UPDATE LICENSE: Sending payload:', payload);
            return axios.patch("license/", payload);
        }
        };

        // Delete doctor license/proof record
        export const deleteDoctorLicense = () => {
        return axios.delete("license/");
        };

        // Helper function to create FormData for license with images
        export const createLicenseFormData = (formData) => {
        const data = new FormData();
        
        // Add text fields
        if (formData.medical_license_number) {
            data.append('medical_license_number', formData.medical_license_number);
        }
        if (formData.license_doc_id) {
            data.append('license_doc_id', formData.license_doc_id);
        }
        
        // Add image files
        if (formData.license_proof_image) {
            data.append('license_proof_image', formData.license_proof_image);
        }
        if (formData.id_proof) {
            data.append('id_proof', formData.id_proof);
        }
        
        // Add ID for updates
        if (formData.id) {
            data.append('id', formData.id);
        }
        
        return data;
        };

    
    export const getServices = async () => {
        try {
            const response = await axios.get('service/');
            return response;
        } catch (error) {
            console.error("Error fetching services:", error);
            throw error;
        }
    };




    export const createService = async (data) => {
        try {
            const payload = {
                service_name: data.service_name,
                service_mode: data.service_mode,
                service_fee: data.service_fee ? parseFloat(data.service_fee) : null,
                description: data.description,
                is_active: data.is_active !== undefined ? data.is_active : true,
            };

            // Remove empty values
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined || payload[key] === '' || payload[key] === null) {
                    delete payload[key];
                }
            });

            const response = await axios.post('service/', payload);
            return response;
        } catch (error) {
            console.error("Error creating service:", error);
            throw error;
        }
    };


    export const updateService = async (data) => {
        try {
            if (!data.id) {
                throw new Error('Service ID is required for update');
            }

            const payload = {
                id: data.id,
                service_name: data.service_name,
                service_mode: data.service_mode,
                service_fee: data.service_fee ? parseFloat(data.service_fee) : null,
                description: data.description,
                is_active: data.is_active,
            };

            // Remove empty values except for id
            Object.keys(payload).forEach(key => {
                if (key !== 'id' && (payload[key] === undefined || payload[key] === '')) {
                    delete payload[key];
                }
            });

            const response = await axios.patch('service/', payload);
            return response;
        } catch (error) {
            console.error("Error updating service:", error);
            throw error;
        }
    };


    export const deleteService = async (serviceId) => {
        try {
            if (!serviceId) {
                throw new Error('Service ID is required for deletion');
            }

            const response = await axios.delete('service/', {
                data: { id: serviceId }
            });
            return response;
        } catch (error) {
            console.error("Error deleting service:", error);
            throw error;
        }
    };


    export const getSchedules = async () => {
        try {
            const response = await axios.get('scheduleView/');
            return response;
        } catch (error) {
            console.error("Error fetching schedules:", error);
            throw error;
        }
    };




    export const createSchedule = async (data) => {
        try {
            const payload = {
                service: data.service,
                mode: data.mode,
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
                slot_duration: data.slot_duration,
                break_start_time: data.break_start_time,
                break_end_time: data.break_end_time,
                total_slots: data.total_slots ? parseInt(data.total_slots) : null,
                booked_slots: data.booked_slots ? parseInt(data.booked_slots) : 0,
                max_patients_per_slot: data.max_patients_per_slot ? parseInt(data.max_patients_per_slot) : 1,
                is_active: data.is_active !== undefined ? data.is_active : true,
            };

            // Remove empty values
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined || payload[key] === '' || payload[key] === null) {
                    delete payload[key];
                }
            });

            const response = await axios.post('scheduleView/', payload);
            return response;
        } catch (error) {
            console.error("Error creating schedule:", error);
            throw error;
        }
    };


    export const updateSchedule = async (data) => {
        try {
            if (!data.id) {
                throw new Error('Schedule ID is required for update');
            }

            const payload = {
                id: data.id,
                service: data.service,
                mode: data.mode,
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
                slot_duration: data.slot_duration,
                break_start_time: data.break_start_time,
                break_end_time: data.break_end_time,
                total_slots: data.total_slots ? parseInt(data.total_slots) : null,
                booked_slots: data.booked_slots ? parseInt(data.booked_slots) : null,
                max_patients_per_slot: data.max_patients_per_slot ? parseInt(data.max_patients_per_slot) : null,
                is_active: data.is_active,
            };

            // Remove empty values except for id
            Object.keys(payload).forEach(key => {
                if (key !== 'id' && (payload[key] === undefined || payload[key] === '')) {
                    delete payload[key];
                }
            });

            const response = await axios.patch('scheduleView/', payload);
            return response;
        } catch (error) {
            console.error("Error updating schedule:", error);
            throw error;
        }
    };


    export const deleteSchedule = async (scheduleId) => {
        try {
            if (!scheduleId) {
                throw new Error('Schedule ID is required for deletion');
            }

            const response = await axios.delete('scheduleView/', {
                data: { id: scheduleId }
            });
            return response;
        } catch (error) {
            console.error("Error deleting schedule:", error);
            throw error;
        }
    };
