"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Button from "../../components/ui/Button"
import { Stethoscope, Clock, AlertCircle, CheckCircle, FileText, User } from "lucide-react"
import { getAuthState } from "../../utils/auth" 
import DocHeader from "../../components/ui/DocHeader"

export default function PreVerificationView() {
    const navigate = useNavigate()
    const [authData, setAuthData] = useState(null)
    const [verificationStatus, setVerificationStatus] = useState('incomplete')
    const [doctorName, setDoctorName] = useState('')
    const [rejectionReasons, setRejectionReasons] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const auth = getAuthState()
        if (!auth || auth.userType !== 'doctor') {
            navigate('/login')
            return
        }
        
        setAuthData(auth)
        setDoctorName(auth.user?.name || auth.user?.first_name || 'Doctor')
        
        // Get verification status from user data
        const status = auth.user?.verification_status || auth.user?.status || 'incomplete'
        setVerificationStatus(status)
        
        // If rejected, get rejection reasons
        if (status === 'rejected') {
            setRejectionReasons(auth.user?.rejection_reasons || [
                "Medical license document needs to be clearer",
                "Board certification requires additional verification"
            ])
        }
        
        setLoading(false)
    }, [navigate])

    const handleCompleteRegistration = () => {
        // Navigate to the step-by-step registration process
        navigate('/doctor-registration')
    }

    const handleUpdateDocuments = () => {
        // For rejected status, allow updating documents
        navigate('/doctor-registration')
    }

    const handleCheckStatus = async () => {
        // API call to refresh verification status
        try {
            // const response = await checkVerificationStatus()
            // Update status based on response
            console.log("Checking verification status...")
            // For demo purposes, you can simulate status change
        } catch (error) {
            console.error("Error checking status:", error)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    // Render based on verification status
    const renderContent = () => {
        switch (verificationStatus) {
            case 'incomplete':
            case 'pending_documents':
                return (
                    <>
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Stethoscope className="w-10 h-10 text-blue-900" />
                        </div>
                        <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">WELCOME TO WELLCARE</p>
                        <h1 className="text-3xl font-bold text-blue-900 mb-4">Welcome, Dr. {doctorName}</h1>
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            We're excited to have you on board. Complete your registration to start providing quality care.
                        </p>
                        <Button
                            onClick={handleCompleteRegistration}
                            className="bg-blue-900 hover:bg-blue-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                        >
                            <FileText className="w-5 h-5 mr-2" />
                            Complete Your Registration
                        </Button>
                    </>
                )

            case 'pending_approval':
            case 'under_review':
                return (
                    <>
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Clock className="w-10 h-10 text-amber-600" />
                        </div>
                        <p className="text-sm text-amber-600 uppercase tracking-wide mb-2">UNDER REVIEW</p>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Hi, Dr. {doctorName}</h1>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                            ✅ Registration completed successfully!<br />
                            Your documents are currently being reviewed by our medical verification team.
                        </p>
                        
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-left">
                            <h3 className="font-semibold text-amber-800 mb-2">What's Next?</h3>
                            <ul className="text-amber-700 text-sm space-y-1">
                                <li>• Document verification in progress</li>
                                <li>• Email notification upon approval</li>
                                <li>• Estimated time: 2-3 business days</li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <Button
                                onClick={handleCheckStatus}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors w-full"
                            >
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Check Status
                            </Button>
                            <Button
                                onClick={handleUpdateDocuments}
                                variant="outline"
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3 rounded-lg font-semibold transition-colors w-full"
                            >
                                <FileText className="w-5 h-5 mr-2" />
                                Update Documents
                            </Button>
                        </div>
                    </>
                )

            case 'rejected':
                return (
                    <>
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <p className="text-sm text-red-600 uppercase tracking-wide mb-2">ACTION REQUIRED</p>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Hi, Dr. {doctorName}</h1>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                            We need additional information to complete your verification process.
                        </p>
                        
                        {rejectionReasons.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-left">
                                <h3 className="font-semibold text-red-800 mb-3">Issues to Address:</h3>
                                <ul className="space-y-2">
                                    {rejectionReasons.map((reason, index) => (
                                        <li key={index} className="text-red-700 flex items-start text-sm">
                                            <span className="text-red-500 mr-2 mt-0.5">•</span>
                                            {reason}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <Button
                            onClick={handleUpdateDocuments}
                            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                        >
                            <FileText className="w-5 h-5 mr-2" />
                            Update Verification Documents
                        </Button>
                    </>
                )

            case 'approved':
            case 'verified':
                return (
                    <>
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <p className="text-sm text-green-600 uppercase tracking-wide mb-2">VERIFIED</p>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome, Dr. {doctorName}</h1>
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            🎉 Congratulations! Your verification is complete.<br />
                            You can now access your dashboard and start providing care.
                        </p>
                        <Button
                            onClick={() => navigate('/doctor/dashboard')}
                            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                        >
                            <User className="w-5 h-5 mr-2" />
                            Go to Dashboard
                        </Button>
                    </>
                )

            default:
                return (
                    <>
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-10 h-10 text-gray-600" />
                        </div>
                        <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">STATUS UNKNOWN</p>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Hi, Dr. {doctorName}</h1>
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            We're having trouble determining your verification status. Please try again.
                        </p>
                        <Button
                            onClick={handleCompleteRegistration}
                            className="bg-blue-900 hover:bg-blue-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                        >
                            <FileText className="w-5 h-5 mr-2" />
                            Start Verification Process
                        </Button>
                    </>
                )
        }
    }

    return (
        <>
            <DocHeader/>
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="mb-8">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </>
    )
}