import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Eye, 
    MoreVertical, 
    User, 
    Phone, 
    Mail, 
    Calendar, 
    MapPin, 
    Shield, 
    ShieldCheck, 
    X, 
    AlertCircle, 
    Stethoscope, 
    GraduationCap, 
    Award, 
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    FileText,
    FileCheck 
} from 'lucide-react';

import { doctorManagement, toggle_doctorStatusSimple, get_doctor_Details,getDoctorApplicationDetail } from '../endpoints/adm';
import AdminHeader from '../components/ui/AdminHeader'; 
import Sidebar from '../components/ui/Sidebar';
import { useToast } from '../components/ui/Toast';

const DoctorsPage = () => {
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filteredDoctors, setFilteredDoctors] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const toast = useToast();
    const [confirmAction, setConfirmAction] = useState(null);
    const [showApplicationDetails, setShowApplicationDetails] = useState(false);
    const [loadingApplicationDetails, setLoadingApplicationDetails] = useState(false);
    const [applicationDetails, setApplicationDetails] = useState(null);
    

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [doctorsPerPage] = useState(10);

    // Load doctors on component mount
    useEffect(() => {
        loadDoctors(); 
    }, []);

    // Filter doctors based on search term
    useEffect(() => {
        const filtered = doctors.filter(doctor => {
            const fullName = doctor.full_name || `${doctor.first_name} ${doctor.last_name}`.trim();
            return (
                fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doctor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (doctor.phone_number && doctor.phone_number.includes(searchTerm)) ||
                (doctor.doctor_specialization && doctor.doctor_specialization.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (doctor.doctor_license_number && doctor.doctor_license_number.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        });
        setFilteredDoctors(filtered);
        setCurrentPage(1);
    }, [searchTerm, doctors]);

    // Get current doctors for pagination
    const indexOfLastDoctor = currentPage * doctorsPerPage;
    const indexOfFirstDoctor = indexOfLastDoctor - doctorsPerPage;
    const currentDoctors = filteredDoctors.slice(indexOfFirstDoctor, indexOfLastDoctor);
    const totalPages = Math.ceil(filteredDoctors.length / doctorsPerPage);

    const loadDoctors = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await doctorManagement();
            setDoctors(response.data);
        } catch (err) {
            setError('Failed to load doctors. Please try again.');
            console.error('Error loading doctors:', err);
        } finally {
            setLoading(false);
        }
    };

    // Pagination functions
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };
    const prevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const loadDoctorApplicationDetails = async (doctorId) => {
    if (showApplicationDetails) {
        setShowApplicationDetails(false);
        setApplicationDetails(null);
        return;
    }

    setLoadingApplicationDetails(true);
    try {
        const response = await getDoctorApplicationDetail(doctorId);
        console.log('Full API Response:', response); // Debug log
        
        // Check if response exists and has data
        if (response && response.data) {
            setApplicationDetails(response.data);
            setShowApplicationDetails(true);
            toast.success('Application details loaded successfully');
        } else {
            const errorMessage = response?.message || 
                            response?.data?.message || 
                            'Failed to load application details';
            console.error('API response missing data:', errorMessage);
            toast.error(errorMessage);
        }
    } catch (error) {
        console.error('Error loading application details:', error);
        const errorMessage = error.response?.data?.message || 
                        error.message || 
                        'Failed to load application details';
        toast.error(errorMessage);
    } finally {
        setLoadingApplicationDetails(false);
    }
};


    const toggleBlockStatus = async (doctorId, currentStatus) => {
        const doctor=doctors.find(p=>p.id=== doctorId);
        const doctorName=getDoctorName(doctor);
        const action=currentStatus?'deactivate':'activate'

        setConfirmAction({
        doctorId,
        currentStatus,
        doctorName,
        action   });
};

const executeStatusChange = async () => {
    if (!confirmAction) return;
    
    const { doctorId, currentStatus } = confirmAction;

        try {
            setActionLoading(doctorId);
            const newStatus = !currentStatus;
            
            await toggle_doctorStatusSimple(doctorId, newStatus);
            
            // Update local state
            setDoctors(prevDoctors =>
                prevDoctors.map(doctor =>
                    doctor.id === doctorId
                        ? { ...doctor, is_active: newStatus }
                        : doctor
                )
            );
            const statusMessage = newStatus ? 'Doctor activated successfully' : 'Doctor deactivated successfully';
            toast.success(statusMessage);

            // Update selected doctor if modal is open
            if (selectedDoctor && selectedDoctor.id === doctorId) {
                setSelectedDoctor(prev => ({ ...prev, is_active: newStatus }));
            }
        } catch (err) {
            setError('Failed to update doctor status. Please try again.');
            console.error('Error toggling doctor status:', err);
            toast.error('Failed to update doctor status');
        } finally {
            setActionLoading(null);
            setConfirmAction(null);
        }
    };

    const viewDoctorDetails = async (doctor) => {
        try {
            setLoading(true);
            const response = await get_doctor_Details(doctor.id);
            setSelectedDoctor(response.data);
            setIsModalOpen(true);
        } catch (err) {
            setError('Failed to load doctor details. Please try again.');
            console.error('Error loading doctor details:', err);
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedDoctor(null);
        setShowApplicationDetails(false);
        setApplicationDetails(null);
        setLoadingApplicationDetails(false);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const getDoctorName = (doctor) => {
        return doctor.full_name || `${doctor.doctor_first_name || doctor.first_name || ''} ${doctor.doctor_last_name || doctor.last_name || ''}`.trim() || doctor.email || doctor.username;
    };

    const getDefaultAvatar = (name) => {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=ffffff&size=150`;
    };

    const getVerificationStatusColor = (status) => {
        switch (status) {
            case 'verified':
            case 'approved':
                return 'bg-green-100 text-green-800';
            case 'pending':
            case 'pending_approval':
                return 'bg-yellow-100 text-yellow-800';
            case 'incomplete':
            case 'rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getVerificationStatusText = (status) => {
        switch (status) {
            case 'verified':
            case 'approved':
                return 'Verified';
            case 'pending':
            case 'pending_approval':
                return 'Pending';
            case 'incomplete':
                return 'Incomplete';
            case 'rejected':
                return 'Rejected';
            default:
                return 'Unknown';
        }
    };

    const getVerificationStatus = (doctor) => {
        return doctor.verification_status || 
            doctor.doctor_verification_status || 
            doctor.status || 
            'unknown';
    };

    
    const ConfirmationModal = () => {
        if (!confirmAction) return null;
        
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                    <div className="flex items-center mb-4">
                        <div className={`p-2 rounded-full ${
                            confirmAction.action === 'deactivate' 
                                ? 'bg-red-100 text-red-600' 
                                : 'bg-green-100 text-green-600'
                        }`}>
                            {confirmAction.action === 'deactivate' ? (
                                <Shield size={20} />
                            ) : (
                                <ShieldCheck size={20} />
                            )}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 ml-3">
                            {confirmAction.action === 'deactivate' ? 'Deactivate' : 'Activate'} Patient
                        </h3>
                    </div>
                    
                    <p className="text-gray-600 mb-6">
                        Are you sure you want to {confirmAction.action} <strong>{confirmAction.patientName}</strong>?
                        {confirmAction.action === 'deactivate' && (
                            <span className="block mt-2 text-sm text-red-600">
                                This will prevent the doctor from accessing their account.
                            </span>
                        )}
                    </p>
                    
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setConfirmAction(null)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            disabled={actionLoading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={executeStatusChange}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                confirmAction.action === 'deactivate'
                                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                                    : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                            }`}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Processing...
                                </div>
                            ) : (
                                `${confirmAction.action === 'deactivate' ? 'Deactivate' : 'Activate'}`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading && doctors.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                <AdminHeader/>
                <Sidebar/>
                <div className="ml-64 p-8">
                    <div className="bg-white rounded-lg shadow-sm p-8">
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2">Loading doctors...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-gray-50">
            <AdminHeader/>
            <Sidebar/>

            <div className="ml-64 pt-20 px-8 pb-10">
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                        <span className="text-red-700">{error}</span>
                        <button 
                            onClick={() => setError(null)}
                            className="ml-auto text-red-400 hover:text-red-600"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-sm">
                    {/* Search Header */}
                    <div className="p-6 border-b">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Doctor Management</h3>
                            <div className="text-sm text-gray-500">
                                Showing {indexOfFirstDoctor + 1}-{Math.min(indexOfLastDoctor, filteredDoctors.length)} of {filteredDoctors.length} doctors
                            </div>
                        </div>
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search doctors by name, email, specialization, or license..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Doctors Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Doctor
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Specialization
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Experience
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Verification
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {currentDoctors.map((doctor) => {
                                    const doctorName = getDoctorName(doctor);
                                    const avatarUrl = doctor.profile_picture_url || getDefaultAvatar(doctorName);
                                    const verificationStatus = getVerificationStatus(doctor);
                                    
                                    return (
                                        <tr key={doctor.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <img
                                                        className="h-10 w-10 rounded-full object-cover"
                                                        src={avatarUrl}
                                                        alt={doctorName}
                                                        onError={(e) => {
                                                            e.target.src = getDefaultAvatar(doctorName);
                                                        }}
                                                    />
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {doctorName}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {doctor.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {doctor.doctor_specialization || doctor.doctor_department || 'N/A'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {doctor.doctor_license_number || 'No License'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {doctor.doctor_experience ? `${doctor.doctor_experience} years` : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVerificationStatusColor(verificationStatus)}`}
                                                >
                                                    {getVerificationStatusText(verificationStatus)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        doctor.is_active
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}
                                                >
                                                    {doctor.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => viewDoctorDetails(doctor)}
                                                        className="text-blue-600 hover:text-blue-900 p-1"
                                                        title="View Details"
                                                        disabled={loading}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleBlockStatus(doctor.id, doctor.is_active)}
                                                        className={`p-1 ${
                                                            doctor.is_active
                                                                ? 'text-red-600 hover:text-red-900'
                                                                : 'text-green-600 hover:text-green-900'
                                                        }`}
                                                        title={doctor.is_active ? 'Deactivate Doctor' : 'Activate Doctor'}
                                                        disabled={actionLoading === doctor.id}
                                                    >
                                                        {actionLoading === doctor.id ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                                        ) : (
                                                            doctor.is_active ? <Shield size={16} /> : <ShieldCheck size={16} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {filteredDoctors.length > doctorsPerPage && (
                        <div className="flex items-center justify-between px-6 py-4 border-t">
                            <div className="text-sm text-gray-700">
                                Showing <span className="font-medium">{indexOfFirstDoctor + 1}</span> to{' '}
                                <span className="font-medium">{Math.min(indexOfLastDoctor, filteredDoctors.length)}</span> of{' '}
                                <span className="font-medium">{filteredDoctors.length}</span> results
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={prevPage}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                
                                {/* Page numbers */}
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                                    <button
                                        key={number}
                                        onClick={() => paginate(number)}
                                        className={`px-3 py-1 rounded-md ${currentPage === number ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >
                                        {number}
                                    </button>
                                ))}
                                
                                <button
                                    onClick={nextPage}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {filteredDoctors.length === 0 && !loading && (
                        <div className="text-center py-12">
                            <Stethoscope className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No doctors found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm ? 'Try adjusting your search criteria.' : 'No doctors have been registered yet.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal/>
            {/* Doctor Details Modal */}
            {isModalOpen && selectedDoctor && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Doctor Details</h3>
                <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                >
                    <X size={24} />
                </button>
            </div>
            
            <div className="p-6">
                {/* Doctor Header */}
                <div className="flex items-center mb-6">
                    <img
                        className="h-20 w-20 rounded-full object-cover"
                        src={selectedDoctor.profile_picture_url || getDefaultAvatar(getDoctorName(selectedDoctor))}
                        alt={getDoctorName(selectedDoctor)}
                        onError={(e) => {
                            e.target.src = getDefaultAvatar(getDoctorName(selectedDoctor));
                        }}
                    />
                    <div className="ml-6">
                        <h4 className="text-xl font-semibold text-gray-900">
                            Dr. {getDoctorName(selectedDoctor)}
                        </h4>
                        <p className="text-sm text-gray-500">Doctor ID: #{selectedDoctor.id}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    selectedDoctor.is_active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                }`}
                            >
                                {selectedDoctor.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVerificationStatusColor(getVerificationStatus(selectedDoctor))}`}
                            >
                                {getVerificationStatusText(getVerificationStatus(selectedDoctor))}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons - Moved to top for better UX */}
                <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg">
                    <button
                        onClick={() => loadDoctorApplicationDetails(selectedDoctor.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
                        disabled={loadingApplicationDetails}
                    >
                        {loadingApplicationDetails ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <FileText size={16} />
                        )}
                        {showApplicationDetails ? 'Hide Application Details' : 'Show Application Details'}
                    </button>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                toggleBlockStatus(selectedDoctor.id, selectedDoctor.is_active);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                selectedDoctor.is_active
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                            disabled={actionLoading === selectedDoctor.id}
                        >
                            {actionLoading === selectedDoctor.id ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Processing...
                                </div>
                            ) : (
                                selectedDoctor.is_active ? 'Deactivate Doctor' : 'Activate Doctor'
                            )}
                        </button>
                        <button
                            onClick={closeModal}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Doctor Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h5 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h5>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="flex items-center text-sm text-gray-900">
                                <Mail size={16} className="mr-2 text-gray-400" />
                                {selectedDoctor.email}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <div className="flex items-center text-sm text-gray-900">
                                <Phone size={16} className="mr-2 text-gray-400" />
                                {selectedDoctor.phone_number || 'N/A'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                            <div className="text-sm text-gray-900">{selectedDoctor.doctor_gender || 'N/A'}</div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                            <div className="flex items-center text-sm text-gray-900">
                                <Calendar size={16} className="mr-2 text-gray-400" />
                                {formatDate(selectedDoctor.doctor_date_of_birth)}
                            </div>
                        </div>
                    </div>

                    {/* Professional Information */}
                    <div className="space-y-4">
                        <h5 className="text-lg font-medium text-gray-900 border-b pb-2">Professional Information</h5>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                            <div className="flex items-center text-sm text-gray-900">
                                <Stethoscope size={16} className="mr-2 text-gray-400" />
                                {selectedDoctor.doctor_specialization || selectedDoctor.doctor_department || 'N/A'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                            <div className="text-sm text-gray-900">
                                {selectedDoctor.doctor_experience ? `${selectedDoctor.doctor_experience} years` : 'N/A'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                            <div className="text-sm text-gray-900">{selectedDoctor.doctor_license_number || 'N/A'}</div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee</label>
                            <div className="text-sm text-gray-900">
                                ${selectedDoctor.doctor_consultation_fee || '0.00'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Consultation & Practice Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                        <h5 className="text-lg font-medium text-gray-900 border-b pb-2">Consultation Modes</h5>
                        
                        <div className="space-y-2">
                            <div className="flex items-center">
                                <CheckCircle 
                                    size={16} 
                                    className={`mr-2 ${selectedDoctor.doctor_consultation_mode_online ? 'text-green-500' : 'text-gray-400'}`} 
                                />
                                <span className="text-sm text-gray-900">Online Consultation</span>
                            </div>
                            <div className="flex items-center">
                                <CheckCircle 
                                    size={16} 
                                    className={`mr-2 ${selectedDoctor.doctor_consultation_mode_offline ? 'text-green-500' : 'text-gray-400'}`} 
                                />
                                <span className="text-sm text-gray-900">In-Person Consultation</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h5 className="text-lg font-medium text-gray-900 border-b pb-2">Practice Details</h5>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
                            <div className="text-sm text-gray-900">{selectedDoctor.doctor_clinic_name || 'N/A'}</div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                            <div className="flex items-center text-sm text-gray-900">
                                <MapPin size={16} className="mr-2 text-gray-400" />
                                {selectedDoctor.doctor_location || 'N/A'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                            <div className="flex items-center">
                                <CheckCircle 
                                    size={16} 
                                    className={`mr-2 ${selectedDoctor.doctor_is_available ? 'text-green-500' : 'text-red-500'}`} 
                                />
                                <span className="text-sm text-gray-900">
                                    {selectedDoctor.doctor_is_available ? 'Available' : 'Not Available'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profile Completion Status */}
                <div className="mb-6">
                    <h5 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Profile Completion</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center">
                            <CheckCircle 
                                size={16} 
                                className={`mr-2 ${selectedDoctor.profile_completed ? 'text-green-500' : 'text-red-500'}`} 
                            />
                            <span className="text-sm text-gray-900">Profile Setup</span>
                        </div>
                        <div className="flex items-center">
                            <GraduationCap 
                                size={16} 
                                className={`mr-2 ${selectedDoctor.has_profile_picture ? 'text-green-500' : 'text-gray-400'}`} 
                            />
                            <span className="text-sm text-gray-900">Profile Picture</span>
                        </div>
                    </div>
                </div>

                {/* Bio Section */}
                {selectedDoctor.doctor_bio && (
                    <div className="mb-6">
                        <h5 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Bio</h5>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {selectedDoctor.doctor_bio}
                        </p>
                    </div>
                )}

                {/* Account Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Login</label>
                        <div className="text-sm text-gray-900">
                            {formatDate(selectedDoctor.last_login_date)}
                        </div>
                    </div>
                </div>

                {/* APPLICATION DETAILS SECTION - Expandable */}
                {showApplicationDetails && (
                    <div className="border-t pt-6 mt-6">
                        <div className="mb-6">
                            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <FileText size={20} />
                                Complete Application Details
                            </h3>
                            
                            {loadingApplicationDetails ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <span className="ml-2 text-gray-600">Loading application details...</span>
                                </div>
                            ) : applicationDetails ? (
                                <div className="space-y-6">
                                    {/* Verification Summary */}
                                    {applicationDetails.verification_summary && (
                                        <div className="bg-blue-50 p-4 rounded-lg">
                                            <h4 className="font-medium text-blue-900 mb-3">Verification Summary</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="flex items-center">
                                                    <CheckCircle 
                                                        size={16} 
                                                        className={`mr-2 ${applicationDetails.verification_summary.is_profile_setup_done ? 'text-green-500' : 'text-red-500'}`} 
                                                    />
                                                    <span className="text-sm">Profile Setup</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <GraduationCap 
                                                        size={16} 
                                                        className={`mr-2 ${applicationDetails.verification_summary.is_education_done ? 'text-green-500' : 'text-red-500'}`} 
                                                    />
                                                    <span className="text-sm">Education</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <Award 
                                                        size={16} 
                                                        className={`mr-2 ${applicationDetails.verification_summary.is_certification_done ? 'text-green-500' : 'text-red-500'}`} 
                                                    />
                                                    <span className="text-sm">Certifications</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <FileCheck 
                                                        size={16} 
                                                        className={`mr-2 ${applicationDetails.verification_summary.is_license_done ? 'text-green-500' : 'text-red-500'}`} 
                                                    />
                                                    <span className="text-sm">License</span>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span>Completion Progress</span>
                                                    <span className="font-medium">{applicationDetails.verification_summary.completion_percentage}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                    <div 
                                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${applicationDetails.verification_summary.completion_percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Doctor Profile Details */}
                                    {applicationDetails.doctor_profile && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                                <User size={16} />
                                                Enhanced Profile Information
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                                    <div className="text-sm text-gray-900">{applicationDetails.doctor_profile.full_name}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                                                    <div className="text-sm text-gray-900">{applicationDetails.doctor_profile.created_at}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Updated At</label>
                                                    <div className="text-sm text-gray-900">{applicationDetails.doctor_profile.updated_at}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Verification Status</label>
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        applicationDetails.doctor_profile.verification_status === 'approved' ? 'bg-green-100 text-green-800' :
                                                        applicationDetails.doctor_profile.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {applicationDetails.doctor_profile.verification_status || 'Not Set'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Education Details */}
                                    {applicationDetails.doctor_educations && applicationDetails.doctor_educations.length > 0 && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                                <GraduationCap size={16} />
                                                Education Details ({applicationDetails.doctor_educations.length})
                                            </h4>
                                            <div className="space-y-3">
                                                {applicationDetails.doctor_educations.map((education, index) => (
                                                    <div key={education.id} className="bg-gray-50 p-4 rounded-lg">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Degree</label>
                                                                <div className="text-sm text-gray-900 font-medium">{education.degree_name}</div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                                                                <div className="text-sm text-gray-900">{education.institution_name}</div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Year of Completion</label>
                                                                <div className="text-sm text-gray-900">{education.year_of_completion}</div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Certificate ID</label>
                                                                <div className="text-sm text-gray-900">{education.degree_certificate_id || 'N/A'}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Certifications */}
                                    {applicationDetails.doctor_certifications && applicationDetails.doctor_certifications.length > 0 && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                                <Award size={16} />
                                                Certifications ({applicationDetails.doctor_certifications.length})
                                            </h4>
                                            <div className="space-y-3">
                                                {applicationDetails.doctor_certifications.map((cert, index) => (
                                                    <div key={cert.id} className="bg-gray-50 p-4 rounded-lg">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Certification</label>
                                                                <div className="text-sm text-gray-900 font-medium">{cert.certification_name}</div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Issued By</label>
                                                                <div className="text-sm text-gray-900">{cert.issued_by}</div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Year of Issue</label>
                                                                <div className="text-sm text-gray-900">{cert.year_of_issue}</div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Status</label>
                                                                <div className="flex items-center">
                                                                    <CheckCircle 
                                                                        size={16} 
                                                                        className={`mr-2 ${cert.has_certificate_image ? 'text-green-500' : 'text-red-500'}`} 
                                                                    />
                                                                    <span className="text-sm text-gray-900">
                                                                        {cert.has_certificate_image ? 'Image Uploaded' : 'No Image'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {cert.certificate_image_url && (
                                                                <div className="md:col-span-2">
                                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Image</label>
                                                                    <img 
                                                                        src={cert.certificate_image_url} 
                                                                        alt={cert.certification_name}
                                                                        className="h-32 w-auto rounded border cursor-pointer hover:shadow-lg transition-shadow"
                                                                        onClick={() => window.open(cert.certificate_image_url, '_blank')}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* License and Proof Documents */}
                                    {applicationDetails.doctor_proof && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                                <FileCheck size={16} />
                                                License & Proof Documents
                                            </h4>
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Medical License Number</label>
                                                        <div className="text-sm text-gray-900 font-medium">
                                                            {applicationDetails.doctor_proof.medical_license_number || 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">License Document ID</label>
                                                        <div className="text-sm text-gray-900">
                                                            {applicationDetails.doctor_proof.license_doc_id || 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">License Proof</label>
                                                        <div className="flex items-center">
                                                            <CheckCircle 
                                                                size={16} 
                                                                className={`mr-2 ${applicationDetails.doctor_proof.has_license_image ? 'text-green-500' : 'text-red-500'}`} 
                                                            />
                                                            <span className="text-sm text-gray-900">
                                                                {applicationDetails.doctor_proof.has_license_image ? 'Uploaded' : 'Not Uploaded'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">ID Proof</label>
                                                        <div className="flex items-center">
                                                            <CheckCircle 
                                                                size={16} 
                                                                className={`mr-2 ${applicationDetails.doctor_proof.has_id_proof ? 'text-green-500' : 'text-red-500'}`} 
                                                            />
                                                            <span className="text-sm text-gray-900">
                                                                {applicationDetails.doctor_proof.has_id_proof ? 'Uploaded' : 'Not Uploaded'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Document Images */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                    {applicationDetails.doctor_proof.license_image_url && (
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-2">License Image</label>
                                                            <img 
                                                                src={applicationDetails.doctor_proof.license_image_url} 
                                                                alt="License Proof"
                                                                className="h-32 w-auto rounded border cursor-pointer hover:shadow-lg transition-shadow"
                                                                onClick={() => window.open(applicationDetails.doctor_proof.license_image_url, '_blank')}
                                                            />
                                                        </div>
                                                    )}
                                                    {applicationDetails.doctor_proof.id_proof_url && (
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-2">ID Proof</label>
                                                            <img 
                                                                src={applicationDetails.doctor_proof.id_proof_url} 
                                                                alt="ID Proof"
                                                                className="h-32 w-auto rounded border cursor-pointer hover:shadow-lg transition-shadow"
                                                                onClick={() => window.open(applicationDetails.doctor_proof.id_proof_url, '_blank')}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    Failed to load application details. Please try again.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
)}
        </div>
    );
};

export default DoctorsPage;