// auth.js - Cookie-only authentication version
import { getUserProfile, logout } from '../endpoints/APIs'; 
import { getDoctorProfile } from '../endpoints/Doc';
import { useEffect, useState } from 'react';

export const STORAGE_KEYS = {
    USER_DETAILS: "user_details",
    IS_AUTHENTICATED: "isAuthenticated",
    USER_TYPE: "user_type",
    ACCESS_TOKEN: 'access_token',  // Added for WebSocket auth
    REFRESH_TOKEN: 'refresh_token' 
    
};

//  Auth check using cookie-based authentication
export const isAuthenticated = async () => {
    try {
        console.log('Checking authentication via API call...');
        
        // Try to get user profile (backend reads from cookies automatically)
        const response = await getUserProfile();
        console.log('Auth check successful:', response.data);
        
        // Update user data if we got it
        if (response.data?.data) {
            localStorage.setItem(STORAGE_KEYS.USER_DETAILS, JSON.stringify(response.data.data));
            localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, "true");
        }
        
        return true;
        
    } catch (error) {
        console.error(' Auth check failed:', error);
        
        // Clear auth data for actual auth failures (401, 403)
        if (error?.response?.status === 401 || error?.response?.status === 403) {
            console.log(' Authentication failed, clearing auth data');
            clearAuthData();
            return false;
        }
        
        // For server errors (500) or network errors, don't clear auth data
        if (error?.response?.status === 500) {
            console.log('Server error during auth check - keeping auth state');
            return isUserAuthenticated(); // Fall back to local storage check
        }
        
        if (!error?.response) {
            console.log('Network error during auth check - keeping auth state');
            return isUserAuthenticated(); // Fall back to local storage check
        }
        
        return false;
    }
};


export const isDoctorAuthenticated = async () => {
    try {
        console.log('🔍 Checking doctor authentication via API call...');
        
        const response = await getDoctorProfile();
        console.log(' Doctor auth check successful:', response.data);
        
        // Update user data if we got it
        if (response.data?.data) {
            localStorage.setItem(STORAGE_KEYS.USER_DETAILS, JSON.stringify(response.data.data));
            localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, "true");
            localStorage.setItem(STORAGE_KEYS.USER_TYPE, "doctor");
        }
        
        return true;
        
    } catch (error) {
        console.error('Doctor auth check failed:', error);
        
        // For profile setup flow, 404 means authenticated but no profile yet
        if (error?.response?.status === 404) {
            console.log('Doctor authenticated but profile not set up yet');
            localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, "true");
            localStorage.setItem(STORAGE_KEYS.USER_TYPE, "doctor");
            // Don't store user details since profile doesn't exist
            return true; // Still authenticated, just no profile
        }
        
        // Clear auth data for actual auth failures (401, 403)
        if (error?.response?.status === 401 || error?.response?.status === 403) {
            console.log('Doctor authentication failed, clearing auth data');
            clearAuthData();
            return false;
        }
        
        // For server errors (500) or network errors, don't clear auth data
        if (error?.response?.status === 500) {
            console.log(' Server error during doctor auth check - keeping auth state');
            return isUserAuthenticated();
        }
        
        if (!error?.response) {
            console.log(' Network error during doctor auth check - keeping auth state');
            return isUserAuthenticated();
        }
        
        return false;
    }
};

export const setAuthData = (userDetails, tokens, userType = "patient") => {
    try {
        console.log("💾 Storing auth data...");
        console.log("👤 User details:", userDetails);
        console.log("🔑 Tokens received:", {
            access: tokens?.access ? "✅ Present" : "❌ Missing",
            refresh: tokens?.refresh ? "✅ Present" : "❌ Missing"
        });

        // Store user details and auth state
        localStorage.setItem(STORAGE_KEYS.USER_DETAILS, JSON.stringify(userDetails));
        localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, "true");
        localStorage.setItem(STORAGE_KEYS.USER_TYPE, userType);

        // 🚀 NEW: Store tokens for WebSocket authentication
        if (tokens) {
            if (tokens.access) {
                localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access);
                console.log("✅ Access token stored for WebSocket auth");
            } else {
                console.warn("⚠️ No access token provided - WebSocket auth may fail");
            }
            
            if (tokens.refresh) {
                localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh);
                console.log("✅ Refresh token stored");
            }
        } else {
            console.warn("⚠️ No tokens provided - WebSocket auth may fail");
        }

        console.log("✅ Auth data stored successfully");
        window.dispatchEvent(new Event("authStateChanged"));
        return true;
    } catch (error) {
        console.error("❌ Error storing auth data:", error);
        return false;
    }
};

// Get current logged-in user's ID
export const getCurrentUserId = () => {
    const user = getStoredUserData();

    if (!user) return null;
    console.log(`🧠 I am not afraid: ${user.id}`);

    // Some responses may use `id`, others might use `user_id`
    return user.id || user.user_id || null;

};



// Save doctor auth info
export const setDoctorAuthData = (doctorDetails, tokens) => {
    return setAuthData(doctorDetails, tokens, "doctor");
};

// 🔑 NEW: Get stored access token for WebSocket
export const getAccessToken = () => {
    try {
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (token) {
            console.log("✅ Access token found:", token.substring(0, 30) + '...');
            return token;
        } else {
            console.log("❌ No access token found in localStorage");
            return null;
        }
    } catch (error) {
        console.error("❌ Error getting access token:", error);
        return null;
    }
};

// 🔑 NEW: Get stored refresh token
export const getRefreshToken = () => {
    try {
        const token = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        return token || null;
    } catch (error) {
        console.error("❌ Error getting refresh token:", error);
        return null;
    }
};

// 🔄 NEW: Check if token is expired (basic check)
export const isTokenExpired = (token) => {
    if (!token) return true;
    
    try {
        // Decode JWT payload (basic decode, not verification)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (payload.exp && payload.exp < currentTime) {
            console.log("⏰ Token is expired");
            return true;
        }
        
        console.log("✅ Token is still valid");
        return false;
    } catch (error) {
        console.error("❌ Error checking token expiration:", error);
        return true; // Assume expired if we can't decode
    }
};

// 🔄 NEW: Get valid access token (with expiration check)
export const getValidAccessToken = () => {
    const token = getAccessToken();
    
    if (!token) {
        console.log("❌ No access token available");
        return null;
    }
    
    if (isTokenExpired(token)) {
        console.log("⏰ Access token is expired");
        // You could implement token refresh logic here
        return null;
    }
    
    return token;
};
// Clear all auth data
export const clearAuthData = () => {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        window.dispatchEvent(new Event("authStateChanged"));
        console.log("All auth data cleared");
        return true;
    } catch (error) {
        console.error("Error clearing auth data:", error);
        return false;
    }
};

// Get stored user data
export const getStoredUserData = () => {
    try {
        const userData = localStorage.getItem(STORAGE_KEYS.USER_DETAILS);
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error("Error parsing stored user data:", error);
        return null;
    }
};

// Check if user is authenticated (local storage check)
export const isUserAuthenticated = () => {
    return localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED) === "true";
};

// Get user type
export const getUserType = () => {
    return localStorage.getItem(STORAGE_KEYS.USER_TYPE);
};

// Check if user is doctor
export const isDoctor = () => {
    return getUserType() === "doctor";
};

// Check if user is patient
export const isPatient = () => {
    return getUserType() === "patient";
};

// Get auth state
export const getAuthState = () => {
    const userData = getStoredUserData();
    const isAuthenticated = isUserAuthenticated();
    const userType = getUserType();

    return {
        isLoggedIn: isAuthenticated && userData && (userData.id || userData.user_id),
        user: userData,
        userType,
        isAuthenticated,
        isDoctor: userType === "doctor",
        isPatient: userType === "patient"
    };
};

// Logout user
export const logoutUser = async () => {
    try {
        await logout();
        clearAuthData();
        console.log('✅ Logout successful');
        return true;
    } catch (error) {
        console.error(' Logout API failed:', error);
        clearAuthData(); // Still clear even if API fails
        return false;
    }
};

// React auth state hook
export const useAuthState = () => {
    const [authState, setAuthState] = useState(getAuthState());

    useEffect(() => {
        const updateAuthState = () => {
            setAuthState(getAuthState());
        };
        window.addEventListener('authStateChanged', updateAuthState);
        window.addEventListener('storage', updateAuthState);
        return () => {
            window.removeEventListener('authStateChanged', updateAuthState);
            window.removeEventListener('storage', updateAuthState);
        };
    }, []);

    return authState;
};


export const handleSubscriptionError = (error, navigate, showModal) => {
    if (error.response?.status === 402) {
        showModal({
        title: 'Subscription Required',
        message: 'You need an active subscription to access this feature.',
        onConfirm: () => navigate('/subscription/plans'),
        confirmText: 'View Plans',
        cancelText: 'Cancel'
        });
    } else if (error.response?.status === 403) {
        const errorData = error.response.data;

        if (errorData.error_type === 'limit_reached') {
        showModal({
            title: 'Plan Limit Reached',
            message: errorData.message,
            onConfirm: () => navigate('/subscription/plans'),
            confirmText: 'Upgrade Plan',
            cancelText: 'Cancel'
        });
        } else {
        showModal({
            title: 'Feature Not Available',
            message: errorData.message || 'This feature is not available in your current plan.',
            onConfirm: () => navigate('/subscription/plans'),
            confirmText: 'View Plans',
            cancelText: 'Cancel'
        });
        }
    }
    };