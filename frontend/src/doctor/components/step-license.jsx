"use client"

import { useState, useEffect } from "react"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { Label } from "../../components/ui/Label"
import { Upload, X, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { getDoctorLicense, createDoctorLicense, 
    updateDoctorLicense, 
    createLicenseFormData } from "../../endpoints/Doc" 

export default function StepLicense() {
    const navigate = useNavigate()
    
    // Form state
    const [formData, setFormData] = useState({
        medical_license_number: '',
        license_doc_id: '',
        license_proof_image: null,
        id_proof: null
    })
    
    // UI state
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [existingRecord, setExistingRecord] = useState(null)
    const [errors, setErrors] = useState({})
    const [uploadStatus, setUploadStatus] = useState({
        license_proof_image: null,
        id_proof: null
    })

    // Load existing data on component mount
    useEffect(() => {
        loadExistingData()
    }, [])

    const loadExistingData = async () => {
        try {
            setInitialLoading(true)
            const response = await getDoctorLicense()
            
            if (response.data.success && response.data.data) {
                // Handle case where data might be an array
                const data = Array.isArray(response.data.data) ? response.data.data[0] : response.data.data
                
                if (data) {
                    console.log("📋 Fetched license data:", data) // Added debug log
                    setExistingRecord(data)
                    setFormData({
                        medical_license_number: data.medical_license_number || '',
                        license_doc_id: data.license_doc_id || '',
                        license_proof_image: null, // Files handled separately
                        id_proof: null
                    })
                    
                    // Set upload status for existing files
                    setUploadStatus({
                        license_proof_image: data.has_license_image ? 'existing' : null,
                        id_proof: data.has_id_proof ? 'existing' : null
                    })
                }
            } else {
                console.log("📋 No existing license data found") // Added debug log
            }
        } catch (error) {
            console.error('Error loading license data:', error)
            // Don't block the form if loading fails
        } finally {
            setInitialLoading(false)
        }
    }

    // Updated handleInputChange to match certification pattern
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
        
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: null
            }))
        }
    }

    const handleFileUpload = (field, file) => {
        if (!file) return

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            setErrors(prev => ({
                ...prev,
                [field]: 'File size must be less than 10MB'
            }))
            return
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
        if (!allowedTypes.includes(file.type)) {
            setErrors(prev => ({
                ...prev,
                [field]: 'Only PDF, JPG, and PNG files are allowed'
            }))
            return
        }

        setFormData(prev => ({
            ...prev,
            [field]: file
        }))

        setUploadStatus(prev => ({
            ...prev,
            [field]: 'selected'
        }))

        // Clear error
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: null
            }))
        }
    }

    const removeFile = (field) => {
        setFormData(prev => ({
            ...prev,
            [field]: null
        }))
        setUploadStatus(prev => ({
            ...prev,
            [field]: existingRecord && existingRecord[`has_${field === 'license_proof_image' ? 'license_image' : 'id_proof'}`] ? 'existing' : null
        }))
    }

    const validateForm = () => {
        const newErrors = {}

        if (!formData.medical_license_number.trim()) {
            newErrors.medical_license_number = 'Medical license number is required'
        }

        if (!formData.license_doc_id.trim()) {
            newErrors.license_doc_id = 'License document ID is required'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validateForm()) return

        try {
            setLoading(true)
            
            let response
            const hasFiles = formData.license_proof_image || formData.id_proof
            
            if (hasFiles) {
                // Use FormData for file uploads
                const formDataObj = createLicenseFormData(formData)
                
                if (existingRecord) {
                    response = await updateDoctorLicense(formDataObj)
                } else {
                    response = await createDoctorLicense(formDataObj)
                }
            } else {
                // Use JSON for text-only updates
                const jsonData = {
                    medical_license_number: formData.medical_license_number,
                    license_doc_id: formData.license_doc_id
                }
                
                if (existingRecord) {
                    response = await updateDoctorLicense(jsonData)
                } else {
                    response = await createDoctorLicense(jsonData)
                }
            }

            if (response.data.success) {
                console.log("✅ License data saved successfully:", response.data) // Added success log
                alert("License information saved successfully!")
                
                // Reload the data to show updated information
                await loadExistingData()
                
                navigate("/doctor/verification", { state: { submitted: true } })
            } else {
                console.log("❌ License save failed:", response.data) // Added failure log
                // Handle field errors
                if (response.data.field_errors) {
                    setErrors(response.data.field_errors)
                } else {
                    alert(response.data.message || "Failed to save license information")
                }
            }
        } catch (error) {
            console.error('Error submitting license:', error)
            alert("An error occurred while saving. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleBack = () => {
        navigate("../certification")
    }

    const FileUploadArea = ({ field, label, currentFile, hasExisting, existingUrl }) => {
        const triggerFileInput = () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.pdf,.jpg,.jpeg,.png'
            input.onchange = (e) => handleFileUpload(field, e.target.files[0])
            input.click()
        }

        return (
            <div>
                <Label>{label}</Label>
                {uploadStatus[field] === 'selected' || currentFile ? (
                    <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <FileText className="w-5 h-5 text-green-600" />
                                <span className="text-sm text-green-800">
                                    {currentFile ? currentFile.name : 'File selected'}
                                </span>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(field)}
                                className="text-red-600 hover:text-red-800"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ) : uploadStatus[field] === 'existing' && hasExisting ? (
                    <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span className="text-sm text-blue-800">Current file uploaded</span>
                                <CheckCircle className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex space-x-2">
                                {existingUrl && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(existingUrl, '_blank')}
                                        className="text-blue-600"
                                    >
                                        View
                                    </Button>
                                )}
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-blue-600" 
                                    type="button"
                                    onClick={triggerFileInput}
                                >
                                    Replace
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 mb-2">Drag and drop your file here, or</p>
                        <Button 
                            variant="outline" 
                            className="bg-white text-gray-700" 
                            type="button"
                            onClick={triggerFileInput}
                        >
                            browse to upload
                        </Button>
                        <p className="text-xs text-gray-400 mt-2">Supported: PDF, JPG, PNG (Max 10MB)</p>
                    </div>
                )}
                {errors[field] && (
                    <div className="flex items-center space-x-1 mt-2 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{errors[field]}</span>
                    </div>
                )}
            </div>
        )
    }

    // Debug: Log current form data
    console.log('Current formData:', formData)
    console.log('Existing record:', existingRecord)
    console.log('Initial loading:', initialLoading)

    if (initialLoading) {
        return (
            <div className="flex justify-center items-center py-8">
                <div className="text-gray-600">Loading license information...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <Label htmlFor="medical_license_number">Medical License Number</Label>
                <Input 
                    id="medical_license_number"
                    type="text"
                    value={formData.medical_license_number}
                    onChange={(e) => handleInputChange('medical_license_number', e.target.value)}
                    placeholder="Enter your medical license number"
                    className={errors.medical_license_number ? 'border-red-500' : ''}
                    disabled={loading}
                />
                {errors.medical_license_number && (
                    <div className="flex items-center space-x-1 mt-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{errors.medical_license_number}</span>
                    </div>
                )}
            </div>

            <div>
                <Label htmlFor="license_doc_id">License Document ID</Label>
                <Input 
                    id="license_doc_id"
                    type="text"
                    value={formData.license_doc_id}
                    onChange={(e) => handleInputChange('license_doc_id', e.target.value)}
                    placeholder="Enter your license document ID"
                    className={errors.license_doc_id ? 'border-red-500' : ''}
                    disabled={loading}
                />
                {errors.license_doc_id && (
                    <div className="flex items-center space-x-1 mt-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{errors.license_doc_id}</span>
                    </div>
                )}
            </div>

            <FileUploadArea
                field="license_proof_image"
                label="License Document"
                currentFile={formData.license_proof_image}
                hasExisting={existingRecord?.has_license_image}
                existingUrl={existingRecord?.license_image_url}
            />

            <FileUploadArea
                field="id_proof"
                label="ID Proof"
                currentFile={formData.id_proof}
                hasExisting={existingRecord?.has_id_proof}
                existingUrl={existingRecord?.id_proof_url}
            />

            <div className="flex justify-between">
                <Button 
                    variant="outline" 
                    onClick={handleBack} 
                    className="bg-gray-200 text-gray-700"
                    disabled={loading}
                >
                    Back
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    className="bg-blue-900 hover:bg-blue-800"
                    disabled={loading}
                >
                    {loading ? 'Saving...' : existingRecord ? 'Update License' : 'Submit Registration'}
                </Button>
            </div>
        </div>
    )
}