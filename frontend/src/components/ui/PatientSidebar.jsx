import React, { useState, useEffect } from 'react';
import { 
    User, 
    Calendar, 
    FileText, 
    Clock, 
    CheckCircle, 
    CreditCard, 
    LogOut,
    Loader2,
    MapPin,
    Navigation
} from 'lucide-react';
import { getUserProfile } from '../../endpoints/APIs';
import { 
    updatePatientLocation, 
    getCurrentPatientLocation 
} from '../../endpoints/APIs';
import { useAuthState, clearAuthData } from '../../utils/auth';

const PatientSidebar = ({
    activeSection,
    onSectionNavigation,
    onLogout
}) => {
    const [activeMenuItem, setActiveMenuItem] = useState(activeSection);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profilePicture, setProfilePicture] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    
    // Location state
    const [locationLoading, setLocationLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [locationUpdateSuccess, setLocationUpdateSuccess] = useState(false);
    
    // Use auth state hook
    const authState = useAuthState();

    // Patient sidebar items
    const sidebarItems = [
        {
            id: "profile",
            name: "My Profile",
            icon: User,
            route: "/patientprofile"
        },
        {
            id: "appointments",
            name: "My Appointments",
            icon: Calendar,
            route: '/patient/myAppointments'
        },
        {
            id: "records",
            name: "Medical Records",
            icon: FileText,
            route: "/patient/medical_record"
        },
        {
            id: "upcoming",
            name: "Upcoming Appointments",
            icon: Clock,
            route: "/patient/appointments/upcoming"
        },
        {
            id: "completed",
            name: "Completed Appointments",
            icon: CheckCircle,
            route: "/patient/appointments/completed"
        },
        {
            id: "payments",
            name: "Payments",
            icon: CreditCard,
            route: "/patient/payments"
        }
    ];

    // Fetch user profile data
    const fetchUserProfile = async () => {
        if (!authState.isLoggedIn) return;
        
        setProfileLoading(true);
        try {
            console.log("🔍 PatientSidebar: Fetching user profile...");
            const response = await getUserProfile();
            
            if (response.data && response.data.data) {
                const profileData = response.data.data;
                setUserProfile(profileData);
                
                // Set profile picture with fallbacks
                const profilePictureUrl = profileData.profile_picture || 
                                        profileData.profile_picture_url || 
                                        profileData.image || 
                                        null;
                
                setProfilePicture(profilePictureUrl);
                console.log("✅ PatientSidebar: Profile fetched successfully");
            }
        } catch (error) {
            console.error("❌ PatientSidebar: Failed to fetch profile:", error);
            
            // Fallback to auth state user data
            if (authState.user) {
                setUserProfile(authState.user);
                const fallbackPicture = authState.user.profile_picture || 
                                    authState.user.profile_picture_url || 
                                    authState.user.image || 
                                    null;
                setProfilePicture(fallbackPicture);
            }
        } finally {
            setProfileLoading(false);
        }
    };

    // Fetch current patient location from backend
    const fetchCurrentLocation = async () => {
        try {
            console.log("🔍 PatientSidebar: Fetching current location...");
            const response = await getCurrentPatientLocation();
            
            if (response.data && response.data.data) {
                setCurrentLocation(response.data.data);
                console.log("✅ PatientSidebar: Current location fetched successfully");
            }
        } catch (error) {
            console.error("❌ PatientSidebar: Failed to fetch current location:", error);
        }
    };

    // Get user's current location using browser's Geolocation API
    const getCurrentPosition = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    let errorMessage = 'Unable to retrieve location';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location access denied by user';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information is unavailable';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out';
                            break;
                        default:
                            errorMessage = 'An unknown error occurred';
                            break;
                    }
                    reject(new Error(errorMessage));
                },
                options
            );
        });
    };

    // Update patient location
    const handleUpdateLocation = async () => {
        if (!authState.isLoggedIn) {
            setLocationError('Please log in to update your location');
            return;
        }

        setLocationLoading(true);
        setLocationError(null);
        setLocationUpdateSuccess(false);

        try {
            console.log("🧭 PatientSidebar: Getting current position...");
            const position = await getCurrentPosition();
            
            console.log("📍 PatientSidebar: Position obtained:", position);
            
            // Update location on backend
            const locationData = {
                latitude: position.latitude,
                longitude: position.longitude,
                accuracy: position.accuracy
            };

            console.log("📤 PatientSidebar: Updating location on backend...");
            const response = await updatePatientLocation(locationData);
            
            if (response.data) {
                setCurrentLocation({
                    latitude: position.latitude,
                    longitude: position.longitude,
                    accuracy: position.accuracy,
                    updated_at: new Date().toISOString()
                });
                
                setLocationUpdateSuccess(true);
                console.log("✅ PatientSidebar: Location updated successfully");
                
                // Clear success message after 3 seconds
                setTimeout(() => {
                    setLocationUpdateSuccess(false);
                }, 3000);
            }
        } catch (error) {
            console.error("❌ PatientSidebar: Failed to update location:", error);
            setLocationError(error.message || 'Failed to update location');
            
            // Clear error message after 5 seconds
            setTimeout(() => {
                setLocationError(null);
            }, 5000);
        } finally {
            setLocationLoading(false);
        }
    };

    // Get user display data with fallbacks
    const getUserDisplayData = () => {
        const user = userProfile || authState.user;
        if (!user) return null;
        
        return {
            name: user.name ||
                `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
                user.username ||
                "User",
            email: user.email || "No email provided",
            profilePicture: profilePicture || user.profile_picture || user.avatar || null
        };
    };

    const displayData = getUserDisplayData();

    const handleMenuClick = (item) => {
        setActiveMenuItem(item.id);
        if (onSectionNavigation) {
            onSectionNavigation(item);
        }
    };

    // Format location for display
    const formatLocation = (location) => {
        if (!location) return null;
        
        const lat = parseFloat(location.latitude).toFixed(6);
        const lng = parseFloat(location.longitude).toFixed(6);
        
        return `${lat}, ${lng}`;
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return null;
        
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        } catch {
            return null;
        }
    };

    // Fetch profile when component mounts or auth state changes
    useEffect(() => {
        if (authState.isLoggedIn) {
            fetchUserProfile();
            fetchCurrentLocation();
        }
    }, [authState.isLoggedIn]);

    // Update active menu item when activeSection prop changes
    useEffect(() => {
        if (activeSection) {
            setActiveMenuItem(activeSection);
        }
    }, [activeSection]);

    // Auto-detect active item based on current path
    useEffect(() => {
        const currentPath = window.location.pathname;
        const currentItem = sidebarItems.find(item => item.route === currentPath);
        if (currentItem) {
            setActiveMenuItem(currentItem.id);
        }
    }, []);

    // Listen for profile updates from other components
    useEffect(() => {
        const handleProfileUpdate = (event) => {
            if (event.detail && event.detail.type === 'profile_update') {
                console.log("🔄 PatientSidebar: Profile update detected, refreshing...");
                fetchUserProfile();
            }
        };

        window.addEventListener('profileUpdate', handleProfileUpdate);
        return () => window.removeEventListener('profileUpdate', handleProfileUpdate);
    }, []);

    return (
        <aside className="w-64 bg-white shadow-sm min-h-screen">
            {/* Patient Portal Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center relative">
                        {profileLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                        ) : displayData?.profilePicture ? (
                            <img
                                src={displayData.profilePicture}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    console.error("Profile image failed to load:", displayData.profilePicture);
                                    setProfilePicture(null);
                                }}
                            />
                        ) : (
                            <User className="w-6 h-6 text-white" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">Patient Portal</h3>
                        {displayData?.name && (
                            <p className="text-sm text-gray-600 truncate">{displayData.name}</p>
                        )}
                        {displayData?.email && (
                            <p className="text-xs text-gray-500 truncate">{displayData.email}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* My Current Location Section */}
            <div className="p-4 border-b border-gray-200">
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                        <MapPin className="w-5 h-5 text-gray-600" />
                        <h4 className="font-medium text-gray-900">My Current Location</h4>
                    </div>
                    
                    {/* Current Location Display */}
                    {currentLocation && (
                        <div className="mb-3">
                            <p className="text-sm text-gray-600 mb-1">
                                📍 {formatLocation(currentLocation)}
                            </p>
                            {currentLocation.updated_at && (
                                <p className="text-xs text-gray-500">
                                    Updated: {formatDate(currentLocation.updated_at)}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Update Location Button */}
                    <button
                        onClick={handleUpdateLocation}
                        disabled={locationLoading}
                        className="w-full flex items-center justify-center space-x-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {locationLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Navigation className="w-4 h-4" />
                        )}
                        <span>
                            {locationLoading ? 'Updating...' : 'Update Location'}
                        </span>
                    </button>

                    {/* Success Message */}
                    {locationUpdateSuccess && (
                        <div className="mt-3 p-2 bg-green-100 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800">
                                ✅ Location updated successfully!
                            </p>
                        </div>
                    )}

                    {/* Error Message */}
                    {locationError && (
                        <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800">
                                ❌ {locationError}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Menu */}
            <nav className="p-4">
                <ul className="space-y-2">
                    {sidebarItems.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = activeMenuItem === item.id;
                        
                        return (
                            <li key={item.id}>
                                <button
                                    onClick={() => handleMenuClick(item)}
                                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${
                                        isActive
                                            ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                                            : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                >
                                    <IconComponent className="w-5 h-5" />
                                    <span className={isActive ? 'font-medium' : ''}>
                                        {item.name}
                                    </span>
                                </button>
                            </li>
                        );
                    })}

                    {/* Logout Button */}
                    <li className="pt-4 border-t border-gray-200">
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center space-x-3 p-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-left"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">Logout</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* Refresh Profile Button (for development/testing) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={fetchUserProfile}
                        disabled={profileLoading}
                        className="w-full flex items-center justify-center space-x-2 p-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {profileLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <User className="w-4 h-4" />
                        )}
                        <span>Refresh Profile</span>
                    </button>
                </div>
            )}
        </aside>
    );
};

export default PatientSidebar;