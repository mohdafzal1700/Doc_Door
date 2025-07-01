"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Award, Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { 
    getDoctorEducation, 
    createDoctorEducation, 
    updateDoctorEducation, 
    deleteDoctorEducation,
    getDoctorCertification,
    createDoctorCertification,
    updateDoctorCertification,
    deleteDoctorCertification
} from '../../endpoints/Doc';
import DocHeader from '../../components/ui/DocHeader';
import DoctorSidebar from '../../components/ui/DocSide';
import Button from '../../components/ui/Button';
import { useNavigate } from "react-router-dom"; // Changed from useRoutes to useRouter

const ManageQualifications = () => {
    const navigate = useNavigate();
    const [educations, setEducations] = useState([]);
    const [certifications, setCertifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('education');
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        degree_name: '',
        institution_name: '',
        year_of_completion: '',
        degree_certificate_id: '',
        certification_name: '',
        issued_by: '',
        year_of_issue: '',
        certification_certificate_id: '',
        certificate_image_url: ''
    });

    // Fetch all qualification data
    const fetchQualifications = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [eduResponse, certResponse] = await Promise.all([
                getDoctorEducation(),
                getDoctorCertification()
            ]);
            
            setEducations(eduResponse.data?.data || []);
            setCertifications(certResponse.data?.data || []);
            
        } catch (err) {
            setError('Failed to load qualifications data');
            console.error('API Error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            degree_name: '',
            institution_name: '',
            year_of_completion: '',
            degree_certificate_id: '',
            certification_name: '',
            issued_by: '',
            year_of_issue: '',
            certification_certificate_id: '',
            certificate_image_url: ''
        });
        setEditingItem(null);
        setShowForm(false);
    };

    // Start editing an item
    const startEdit = (item) => {
        if (activeTab === 'education') {
            setFormData({
                degree_name: item.degree_name || '',
                institution_name: item.institution_name || '',
                year_of_completion: item.year_of_completion || '',
                degree_certificate_id: item.degree_certificate_id || '',
                // Clear certification fields
                certification_name: '',
                issued_by: '',
                year_of_issue: '',
                certification_certificate_id: '',
                certificate_image_url: ''
            });
        } else {
            setFormData({
                // Clear education fields
                degree_name: '',
                institution_name: '',
                year_of_completion: '',
                degree_certificate_id: '',
                // Set certification fields
                certification_name: item.certification_name || '',
                issued_by: item.issued_by || '',
                year_of_issue: item.year_of_issue || '',
                certification_certificate_id: item.certification_certificate_id || '',
                certificate_image_url: item.certificate_image_url || ''
            });
        }
        setEditingItem(item);
        setShowForm(true);
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            setLoading(true);
            let response;
            
            if (activeTab === 'education') {
                // Validate education form
                if (!formData.degree_name || !formData.institution_name || 
                    !formData.year_of_completion || !formData.degree_certificate_id) {
                    setError('All fields are required');
                    return;
                }
                
                const payload = {
                    degree_name: formData.degree_name,
                    institution_name: formData.institution_name,
                    year_of_completion: formData.year_of_completion,
                    degree_certificate_id: formData.degree_certificate_id
                };
                
                if (editingItem) {
                    response = await updateDoctorEducation({
                        id: editingItem.id,
                        ...payload
                    });
                } else {
                    response = await createDoctorEducation(payload);
                }
            } else {
                // Validate certification form
                if (!formData.certification_name || !formData.issued_by || 
                    !formData.year_of_issue || !formData.certification_certificate_id) {
                    setError('All fields are required');
                    return;
                }
                
                const payload = {
                    certification_name: formData.certification_name,
                    issued_by: formData.issued_by,
                    year_of_issue: formData.year_of_issue,
                    certification_certificate_id: formData.certification_certificate_id,
                    certificate_image_url: formData.certificate_image_url
                };
                
                if (editingItem) {
                    response = await updateDoctorCertification({
                        id: editingItem.id,
                        ...payload
                    });
                } else {
                    response = await createDoctorCertification(payload);
                }
            }
            
            if (response.data.success) {
                await fetchQualifications();
                resetForm();
            } else {
                setError(response.data.message || 'Operation failed');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Operation failed');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Handle delete
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this record?')) {
            return;
        }
        
        try {
            setLoading(true);
            let response;
            
            if (activeTab === 'education') {
                response = await deleteDoctorEducation(id);
            } else {
                response = await deleteDoctorCertification(id);
            }
            
            if (response.data.success) {
                await fetchQualifications();
            } else {
                setError(response.data.message || 'Delete failed');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Delete failed');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Load data on component mount
    useEffect(() => {
        fetchQualifications();
    }, [fetchQualifications]);

    if (loading && !showForm) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading qualifications...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <DocHeader />
            <div className="flex">
                <DoctorSidebar />
                
                <div className="flex-1 p-8">
                    <div className="max-w-4xl mx-auto">
                        <h1 className="text-2xl font-bold text-gray-900 mb-8">Manage Qualifications</h1>
                        
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                                <p className="text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 mb-6">
                            <button
                                className={`py-2 px-4 font-medium ${activeTab === 'education' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                                onClick={() => {
                                    setActiveTab('education');
                                    resetForm();
                                }}
                            >
                                Education
                            </button>
                            <button
                                className={`py-2 px-4 font-medium ${activeTab === 'certification' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                                onClick={() => {
                                    setActiveTab('certification');
                                    resetForm();
                                }}
                            >
                                Certifications
                            </button>
                        </div>

                        {/* Add New Button */}
                        <div className="flex justify-end mb-6">
                            <Button 
                                onClick={() => {
                                    resetForm();
                                    setShowForm(true);
                                }}
                                className="flex items-center gap-2"
                            >
                                <Plus size={16} />
                                Add {activeTab === 'education' ? 'Education' : 'Certification'}
                            </Button>
                        </div>

                        {/* Form Modal */}
                        {showForm && (
                            <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
                                <h2 className="text-xl font-semibold mb-4">
                                    {editingItem ? 'Edit' : 'Add New'} {activeTab === 'education' ? 'Education' : 'Certification'}
                                </h2>
                                
                                <form onSubmit={handleSubmit}>
                                    {activeTab === 'education' ? (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Degree Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="degree_name"
                                                        value={formData.degree_name}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Institution Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="institution_name"
                                                        value={formData.institution_name}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Year of Completion *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        name="year_of_completion"
                                                        value={formData.year_of_completion}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        required
                                                        min="1900"
                                                        max={new Date().getFullYear()}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Certificate ID *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="degree_certificate_id"
                                                        value={formData.degree_certificate_id}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Certification Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="certification_name"
                                                        value={formData.certification_name}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Issued By *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="issued_by"
                                                        value={formData.issued_by}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Year of Issue *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        name="year_of_issue"
                                                        value={formData.year_of_issue}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        required
                                                        min="1900"
                                                        max={new Date().getFullYear()}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Certificate ID *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="certification_certificate_id"
                                                        value={formData.certification_certificate_id}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Certificate Image URL
                                                </label>
                                                <input
                                                    type="text"
                                                    name="certificate_image_url"
                                                    value={formData.certificate_image_url}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    placeholder="https://example.com/certificate.jpg"
                                                />
                                            </div>
                                        </>
                                    )}
                                    
                                    <div className="flex justify-end gap-3 mt-6">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={resetForm}
                                            disabled={loading}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : editingItem ? (
                                                'Update'
                                            ) : (
                                                'Create'
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Education List */}
                        {activeTab === 'education' && (
                            <div className="space-y-4">
                                {educations.length === 0 ? (
                                    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 text-center">
                                        <p className="text-gray-500">No education records found</p>
                                    </div>
                                ) : (
                                    educations.map((edu) => (
                                        <div key={edu.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-lg font-medium text-gray-900 mb-2">{edu.degree_name}</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-gray-500">Institution</p>
                                                            <p className="font-medium">{edu.institution_name}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500">Year</p>
                                                            <p className="font-medium">{edu.year_of_completion}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500">Certificate ID</p>
                                                            <p className="font-medium">{edu.degree_certificate_id}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => startEdit(edu)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                                                        title="Edit"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(edu.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-full"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Certification List */}
                        {activeTab === 'certification' && (
                            <div className="space-y-4">
                                {certifications.length === 0 ? (
                                    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 text-center">
                                        <p className="text-gray-500">No certifications found</p>
                                    </div>
                                ) : (
                                    certifications.map((cert) => (
                                        <div key={cert.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-lg font-medium text-gray-900 mb-2">{cert.certification_name}</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-gray-500">Issued By</p>
                                                            <p className="font-medium">{cert.issued_by}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500">Year</p>
                                                            <p className="font-medium">{cert.year_of_issue}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500">Certificate ID</p>
                                                            <p className="font-medium">{cert.certification_certificate_id}</p>
                                                        </div>
                                                    </div>
                                                    {cert.certificate_image_url && (
                                                        <div className="mt-4">
                                                            <p className="text-gray-500 mb-1">Certificate Image</p>
                                                            <img 
                                                                src={cert.certificate_image_url} 
                                                                alt="Certificate" 
                                                                className="max-w-xs rounded border"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => startEdit(cert)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                                                        title="Edit"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(cert.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-full"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageQualifications;