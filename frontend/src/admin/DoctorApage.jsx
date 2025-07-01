import React, { useState, useEffect } from 'react';
import { Search, Eye, CheckCircle, XCircle, User, Phone, Mail, Calendar, MapPin, Stethoscope, GraduationCap, Award, FileText, AlertCircle, X, Clock, CheckSquare } from 'lucide-react';
import { getDoctorApplications, getDoctorApplicationDetail, doctorApprovalAction } from '../endpoints/adm';
import AdminHeader from '../components/ui/AdminHeader'; 
import Sidebar from '../components/ui/Sidebar';

const DoctorApplicationsPage = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filteredApplications, setFilteredApplications] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [approvalComment, setApprovalComment] = useState('');
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    // Load applications on component mount
    useEffect(() => {
        loadApplications(); 
    }, []);

    // Filter applications based on search term
    useEffect(() => {
        const filtered = applications.filter(app => {
            const fullName = app.full_name || app.email;
            return (
                fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (app.phone_number && app.phone_number.includes(searchTerm)) ||
                (app.doctor_specialization && app.doctor_specialization.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        });
        setFilteredApplications(filtered);
    }, [searchTerm, applications]);

    const loadApplications = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getDoctorApplications();
            setApplications(response.data);
        } catch (err) {
            setError('Failed to load doctor applications. Please try again.');
            console.error('Error loading applications:', err);
        } finally {
            setLoading(false);
        }
    };

    const viewApplicationDetails = async (application) => {
        try {
            setLoading(true);
            const response = await getDoctorApplicationDetail(application.id);
            setSelectedApplication(response.data);
            setIsModalOpen(true);
        } catch (err) {
            setError('Failed to load application details. Please try again.');
            console.error('Error loading application details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprovalAction = (action, applicationId) => {
        setPendingAction({ action, applicationId });
        setApprovalComment('');
        setShowApprovalModal(true);
    };

    const confirmApprovalAction = async () => {
        if (!pendingAction) return;

        try {
            setActionLoading(pendingAction.applicationId);
            
            await doctorApprovalAction(
                pendingAction.applicationId, 
                pendingAction.action, 
                approvalComment
            );
            
            // Refresh applications list
            await loadApplications();
            
            // Close modals
            setShowApprovalModal(false);
            setIsModalOpen(false);
            setPendingAction(null);
            setApprovalComment('');
            
        } catch (err) {
            setError(`Failed to ${pendingAction.action} application. Please try again.`);
            console.error('Error processing approval action:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedApplication(null);
    };

    const closeApprovalModal = () => {
        setShowApprovalModal(false);
        setPendingAction(null);
        setApprovalComment('');
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const getDefaultAvatar = (name) => {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=ffffff&size=150`;
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved':
                return 'bg-green-100 text-green-800';
            case 'pending':
            case 'pending_approval':
                return 'bg-yellow-100 text-yellow-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getCompletionColor = (percentage) => {
        if (percentage >= 100) return 'bg-green-500';
        if (percentage >= 75) return 'bg-blue-500';
        if (percentage >= 50) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    if (loading && applications.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                <AdminHeader/>
                <Sidebar/>
                <div className="ml-64 p-8">
                    <div className="bg-white rounded-lg shadow-sm p-8">
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2">Loading applications...</span>
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
                            <h3 className="text-lg font-semibold text-gray-800">Doctor Applications</h3>
                            <div className="text-sm text-gray-500">
                                Total Applications: {applications.length}
                            </div>
                        </div>
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search applications by name, email, or specialization..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Applications Table */}
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
                                        Applied Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredApplications.map((application) => {
                                    const doctorName = application.full_name || application.email;
                                    const avatarUrl = application.profile_picture_url || getDefaultAvatar(doctorName);
                                    
                                    return (
                                        <tr key={application.id} className="hover:bg-gray-50">
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
                                                            Dr. {doctorName}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {application.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {application.doctor_specialization || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {application.doctor_experience ? `${application.doctor_experience} years` : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatDate(application.date_joined)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => viewApplicationDetails(application)}
                                                        className="text-blue-600 hover:text-blue-900 p-1"
                                                        title="View Details"
                                                        disabled={loading}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprovalAction('approve', application.id)}
                                                        className="text-green-600 hover:text-green-900 p-1"
                                                        title="Approve Application"
                                                        disabled={actionLoading === application.id}
                                                    >
                                                        {actionLoading === application.id ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                                        ) : (
                                                            <CheckCircle size={16} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprovalAction('reject', application.id)}
                                                        className="text-red-600 hover:text-red-900 p-1"
                                                        title="Reject Application"
                                                        disabled={actionLoading === application.id}
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredApplications.length === 0 && !loading && (
                        <div className="text-center py-12">
                            <FileText className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No applications found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm ? 'Try adjusting your search criteria.' : 'No doctor applications have been submitted yet.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Application Details Modal */}
            {isModalOpen && selectedApplication && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">Doctor Application Details</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            {/* Doctor Header */}
                            <div className="flex items-center mb-6">
                                <img
                                    className="h-20 w-20 rounded-full object-cover"
                                    src={selectedApplication.doctor_profile?.profile_picture_url || getDefaultAvatar(selectedApplication.doctor_profile?.full_name || selectedApplication.email)}
                                    alt={selectedApplication.doctor_profile?.full_name || selectedApplication.email}
                                    onError={(e) => {
                                        e.target.src = getDefaultAvatar(selectedApplication.doctor_profile?.full_name || selectedApplication.email);
                                    }}
                                />
                                <div className="ml-6">
                                    <h4 className="text-xl font-semibold text-gray-900">
                                        Dr. {selectedApplication.doctor_profile?.full_name || selectedApplication.email}
                                    </h4>
                                    <p className="text-sm text-gray-500">Application ID: #{selectedApplication.id}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedApplication.doctor_profile?.verification_status)}`}>
                                            {selectedApplication.doctor_profile?.verification_status || 'Pending'}
                                        </span>
                                        {selectedApplication.verification_summary && (
                                            <div className="flex items-center">
                                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                                    <div 
                                                        className={`h-2 rounded-full ${getCompletionColor(selectedApplication.verification_summary.completion_percentage)}`}
                                                        style={{ width: `${selectedApplication.verification_summary.completion_percentage}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs text-gray-600">
                                                    {selectedApplication.verification_summary.completion_percentage}% Complete
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Application Information Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                {/* Basic Information */}
                                <div className="space-y-4">
                                    <h5 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h5>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <div className="flex items-center text-sm text-gray-900">
                                            <User size={16} className="mr-2 text-gray-400" />
                                            {selectedApplication.doctor_profile?.full_name || 'N/A'}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <div className="flex items-center text-sm text-gray-900">
                                            <Mail size={16} className="mr-2 text-gray-400" />
                                            {selectedApplication.email}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                        <div className="flex items-center text-sm text-gray-900">
                                            <Phone size={16} className="mr-2 text-gray-400" />
                                            {selectedApplication.phone_number || 'N/A'}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                        <div className="text-sm text-gray-900">{selectedApplication.doctor_profile?.gender || 'N/A'}</div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                        <div className="flex items-center text-sm text-gray-900">
                                            <Calendar size={16} className="mr-2 text-gray-400" />
                                            {selectedApplication.doctor_profile?.date_of_birth || 'N/A'}
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
                                            {selectedApplication.doctor_profile?.specialization || 'N/A'}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                                        <div className="text-sm text-gray-900">
                                            {selectedApplication.doctor_profile?.experience ? `${selectedApplication.doctor_profile.experience} years` : 'N/A'}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                                        <div className="text-sm text-gray-900">{selectedApplication.doctor_profile?.license_number || 'N/A'}</div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee</label>
                                        <div className="text-sm text-gray-900">
                                            ${selectedApplication.doctor_profile?.consultation_fee || '0.00'}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Clinic</label>
                                        <div className="text-sm text-gray-900">{selectedApplication.doctor_profile?.clinic_name || 'N/A'}</div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                        <div className="flex items-center text-sm text-gray-900">
                                            <MapPin size={16} className="mr-2 text-gray-400" />
                                            {selectedApplication.doctor_profile?.location || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Education Section */}
                            {selectedApplication.doctor_educations && selectedApplication.doctor_educations.length > 0 && (
                                <div className="mb-6">
                                    <h5 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Education</h5>
                                    <div className="space-y-3">
                                        {selectedApplication.doctor_educations.map((edu, index) => (
                                            <div key={edu.id} className="border rounded-lg p-4">
                                                <div className="flex items-center mb-2">
                                                    <GraduationCap size={16} className="mr-2 text-blue-500" />
                                                    <h6 className="font-medium text-gray-900">{edu.degree_name}</h6>
                                                </div>
                                                <p className="text-sm text-gray-600">Institution: {edu.institution_name}</p>
                                                <p className="text-sm text-gray-600">Year: {edu.year_of_completion}</p>
                                                {edu.degree_certificate_id && (
                                                    <p className="text-sm text-gray-600">Certificate ID: {edu.degree_certificate_id}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Certifications Section */}
                            {selectedApplication.doctor_certifications && selectedApplication.doctor_certifications.length > 0 && (
                                <div className="mb-6">
                                    <h5 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Certifications</h5>
                                    <div className="space-y-3">
                                        {selectedApplication.doctor_certifications.map((cert, index) => (
                                            <div key={cert.id} className="border rounded-lg p-4">
                                                <div className="flex items-center mb-2">
                                                    <Award size={16} className="mr-2 text-green-500" />
                                                    <h6 className="font-medium text-gray-900">{cert.certification_name}</h6>
                                                </div>
                                                <p className="text-sm text-gray-600">Issued by: {cert.issued_by}</p>
                                                <p className="text-sm text-gray-600">Year: {cert.year_of_issue}</p>
                                                {cert.certificate_image_url && (
                                                    <div className="mt-2">
                                                        <img 
                                                            src={cert.certificate_image_url} 
                                                            alt="Certificate" 
                                                            className="max-w-xs rounded border"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* License & Proof Section */}
                            {selectedApplication.doctor_proof && (
                                <div className="mb-6">
                                    <h5 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">License & Proof</h5>
                                    <div className="border rounded-lg p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Medical License Number</label>
                                                <p className="text-sm text-gray-900">{selectedApplication.doctor_proof.medical_license_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">License Document ID</label>
                                                <p className="text-sm text-gray-900">{selectedApplication.doctor_proof.license_doc_id || 'N/A'}</p>
                                            </div>
                                        </div>
                                        {selectedApplication.doctor_proof.license_image_url && (
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">License Image</label>
                                                <img 
                                                    src={selectedApplication.doctor_proof.license_image_url} 
                                                    alt="License" 
                                                    className="max-w-sm rounded border"
                                                />
                                            </div>
                                        )}
                                        {selectedApplication.doctor_proof.id_proof_url && (
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">ID Proof</label>
                                                <img 
                                                    src={selectedApplication.doctor_proof.id_proof_url} 
                                                    alt="ID Proof" 
                                                    className="max-w-sm rounded border"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Verification Summary */}
                            {selectedApplication.verification_summary && (
                                <div className="mb-6">
                                    <h5 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Application Status</h5>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="flex items-center">
                                            <CheckSquare 
                                                size={16} 
                                                className={`mr-2 ${selectedApplication.verification_summary.is_profile_setup_done ? 'text-green-500' : 'text-red-500'}`} 
                                            />
                                            <span className="text-sm text-gray-900">Profile Setup</span>
                                        </div>
                                        <div className="flex items-center">
                                            <GraduationCap 
                                                size={16} 
                                                className={`mr-2 ${selectedApplication.verification_summary.is_education_done ? 'text-green-500' : 'text-red-500'}`} 
                                            />
                                            <span className="text-sm text-gray-900">Education</span>
                                        </div>
                                        <div className="flex items-center">
                                            <Award 
                                                size={16} 
                                                className={`mr-2 ${selectedApplication.verification_summary.is_certification_done ? 'text-green-500' : 'text-red-500'}`} 
                                            />
                                            <span className="text-sm text-gray-900">Certifications</span>
                                        </div>
                                        <div className="flex items-center">
                                            <FileText 
                                                size={16} 
                                                className={`mr-2 ${selectedApplication.verification_summary.is_license_done ? 'text-green-500' : 'text-red-500'}`} 
                                            />
                                            <span className="text-sm text-gray-900">License</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Bio Section */}
                            {selectedApplication.doctor_profile?.bio && (
                                <div className="mb-6">
                                    <h5 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Bio</h5>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        {selectedApplication.doctor_profile.bio}
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    onClick={() => handleApprovalAction('reject', selectedApplication.id)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                                    disabled={actionLoading === selectedApplication.id}
                                >
                                    {actionLoading === selectedApplication.id ? (
                                        <div className="flex items-center">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Processing...
                                        </div>
                                    ) : (
                                        'Reject Application'
                                    )}
                                </button>
                                <button
                                    onClick={() => handleApprovalAction('approve', selectedApplication.id)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                                    disabled={actionLoading === selectedApplication.id}
                                >
                                                                        {actionLoading === selectedApplication.id ? (
                                        <div className="flex items-center">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Processing...
                                        </div>
                                    ) : (
                                        'Approve Application'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Approval Confirmation Modal */}
            {showApprovalModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-md w-full mx-4">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {pendingAction?.action === 'approve' ? 'Approve Application' : 'Reject Application'}
                            </h3>
                            <button onClick={closeApprovalModal} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {pendingAction?.action === 'approve' 
                                        ? 'Approval comments (optional)' 
                                        : 'Reason for rejection (required)'}
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows={4}
                                    value={approvalComment}
                                    onChange={(e) => setApprovalComment(e.target.value)}
                                    placeholder={pendingAction?.action === 'approve' 
                                        ? 'Add any notes about this approval...' 
                                        : 'Explain why this application is being rejected...'}
                                    required={pendingAction?.action === 'reject'}
                                />
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={closeApprovalModal}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmApprovalAction}
                                    className={`px-4 py-2 text-white rounded-lg font-medium ${
                                        pendingAction?.action === 'approve' 
                                            ? 'bg-green-600 hover:bg-green-700' 
                                            : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                    disabled={
                                        (pendingAction?.action === 'reject' && !approvalComment.trim()) ||
                                        actionLoading === pendingAction?.applicationId
                                    }
                                >
                                    {actionLoading === pendingAction?.applicationId ? (
                                        <div className="flex items-center">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Processing...
                                        </div>
                                    ) : (
                                        pendingAction?.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorApplicationsPage;