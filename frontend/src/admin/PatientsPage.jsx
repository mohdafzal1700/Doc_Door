import React, { useState, useEffect } from 'react';
import { Search, Eye, MoreVertical, User, Phone, Mail, Calendar, MapPin, Shield, ShieldCheck, X, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { patientManagement,togglePatientStatusSimple, getPatientDetails } from '../endpoints/adm'; // Update path as needed
import AdminHeader from '../components/ui/AdminHeader'; 
import Sidebar from '../components/ui/Sidebar';

const PatientsPage = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);


    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [patientsPerPage, setPatientsPerPage] = useState(10);

    // Load patients on component mount
    useEffect(() => {
        loadPatients(); 
    }, []);

    // Filter patients based on search term
    useEffect(() => {
        const filtered = patients.filter(patient => {
            const fullName = patient.full_name || `${patient.first_name} ${patient.last_name}`.trim();
            return (
                fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (patient.phone_number && patient.phone_number.includes(searchTerm))
            );
        });
        setFilteredPatients(filtered);
        setCurrentPage(1); // Reset to first page when search changes
    }, [searchTerm, patients]);

    // Calculate pagination values
    const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);
    const startIndex = (currentPage - 1) * patientsPerPage;
    const endIndex = startIndex + patientsPerPage;
    const currentPatients = filteredPatients.slice(startIndex, endIndex);

    // Generate page numbers for pagination
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }
        
        return pages;
    };

    const loadPatients = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await patientManagement();
            setPatients(response.data);
        } catch (err) {
            setError('Failed to load patients. Please try again.');
            console.error('Error loading patients:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleBlockStatus = async (patientId, currentStatus) => {
    const patient = patients.find(p => p.id === patientId);
    const patientName = getPatientName(patient);
    const action = currentStatus ? 'deactivate' : 'activate';
    
    // Set confirmation data
    setConfirmAction({
        patientId,
        currentStatus,
        patientName,
        action
    });
};

// Function to execute the actual status change
const executeStatusChange = async () => {
    if (!confirmAction) return;
    
    const { patientId, currentStatus } = confirmAction;
    
    try {
        setActionLoading(patientId);
        const newStatus = !currentStatus;
        
        await togglePatientStatusSimple(patientId, newStatus);
        
        // Update local state
        setPatients(prevPatients =>
            prevPatients.map(patient =>
                patient.id === patientId
                    ? { ...patient, is_active: newStatus }
                    : patient
            )
        );
        
        // Update selected patient if modal is open
        if (selectedPatient && selectedPatient.id === patientId) {
            setSelectedPatient(prev => ({ ...prev, is_active: newStatus }));
        }
        
        // Show success message (optional)
        // You can add a toast notification here
        console.log(`Patient ${confirmAction.action}d successfully`);
        
    } catch (err) {
        setError('Failed to update patient status. Please try again.');
        console.error('Error toggling patient status:', err);
    } finally {
        setActionLoading(null);
        setConfirmAction(null); // Close confirmation
    }
};


    const viewPatientDetails = async (patient) => {
        try {
            setLoading(true);
            const response = await getPatientDetails(patient.id);
            setSelectedPatient(response.data);
            setIsModalOpen(true);
        } catch (err) {
            setError('Failed to load patient details. Please try again.');
            console.error('Error loading patient details:', err);
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedPatient(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const getPatientName = (patient) => {
        return patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.email || patient.username;
    };

    const getDefaultAvatar = (name) => {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=ffffff&size=150`;
    };

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handlePerPageChange = (newPerPage) => {
        setPatientsPerPage(newPerPage);
        setCurrentPage(1);
    };

    if (loading && patients.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                <AdminHeader/>
                <Sidebar/>
                <div className="ml-64 p-8">
                    <div className="bg-white rounded-lg shadow-sm p-8">
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2">Loading patients...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    
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
                                This will prevent the patient from accessing their account.
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

    if (loading && patients.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                <AdminHeader/>
                <Sidebar/>
                <div className="ml-64 p-8">
                    <div className="bg-white rounded-lg shadow-sm p-8">
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2">Loading patients...</span>
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
                            <h3 className="text-lg font-semibold text-gray-800">Patient Management</h3>
                            <div className="text-sm text-gray-500">
                                Total Patients: {patients.length}
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search patients by name, email, or phone..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600">Show:</label>
                                <select
                                    value={patientsPerPage}
                                    onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span className="text-sm text-gray-600">per page</span>
                            </div>
                        </div>
                    </div>

                    {/* Patients Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Patient
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contact
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Last Visit
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
                {currentPatients.map((patient) => {
                    const patientName = getPatientName(patient);
                    const avatarUrl = patient.profile_picture_url || getDefaultAvatar(patientName);
                    
                    return (
                        <tr key={patient.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <img
                                        className="h-10 w-10 rounded-full object-cover"
                                        src={avatarUrl}
                                        alt={patientName}
                                        onError={(e) => {
                                            e.target.src = getDefaultAvatar(patientName);
                                        }}
                                    />
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">
                                            {patientName}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            ID: #{patient.id}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{patient.email}</div>
                                <div className="text-sm text-gray-500">{patient.phone_number || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(patient.last_visit)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        patient.is_active
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                    {patient.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => viewPatientDetails(patient)}
                                        className="text-blue-600 hover:text-blue-900 p-1"
                                        title="View Details"
                                        disabled={loading}
                                    >
                                        <Eye size={16} />
                                    </button>
                                    <button
                                        onClick={() => toggleBlockStatus(patient.id, patient.is_active)}
                                        className={`p-1 ${
                                            patient.is_active
                                                ? 'text-red-600 hover:text-red-900'
                                                : 'text-green-600 hover:text-green-900'
                                        }`}
                                        title={patient.is_active ? 'Deactivate Patient' : 'Activate Patient'}
                                        disabled={actionLoading === patient.id}
                                    >
                                        {actionLoading === patient.id ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                        ) : (
                                            patient.is_active ? <Shield size={16} /> : <ShieldCheck size={16} />
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Showing {startIndex + 1} to {Math.min(endIndex, filteredPatients.length)} of {filteredPatients.length} patients
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="flex items-center px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={16} />
                                        Previous
                                    </button>
                                    
                                    <div className="flex items-center gap-1">
                                        {getPageNumbers().map((page, index) => (
                                            <button
                                                key={index}
                                                onClick={() => typeof page === 'number' && handlePageChange(page)}
                                                disabled={page === '...'}
                                                className={`px-3 py-1 text-sm border rounded-lg ${
                                                    page === currentPage
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : page === '...'
                                                        ? 'border-transparent cursor-default'
                                                        : 'border-gray-300 hover:bg-gray-100'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="flex items-center px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {filteredPatients.length === 0 && !loading && (
                        <div className="text-center py-12">
                            <User className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No patients found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm ? 'Try adjusting your search criteria.' : 'No patients have been registered yet.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal />

            {/* Patient Details Modal */}
            {isModalOpen && selectedPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">Patient Details</h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <div className="flex items-center mb-6">
                                <img
                                    className="h-20 w-20 rounded-full object-cover"
                                    src={selectedPatient.profile_picture_url || getDefaultAvatar(getPatientName(selectedPatient))}
                                    alt={getPatientName(selectedPatient)}
                                    onError={(e) => {
                                        e.target.src = getDefaultAvatar(getPatientName(selectedPatient));
                                    }}
                                />
                                <div className="ml-6">
                                    <h4 className="text-xl font-semibold text-gray-900">
                                        {getPatientName(selectedPatient)}
                                    </h4>
                                    <p className="text-sm text-gray-500">Patient ID: #{selectedPatient.id}</p>
                                    <span
                                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-2 ${
                                            selectedPatient.is_active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}
                                    >
                                        {selectedPatient.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email
                                        </label>
                                        <div className="flex items-center text-sm text-gray-900">
                                            <Mail size={16} className="mr-2 text-gray-400" />
                                            {selectedPatient.email}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Phone
                                        </label>
                                        <div className="flex items-center text-sm text-gray-900">
                                            <Phone size={16} className="mr-2 text-gray-400" />
                                            {selectedPatient.phone_number || 'N/A'}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Age
                                        </label>
                                        <div className="flex items-center text-sm text-gray-900">
                                            <Calendar size={16} className="mr-2 text-gray-400" />
                                            {selectedPatient.patient_age || 'N/A'}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Gender
                                        </label>
                                        <div className="text-sm text-gray-900">{selectedPatient.patient_gender || 'N/A'}</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Blood Group
                                        </label>
                                        <div className="text-sm text-gray-900">{selectedPatient.patient_blood_group || 'N/A'}</div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Member Since
                                        </label>
                                        <div className="text-sm text-gray-900">
                                            {formatDate(selectedPatient.member_since)}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Last Visit
                                        </label>
                                        <div className="text-sm text-gray-900">
                                            {formatDate(selectedPatient.last_visit)}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Username
                                        </label>
                                        <div className="text-sm text-gray-900">{selectedPatient.username}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        toggleBlockStatus(selectedPatient.id, selectedPatient.is_active);
                                    }}
                                    className={`px-4 py-2 rounded-lg font-medium ${
                                        selectedPatient.is_active
                                            ? 'bg-red-600 hover:bg-red-700 text-white'
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                                    disabled={actionLoading === selectedPatient.id}
                                >
                                    {actionLoading === selectedPatient.id ? (
                                        <div className="flex items-center">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Processing...
                                        </div>
                                    ) : (
                                        selectedPatient.is_active ? 'Deactivate Patient' : 'Activate Patient'
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

export default PatientsPage;