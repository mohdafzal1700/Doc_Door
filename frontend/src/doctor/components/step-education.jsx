"use client"

// Enhanced React component with better state management
import React, { useState, useEffect, useCallback } from 'react';
import { 
    getDoctorEducation, 
    createDoctorEducation, 
    updateDoctorEducation, 
    deleteDoctorEducation  
} from '../../endpoints/Doc';
import Button from "../../components/ui/Button";
import { useNavigate } from "react-router-dom";

const DoctorEducationComponent = () => {
    const navigate = useNavigate();
    const [educationList, setEducationList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editingEducation, setEditingEducation] = useState(null);
    const [showForm, setShowForm] = useState(false);

    // Form state - removed certificate_file as it's not in the model
    const [formData, setFormData] = useState({
        degree_name: '',
        institution_name: '',
        year_of_completion: '',
        certificate_id: ''
    });

    // Navigation handlers
    const handleNext = () => {
        navigate("../certification");
    };

    const handleBack = () => {
        navigate("../profile");
    };

    // Fetch education records
    const fetchEducation = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getDoctorEducation();
            
            console.log('🔍 FETCH: Response:', response.data);
            
            if (response.data.success) {
                setEducationList(response.data.data || []);
            } else {
                setError(response.data.message || 'Failed to fetch education records');
            }
        } catch (err) {
            console.error('Error fetching education:', err);
            setError(err.response?.data?.message || 'Failed to fetch education records');
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
            certificate_id: ''
        });
        setEditingEducation(null);
        setShowForm(false);
    };

    // Start editing an education record
    const startEdit = (education) => {
        console.log('🔍 EDIT: Starting edit for:', education);
        setFormData({
            id: education.id, // UUID string
            degree_name: education.degree_name || '',
            institution_name: education.institution_name || '',
            year_of_completion: education.year_of_completion ? String(education.year_of_completion) : '',
            certificate_id: education.certificate_id || ''
        });
        setEditingEducation(education);
        setShowForm(true);
    };

    // Create new education record
    const handleCreateEducation = async (formData) => {
        try {
            setLoading(true);
            console.log('🔍 CREATE: Sending data:', formData);
            
            const response = await createDoctorEducation(formData);
            console.log('🔍 CREATE: Response:', response.data);
            
            if (response.data.success) {
                await fetchEducation(); // Refresh the list
                resetForm();
                return { 
                    success: true, 
                    message: response.data.message || 'Education record created successfully' 
                };
            } else {
                return { 
                    success: false, 
                    errors: response.data.field_errors || { general: response.data.message }
                };
            }
        } catch (err) {
            console.error('Error creating education:', err);
            return { 
                success: false, 
                errors: { 
                    general: err.response?.data?.message || 'Failed to create education record'
                }
            };
        } finally {
            setLoading(false);
        }
    };

    // Update education record
    const handleUpdateEducation = async (formData) => {
        try {
            setLoading(true);
            console.log('🔍 UPDATE: Sending data:', formData);
            
            const response = await updateDoctorEducation(formData);
            console.log('🔍 UPDATE: Response:', response.data);
            
            if (response.data.success) {
                await fetchEducation(); // Refresh the list
                resetForm();
                return { 
                    success: true, 
                    message: response.data.message || 'Education record updated successfully' 
                };
            } else {
                return { 
                    success: false, 
                    errors: response.data.field_errors || { general: response.data.message }
                };
            }
        } catch (err) {
            console.error('Error updating education:', err);
            return { 
                success: false, 
                errors: { 
                    general: err.response?.data?.message || 'Failed to update education record'
                }
            };
        } finally {
            setLoading(false);
        }
    };

    // Delete education record
    const handleDeleteEducation = async (educationId) => {
        if (!window.confirm('Are you sure you want to delete this education record?')) {
            return;
        }

        try {
            setLoading(true);
            console.log('🔍 DELETE: Deleting ID:', educationId);
            
            const response = await deleteDoctorEducation(educationId);
            console.log('🔍 DELETE: Response:', response.data);
            
            if (response.data.success) {
                await fetchEducation(); // Refresh the list
                return { 
                    success: true, 
                    message: response.data.message || 'Education record deleted successfully' 
                };
            } else {
                return { 
                    success: false, 
                    message: response.data.message || 'Failed to delete education record'
                };
            }
        } catch (err) {
            console.error('Error deleting education:', err);
            return { 
                success: false, 
                message: err.response?.data?.message || 'Failed to delete education record'
            };
        } finally {
            setLoading(false);
        }
    };

    // Handle form submission
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        // Basic validation
        if (!formData.degree_name.trim()) {
            setError('Degree name is required');
            return;
        }
        if (!formData.institution_name.trim()) {
            setError('Institution name is required');
            return;
        }
        if (!formData.year_of_completion) {
            setError('Year of completion is required');
            return;
        }
        if (!formData.certificate_id.trim()) {
            setError('Certificate ID is required');
            return;
        }

        setError(null);
        
        let result;
        if (editingEducation) {
            result = await handleUpdateEducation(formData);
        } else {
            result = await handleCreateEducation(formData);
        }

        if (result.success) {
            console.log('✅ Success:', result.message);
            // You can show a success toast here
        } else {
            console.log('❌ Error:', result.errors);
            if (result.errors.general) {
                setError(result.errors.general);
            } else {
                // Handle field-specific errors
                const errorMessages = Object.entries(result.errors)
                    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                    .join('\n');
                setError(errorMessages);
            }
        }
    };

    // Load education records on component mount
    useEffect(() => {
        fetchEducation();
    }, [fetchEducation]);

    return (
        <div className="doctor-education-container">
            <div className="header">
                <h2>Education Records</h2>
                <button 
                    onClick={() => setShowForm(true)}
                    disabled={loading}
                    className="add-btn"
                >
                    Add Education
                </button>
            </div>

            {loading && <div className="loading">Loading...</div>}
            {error && <div className="error">Error: {error}</div>}
            
            {/* Education Form */}
            {showForm && (
                <div className="form-container">
                    <h3>{editingEducation ? 'Edit Education' : 'Add New Education'}</h3>
                    <form onSubmit={handleFormSubmit}>
                        <div className="form-group">
                            <label>Degree Name *</label>
                            <input
                                type="text"
                                name="degree_name"
                                value={formData.degree_name}
                                onChange={handleInputChange}
                                required
                                maxLength="100"
                                placeholder="e.g., MBBS, MD, PhD"
                            />
                        </div>

                        <div className="form-group">
                            <label>Institution Name *</label>
                            <input
                                type="text"
                                name="institution_name"
                                value={formData.institution_name}
                                onChange={handleInputChange}
                                required
                                maxLength="255"
                                placeholder="e.g., Harvard Medical School"
                            />
                        </div>

                        <div className="form-group">
                            <label>Year of Completion *</label>
                            <input
                                type="number"
                                name="year_of_completion"
                                value={formData.year_of_completion}
                                onChange={handleInputChange}
                                required
                                min="1900"
                                max={new Date().getFullYear()}
                                placeholder="e.g., 2020"
                            />
                        </div>

                        <div className="form-group">
                            <label>Certificate ID *</label>
                            <input
                                type="text"
                                name="certificate_id"
                                value={formData.certificate_id}
                                onChange={handleInputChange}
                                required
                                maxLength="100"
                                placeholder="Certificate or Registration ID"
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" disabled={loading}>
                                {loading ? 'Saving...' : (editingEducation ? 'Update' : 'Create')}
                            </button>
                            <button type="button" onClick={resetForm}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            {/* Education List */}
            <div className="education-list">
                {educationList.length === 0 ? (
                    <p>No education records found. Add your first education record!</p>
                ) : (
                    educationList.map(education => (
                        <div key={education.id} className="education-card">
                            <div className="education-info">
                                <h3>{education.degree_name}</h3>
                                <p><strong>Institution:</strong> {education.institution_name}</p>
                                <p><strong>Year:</strong> {education.year_of_completion}</p>
                                <p><strong>Certificate ID:</strong> {education.certificate_id}</p>
                                <p><small><strong>ID:</strong> {education.id}</small></p>
                            </div>
                            
                            <div className="education-actions">
                                <button 
                                    onClick={() => startEdit(education)}
                                    disabled={loading}
                                    className="edit-btn"
                                >
                                    Edit
                                </button>
                                <button 
                                    onClick={() => handleDeleteEducation(education.id)}
                                    disabled={loading}
                                    className="delete-btn"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="navigation-buttons">
                <Button variant="outline" onClick={handleBack} className="bg-gray-200 text-gray-700">
                    Back
                </Button>
                <Button onClick={handleNext} className="bg-blue-900 hover:bg-blue-800">
                    Next
                </Button>
            </div>

            <style >{`
                .doctor-education-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .form-container {
                    background: #f9f9f9;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }

                .form-group {
                    margin-bottom: 15px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }

                .form-group input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }

                .form-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
                }

                .form-actions button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .form-actions button[type="submit"] {
                    background: #007bff;
                    color: white;
                }

                .form-actions button[type="button"] {
                    background: #6c757d;
                    color: white;
                }

                .education-card {
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .education-info h3 {
                    margin: 0 0 10px 0;
                    color: #333;
                }

                .education-info p {
                    margin: 5px 0;
                    color: #666;
                }

                .education-info small {
                    color: #999;
                    font-size: 11px;
                }

                .education-actions {
                    display: flex;
                    gap: 10px;
                    flex-shrink: 0;
                }

                .edit-btn, .delete-btn, .add-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }

                .add-btn, .edit-btn {
                    background: #28a745;
                    color: white;
                }

                .delete-btn {
                    background: #dc3545;
                    color: white;
                }

                .navigation-buttons {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                }

                .loading {
                    text-align: center;
                    padding: 20px;
                    color: #666;
                }

                .error {
                    background: #f8d7da;
                    color: #721c24;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    white-space: pre-line;
                }

                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                @media (max-width: 600px) {
                    .education-card {
                        flex-direction: column;
                        gap: 15px;
                    }
                    
                    .education-actions {
                        align-self: stretch;
                    }
                }
            `}</style>
        </div>
    );
};

export default DoctorEducationComponent;