"use client"
import { useState, useEffect, useRef } from "react"
import { Calendar, FileText, Clock, CheckCircle, CreditCard, User, ChevronRight, Loader2, Camera, Trash2, Upload, Mail, Phone, MapPin, Shield, CheckCircle2 } from 'lucide-react'
import { useNavigate } from "react-router-dom"
import Header from "../components/home/Header"
import PatientSidebar from "../components/ui/PatientSidebar"
import { getUserProfile, uploadProfilePicture, deleteProfilePicture } from "../endpoints/APIs"
import { isAuthenticated, clearAuthData, setAuthData, logoutUser, useAuthState } from "../utils/auth"

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
  const [userProfile, setUserProfile] = useState(null)

  // Check authentication status
  const checkAuthStatus = async () => {
    console.log("🔍 PatientPortal: Checking authentication status...")
    setAuthLoading(true)
    try {
      const authenticated = await isAuthenticated()
      if (authenticated && authState.isLoggedIn) {
        console.log("✅ PatientPortal: User is authenticated")
        // Fetch user profile for main content area
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
        setUserProfile(authState.user)
        setAuthLoading(false)
      } else {
        console.log("❌ PatientPortal: No valid user data, redirecting to login...")
        navigate("/login")
      }
    } finally {
      setAuthLoading(false)
    }
  }

  // Fetch user profile for main content area
  const fetchUserProfile = async () => {
    setProfileLoading(true)
    try {
      console.log("🔍 PatientPortal: Fetching user profile from API...")
      const response = await getUserProfile()
      
      if (response.data && response.data.data) {
        const profileData = response.data.data
        setUserProfile(profileData)
        
        // Set profile picture
        const profilePictureUrl = profileData.profile_picture || profileData.profile_picture_url || profileData.image || null
        setProfilePicture(profilePictureUrl)
        
        // Update localStorage with fresh data
        const currentTokens = {
          access: localStorage.getItem("access_token"),
          refresh: localStorage.getItem("refresh_token")
        }
        setAuthData(profileData, currentTokens, authState.userType || 'patient')
        
        // Notify sidebar about profile update
        window.dispatchEvent(new CustomEvent('profileUpdate', {
          detail: { type: 'profile_update', data: profileData }
        }))
      }
    } catch (error) {
      console.error("❌ PatientPortal: Failed to fetch profile:", error)
      // If API call fails with 401/403, user is not authenticated
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        console.log("❌ PatientPortal: Authentication failed, clearing data and redirecting...")
        clearAuthData()
        navigate("/login")
      } else {
        // For other errors, use stored data
        if (authState.user) {
          setUserProfile(authState.user)
          const fallbackPicture = authState.user.profile_picture || authState.user.profile_picture_url || authState.user.image || null
          setProfilePicture(fallbackPicture)
        }
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
      
      const response = await uploadProfilePicture(formData)
      if (response.data) {
        // Extract profile picture URL from response
        let newProfilePictureUrl = response.data.profile_picture || 
                                   response.data.data?.profile_picture || 
                                   response.data.profile_picture_url || 
                                   response.data.data?.profile_picture_url || 
                                   response.data.image || 
                                   response.data.data?.image || null

        if (newProfilePictureUrl) {
          setProfilePicture(newProfilePictureUrl)
          
          // Update auth state
          const updatedUser = { ...authState.user, profile_picture: newProfilePictureUrl }
          const currentTokens = {
            access: localStorage.getItem("access_token"),
            refresh: localStorage.getItem("refresh_token")
          }
          setAuthData(updatedUser, currentTokens, authState.userType || 'patient')
          
          // Notify sidebar about profile update
          window.dispatchEvent(new CustomEvent('profileUpdate', {
            detail: { type: 'profile_picture_update', profilePicture: newProfilePictureUrl }
          }))
        }
        
        // Refresh profile data
        setTimeout(fetchUserProfile, 1000)
        alert('Profile picture updated successfully!')
      }
    } catch (error) {
      console.error("❌ PatientPortal: Profile picture upload failed:", error)
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || 'Failed to upload profile picture'
      alert(errorMessage)
    } finally {
      setPictureUploading(false)
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
      await deleteProfilePicture()
      setProfilePicture(null)
      
      // Update auth state
      const updatedUser = { ...authState.user, profile_picture: null }
      const currentTokens = {
        access: localStorage.getItem("access_token"),
        refresh: localStorage.getItem("refresh_token")
      }
      setAuthData(updatedUser, currentTokens, authState.userType || 'patient')
      
      // Notify sidebar about profile update
      window.dispatchEvent(new CustomEvent('profileUpdate', {
        detail: { type: 'profile_picture_delete' }
      }))
      
      // Refresh profile data
      setTimeout(fetchUserProfile, 1000)
      alert('Profile picture deleted successfully!')
    } catch (error) {
      console.error("❌ PatientPortal: Profile picture delete failed:", error)
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || 'Failed to delete profile picture'
      alert(errorMessage)
    } finally {
      setPictureDeleting(false)
    }
  }

  // Handle navigation to specific sections
  const handleSectionNavigation = (item) => {
    setActiveSection(item.id)
    // Navigate to the specific route if it exists
    if (item.href) {
      navigate(item.href)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    console.log("🔍 PatientPortal: Logout clicked")
    if (authLoading) return

    try {
      setAuthLoading(true)
      // Call logout API with timeout
      const logoutPromise = logoutUser()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Logout timeout')), 5000)
      )
      await Promise.race([logoutPromise, timeoutPromise])
    } catch (error) {
      console.error("❌ PatientPortal: Logout API failed:", error)
    }

    // Clear auth data
    clearAuthData()
    
    // Clear localStorage
    const keysToRemove = [
      "access_token", "refresh_token", "user_data", "user_type", 
      "authState", "patient_data", "login_data"
    ]
    keysToRemove.forEach(key => localStorage.removeItem(key))
    sessionStorage.clear()
    
    // Navigate to login
    navigate("/login", { replace: true })
    setTimeout(() => {
      window.location.replace("/login")
    }, 200)
  }

  // Initialize on component mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Watch for auth state changes
  useEffect(() => {
    if (!authState.isLoggedIn && !authLoading) {
      navigate("/login")
    }
  }, [authState.isLoggedIn, authLoading, navigate])

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

  const user = userProfile || authState.user

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Hidden file input for profile picture upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleProfilePictureUpload}
        className="hidden"
      />

      {/* Main Layout - Updated to match doctor interface */}
      <div className="flex">
        {/* PatientSidebar - Updated */}
        <PatientSidebar
          activeSection={activeSection}
          onSectionNavigation={handleSectionNavigation}
          onLogout={handleLogout}
        />

        {/* Main Content Area - Updated Layout */}
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            {/* Profile Header Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div className="p-8">
                {/* Profile Header */}
                <div className="flex items-center space-x-6 mb-8">
                  {/* Profile Picture */}
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center">
                      {profilePicture ? (
                        <img
                          src={profilePicture}
                          alt="Profile"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error("Profile image failed to load:", profilePicture)
                            setProfilePicture(null)
                          }}
                        />
                      ) : (
                        <User className="w-12 h-12 text-white" />
                      )}
                    </div>
                    
                    {/* Upload/Delete Overlay */}
                    <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={pictureUploading || pictureDeleting}
                          className="p-1.5 bg-white rounded-full text-gray-700 hover:bg-gray-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Upload new picture"
                        >
                          {pictureUploading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Camera className="w-3 h-3" />
                          )}
                        </button>
                        {profilePicture && (
                          <button
                            onClick={handleProfilePictureDelete}
                            disabled={pictureUploading || pictureDeleting}
                            className="p-1.5 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete picture"
                          >
                            {pictureDeleting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h1 className="text-2xl font-bold text-gray-900">
                        {user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || "Patient"}
                      </h1>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Patient
                      </span>
                    </div>
                    <p className="text-purple-600 font-medium mb-1">
                      {authState.userType || 'Patient Portal'}
                    </p>
                    {(pictureUploading || pictureDeleting) && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          {pictureUploading ? 'Uploading profile picture...' : 'Deleting profile picture...'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="text-right">
                    <div className="inline-flex items-center space-x-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Grid - Updated Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Contact Information */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Contact Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Email */}
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Mail className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email</p>
                          <p className="text-sm text-gray-600">{user.email || "No email provided"}</p>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Phone className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Phone</p>
                          <p className="text-sm text-gray-600">{user.phone || user.phone_number || "No phone provided"}</p>
                        </div>
                      </div>

                      {/* Date of Birth */}
                      {user.date_of_birth && (
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Date of Birth</p>
                            <p className="text-sm text-gray-600">
                              {new Date(user.date_of_birth).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Gender */}
                      {user.gender && (
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-pink-100 rounded-lg">
                            <User className="w-5 h-5 text-pink-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Gender</p>
                            <p className="text-sm text-gray-600">{user.gender}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Patient Details */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Patient Details</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Patient ID */}
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Shield className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Patient ID</p>
                          <p className="text-sm text-gray-600">{user.id || user.user_id || "Not assigned"}</p>
                        </div>
                      </div>

                      {/* Registration Date */}
                      {user.date_joined && (
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Clock className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Registration Date</p>
                            <p className="text-sm text-gray-600">
                              {new Date(user.date_joined).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Quick Actions & Status */}
              <div className="space-y-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                    <div className="space-y-3">
                      <button
                        onClick={() => navigate("/patientprofile")}
                        className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <User className="w-5 h-5 text-purple-600" />
                          <span className="font-medium text-purple-900">Edit Profile</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-purple-600" />
                      </button>
                      
                      <button
                        onClick={() => navigate("/patient/myAppointments")}
                        className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-blue-900">My Appointments</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-blue-600" />
                      </button>
                      
                      <button
                        onClick={() => navigate("/patient/medical_record")}
                        className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-900">Medical Records</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-green-600" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Account Status */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h2>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Current Status</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </div>
                      
                      {user.email_verified && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Email Verified</span>
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PatientPortal