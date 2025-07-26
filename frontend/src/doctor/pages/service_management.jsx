import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, DollarSign, MapPin, Clock, Check, X, AlertCircle, Loader2 } from 'lucide-react';

import { getServices, createService, updateService, deleteService } from '../../endpoints/Doc';
import { useToast } from '../../components/ui/Toast';
import { useSubscription,createSubscriptionErrorModal  } from '../../hooks/useSubscription';



const SubscriptionErrorModal = ({ modalConfig, onClose }) => {
    if (!modalConfig?.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center space-x-3 mb-4">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <h3 className="text-lg font-semibold text-gray-900">{modalConfig.title}</h3>
                </div>
                <p className="text-gray-600 mb-6">{modalConfig.message}</p>
                <div className="flex justify-end space-x-3">
                    {modalConfig.cancelText && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            {modalConfig.cancelText}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            modalConfig.onConfirm?.();
                            onClose();
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        {modalConfig.confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


// Confirmation Dialog Component
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center space-x-3 mb-4">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                </div>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

// Service Form Modal Component
const ServiceFormModal = ({ isOpen, onClose, onSubmit, editingService, loading }) => {
    const { canCreateService } = useSubscription();
    const [formData, setFormData] = useState({
        service_name: '',
        service_mode: 'online',
        service_fee: '',
        description: '',
        is_active: true
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (editingService) {
            setFormData({
                service_name: editingService.service_name || '',
                service_mode: editingService.service_mode || 'online',
                service_fee: editingService.service_fee || '',
                description: editingService.description || '',
                is_active: editingService.is_active !== undefined ? editingService.is_active : true
            });
        } else {
            setFormData({
                service_name: '',
                service_mode: 'online',
                service_fee: '',
                description: '',
                is_active: true
            });
        }
        setErrors({});
    }, [editingService, isOpen]);

    const handleSubmit = () => {
        // Basic validation
        const newErrors = {};
        if (!formData.service_name.trim()) {
            newErrors.service_name = 'Service name is required';
        } else if (formData.service_name.trim().length < 2) {
            newErrors.service_name = 'Service name must be at least 2 characters long';
        }

        if (!formData.service_fee || formData.service_fee < 0) {
            newErrors.service_fee = 'Service fee must be a positive number';
        }

        if (!formData.description.trim()) {
            newErrors.description = 'Description is required';
        } else if (formData.description.trim().length < 10) {
            newErrors.description = 'Description must be at least 10 characters long';
        }

        if (!['online', 'offline'].includes(formData.service_mode)) {
            newErrors.service_mode = 'Service mode must be either online or offline';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        onSubmit(formData);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    if (!isOpen) return null;



    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {editingService ? 'Edit Service' : 'Add New Service'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                            disabled={loading}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Service Name *
                            </label>
                            <input
                                type="text"
                                name="service_name"
                                value={formData.service_name}
                                onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.service_name ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Enter service name"
                            />
                            {errors.service_name && (
                                <p className="text-red-500 text-sm mt-1">{errors.service_name}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Service Mode *
                            </label>
                            <select
                                name="service_mode"
                                value={formData.service_mode}
                                onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.service_mode ? 'border-red-500' : 'border-gray-300'
                                }`}
                            >
                                 <option value="online" disabled={!canCreateService('online')}>
                                    Online {!canCreateService('online') ? '(Not available in your plan)' : ''}
                                </option>
                                <option value="offline" disabled={!canCreateService('offline')}>
                                    Offline {!canCreateService('offline') ? '(Not available in your plan)' : ''}
                                </option>
                            </select>
                            {errors.service_mode && (
                                <p className="text-red-500 text-sm mt-1">{errors.service_mode}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Service Fee ($) *
                            </label>
                            <input
                                type="number"
                                name="service_fee"
                                value={formData.service_fee}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.service_fee ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Enter fee amount"
                            />
                            {errors.service_fee && (
                                <p className="text-red-500 text-sm mt-1">{errors.service_fee}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description *
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.description ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Enter service description (minimum 10 characters)"
                            />
                            {errors.description && (
                                <p className="text-red-500 text-sm mt-1">{errors.description}</p>
                            )}
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                name="is_active"
                                checked={formData.is_active}
                                onChange={handleChange}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-900">
                                Active Service
                            </label>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>{editingService ? 'Update' : 'Add'} Service</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ServiceDetailsModal = ({ isOpen, onClose, service }) => {
    if (!isOpen || !service) return null;

    const getModeIcon = (mode) => {
        switch (mode) {
            case 'online':
                return <Calendar className="w-5 h-5 text-blue-500" />;
            case 'offline':
                return <MapPin className="w-5 h-5 text-green-500" />;
            default:
                return <Calendar className="w-5 h-5 text-purple-500" />;
        }
    };

    const getModeColor = (mode) => {
        switch (mode) {
            case 'online':
                return 'bg-blue-100 text-blue-800';
            case 'offline':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-purple-100 text-purple-800';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">Service Details</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">{service.service_name}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Service Mode
                                </label>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getModeColor(service.service_mode)}`}>
                                    {getModeIcon(service.service_mode)}
                                    <span className="ml-2 capitalize">{service.service_mode}</span>
                                </span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Service Fee
                                </label>
                                <div className="flex items-center">
                                    <DollarSign className="w-4 h-4 text-gray-500 mr-1" />
                                    <span className="text-lg font-semibold text-gray-900">${service.service_fee}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                service.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                                {service.is_active ? (
                                    <Check className="w-4 h-4 mr-1" />
                                ) : (
                                    <X className="w-4 h-4 mr-1" />
                                )}
                                {service.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-gray-700 leading-relaxed">{service.description}</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Service Card Component
const ServiceCard = ({ service, onEdit, onDelete, onViewDetails }) => {
    const getModeIcon = (mode) => {
        switch (mode) {
            case 'online':
                return <Calendar className="w-4 h-4 text-blue-600" />;
            case 'offline':
                return <MapPin className="w-4 h-4 text-green-600" />;
            default:
                return <Calendar className="w-4 h-4 text-purple-600" />;
        }
    };

    const getModeColor = (mode) => {
        switch (mode) {
            case 'online':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'offline':
                return 'bg-green-50 text-green-700 border-green-200';
            default:
                return 'bg-purple-50 text-purple-700 border-purple-200';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 p-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {service.service_name}
                    </h3>
                    
                    {/* Service Mode Badge */}
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getModeColor(service.service_mode)}`}>
                        {getModeIcon(service.service_mode)}
                        <span className="ml-2 capitalize">{service.service_mode}</span>
                    </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-2">
                    <button
                        onClick={() => onEdit(service)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(service)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Service Info */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-gray-700">
                    <DollarSign className="w-4 h-4 mr-1" />
                    <span className="font-semibold">${service.service_fee}</span>
                </div>
                
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    service.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                }`}>
                    {service.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>

            {/* View Details Button */}
            <button
                onClick={() => onViewDetails(service)}
                className="w-full py-2 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
                View Details
            </button>
        </div>
    );
};

// Main Service Page Component
const ServicePage = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, service: null });
    const [error, setError] = useState(null);
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, service: null });
    const { canCreateService, isNearLimit, subscriptionData, loading: subscriptionLoading, error: subscriptionError } = useSubscription();
    
    const [subscriptionErrorModal, setSubscriptionErrorModal] = useState(null);
    
    // Use the toast hook
    const toast = useToast();

    const handleViewDetails = (service) => {
    setDetailsModal({ isOpen: true, service });
};



    // Load services on component mount
    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getServices();
            
            if (response.data && response.data.success) {
                setServices(response.data.data || []);
            } else {
                const errorMessage = response.data?.message || 'Failed to load services';
                setError(errorMessage);
                toast.error(errorMessage, 'Error');
            }
        } catch (error) {
            console.error('Error loading services:', error);
            const errorMessage = error.response?.data?.message || 'Failed to load services';
            setError(errorMessage);
            toast.error(errorMessage, 'Error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddService = () => {
    // Check if user can create any type of service
    const canCreateOnline = canCreateService('online');
    const canCreateOffline = canCreateService('offline');
    
    if (!canCreateOnline && !canCreateOffline) {
        const modalConfig = createSubscriptionErrorModal({
            response: { 
                status: 403, 
                data: { 
                    error_type: 'limit_reached', 
                    message: 'You have reached the service limit for your plan.' 
                } 
            }
        });
        setSubscriptionErrorModal(modalConfig);
        return;
    }
    
    setEditingService(null);
    setModalOpen(true);
};

    const handleEditService = (service) => {
        setEditingService(service);
        setModalOpen(true);
    };

    const handleDeleteService = (service) => {
        setConfirmDialog({ isOpen: true, service });
    };

    const confirmDelete = async () => {
        try {
            const response = await deleteService(confirmDialog.service.id);
            
            if (response.data && response.data.success) {
                setServices(services.filter(s => s.id !== confirmDialog.service.id));
                toast.success('Service deleted successfully', 'Success');
            } else {
                const errorMessage = response.data?.message || 'Failed to delete service';
                toast.error(errorMessage, 'Error');
            }
        } catch (error) {
            console.error('Error deleting service:', error);
            const errorMessage = error.response?.data?.message || 'Failed to delete service';
            toast.error(errorMessage, 'Error');
        } finally {
            setConfirmDialog({ isOpen: false, service: null });
        }
    };

    const handleFormSubmit = async (formData) => {
    try {
        setFormLoading(true);
        
        // Check service type permissions before creating
        if (!editingService && !canCreateService(formData.service_mode)) {
            const modalConfig = createSubscriptionErrorModal({
                response: { 
                    status: 403, 
                    data: { 
                        error_type: 'feature_not_available', 
                        message: `You cannot create ${formData.service_mode} services with your current plan.` 
                    } 
                }
            });
            setSubscriptionErrorModal(modalConfig);
            setFormLoading(false);
            return;
        }
        
        let response;
        
        if (editingService) {
            response = await updateService({ id: editingService.id, ...formData });
            
            if (response.data && response.data.success) {
                setServices(services.map(s => 
                    s.id === editingService.id ? response.data.data : s
                ));
                toast.success('Service updated successfully', 'Success');
            } else {
                const errorMessage = response.data?.message || 'Failed to update service';
                toast.error(errorMessage, 'Error');
                return;
            }
        } else {
            response = await createService(formData);
            
            if (response.data && response.data.success) {
                setServices([...services, response.data.data]);
                toast.success('Service added successfully', 'Success');
            } else {
                const errorMessage = response.data?.message || 'Failed to add service';
                toast.error(errorMessage, 'Error');
                return;
            }
        }
        
        setModalOpen(false);
        setEditingService(null);
    } catch (error) {
        console.error('Error saving service:', error);
        
        // Handle subscription-related errors
        if (error.response?.status === 402 || error.response?.status === 403) {
            const modalConfig = createSubscriptionErrorModal(error);
            setSubscriptionErrorModal(modalConfig);
        } else {
            const errorMessage = error.response?.data?.message || 'Failed to save service';
            toast.error(errorMessage, 'Error');
        }
    } finally {
        setFormLoading(false);
    }
};


    if (loading || subscriptionLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading...</span>
            </div>
        );
    }
    if (subscriptionError) {
        return (
            <div className="min-h-screen bg-gray-50">
               
                <div className="flex">
                    
                    <div className="flex-1 p-8">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-700">Subscription Error: {subscriptionError}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-gray-50">
            
            <div className="flex">
                
                <div className="flex-1 p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">Service Management</h1>
                                    <p className="text-gray-600 mt-2">Manage your medical services and consultations</p>
                                </div>
                                <button
                                    onClick={handleAddService}
                                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 flex items-center space-x-2 transition-colors"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span>Add Service</span>
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                                <p className="text-red-700">{error}</p>
                                <button
                                    onClick={loadServices}
                                    className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}

                        {/* Services List */}
                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                <span className="ml-2 text-gray-600">Loading services...</span>
                            </div>
                        ) : services.length === 0 ? (
                            <div className="text-center py-12">
                                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No services yet</h3>
                                <p className="text-gray-600 mb-6">Start by adding your first service</p>
                                <button
                                    onClick={handleAddService}
                                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
                                >
                                    Add Your First Service
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {services.map(service => (
                                    <ServiceCard
                                        key={service.id}
                                        service={service}
                                        onEdit={handleEditService}
                                        onDelete={handleDeleteService}
                                        onViewDetails={handleViewDetails}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Service Form Modal */}
                        <ServiceFormModal
                            isOpen={modalOpen}
                            onClose={() => {
                                setModalOpen(false);
                                setEditingService(null);
                            }}
                            onSubmit={handleFormSubmit}
                            editingService={editingService}
                            loading={formLoading}
                        />

                        {/* Confirmation Dialog */}
                        <ConfirmDialog
                            isOpen={confirmDialog.isOpen}
                            onClose={() => setConfirmDialog({ isOpen: false, service: null })}
                            onConfirm={confirmDelete}
                            title="Delete Service"
                            message={`Are you sure you want to delete "${confirmDialog.service?.service_name}"? This action cannot be undone.`}
                        />
                        
                            {subscriptionErrorModal && (
                            <SubscriptionErrorModal
                                modalConfig={subscriptionErrorModal}
                                onClose={() => setSubscriptionErrorModal(null)}
                            />
                        )}

                        <ServiceDetailsModal
                            isOpen={detailsModal.isOpen}
                            onClose={() => setDetailsModal({ isOpen: false, service: null })}
                            service={detailsModal.service}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServicePage;