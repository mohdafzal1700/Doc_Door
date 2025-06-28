import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Mail, Phone, User, MapPin, Edit, Lock, Calendar, Heart, Activity, RefreshCw } from 'lucide-react'
import Button from "../components/ui/Button"
import Header from "../components/home/Header"
import { useNavigate, useLocation } from "react-router-dom"
import { getUserProfile, getAddresses, handleApiError,uploadProfilePicture ,deleteProfilePicture } from "../endpoints/APIs"

const PatientProfile = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const [user, setUser] = useState(null)
    const [primaryAddress, setPrimaryAddress] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [refreshing, setRefreshing] = useState(false)



    


    // Enhanced fetch function that gets both profile and address data
    const fetchUserData = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            
            console.log('🔄 Fetching user profile and addresses...')
            
            // Fetch both profile and addresses in parallel
            const [profileResponse, addressesResponse] = await Promise.all([
                getUserProfile(),
                getAddresses().catch(err => {
                    console.warn('Address fetch failed:', err);
                    return { data: { success: false, data: { addresses: [] } } };
                })
            ]);
            
            console.log('📥 Profile response:', profileResponse.data)
            console.log('📥 Addresses response:', addressesResponse.data)
            
            if (profileResponse.data.success) {
                const userData = profileResponse.data.data;
                console.log('✅ Setting user data:', userData)
                setUser(userData);
                
                // Get primary address
                if (addressesResponse.data.success && addressesResponse.data.data?.addresses) {
                    const primary = addressesResponse.data.data.addresses.find(addr => addr.is_primary);
                    setPrimaryAddress(primary || null);
                    console.log('✅ Primary address:', primary);
                }
            } else {
                const errorInfo = handleApiError({ response: profileResponse });
                setError(errorInfo.message);
            }
        } catch (error) {
            console.error("❌ Error fetching user data:", error)
            const errorInfo = handleApiError(error);
            setError(errorInfo.message);
        } finally {
            setLoading(false)
        }
    }, [])

    // Manual refresh function
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchUserData();
        setRefreshing(false);
    }, [fetchUserData]);

    // Initial fetch on component mount
    useEffect(() => {
        fetchUserData()
    }, [fetchUserData])

    // Handle navigation state for refresh after edit
    useEffect(() => {
        if (location.state?.shouldRefresh || location.state?.success) {
            console.log('🔄 Refreshing profile after edit...')
            fetchUserData()
            // Clear the state to prevent unnecessary refetches
            navigate(location.pathname, { replace: true, state: {} })
        }
    }, [location.state, fetchUserData, navigate, location.pathname])

    // Handle window focus to refresh data when user returns to tab
    useEffect(() => {
        const handleFocus = () => {
            console.log('🔄 Window focused, refreshing profile...')
            fetchUserData()
        }

        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [fetchUserData])

    const handleBack = () => navigate("/patientportal")
    
    const handleEditProfile = () => {
        navigate('/editprofile', { state: { user, primaryAddress } })
    }

    const handleResetPassword = () => {
        navigate('/reset-password')
        console.log("Reset password clicked")
    }

    // Info Card Component
    const InfoCard = ({ icon: Icon, iconBg, label, value }) => (
        <div className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors">
            <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center mr-4`}>
                    <Icon size={18} className={iconBg.includes('purple') ? 'text-purple-600' : 
                                                iconBg.includes('blue') ? 'text-blue-600' : 
                                                iconBg.includes('red') ? 'text-red-600' : 'text-green-600'} />
                </div>
                <div className="flex-1">
                    <p className="text-sm text-gray-500 font-medium">{label}</p>
                    <p className="text-gray-900 font-semibold">{value}</p>
                </div>
            </div>
        </div>
    )

    // Section Header Component
    const SectionHeader = ({ icon: Icon, iconBg, title, action }) => (
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center mr-3`}>
                    <Icon size={18} className={iconBg.includes('purple') ? 'text-purple-600' : 
                                            iconBg.includes('green') ? 'text-green-600' : 'text-blue-600'} />
                </div>
                {title}
            </h2>
            {action}
        </div>
    )

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
                <Header />
                <div className="flex items-center justify-center py-20">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200"></div>
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-600 absolute top-0 left-0"></div>
                        <div className="mt-4 text-center">
                            <p className="text-gray-600 animate-pulse">Loading profile...</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
                <Header />
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center shadow-lg">
                        <h3 className="text-lg font-semibold text-red-800 mb-2">Oops! Something went wrong</h3>
                        <p className="text-red-600 mb-6">{error}</p>
                        <div className="flex gap-4 justify-center">
                            <Button 
                                onClick={handleRefresh} 
                                className="bg-red-600 hover:bg-red-700 max-w-xs"
                                disabled={refreshing}
                            >
                                <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                {refreshing ? 'Refreshing...' : 'Try Again'}
                            </Button>
                            {error.includes('Session expired') && (
                                <Button 
                                    onClick={() => navigate('/login')} 
                                    className="bg-blue-600 hover:bg-blue-700 max-w-xs"
                                >
                                    Login
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // No user data
    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
                <Header />
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center shadow-lg">
                        <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Profile Found</h3>
                        <p className="text-yellow-600 mb-6">No profile data available</p>
                        <div className="flex gap-4 justify-center">
                            <Button 
                                onClick={handleRefresh} 
                                className="bg-yellow-600 hover:bg-yellow-700 max-w-xs"
                                disabled={refreshing}
                            >
                                <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                {refreshing ? 'Refreshing...' : 'Refresh'}
                            </Button>
                            <Button onClick={() => navigate('/login')} className="bg-blue-600 hover:bg-blue-700 max-w-xs">
                                Go to Login
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Use the full_name from backend or construct display name
    const displayName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'User'

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
            <Header />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Back Button */}
                <button 
                    onClick={handleBack}
                    className="flex items-center text-gray-600 hover:text-purple-600 mb-8 transition-all duration-200 group bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md"
                >
                    <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">Back to Dashboard</span>
                </button>

                {/* Success Message */}
                {location.state?.success && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                        <p className="text-green-800 font-medium">
                            {location.state.message || 'Profile updated successfully!'}
                        </p>
                    </div>
                )}

                {/* Profile Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Profile Header */}
                    <div className="relative bg-gradient-to-r from-purple-600 via-purple-500 to-blue-500 px-8 py-12">
                        <div className="absolute inset-0 bg-black opacity-10"></div>
                        <div className="relative flex flex-col items-center text-center">
                            {/* Avatar */}
                            <div className="relative mb-6">
                                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white ring-opacity-50">
                                    {user.profile_picture_url ? (
                                        <img 
                                            src={user.profile_picture_url} 
                                            alt="Profile" 
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <User className="w-16 h-16 text-purple-600" />
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                                </div>
                            </div>
                            
                            <h1 className="text-3xl font-bold text-white mb-3 drop-shadow-sm">{displayName}</h1>
                            
                            {/* Contact Info */}
                            <div className="flex flex-col sm:flex-row items-center gap-6 text-white text-opacity-90">
                                <div className="flex items-center bg-white bg-opacity-20 px-4 py-2 rounded-full">
                                    <Mail size={16} className="mr-2" />
                                    <span className="font-medium">{user.email || 'Not provided'}</span>
                                </div>
                                <div className="flex items-center bg-white bg-opacity-20 px-4 py-2 rounded-full">
                                    <Phone size={16} className="mr-2" />
                                    <span className="font-medium">{user.phone_number || 'Not provided'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Profile Details */}
                    <div className="p-8">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            {/* Personal Information */}
                            <div className="space-y-6">
                                <SectionHeader 
                                    icon={User} 
                                    iconBg="bg-purple-100" 
                                    title="Personal Information"
                                />
                                <div className="space-y-4">
                                    <InfoCard 
                                        icon={User} 
                                        iconBg="bg-purple-100" 
                                        label="Gender" 
                                        value={user.patient_gender || 'Not specified'} 
                                    />
                                    <InfoCard 
                                        icon={Calendar} 
                                        iconBg="bg-blue-100" 
                                        label="Age" 
                                        value={user.patient_age ? `${user.patient_age} years` : 'Not specified'} 
                                    />
                                    <InfoCard 
                                        icon={Heart} 
                                        iconBg="bg-red-100" 
                                        label="Blood Group" 
                                        value={user.patient_blood_group || 'Not specified'} 
                                    />
                                </div>
                            </div>

                            {/* Address Information */}
                            <div className="space-y-6">
                                <SectionHeader 
                                    icon={MapPin} 
                                    iconBg="bg-green-100" 
                                    title="Address Information"
                                />
                                <div className="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors">
                                    <div className="flex items-start">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-4 mt-1">
                                            <MapPin size={18} className="text-green-600" />
                                        </div>
                                        <div className="space-y-2 flex-1">
                                            <p className="text-sm text-gray-500 font-medium">Current Address</p>
                                            {primaryAddress ? (
                                                <div className="text-gray-900 space-y-2">
                                                    {primaryAddress.address_line_1 && <p className="font-medium">{primaryAddress.address_line_1}</p>}
                                                    {primaryAddress.street && <p className="text-gray-600">{primaryAddress.street}</p>}
                                                    <p className="font-medium">{[primaryAddress.city, primaryAddress.state].filter(Boolean).join(', ')}</p>
                                                    <p className="text-gray-600">{[primaryAddress.postal_code, primaryAddress.country].filter(Boolean).join(', ')}</p>
                                                </div>
                                            ) : (
                                                <p className="text-gray-600">Address not provided</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Account Information */}
                            <div className="space-y-6">
                                <SectionHeader 
                                    icon={Activity} 
                                    iconBg="bg-blue-100" 
                                    title="Account Information"
                                    action={
                                        <button
                                            onClick={handleRefresh}
                                            disabled={refreshing}
                                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                            title="Refresh data"
                                        >
                                            <RefreshCw size={16} className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
                                        </button>
                                    }
                                />
                                <div className="space-y-4">
                                    <InfoCard 
                                        icon={Calendar} 
                                        iconBg="bg-blue-100" 
                                        label="Member Since" 
                                        value={user.member_since ? new Date(user.member_since).toLocaleDateString() : 'Not available'} 
                                    />
                                    <InfoCard 
                                        icon={Activity} 
                                        iconBg="bg-green-100" 
                                        label="Last Visit" 
                                        value={user.last_visit ? new Date(user.last_visit).toLocaleDateString() : 'No recent visits'} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6">
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Button 
                                onClick={handleEditProfile} 
                                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 hover:shadow-lg"
                            >
                                <Edit size={20} className="mr-2" />
                                Edit Profile
                            </Button>
                            <Button 
                                onClick={handleResetPassword} 
                                variant="outline" 
                                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white border-none transform hover:scale-105 hover:shadow-lg"
                            >
                                <Lock size={20} className="mr-2" />
                                Reset Password
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PatientProfile