import React, { useState, useEffect } from 'react';
import { User, Calendar, FileText, Clock, CheckCircle, CreditCard, LogOut, Loader2, MapPin, Navigation, CheckCircle2, AlertCircle } from 'lucide-react';

// Import actual APIs
import { getUserProfile } from '../../endpoints/APIs';
import { updatePatientLocation, getCurrentPatientLocation } from '../../endpoints/APIs';
import { useAuthState, clearAuthData } from '../../utils/auth';

const PatientSidebar = ({ activeSection, onSectionNavigation, onLogout, initialActiveMenuItem = 'profile' }) => {
  const [activeMenuItem, setActiveMenuItem] = useState(activeSection || initialActiveMenuItem);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // Location state
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState(null);
  const [messageType, setMessageType] = useState(null); // 'success', 'error', 'info'
  
  // Use actual auth state
  const authState = useAuthState();

  // Patient sidebar items - updated structure to match DoctorSidebar
  const menuItems = [
    { 
      id: "profile", 
      name: "My Profile", 
      icon: User, 
      href: "/patientportal" 
    },
    { 
      id: "appointments", 
      name: "My Appointments", 
      icon: Calendar, 
      href: '/patient/myAppointments' 
    },
    { 
      id: "records", 
      name: "Medical Records", 
      icon: FileText, 
      href: "/patient/medical_record" 
    },
    // { 
    //   id: "upcoming", 
    //   name: "Upcoming Appointments", 
    //   icon: Clock, 
    //   href: "/patient/nearbyDoctorFinder" 
    // },
    // { 
    //   id: "completed", 
    //   name: "Completed Appointments", 
    //   icon: CheckCircle, 
    //   href: "/patient/wallet" 
    // },
    { 
      id: "Wallet", 
      name: "Wallet", 
      icon: CreditCard, 
      href: "/patient/wallet" 
    },
    { 
      id: "logout", 
      name: "Logout", 
      icon: LogOut, 
      href: "#" 
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
        setProfilePicture(profileData.profile_picture);
        console.log("✅ PatientSidebar: Profile fetched successfully");
      }
    } catch (error) {
      console.error("❌ PatientSidebar: Failed to fetch profile:", error);
      if (authState.user) {
        setUserProfile(authState.user);
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
      // Handle 404 or other errors gracefully - don't show error to user
      // as this might be the first time they're using location feature
      if (error.response?.status === 404) {
        console.log("ℹ️ PatientSidebar: No existing location found - this is normal for first-time users");
      }
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
        timeout: 15000,
        maximumAge: 60000 // 1 minute
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
              errorMessage = 'Location access denied. Please enable GPS and refresh the page.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = 'An unknown error occurred while getting location.';
              break;
          }
          reject(new Error(errorMessage));
        },
        options
      );
    });
  };

  // Clear messages after timeout
  const clearMessage = () => {
    setTimeout(() => {
      setLocationMessage(null);
      setMessageType(null);
    }, 5000);
  };

  // Update patient location
  const handleUpdateLocation = async () => {
    if (!authState.isLoggedIn) {
      setLocationMessage('Please log in to update your location');
      setMessageType('error');
      clearMessage();
      return;
    }

    setLocationLoading(true);
    setLocationMessage(null);
    setMessageType(null);

    try {
      console.log("🧭 PatientSidebar: Getting current position...");
      const position = await getCurrentPosition();
      console.log("📍 PatientSidebar: Position obtained:", position);

      // Update location on backend
      const locationData = {
        latitude: position.latitude,
        longitude: position.longitude
      };

      console.log("📤 PatientSidebar: Updating location on backend...");
      console.log("📊 PatientSidebar: Sending location data:", locationData);
      
      const response = await updatePatientLocation(locationData);

      if (response.data) {
        const { message, data } = response.data;
        
        // Update local state with the new location data from backend
        setCurrentLocation(data);
        
        // Always show success message since location is updated
        setLocationMessage('✅ Location updated successfully!');
        setMessageType('success');
        console.log("✅ PatientSidebar: Location updated successfully");
        clearMessage();
      }
    } catch (error) {
      console.error("❌ PatientSidebar: Failed to update location:", error);
      
      // Handle different types of errors
      let errorMessage = 'Failed to update location';
      
      if (error.response) {
        // Server responded with error status
        const { status, data } = error.response;
        if (status === 400) {
          errorMessage = data?.message || 'Invalid location data. Please try again.';
        } else if (status === 401) {
          errorMessage = 'Please log in to update your location.';
        } else if (status === 403) {
          errorMessage = 'You do not have permission to update location.';
        } else if (status === 404) {
          errorMessage = 'Location service not available. Please contact support.';
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = data?.message || `Error ${status}: Unable to update location.`;
        }
      } else if (error.request) {
        // Network error
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        // Other error (likely from getCurrentPosition)
        errorMessage = error.message || 'An unexpected error occurred.';
      }

      setLocationMessage(`❌ ${errorMessage}`);
      setMessageType('error');
      clearMessage();
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle logout with proper auth cleanup
  const handleLogout = () => {
    clearAuthData();
    if (onLogout) {
      onLogout();
    }
  };

  // Get user display data with fallbacks
  const getUserDisplayData = () => {
    const user = userProfile || authState.user;
    if (!user) return null;

    return {
      name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || "User",
      email: user.email || "No email provided",
      profilePicture: profilePicture || user.profile_picture || user.profile_picture_url || user.image
    };
  };

  const displayData = getUserDisplayData();

  // Handle menu click - updated to match DoctorSidebar pattern
  const handleMenuClick = (item, e) => {
    if (item.id === 'logout') {
      e.preventDefault();
      handleLogout();
      return;
    }

    setActiveMenuItem(item.id);
    
    // Maintain backward compatibility with existing onSectionNavigation prop
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

  // Get message icon based on type
  const getMessageIcon = () => {
    switch (messageType) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'info':
        return <MapPin className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  // Get message styling based on type
  const getMessageStyling = () => {
    switch (messageType) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  // Update activeMenuItem when current path changes (like DoctorSidebar)
  useEffect(() => {
    const currentPath = window.location.pathname;
    const currentItem = menuItems.find(item => item.href === currentPath);
    if (currentItem) {
      setActiveMenuItem(currentItem.id);
    }
  }, []);

  // Fetch profile when component mounts or auth state changes
  useEffect(() => {
    if (authState.isLoggedIn) {
      fetchUserProfile();
      // Only fetch current location if user is logged in
      fetchCurrentLocation();
    }
  }, [authState.isLoggedIn]);

  // Update active menu item when activeSection prop changes
  useEffect(() => {
    if (activeSection) {
      setActiveMenuItem(activeSection);
    }
  }, [activeSection]);

  return (
    <aside className="w-64 bg-white shadow-sm min-h-screen">
      {/* Patient Info - Updated to match DoctorSidebar style */}
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
            {displayData?.name && (
              <h3 className="font-semibold text-gray-900">{displayData.name}</h3>
            )}
            <p className="text-sm text-gray-600">Patient</p>
            {displayData?.email && (
              <p className="text-xs text-gray-500 truncate">{displayData.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Live Location Update Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <MapPin className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Current Location</h4>
          </div>

          {/* Current Location Display */}
          {currentLocation && (
            <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-900 mb-1">
                📍 Your Location
              </p>
              <p className="text-xs text-gray-600 font-mono">
                {formatLocation(currentLocation)}
              </p>
              {currentLocation.updated_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {formatDate(currentLocation.updated_at)}
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
            <span className="font-medium">
              {locationLoading ? 'Updating...' : 'Update My Location'}
            </span>
          </button>

          {/* Status Message */}
          {locationMessage && (
            <div className={`mt-3 p-3 rounded-lg border ${getMessageStyling()}`}>
              <div className="flex items-center space-x-2">
                {getMessageIcon()}
                <p className="text-sm font-medium">
                  {locationMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu - Updated to match DoctorSidebar structure */}
      <nav className="p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeMenuItem === item.id;
            
            return (
              <li key={item.id}>
                <a
                  href={item.href}
                  onClick={(e) => handleMenuClick(item, e)}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : item.id === 'logout' 
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                  <span className={isActive ? 'font-medium' : ''}>
                    {item.name}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default PatientSidebar;