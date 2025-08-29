// Complete Login.jsx with Fixed Google Auth Role Handling
"use client"
import { useFormik } from "formik"
import * as Yup from "yup"
import { useNavigate } from "react-router-dom"
import { Mail, Lock, LogIn } from "lucide-react"
import { useState, useEffect } from "react"
import { useContext } from "react"
import { ToastContext } from "../components/ui/Toast"
import Logo from "../components/ui/Logo.jsx"
import Input from "../components/ui/Input.jsx"
import Button from "../components/ui/Button.jsx"
import UserTypeToggle from "../components/ui/UserTypeToggle.jsx"
import GoogleButton from "../components/ui/GoogleButton.jsx"
import { login, googleLogin } from "../endpoints/APIs.js"
import { doctorLogin } from "../endpoints/Doc.js"
import { setAuthData } from "../utils/auth.js"
import { useToast } from "../components/ui/Toast"

const Login = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const toast = useToast()

  // Load Google Sign-In script
  useEffect(() => {
    const loadGoogleScript = () => {
      if (window.google) return // Already loaded
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        console.log("Google Sign-In script loaded")
      }
      script.onerror = () => {
        console.error("Failed to load Google Sign-In script")
      }
      document.head.appendChild(script)
    }
    loadGoogleScript()
  }, [])

  const formik = useFormik({
    initialValues: {
      userType: "patient",
      email: "",
      password: "",
    },
    validationSchema: Yup.object({
      email: Yup.string().email("Please enter a valid email address").required("Email is required"),
      password: Yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
    }),
    onSubmit: async (values) => {
      setLoading(true)
      try {
        console.log("Starting login process:", values)
        let response;

        // Choose the appropriate login function based on userType
        if (values.userType === "doctor") {
          console.log("Calling doctor login...")
          response = await doctorLogin(values)
        } else {
          console.log("Calling patient login...")
          response = await login(values)
        }

        console.log("Login response:", response.data)

        // Handle successful login
        if (response.data.success || response.status === 200) {
          console.log("Login successful!")
          toast.success("Login successful", "Welcome back")

          // Extract user data and tokens from response
          const userData = response.data.user || response.data.userDetails || response.data.data;
          const tokens = {
            access: response.data.access || response.data.access_token,
            refresh: response.data.refresh || response.data.refresh_token
          };

          console.log("User data:", userData)
          console.log("Tokens received:", {
            access: tokens.access ? "Yes" : "No",
            refresh: tokens.refresh ? "Yes" : "No"
          })

          if (userData && tokens.access) {
            // Store auth data with tokens and user type
            const authStored = setAuthData(
              userData,
              tokens,
              values.userType
            )

            if (authStored) {
              console.log("Auth data stored successfully")
              // Dispatch auth state change event
              window.dispatchEvent(new Event("authStateChanged"))

              // Navigate based on user type
              setTimeout(() => {
                if (values.userType === "doctor") {
                  handleDoctorRedirection(userData)
                } else {
                  console.log("Patient login - going to home...")
                  navigate("/home")
                }
              }, 100)
            } else {
              console.error("Failed to store auth data")
              toast.error("Failed to save login state. Please try again.")
            }
          } else {
            console.error("No user details or tokens received")
            toast.error("Invalid response from server. Please try again.")
          }
        } else {
          console.log("Login not successful:", response.data)
          toast.error(response.data.message || response.data.error || "Login failed")
        }
      } catch (error) {
        console.error("Login error:", error)
        handleLoginError(error)
      } finally {
        setLoading(false)
      }
    },
  })

  // Updated handleGoogleLogin function with proper role handling
  const handleGoogleLogin = async (idToken, userType) => {
    setGoogleLoading(true)
    try {
      console.log("=== GOOGLE LOGIN DEBUG ===")
      console.log("Selected userType:", userType)
      console.log("ID Token received:", idToken ? "Yes" : "No")
      console.log("About to call googleLogin API with role:", userType)
      
      // Call Google login API with correct parameters
      const response = await googleLogin(idToken, userType)
      
      console.log("Google login API response:", response.data)
      console.log("Response status:", response.status)
      console.log("User role in response:", response.data.user?.role)

      if (response.status === 200 && response.data) {
        console.log("Google login successful!")
        toast.success("Google login successful", "Welcome!")

        // Extract user data from response
        let userData;
        
        if (response.data.user) {
          userData = response.data.user;
          console.log("Found user data in response.data.user")
        } else if (response.data.data && response.data.data.user) {
          userData = response.data.data.user;
          console.log("Found user data in response.data.data.user")
        } else if (response.data.data) {
          userData = response.data.data;
          console.log("Found user data in response.data.data")
        }

        console.log("Extracted user data:", userData)
        console.log("User role from backend:", userData?.role)

        // Validate that the user role matches what we expected
        if (userData && userData.role) {
          if (userType === "doctor" && userData.role !== "doctor") {
            console.error("Role mismatch! Expected doctor but got:", userData.role)
            toast.error("Account is not registered as a doctor")
            return;
          }
          
          if (userType === "patient" && userData.role !== "patient") {
            console.error("Role mismatch! Expected patient but got:", userData.role)
            toast.error("Account is registered as a doctor. Please select doctor login.")
            return;
          }
        }

        const tokens = {
          access: response.data.access,
          refresh: response.data.refresh
        }

        console.log("Google tokens received:", {
          access: tokens.access ? "Yes" : "No",
          refresh: tokens.refresh ? "Yes" : "No"
        })

        if (userData && tokens.access) {
          // Store auth data
          const authStored = setAuthData(userData, tokens, userType)

          if (authStored) {
            console.log("Google auth data stored successfully")
            
            // Dispatch auth state change event
            window.dispatchEvent(new Event("authStateChanged"))

            // Small delay to ensure cookies are set
            await new Promise(resolve => setTimeout(resolve, 200))

            // Navigate based on user type - use the SELECTED userType, not the response
            console.log("Navigating based on selected userType:", userType)
            if (userType === "doctor") {
              console.log("Google doctor login - checking verification...")
              handleDoctorRedirection(userData)
            } else {
              console.log("Google patient login - going to home...")
              navigate("/home")
            }
          } else {
            console.error("Failed to store Google auth data")
            toast.error("Failed to save login state. Please try again.")
          }
        } else {
          console.error("No user details or tokens received from Google")
          console.error("Available response data keys:", Object.keys(response.data || {}))
          toast.error("Invalid response from server. Please try again.")
        }
      } else {
        console.log("Google login not successful:", response.data)
        toast.error(response.data.error || "Google login failed")
      }
    } catch (error) {
      console.error("Google login error:", error)
      console.error("Error response:", error.response?.data)
      
      // More specific error handling
      if (error.response?.status === 400) {
        const errorData = error.response.data
        if (errorData.error && errorData.error.includes('Already registered as')) {
          toast.error(errorData.error)
        } else {
          toast.error("Invalid Google token. Please try again.")
        }
      } else if (error.response?.status === 500) {
        toast.error("Server error. Please try again later.")
      } else {
        handleLoginError(error)
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleDoctorRedirection = (userData) => {
    console.log("Doctor login - checking verification status...")
    console.log("User data for verification check:", userData);
    
    const verificationStatus = getDoctorVerificationStatus(userData);
    console.log("Determined verification status:", verificationStatus);
    
    switch(verificationStatus) {
      case 'verified':
      case 'approved':
        console.log("Doctor fully verified - going to dashboard...")
        navigate("/doctor/home")
        break;
      case 'pending_approval':
      case 'under_review':
        console.log("Doctor verification pending - going to verification view...")
        navigate("/doctor/verification")
        break;
      case 'rejected':
        console.log("Doctor verification rejected - going to verification view...")
        navigate("/doctor/verification")
        break;
      case 'incomplete':
      default:
        console.log("Doctor verification incomplete - going to verification setup...")
        navigate("/doctor/verification")
    }
  }

  const getDoctorVerificationStatus = (userData) => {
    console.log("Checking verification status from user data:", userData)
    
    const doctorProfile = userData.doctor_profile || userData.profile;
    
    if (doctorProfile) {
      if (doctorProfile.verification_status) {
        console.log('Found explicit verification_status:', doctorProfile.verification_status);
        return doctorProfile.verification_status;
      }
      
      const {
        is_profile_setup_done = false,
        is_education_done = false,
        is_certification_done = false,
        is_license_done = false
      } = doctorProfile;
      
      console.log("Profile completion status:", {
        is_profile_setup_done,
        is_education_done,
        is_certification_done,
        is_license_done
      });
      
      if (is_profile_setup_done && is_education_done && is_certification_done && is_license_done) {
        console.log("All steps completed - status: pending_approval");
        return 'pending_approval';
      }
      
      if (is_profile_setup_done || is_education_done || is_certification_done || is_license_done) {
        console.log("Some steps completed - status: incomplete")
        return 'incomplete';
      }
      
      console.log("No steps completed - status: incomplete");
      return 'incomplete';
    }
    
    if (userData.verification_status) {
      console.log('Found user-level verification:', userData.verification_status)
      return userData.verification_status
    }
    
    if (userData.is_active === true && userData.role === 'doctor') {
      if (!doctorProfile) {
        console.log("User is active but no doctor_profile - status: incomplete");
        return 'incomplete';
      }
    }
    
    console.log("Unable to determine status - defaulting to: incomplete");
    return 'incomplete';
  }

  const handleLoginError = (error) => {
    console.error("Error response:", error?.response?.data)
    
    let errorMessage = "Something went wrong. Please try again.";
    
    if (error?.response?.data) {
      const errorData = error.response.data;
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (errorData.non_field_errors && Array.isArray(errorData.non_field_errors)) {
        errorMessage = errorData.non_field_errors[0];
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
    } else if (error?.message) {
      errorMessage = error.message;
    }

    // Handle specific HTTP status codes
    if (error?.response?.status === 401) {
      errorMessage = "Invalid email or password. Please try again.";
    } else if (error?.response?.status === 429) {
      errorMessage = "Too many login attempts. Please try again later.";
    } else if (error?.response?.status >= 500) {
      errorMessage = "Server error. Please try again later.";
    } else if (!error?.response) {
      errorMessage = "Network error. Please check your connection.";
    }

    toast.error(errorMessage);
  }

  const handleForgotPassword = () => {
    navigate("/forgot-password")
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <Logo />
        <p className="text-center text-gray-600 mb-6">Please sign in to your account</p>

        <form onSubmit={formik.handleSubmit}>
          <UserTypeToggle
            value={formik.values.userType}
            onChange={(value) => {
              console.log("UserType changed to:", value)
              formik.setFieldValue("userType", value)
            }}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            value={formik.values.email}
            onChange={(e) => formik.setFieldValue("email", e.target.value)}
            error={formik.touched.email && formik.errors.email}
            icon={<Mail size={18} className="text-gray-400" />}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={formik.values.password}
            onChange={(e) => formik.setFieldValue("password", e.target.value)}
            error={formik.touched.password && formik.errors.password}
            icon={<Lock size={18} className="text-gray-400" />}
          />

          <div className="text-right mb-6">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-gray-500 hover:text-purple-600 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <Button type="submit" className="mb-4" disabled={loading || googleLoading}>
            <LogIn size={18} className="mr-2" />
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="text-center text-gray-500 text-sm my-4">Or continue with</div>

        <GoogleButton
          userType={formik.values.userType}
          onGoogleLogin={handleGoogleLogin}
          disabled={loading || googleLoading}
          className="mb-6"
        >
          Sign in with Google
        </GoogleButton>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/register")}
            className="text-purple-600 hover:text-purple-700 font-medium underline transition-colors"
          >
            Create Account
          </button>
        </p>
      </div>
    </main>
  )
}

export default Login