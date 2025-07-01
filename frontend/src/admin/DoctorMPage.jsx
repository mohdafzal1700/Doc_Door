import React, { useState, useEffect } from 'react';
import { Search, Eye, MoreVertical, User, Phone, Mail, Calendar, MapPin, Shield, ShieldCheck, X, AlertCircle, Stethoscope, GraduationCap, Award, CheckCircle } from 'lucide-react';
import { doctorManagement, toggle_doctorStatusSimple, get_doctor_Details } from '../endpoints/adm';
import AdminHeader from '../components/ui/AdminHeader'; 
import Sidebar from '../components/ui/Sidebar';

const DoctorsPage = () => {
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filteredDoctors, setFilteredDoctors] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);

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
    }, [searchTerm, doctors]);

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

    const toggleBlockStatus = async (doctorId, currentStatus) => {
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

            // Update selected doctor if modal is open
            if (selectedDoctor && selectedDoctor.id === doctorId) {
                setSelectedDoctor(prev => ({ ...prev, is_active: newStatus }));
            }
        } catch (err) {
            setError('Failed to update doctor status. Please try again.');
            console.error('Error toggling doctor status:', err);
        } finally {
            setActionLoading(null);
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
        // Try multiple possible field names for verification status
        return doctor.verification_status || 
                doctor.doctor_verification_status || 
                doctor.status || 
                'unknown';
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

            <div className="ml-64 p-8">
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
                                Total Doctors: {doctors.length}
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
                                {filteredDoctors.map((doctor) => {
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

            {/* Doctor Details Modal */}
            {isModalOpen && selectedDoctor && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
                                    <div className="text-sm text-gray-900">
                                        {formatDate(selectedDoctor.member_since)}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Login</label>
                                    <div className="text-sm text-gray-900">
                                        {formatDate(selectedDoctor.last_login_date)}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorsPage;