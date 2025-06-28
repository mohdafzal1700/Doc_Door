// auth.js - Cookie-only authentication version
import { getUserProfile, logout } from '../endpoints/APIs'; 
import { getDoctorProfile } from '../endpoints/Doc';
import { useEffect, useState } from 'react';

export const STORAGE_KEYS = {
    USER_DETAILS: "user_details",
    IS_AUTHENTICATED: "isAuthenticated",
    USER_TYPE: "user_type"
    // Remove ACCESS_TOKEN and REFRESH_TOKEN - using cookies only
};

// 🔐 Auth check using cookie-based authentication
export const isAuthenticated = async () => {
    try {
        console.log('🔍 Checking authentication via API call...');
        
        // Try to get user profile (backend reads from cookies automatically)
        const response = await getUserProfile();
        console.log('✅ Auth check successful:', response.data);
        
        // Update user data if we got it
        if (response.data?.data) {
            localStorage.setItem(STORAGE_KEYS.USER_DETAILS, JSON.stringify(response.data.data));
            localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, "true");
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Auth check failed:', error);
        
        // Clear auth data for actual auth failures (401, 403)
        if (error?.response?.status === 401 || error?.response?.status === 403) {
            console.log('🔄 Authentication failed, clearing auth data');
            clearAuthData();
            return false;
        }
        
        // For server errors (500) or network errors, don't clear auth data
        if (error?.response?.status === 500) {
            console.log('⚠️ Server error during auth check - keeping auth state');
            return isUserAuthenticated(); // Fall back to local storage check
        }
        
        if (!error?.response) {
            console.log('🌐 Network error during auth check - keeping auth state');
            return isUserAuthenticated(); // Fall back to local storage check
        }
        
        return false;
    }
};


export const isDoctorAuthenticated = async () => {
    try {
        console.log('🔍 Checking doctor authentication via API call...');
        
        const response = await getDoctorProfile();
        console.log('✅ Doctor auth check successful:', response.data);
        
        // Update user data if we got it
        if (response.data?.data) {
            localStorage.setItem(STORAGE_KEYS.USER_DETAILS, JSON.stringify(response.data.data));
            localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, "true");
            localStorage.setItem(STORAGE_KEYS.USER_TYPE, "doctor");
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Doctor auth check failed:', error);
        
        // For profile setup flow, 404 means authenticated but no profile yet
        if (error?.response?.status === 404) {
            console.log('ℹ️ Doctor authenticated but profile not set up yet');
            localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, "true");
            localStorage.setItem(STORAGE_KEYS.USER_TYPE, "doctor");
            // Don't store user details since profile doesn't exist
            return true; // Still authenticated, just no profile
        }
        
        // Clear auth data for actual auth failures (401, 403)
        if (error?.response?.status === 401 || error?.response?.status === 403) {
            console.log('🔄 Doctor authentication failed, clearing auth data');
            clearAuthData();
            return false;
        }
        
        // For server errors (500) or network errors, don't clear auth data
        if (error?.response?.status === 500) {
            console.log('⚠️ Server error during doctor auth check - keeping auth state');
            return isUserAuthenticated();
        }
        
        if (!error?.response) {
            console.log('🌐 Network error during doctor auth check - keeping auth state');
            return isUserAuthenticated();
        }
        
        return false;
    }
};

// ✅ Save auth info (NO tokens - cookies handle this)
export const setAuthData = (userDetails, tokens, userType = "patient") => {
    try {
        localStorage.setItem(STORAGE_KEYS.USER_DETAILS, JSON.stringify(userDetails));
        localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, "true");
        localStorage.setItem(STORAGE_KEYS.USER_TYPE, userType);
        
        // Don't store tokens - they're in HTTP-only cookies
        console.log("✅ Auth data stored successfully (tokens in cookies)");
        
        window.dispatchEvent(new Event("authStateChanged"));
        return true;
    } catch (error) {
        console.error("❌ Error storing auth data:", error);
        return false;
    }
};

// ✅ Save doctor auth info
export const setDoctorAuthData = (doctorDetails, tokens) => {
    return setAuthData(doctorDetails, tokens, "doctor");
};

// ❌ Clear all auth data
export const clearAuthData = () => {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        window.dispatchEvent(new Event("authStateChanged"));
        console.log("🧹 All auth data cleared");
        return true;
    } catch (error) {
        console.error("❌ Error clearing auth data:", error);
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
        console.error('❌ Logout API failed:', error);
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