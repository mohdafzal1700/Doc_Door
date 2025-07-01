"use client"
import React, { useState, useEffect } from "react"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { Label } from "../../components/ui/Label"
import { Plus, Upload, X, Edit2, Save, AlertCircle, Eye } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { getDoctorCertification,createDoctorCertification, 
    updateDoctorCertification, 
    deleteDoctorCertification  } from "../../endpoints/Doc"

export default function PortalCertification() {
    const navigate = useNavigate()
    
    // State management
    const [certifications, setCertifications] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [editingId, setEditingId] = useState(null)
    const [showImageModal, setShowImageModal] = useState(false)
    const [modalImageUrl, setModalImageUrl] = useState("")
    
    // Form state for new certification
    const [newCertification, setNewCertification] = useState({
        certification_name: "",
        issued_by: "",
        year_of_issue: "",
        certification_certificate_id: "",
        certificate_image: null
    })
    
    // Form state for editing
    const [editForm, setEditForm] = useState({})
    
    // File input refs
    const [fileInputRefs, setFileInputRefs] = useState({})

    // Load existing certifications on component mount
    useEffect(() => {
        fetchCertifications()
    }, [])

    const fetchCertifications = async () => {
        try {
            setIsLoading(true)
            const response = await getDoctorCertification()
            if (response.data.success) {
                console.log("📋 Fetched certifications:", response.data.data) // Debug log
                setCertifications(response.data.data)
            }
        } catch (error) {
            console.error("Error fetching certifications:", error)
            setError("Failed to load certifications")
        } finally {
            setIsLoading(false)
        }
    }

    const handleInputChange = (field, value) => {
        setNewCertification(prev => ({
            ...prev,
            [field]: value
        }))
        // Clear error when user starts typing
        if (error) setError("")
    }

    const handleEditInputChange = (field, value) => {
        setEditForm(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const handleFileChange = (e, isEdit = false, certId = null) => {
        const file = e.target.files[0]
        if (file) {
            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError("File size must be less than 5MB")
                return
            }
            
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
            if (!allowedTypes.includes(file.type)) {
                setError("Only JPG and PNG files are allowed")
                return
            }
            
            if (isEdit) {
                setEditForm(prev => ({
                    ...prev,
                    certificate_image: file
                }))
            } else {
                setNewCertification(prev => ({
                    ...prev,
                    certificate_image: file
                }))
            }
            setError("")
        }
    }

    const validateForm = (data) => {
        if (!data.certification_name?.trim()) {
            setError("Certification name is required")
            return false
        }
        if (!data.issued_by?.trim()) {
            setError("Issuing organization is required")
            return false
        }
        if (!data.year_of_issue) {
            setError("Year of issue is required")
            return false
        }
        if (!data.certification_certificate_id?.trim()) {
            setError("Certificate ID is required")
            return false
        }
        
        const currentYear = new Date().getFullYear()
        const year = parseInt(data.year_of_issue)
        if (year > currentYear || year < 1900) {
            setError("Please enter a valid year")
            return false
        }
        
        return true
    }

    const handleAddCertification = async () => {
        if (!validateForm(newCertification)) return
        
        try {
            setIsLoading(true)
            
            // Prepare data - use FormData if there's an image, otherwise JSON
            let dataToSend
            if (newCertification.certificate_image) {
                dataToSend = new FormData()
                dataToSend.append('certification_name', newCertification.certification_name.trim())
                dataToSend.append('issued_by', newCertification.issued_by.trim())
                dataToSend.append('year_of_issue', newCertification.year_of_issue)
                dataToSend.append('certification_certificate_id', newCertification.certification_certificate_id.trim())
                dataToSend.append('certificate_image', newCertification.certificate_image)
            } else {
                dataToSend = {
                    certification_name: newCertification.certification_name.trim(),
                    issued_by: newCertification.issued_by.trim(),
                    year_of_issue: parseInt(newCertification.year_of_issue),
                    certification_certificate_id: newCertification.certification_certificate_id.trim()
                }
            }
            
            const response = await createDoctorCertification(dataToSend)
            
            if (response.data.success) {
                // Reset form
                setNewCertification({
                    certification_name: "",
                    issued_by: "",
                    year_of_issue: "",
                    certification_certificate_id: "",
                    certificate_image: null
                })
                
                // Refresh certifications list
                await fetchCertifications()
                setError("")
            }
        } catch (error) {
            console.error("Error adding certification:", error)
            setError(error.response?.data?.message || "Failed to add certification")
        } finally {
            setIsLoading(false)
        }
    }

    const handleEditCertification = (certification) => {
        setEditingId(certification.id)
        setEditForm({
            id: certification.id,
            certification_name: certification.certification_name,
            issued_by: certification.issued_by,
            year_of_issue: certification.year_of_issue.toString(),
            certification_certificate_id: certification.certification_certificate_id,
            certificate_image: null // Will be set if user uploads new image
        })
    }

    const handleUpdateCertification = async () => {
        if (!validateForm(editForm)) return
        
        try {
            setIsLoading(true)
            
            // Prepare data - use FormData if there's a new image, otherwise JSON
            let dataToSend
            if (editForm.certificate_image) {
                dataToSend = new FormData()
                dataToSend.append('id', editForm.id)
                dataToSend.append('certification_name', editForm.certification_name.trim())
                dataToSend.append('issued_by', editForm.issued_by.trim())
                dataToSend.append('year_of_issue', editForm.year_of_issue)
                dataToSend.append('certification_certificate_id', editForm.certification_certificate_id.trim())
                dataToSend.append('certificate_image', editForm.certificate_image)
            } else {
                dataToSend = {
                    id: editForm.id,
                    certification_name: editForm.certification_name.trim(),
                    issued_by: editForm.issued_by.trim(),
                    year_of_issue: parseInt(editForm.year_of_issue),
                    certification_certificate_id: editForm.certification_certificate_id.trim()
                }
            }
            
            const response = await updateDoctorCertification(dataToSend)
            
            if (response.data.success) {
                setEditingId(null)
                setEditForm({})
                await fetchCertifications()
                setError("")
            }
        } catch (error) {
            console.error("Error updating certification:", error)
            setError(error.response?.data?.message || "Failed to update certification")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteCertification = async (certificationId) => {
        if (!window.confirm("Are you sure you want to delete this certification?")) return
        
        try {
            setIsLoading(true)
            const response = await deleteDoctorCertification(certificationId)
            
            if (response.data.success) {
                await fetchCertifications()
                setError("")
            }
        } catch (error) {
            console.error("Error deleting certification:", error)
            setError(error.response?.data?.message || "Failed to delete certification")
        } finally {
            setIsLoading(false)
        }
    }

    const handleNext = async () => {
        // Check if at least one certification exists
        if (certifications.length === 0) {
            setError("Please add at least one certification before proceeding")
            return
        }
        navigate("../license")
    }

    const handleBack = () => {
        navigate("../education")
    }

    const triggerFileInput = (inputId) => {
        document.getElementById(inputId).click()
    }

    // Function to open image modal
    const openImageModal = (imageUrl) => {
        setModalImageUrl(imageUrl)
        setShowImageModal(true)
    }

    // Function to get preview image for new upload
    const getNewImagePreview = () => {
        if (newCertification.certificate_image) {
            return URL.createObjectURL(newCertification.certificate_image)
        }
        return null
    }

    // Function to get preview image for edit form
    const getEditImagePreview = () => {
        if (editForm.certificate_image) {
            return URL.createObjectURL(editForm.certificate_image)
        }
        return null
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {/* Image Modal */}
            {showImageModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowImageModal(false)}>
                    <div className="bg-white p-4 rounded-lg max-w-3xl max-h-[90vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Certificate Image</h3>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowImageModal(false)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <img 
                            src={modalImageUrl} 
                            alt="Certificate"
                            className="max-w-full h-auto rounded"
                        />
                    </div>
                </div>
            )}

            {/* Existing Certifications */}
            {certifications.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Your Certifications</h3>
                    {certifications.map((cert, index) => (
                        <div key={cert.id} className="border rounded-lg p-4 bg-gray-50">
                            {editingId === cert.id ? (
                                // Edit mode
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium">Edit Certification {index + 1}</h4>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEditingId(null)}
                                            className="text-gray-600"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Certification Name</Label>
                                            <Input
                                                value={editForm.certification_name}
                                                onChange={(e) => handleEditInputChange('certification_name', e.target.value)}
                                                placeholder="Enter certification name"
                                            />
                                        </div>
                                        <div>
                                            <Label>Issued By</Label>
                                            <Input
                                                value={editForm.issued_by}
                                                onChange={(e) => handleEditInputChange('issued_by', e.target.value)}
                                                placeholder="Enter issuing organization"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Year of Issue</Label>
                                            <Input
                                                type="number"
                                                value={editForm.year_of_issue}
                                                onChange={(e) => handleEditInputChange('year_of_issue', e.target.value)}
                                                placeholder="Enter year of issue"
                                            />
                                        </div>
                                        <div>
                                            <Label>Certificate ID</Label>
                                            <Input
                                                value={editForm.certification_certificate_id}
                                                onChange={(e) => handleEditInputChange('certification_certificate_id', e.target.value)}
                                                placeholder="Enter certificate id"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <Label>Certificate Image</Label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                                            <p className="text-gray-500 mb-2">
                                                {editForm.certificate_image ? editForm.certificate_image.name : "Upload new certificate image (optional)"}
                                            </p>
                                            
                                            {/* Show preview of new image being uploaded */}
                                            {getEditImagePreview() && (
                                                <div className="mt-2 mb-2">
                                                    <img 
                                                        src={getEditImagePreview()} 
                                                        alt="New certificate preview"
                                                        className="max-w-xs mx-auto rounded border"
                                                    />
                                                </div>
                                            )}
                                            
                                            <input
                                                type="file"
                                                id={`edit-file-${cert.id}`}
                                                className="hidden"
                                                accept="image/jpeg,image/jpg,image/png"
                                                onChange={(e) => handleFileChange(e, true, cert.id)}
                                            />
                                            <Button
                                                variant="outline"
                                                type="button"
                                                onClick={() => triggerFileInput(`edit-file-${cert.id}`)}
                                                className="bg-white text-gray-700"
                                            >
                                                Choose file
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <Button
                                        onClick={handleUpdateCertification}
                                        disabled={isLoading}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {isLoading ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            ) : (
                                // View mode
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium">Certification {index + 1}</h4>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEditCertification(cert)}
                                                className="text-blue-600"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteCertification(cert.id)}
                                                className="text-red-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600">Name:</span>
                                            <p className="font-medium">{cert.certification_name}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Issued By:</span>
                                            <p className="font-medium">{cert.issued_by}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Year:</span>
                                            <p className="font-medium">{cert.year_of_issue}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Certificate ID:</span>
                                            <p className="font-medium">{cert.certification_certificate_id}</p>
                                        </div>
                                    </div>
                                    
                                    {/* UPDATED: Certificate Image Display */}
                                    {cert.certificate_image_url && (
                                        <div className="mt-3">
                                            <span className="text-gray-600 text-sm">Certificate Image:</span>
                                            <div className="mt-1 flex items-center gap-2">
                                                <img 
                                                    src={cert.certificate_image_url} 
                                                    alt="Certificate"
                                                    className="max-w-32 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                                    onClick={() => openImageModal(cert.certificate_image_url)}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openImageModal(cert.certificate_image_url)}
                                                    className="text-blue-600"
                                                >
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    View Full Size
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Show message if no image */}
                                    {!cert.certificate_image_url && (
                                        <div className="mt-3">
                                            <span className="text-gray-500 text-sm italic">No certificate image uploaded</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add New Certification Form */}
            <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">
                    {certifications.length === 0 ? "Add Your First Certification" : "Add Another Certification"}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="certificationName">Certification Name</Label>
                        <Input
                            id="certificationName"
                            value={newCertification.certification_name}
                            onChange={(e) => handleInputChange('certification_name', e.target.value)}
                            placeholder="Enter certification name"
                        />
                    </div>
                    <div>
                        <Label htmlFor="issuedBy">Issued By</Label>
                        <Input
                            id="issuedBy"
                            value={newCertification.issued_by}
                            onChange={(e) => handleInputChange('issued_by', e.target.value)}
                            placeholder="Enter issuing organization"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="yearIssue">Year of Issue</Label>
                        <Input
                            id="yearIssue"
                            type="number"
                            value={newCertification.year_of_issue}
                            onChange={(e) => handleInputChange('year_of_issue', e.target.value)}
                            placeholder="Enter year of issue"
                        />
                    </div>
                    <div>
                        <Label htmlFor="certId">Certificate ID</Label>
                        <Input
                            id="certId"
                            value={newCertification.certification_certificate_id}
                            onChange={(e) => handleInputChange('certification_certificate_id', e.target.value)}
                            placeholder="Enter certificate id"
                        />
                    </div>
                </div>

                <div>
                    <Label>Certificate Image (Optional)</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 mb-2">
                            {newCertification.certificate_image ? 
                                newCertification.certificate_image.name : 
                                "Upload your certificate image"
                            }
                        </p>
                        
                        {/* Show preview of selected image */}
                        {getNewImagePreview() && (
                            <div className="mt-2 mb-2">
                                <img 
                                    src={getNewImagePreview()} 
                                    alt="Certificate preview"
                                    className="max-w-xs mx-auto rounded border"
                                />
                            </div>
                        )}
                        
                        <input
                            type="file"
                            id="new-certificate-file"
                            className="hidden"
                            accept="image/jpeg,image/jpg,image/png"
                            onChange={(e) => handleFileChange(e)}
                        />
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => triggerFileInput('new-certificate-file')}
                            className="bg-white text-gray-700"
                        >
                            Choose file
                        </Button>
                        <p className="text-xs text-gray-400 mt-2">Supported formats: JPG, PNG (Max 5MB)</p>
                    </div>
                </div>

                <Button
                    onClick={handleAddCertification}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full border-dashed bg-white text-blue-900 border-blue-900"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {isLoading ? "Adding..." : "Add Certification"}
                </Button>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handleBack} className="bg-gray-200 text-gray-700">
                    Back
                </Button>
                <Button 
                    onClick={handleNext} 
                    className="bg-blue-900 hover:bg-blue-800"
                    disabled={isLoading}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}