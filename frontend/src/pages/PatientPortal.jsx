// PatientPortal.jsx - Updated with proper routing paths
"use client"

import { useState, useEffect, useRef } from "react"
import { 
    Calendar, 
    FileText, 
    Clock, 
    CheckCircle, 
    CreditCard, 
    LogOut, 
    User, 
    ChevronRight,
    Loader2,
    Camera,
    Trash2,
    Upload
} from 'lucide-react'
import { useNavigate } from "react-router-dom"
import Header from "../components/home/Header"
import { 
    getUserProfile, 
    uploadProfilePicture, 
    deleteProfilePicture 
} from "../endpoints/APIs"
import { 
    isAuthenticated, 
    getStoredUserData, 
    clearAuthData, 
    setAuthData, 
    logoutUser,
    useAuthState 
} from "../utils/auth"

const PatientPortal = () => {
    const navigate = useNavigate()
    const fileInputRef = useRef(null)
    
    // Use the custom auth hook for consistent state management
    const authState = useAuthState()
    
    const [profileLoading, setProfileLoading] = useState(false)
    const [activeSection, setActiveSection] = useState("profile")
    const [authLoading, setAuthLoading] = useState(true)
    const [pictureUploading, setPictureUploading] = useState(false)
    const [pictureDeleting, setPictureDeleting] = useState(false)
    const [profilePicture, setProfilePicture] = useState(null)

    const sidebarItems = [
        {
            id: "profile",
            name: "My Profile",
            icon: User,
            active: activeSection === "profile",
            route: "/patient/profile" // Added route for navigation
        },
        {
            id: "appointments",
            name: "My Appointments",
            icon: Calendar,
            active: activeSection === "appointments",
            route: "/patient/appointments" // Added route for navigation
        },
        {
            id: "records",
            name: "Medical Records",
            icon: FileText,
            active: activeSection === "records",
            route: "/patient/doctorprofile" // Added route for navigation
        },
        {
            id: "upcoming",
            name: "Upcoming Appointments",
            icon: Clock,
            active: activeSection === "upcoming",
            route: "/patient/appointments/upcoming" // Added route for navigation
        },
        {
            id: "completed",
            name: "Completed Appointments",
            icon: CheckCircle,
            active: activeSection === "completed",
            route: "/patient/appointments/completed" // Added route for navigation
        },
        {
            id: "payments",
            name: "Payments",
            icon: CreditCard,
            active: activeSection === "payments",
            route: "/patient/payments" // Added route for navigation
        },
    ]

    // Check authentication status and fetch profile
    const checkAuthAndFetchProfile = async () => {
        console.log("🔍 PatientPortal: Checking authentication status...")
        setAuthLoading(true)
        
        try {
            const authenticated = await isAuthenticated()
            console.log("Auth status:", authenticated)
            
            if (authenticated && authState.isLoggedIn) {
                console.log("✅ PatientPortal: User is authenticated")
                // Fetch fresh profile data
                await fetchUserProfile()
            } else {
                console.log("❌ PatientPortal: Not authenticated, redirecting to login...")
                clearAuthData()
                navigate("/login")
            }
        } catch (error) {
            console.error("❌ PatientPortal: Auth check failed:", error)
            
            // If we have stored user data as fallback, use it
            if (authState.user && (authState.user.id || authState.user.user_id)) {
                console.log("🔄 PatientPortal: Using stored user data as fallback")
                setAuthLoading(false)
            } else {
                console.log("❌ PatientPortal: No valid user data, redirecting to login...")
                navigate("/login")
            }
        } finally {
            setAuthLoading(false)
        }
    }

    // Fetch user profile from API
    const fetchUserProfile = async () => {
        setProfileLoading(true)
        try {
            console.log("🔍 PatientPortal: Fetching user profile from API...")
            const response = await getUserProfile()
            
            if (response.data && response.data.data) {
                console.log("✅ PatientPortal: Profile fetched successfully:", response.data.data)
                
                // Update profile picture state with various possible field names
                const profileData = response.data.data
                const profilePictureUrl = profileData.profile_picture || 
                                        profileData.profile_picture_url || 
                                        profileData.image || 
                                        null
                
                if (profilePictureUrl) {
                    setProfilePicture(profilePictureUrl)
                    console.log("✅ Profile picture URL found:", profilePictureUrl)
                } else {
                    setProfilePicture(null)
                    console.log("ℹ️ No profile picture found in response")
                }
                
                // Update localStorage with fresh data (tokens remain unchanged)
                const currentTokens = {
                    access: localStorage.getItem("access_token"),
                    refresh: localStorage.getItem("refresh_token")
                }
                
                setAuthData(response.data.data, currentTokens, authState.userType || 'patient')
            }
        } catch (error) {
            console.error("❌ PatientPortal: Failed to fetch profile:", error)
            
            // If API call fails with 401/403, user is not authenticated
            if (error?.response?.status === 401 || error?.response?.status === 403) {
                console.log("❌ PatientPortal: Authentication failed, clearing data and redirecting...")
                clearAuthData()
                navigate("/login")
            } else {
                // For other errors, we can continue with stored data
                console.log("⚠️ PatientPortal: Profile fetch failed but continuing with stored data")
            }
        } finally {
            setProfileLoading(false)
        }
    }

    // Handle profile picture upload
    const handleProfilePictureUpload = async (event) => {
        const file = event.target.files[0]
        if (!file) return

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
            alert('Please select a valid image file (JPEG, PNG, or GIF)')
            return
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024 // 5MB in bytes
        if (file.size > maxSize) {
            alert('Please select an image smaller than 5MB')
            return
        }

        setPictureUploading(true)
        
        try {
            const formData = new FormData()
            formData.append('profile_picture', file)
            
            console.log("🔍 PatientPortal: Uploading profile picture...")
            const response = await uploadProfilePicture(formData)
            
            if (response.data) {
                console.log("✅ PatientPortal: Profile picture uploaded successfully", response.data)
                
                // Extract profile picture URL from response (check multiple possible field names)
                let newProfilePictureUrl = null
                
                if (response.data.profile_picture) {
                    newProfilePictureUrl = response.data.profile_picture
                } else if (response.data.data?.profile_picture) {
                    newProfilePictureUrl = response.data.data.profile_picture
                } else if (response.data.profile_picture_url) {
                    newProfilePictureUrl = response.data.profile_picture_url
                } else if (response.data.data?.profile_picture_url) {
                    newProfilePictureUrl = response.data.data.profile_picture_url
                } else if (response.data.image) {
                    newProfilePictureUrl = response.data.image
                } else if (response.data.data?.image) {
                    newProfilePictureUrl = response.data.data.image
                }
                
                if (newProfilePictureUrl) {
                    setProfilePicture(newProfilePictureUrl)
                    console.log("✅ Profile picture URL updated:", newProfilePictureUrl)
                    
                    // Update auth state with new profile picture
                    const updatedUser = { ...authState.user, profile_picture: newProfilePictureUrl, profile_picture_url: newProfilePictureUrl }
                    const currentTokens = {
                        access: localStorage.getItem("access_token"),
                        refresh: localStorage.getItem("refresh_token")
                    }
                    setAuthData(updatedUser, currentTokens, authState.userType || 'patient')
                }
                
                // Refresh profile data to get any other updated info
                setTimeout(() => {
                    fetchUserProfile()
                }, 1000)
                
                alert('Profile picture updated successfully!')
            }
        } catch (error) {
            console.error("❌ PatientPortal: Profile picture upload failed:", error)
            
            const errorMessage = error?.response?.data?.message || 
                               error?.response?.data?.error || 
                               'Failed to upload profile picture'
            alert(errorMessage)
        } finally {
            setPictureUploading(false)
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    // Handle profile picture delete
    const handleProfilePictureDelete = async () => {
        if (!profilePicture) return

        const confirmDelete = window.confirm('Are you sure you want to delete your profile picture?')
        if (!confirmDelete) return

        setPictureDeleting(true)
        
        try {
            console.log("🔍 PatientPortal: Deleting profile picture...")
            await deleteProfilePicture()
            
            console.log("✅ PatientPortal: Profile picture deleted successfully")
            setProfilePicture(null)
            
            // Update auth state to remove profile picture
            const updatedUser = { ...authState.user, profile_picture: null, profile_picture_url: null }
            const currentTokens = {
                access: localStorage.getItem("access_token"),
                refresh: localStorage.getItem("refresh_token")
            }
            setAuthData(updatedUser, currentTokens, authState.userType || 'patient')
            
            // Refresh profile data to get updated info
            setTimeout(() => {
                fetchUserProfile()
            }, 1000)
            
            alert('Profile picture deleted successfully!')
        } catch (error) {
            console.error("❌ PatientPortal: Profile picture delete failed:", error)
            
            const errorMessage = error?.response?.data?.message || 
                               error?.response?.data?.error || 
                               'Failed to delete profile picture'
            alert(errorMessage)
        } finally {
            setPictureDeleting(false)
        }
    }

    // Handle navigation to specific sections
    const handleSectionNavigation = (item) => {
        setActiveSection(item.id)
        
        // Navigate to the specific route if it exists
        if (item.route) {
            navigate(item.route)
        }
        
        // For testing doctor profile navigation (as mentioned in your requirement)
        if (item.id === "appointments") {
            // You can add a test navigation to doctor profile here
            console.log("🔍 PatientPortal: Navigating to appointments section")
            // Example: navigate("/patient/doctorprofile") // for testing
        }
    }

    // Initialize auth state on component mount
    useEffect(() => {
        console.log("🔍 PatientPortal: Component mounted, checking auth...")
        checkAuthAndFetchProfile()
    }, [])

    // Watch for auth state changes
    useEffect(() => {
        if (!authState.isLoggedIn && !authLoading) {
            console.log("❌ PatientPortal: Auth state changed to logged out, redirecting...")
            navigate("/login")
        }
    }, [authState.isLoggedIn, authLoading, navigate])

    // Update profile picture when user data changes
    useEffect(() => {
        if (authState.user) {
            const profilePictureUrl = authState.user.profile_picture || 
                                    authState.user.profile_picture_url || 
                                    authState.user.image || 
                                    null
            if (profilePictureUrl) {
                setProfilePicture(profilePictureUrl)
            }
        }
    }, [authState.user])

    const handleLogout = async () => {
        console.log("🔍 PatientPortal: Logout clicked")
        try {
            await logoutUser()
            console.log("✅ PatientPortal: Logout successful")
        } catch (error) {
            console.error("PatientPortal: Logout failed:", error)
        } finally {
            console.log("✅ PatientPortal: Logout complete, navigating to login")
            navigate("/login")
        }
    }

    const renderSectionContent = () => {
        const sectionData = {
            profile: {
                icon: User,
                title: "My Profile",
                description: "Your profile information will appear here",
                route: "/patient/profile"
            },
            appointments: {
                icon: Calendar,
                title: "My Appointments",
                description: "Your appointment history will appear here",
                route: "/patient/appointments"
            },
            records: {
                icon: FileText,
                title: "Medical Records",
                description: "Your medical records will appear here",
                route: "/patient/records"
            },
            upcoming: {
                icon: Clock,
                title: "Upcoming Appointments",
                description: "Your upcoming appointments will appear here",
                route: "/patient/appointments/upcoming"
            },
            completed: {
                icon: CheckCircle,
                title: "Completed Appointments",
                description: "Your completed appointments will appear here",
                route: "/patient/appointments/completed"
            },
            payments: {
                icon: CreditCard,
                title: "Payments",
                description: "Your payment history will appear here",
                route: "/patient/payments"
            }
        }

        const section = sectionData[activeSection]
        const IconComponent = section.icon

        return (
            <div className="text-center py-12">
                <IconComponent className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{section.title}</h3>
                <p className="text-gray-600">{section.description}</p>
                
                {/* Test navigation button for doctor profile */}
                {activeSection === "appointments" && (
                    <div className="mt-6">
                        <button
                            onClick={() => navigate("/patient/doctorprofile")}
                            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            <span>View Doctor Profile (Test)</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // Loading state
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    <p className="text-gray-600">Loading your profile...</p>
                </div>
            </div>
        )
    }

    // If not logged in, show login prompt
    if (!authState.isLoggedIn || !authState.user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">Please log in to access your patient portal.</p>
                    <button
                        onClick={() => navigate("/login")}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        )
    }

    const { user } = authState

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <Header />

            {/* Hidden file input for profile picture upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureUpload}
                className="hidden"
            />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar */}
                    <div className="lg:w-80">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            {/* Patient Portal Header */}
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-white" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-gray-900">Patient Portal</h2>
                                </div>
                            </div>

                            {/* Navigation Menu */}
                            <nav className="p-4">
                                <ul className="space-y-2">
                                    {sidebarItems.map((item) => {
                                        const IconComponent = item.icon
                                        return (
                                            <li key={item.id}>
                                                <button
                                                    onClick={() => handleSectionNavigation(item)}
                                                    className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors ${
                                                        item.active
                                                            ? "bg-purple-600 text-white"
                                                            : "text-gray-700 hover:bg-purple-50 hover:text-purple-600"
                                                    }`}
                                                >
                                                    <IconComponent size={20} />
                                                    <span className="font-medium">{item.name}</span>
                                                </button>
                                            </li>
                                        )
                                    })}

                                    {/* Logout Button */}
                                    <li className="pt-4 border-t border-gray-200">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut size={20} />
                                            <span className="font-medium">Logout</span>
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            {/* Profile Section */}
                            <div className="p-8">
                                <div className="flex flex-col items-center text-center">
                                    {/* Profile Avatar with Upload/Delete Controls - Updated styling */}
                                    <div className="relative mb-6 group">
                                        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white ring-opacity-50 overflow-hidden">
                                            {profilePicture ? (
                                                <img
                                                    src={profilePicture}
                                                    alt="Profile"
                                                    className="w-full h-full rounded-full object-cover"
                                                    onError={(e) => {
                                                        console.error("Profile image failed to load:", profilePicture)
                                                        setProfilePicture(null)
                                                    }}
                                                />
                                            ) : (
                                                <User className="w-16 h-16 text-gray-400" />
                                            )}
                                        </div>

                                        {/* Upload/Delete Overlay */}
                                        <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <div className="flex space-x-2">
                                                {/* Upload Button */}
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={pictureUploading || pictureDeleting}
                                                    className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Upload new picture"
                                                >
                                                    {pictureUploading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Camera className="w-4 h-4" />
                                                    )}
                                                </button>

                                                {/* Delete Button - Only show if profile picture exists */}
                                                {profilePicture && (
                                                    <button
                                                        onClick={handleProfilePictureDelete}
                                                        disabled={pictureUploading || pictureDeleting}
                                                        className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Delete picture"
                                                    >
                                                        {pictureDeleting ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status indicator */}
                                        <div className="absolute bottom-2 right-2">
                                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white">
                                                <User className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Upload Instructions */}
                                    {(pictureUploading || pictureDeleting) && (
                                        <div className="mb-4 text-sm text-gray-600">
                                            {pictureUploading && (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Uploading profile picture...</span>
                                                </div>
                                            )}
                                            {pictureDeleting && (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Deleting profile picture...</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* User Information */}
                                    <div className="space-y-2 mb-6">
                                        {profileLoading ? (
                                            <div className="flex items-center justify-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                                                <span className="ml-2 text-gray-600">Loading profile...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <h2 className="text-2xl font-bold text-gray-900">
                                                    {user.name || 
                                                     `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
                                                     user.username || 
                                                     "Welcome"}
                                                </h2>
                                                <p className="text-gray-600">
                                                    {user.email || "No email provided"}
                                                </p>
                                                <p className="text-gray-600">
                                                    {user.phone || user.phone_number || "No phone provided"}
                                                </p>
                                                {user.date_of_birth && (
                                                    <p className="text-gray-600">
                                                        DOB: {new Date(user.date_of_birth).toLocaleDateString()}
                                                    </p>
                                                )}
                                                {authState.userType && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                        {authState.userType}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        {/* View Details Button - Updated with proper path */}
                                        <button
                                            onClick={() => navigate("/patient/profile")}
                                            className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={profileLoading}
                                        >
                                            <span>View Details</span>
                                            <ChevronRight size={16} />
                                        </button>

                                        {/* Quick Upload Button for Mobile */}
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={pictureUploading || pictureDeleting}
                                            className="inline-flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:hidden"
                                        >
                                            <Upload size={16} />
                                            <span>
                                                {pictureUploading ? "Uploading..." : "Upload Photo"}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Content based on active section */}
                            <div className="border-t border-gray-200 p-8">
                                {renderSectionContent()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PatientPortal