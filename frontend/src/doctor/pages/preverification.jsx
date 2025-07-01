"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Button from "../../components/ui/Button"
import { Stethoscope, Clock, AlertCircle, CheckCircle, FileText, User, RefreshCw, XCircle } from "lucide-react"
import { getAuthState } from "../../utils/auth" 
import DocHeader from "../../components/ui/DocHeader"
import { checkVerificationStatus, refreshVerificationStatus } from "../../endpoints/Doc"

export default function PreVerificationView() {
    const navigate = useNavigate()
    const [authData, setAuthData] = useState(null)
    const [verificationStatus, setVerificationStatus] = useState('incomplete')
    const [doctorName, setDoctorName] = useState('')
    const [rejectionReasons, setRejectionReasons] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [verificationSteps, setVerificationSteps] = useState({
        is_profile_setup_done: false,
        is_education_done: false,
        is_certification_done: false,
        is_license_done: false
    })

    useEffect(() => {
        const auth = getAuthState()
        if (!auth || auth.userType !== 'doctor') {
            navigate('/login')
            return
        }
        
        setAuthData(auth)
        setDoctorName(auth.user?.name || auth.user?.first_name || 'Doctor')
        
        // Load verification status from API
        loadVerificationStatus()
    }, [navigate])

    const loadVerificationStatus = async () => {
        try {
            setLoading(true)
            const response = await checkVerificationStatus()
            
            if (response.data.success) {
                const data = response.data.data
                console.log("📋 Verification status data:", data)
                
                setVerificationStatus(data.verification_status)
                setVerificationSteps({
                    is_profile_setup_done: data.is_profile_setup_done,
                    is_education_done: data.is_education_done,
                    is_certification_done: data.is_certification_done,
                    is_license_done: data.is_license_done
                })
                
                if (data.verification_status === 'rejected') {
                    setRejectionReasons(data.rejection_reasons || [
                        "Medical license document needs to be clearer",
                        "Board certification requires additional verification"
                    ])
                }
            } else {
                console.error("Failed to load verification status:", response.data.message)
                // Fallback to auth data
                const status = authData?.user?.verification_status || authData?.user?.status || 'incomplete'
                setVerificationStatus(status)
            }
        } catch (error) {
            console.error('Error loading verification status:', error)
            // Fallback to auth data
            const auth = getAuthState()
            const status = auth?.user?.verification_status || auth?.user?.status || 'incomplete'
            setVerificationStatus(status)
        } finally {
            setLoading(false)
        }
    }

    const handleCompleteRegistration = () => {
        navigate('/doctor-registration')
    }

    const handleUpdateDocuments = () => {
        navigate('/doctor-registration')
    }

    const handleCheckStatus = async () => {
        try {
            setRefreshing(true)
            const response = await refreshVerificationStatus()
            
            if (response.data.success) {
                const data = response.data.data
                console.log("🔄 Refreshed verification status:", data)
                
                setVerificationStatus(data.verification_status)
                setVerificationSteps({
                    is_profile_setup_done: data.is_profile_setup_done,
                    is_education_done: data.is_education_done,
                    is_certification_done: data.is_certification_done,
                    is_license_done: data.is_license_done
                })
                
                // Show success message
                if (data.verification_status === 'pending_approval') {
                    alert("Great! All verification steps completed. Your application is now under review.")
                } else if (data.verification_status === 'approved') {
                    alert("Congratulations! Your verification has been approved. You can now access the doctor dashboard.")
                    navigate('/doctor-dashboard')
                } else {
                    alert("Status refreshed successfully!")
                }
            } else {
                alert("Failed to refresh status. Please try again.")
            }
        } catch (error) {
            console.error("Error refreshing status:", error)
            alert("An error occurred while checking status. Please try again.")
        } finally {
            setRefreshing(false)
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="w-6 h-6 text-green-500" />
            case 'pending_approval':
                return <Clock className="w-6 h-6 text-yellow-500" />
            case 'rejected':
                return <XCircle className="w-6 h-6 text-red-500" />
            default:
                return <AlertCircle className="w-6 h-6 text-gray-500" />
        }
    }

    const getStatusMessage = () => {
        switch (verificationStatus) {
            case 'approved':
                return {
                    title: "Verification Approved! 🎉",
                    message: "Your medical credentials have been verified successfully. You can now access all doctor features.",
                    color: "green"
                }
            case 'pending_approval':
                return {
                    title: "Under Review ⏳",
                    message: "Your application is being reviewed by our verification team. This typically takes 2-3 business days.",
                    color: "yellow"
                }
            case 'rejected':
                return {
                    title: "Additional Information Required ❌",
                    message: "Some documents need to be updated or resubmitted. Please review the feedback below.",
                    color: "red"
                }
            default:
                return {
                    title: "Complete Your Registration 📝",
                    message: "Please complete all required verification steps to proceed.",
                    color: "blue"
                }
        }
    }

    const getCompletionPercentage = () => {
        const steps = Object.values(verificationSteps)
        const completed = steps.filter(Boolean).length
        return Math.round((completed / steps.length) * 100)
    }

    const verificationStepsList = [
        {
            key: 'is_profile_setup_done',
            label: 'Personal Information',
            icon: <User className="w-5 h-5" />,
            description: 'Basic profile and contact details'
        },
        {
            key: 'is_education_done',
            label: 'Medical Education',
            icon: <FileText className="w-5 h-5" />,
            description: 'Medical degree and university information'
        },
        {
            key: 'is_certification_done',
            label: 'Board Certifications',
            icon: <CheckCircle className="w-5 h-5" />,
            description: 'Specialty certifications and board memberships'
        },
        {
            key: 'is_license_done',
            label: 'Medical License',
            icon: <Stethoscope className="w-5 h-5" />,
            description: 'Active medical license verification'
        }
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="text-gray-600">Loading verification status...</span>
                    </div>
                </div>
            </div>
        )
    }

    const statusInfo = getStatusMessage()
    const completionPercentage = getCompletionPercentage()

    return (
        <div className="min-h-screen bg-gray-50">
            <DocHeader />
            
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Welcome Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Welcome, Dr. {doctorName}
                    </h1>
                    <p className="text-gray-600">
                        Complete your verification to start practicing on our platform
                    </p>
                </div>

                {/* Status Card */}
                <div className={`bg-white rounded-lg shadow-md p-6 mb-8 border-l-4 ${
                    statusInfo.color === 'green' ? 'border-green-500' :
                    statusInfo.color === 'yellow' ? 'border-yellow-500' :
                    statusInfo.color === 'red' ? 'border-red-500' : 'border-blue-500'
                }`}>
                    <div className="flex items-start space-x-4">
                        {getStatusIcon(verificationStatus)}
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                {statusInfo.title}
                            </h2>
                            <p className="text-gray-600 mb-4">
                                {statusInfo.message}
                            </p>
                            
                            {/* Progress Bar */}
                            {verificationStatus === 'incomplete' && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                                        <span>Completion Progress</span>
                                        <span>{completionPercentage}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${completionPercentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Rejection Reasons (if rejected) */}
                {verificationStatus === 'rejected' && rejectionReasons.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
                        <h3 className="text-lg font-semibold text-red-800 mb-4">
                            Items Requiring Attention:
                        </h3>
                        <ul className="space-y-2">
                            {rejectionReasons.map((reason, index) => (
                                <li key={index} className="flex items-start space-x-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-red-700">{reason}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Verification Steps */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">
                        Verification Checklist
                    </h3>
                    <div className="grid gap-4">
                        {verificationStepsList.map((step) => {
                            const isCompleted = verificationSteps[step.key]
                            return (
                                <div 
                                    key={step.key}
                                    className={`flex items-center space-x-4 p-4 rounded-lg border-2 transition-all ${
                                        isCompleted 
                                            ? 'border-green-200 bg-green-50' 
                                            : 'border-gray-200 bg-gray-50'
                                    }`}
                                >
                                    <div className={`flex-shrink-0 ${
                                        isCompleted ? 'text-green-600' : 'text-gray-400'
                                    }`}>
                                        {step.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={`font-medium ${
                                            isCompleted ? 'text-green-800' : 'text-gray-700'
                                        }`}>
                                            {step.label}
                                        </h4>
                                        <p className={`text-sm ${
                                            isCompleted ? 'text-green-600' : 'text-gray-500'
                                        }`}>
                                            {step.description}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {isCompleted ? (
                                            <CheckCircle className="w-6 h-6 text-green-500" />
                                        ) : (
                                            <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    {verificationStatus === 'approved' ? (
                        <Button
                            onClick={() => navigate('/doctor-dashboard')}
                            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium"
                        >
                            Go to Dashboard
                        </Button>
                    ) : verificationStatus === 'pending_approval' ? (
                        <Button
                            onClick={handleCheckStatus}
                            disabled={refreshing}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium disabled:opacity-50"
                        >
                            {refreshing ? (
                                <div className="flex items-center space-x-2">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Checking...</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Check Status</span>
                                </div>
                            )}
                        </Button>
                    ) : (
                        <>
                            <Button
                                onClick={verificationStatus === 'rejected' ? handleUpdateDocuments : handleCompleteRegistration}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium"
                            >
                                {verificationStatus === 'rejected' ? 'Update Documents' : 'Complete Registration'}
                            </Button>
                            <Button
                                onClick={handleCheckStatus}
                                disabled={refreshing}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-medium disabled:opacity-50"
                            >
                                {refreshing ? (
                                    <div className="flex items-center space-x-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Refreshing...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <RefreshCw className="w-4 h-4" />
                                        <span>Refresh Status</span>
                                    </div>
                                )}
                            </Button>
                        </>
                    )}
                </div>

                {/* Help Text */}
                <div className="text-center mt-8">
                    <p className="text-sm text-gray-500">
                        Need help? Contact our support team at{' '}
                        <a href="mailto:support@yourplatform.com" className="text-blue-600 hover:underline">
                            support@yourplatform.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}