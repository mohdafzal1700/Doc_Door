"use client"
import { useEffect, useRef } from 'react';

const GoogleButton = ({ userType, onGoogleLogin, disabled, children, className = "" }) => {
  const googleInitialized = useRef(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    // Prevent multiple initializations
    if (googleInitialized.current) return;

    const loadGoogleScript = () => {
      // Check if script already exists
      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        initializeGoogle();
        return;
      }

      // Load Google Identity Services script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      script.onerror = () => {
        console.error('Failed to load Google Sign-In script');
      };
      document.head.appendChild(script);
    };

    const initializeGoogle = () => {
      if (window.google && !googleInitialized.current) {
        try {
          const CLIENT_ID = "7383262354-71u9o2d8sbea9p67efa8829p86n09j5n.apps.googleusercontent.com";
          console.log('Using Google Client ID:', CLIENT_ID);

          // FIXED: Store callback function that gets current userType
          window.googleButtonCallback = handleCredentialResponse;

          // Initialize with popup method to avoid FedCM issues
          window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response) => {
              // Get the current callback function which has access to current userType
              if (window.googleButtonCallback) {
                window.googleButtonCallback(response);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: false, // Disable FedCM to avoid conflicts
          });

          googleInitialized.current = true;
          console.log('Google Identity Services initialized successfully');
        } catch (error) {
          console.error('Google initialization error:', error);
        }
      }
    };

    loadGoogleScript();
  }, []);

  // Update the global callback whenever userType changes
  useEffect(() => {
    window.googleButtonCallback = handleCredentialResponse;
  }, [userType]);

  const handleCredentialResponse = async (response) => {
    try {
      console.log('=== GOOGLE BUTTON CALLBACK ===');
      console.log('Google credential received:', response.credential ? 'Yes' : 'No');
      console.log('Current userType in GoogleButton:', userType);
      console.log('About to call onGoogleLogin with userType:', userType);
      
      if (response.credential && onGoogleLogin) {
        await onGoogleLogin(response.credential, userType);
      } else {
        console.error('Missing credential or onGoogleLogin callback');
      }
    } catch (error) {
      console.error('Google credential handling error:', error);
    }
  };

  const handleGoogleSignIn = () => {
    if (disabled) return;

    console.log('=== GOOGLE SIGN-IN TRIGGERED ===');
    console.log('Current userType when button clicked:', userType);

    if (window.google && googleInitialized.current) {
      try {
        console.log('Triggering Google Sign-In...');
        
        // Use renderButton method for better compatibility
        const wrapper = document.createElement('div');
        wrapper.style.display = 'none';
        document.body.appendChild(wrapper);

        window.google.accounts.id.renderButton(wrapper, {
          type: 'standard',
          size: 'large',
          text: 'signin_with',
          theme: 'outline',
        });

        // Programmatically click the hidden Google button
        setTimeout(() => {
          const gButton = wrapper.querySelector('[role="button"]');
          if (gButton) {
            gButton.click();
          } else {
            // Fallback to prompt method
            window.google.accounts.id.prompt();
          }
          document.body.removeChild(wrapper);
        }, 100);
      } catch (error) {
        console.error('Google Sign-In trigger error:', error);
        // Fallback method
        try {
          window.google.accounts.id.prompt();
        } catch (fallbackError) {
          console.error('Fallback method also failed:', fallbackError);
        }
      }
    } else {
      console.error('Google Identity Services not ready');
      console.error('window.google exists:', !!window.google);
      console.error('googleInitialized:', googleInitialized.current);
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleGoogleSignIn}
      disabled={disabled}
      className={`w-full py-3 px-4 rounded-lg font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {disabled ? (
        <div className="w-5 h-5 mr-2 animate-spin border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
      ) : (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )}
      {children}
    </button>
  );
};

export default GoogleButton;