"use client"
import { useFormik } from "formik"
import * as Yup from "yup"
import { useNavigate } from "react-router-dom"
import { Mail, Lock, User, Phone } from "lucide-react"
import { useState, useEffect } from "react"
import Logo from "../components/ui/Logo.jsx"
import Input from "../components/ui/Input.jsx"
import Button from "../components/ui/Button.jsx"
import UserTypeToggle from "../components/ui/UserTypeToggle.jsx"
import GoogleButton from "../components/ui/GoogleButton.jsx"
import { register, googleLogin } from "../endpoints/APIs.js"
import { useToast } from "../components/ui/Toast.jsx"
import { setAuthData } from "../utils/auth.js"

const Register = () => {
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState("")
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
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      userType: "patient", // Default to patient
    },
    validationSchema: Yup.object({
      firstName: Yup.string()
        .required("First name is required")
        .matches(/^[A-Za-z]+$/, "First name must contain only letters")
        .trim(),
      lastName: Yup.string()
        .required("Last name is required")
        .matches(/^[A-Za-z]+$/, "Last name must contain only letters")
        .trim(),
      username: Yup.string()
        .min(3, "Username must be at least 3 characters")
        .required("Username is required"),
      email: Yup.string()
        .email("Please enter a valid email address")
        .required("Email is required"),
      phone: Yup.string()
        .matches(/^\d{10}$/, "Phone number must be exactly 10 digits")
        .required("Phone number is required"),
      password: Yup.string()
        .min(8, "Password must be at least 8 characters")
        .matches(/(?=.*[A-Za-z])(?=.*\d)/, "Password must contain at least one letter and one number")
        .required("Password is required"),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref("password"), null], "Passwords don't match")
        .required("Please confirm your password"),
    }),
    onSubmit: async (values) => {
      setLoading(true)
      setErrorMsg("")
      try {
        // Map frontend values to backend values
        const roleMapping = {
          "patient": "patient",
          "doctor": "doctor"
        }

        // Prepare data for backend API
        const registrationData = {
          first_name: values.firstName,
          last_name: values.lastName,
          username: values.username,
          email: values.email,
          phone_number: values.phone,
          password: values.password,
          role: roleMapping[values.userType], // Map frontend role to backend role
        }

        console.log("Registration attempt:", registrationData)

        const response = await register(registrationData)
        console.log("Registration successful:", response)
        
        toast.success("Registration successful! Please verify your email to continue.")

        // Navigate to login or OTP verification page after successful registration
        navigate('/verify-email-otp', {
          state: {
            email: values.email,
            message: "Registration successful! Please verify your email to continue."
          }
        })
      } catch (error) {
        console.error("Registration error:", error)
        
        // Handle backend validation errors
        if (error?.response?.data) {
          const backendErrors = error.response.data
          
          // Handle field-specific errors
          if (backendErrors.email) {
            formik.setFieldError("email", backendErrors.email[0])
            toast.error(backendErrors.email[0])
          }
          if (backendErrors.username) {
            formik.setFieldError("username", backendErrors.username[0])
          }
          if (backendErrors.phone_number) {
            formik.setFieldError("phone", backendErrors.phone_number[0])
          }
          if (backendErrors.password) {
            formik.setFieldError("password", backendErrors.password[0])
          }
          if (backendErrors.first_name) {
            formik.setFieldError("firstName", backendErrors.first_name[0])
          }
          if (backendErrors.last_name) {
            formik.setFieldError("lastName", backendErrors.last_name[0])
          }

          // Handle non-field errors
          if (typeof backendErrors === 'string') {
            toast.error(backendErrors)
          } else if (backendErrors.detail) {
            toast.error(backendErrors.detail)
          }
        } else {
          toast.error("Something went wrong. Please try again.")
        }
      } finally {
        setLoading(false)
      }
    },
  })

  // Handle Google Sign Up with proper role handling
  const handleGoogleSignUp = async (idToken, userType) => {
    setGoogleLoading(true)
    try {
      console.log("=== GOOGLE SIGNUP DEBUG ===")
      console.log("Selected userType:", userType)
      console.log("ID Token received:", idToken ? "Yes" : "No")
      console.log("About to call googleLogin API for signup with role:", userType)

      // Call Google login API (same endpoint used for both login and signup)
      const response = await googleLogin(idToken, userType)
      console.log("Google signup API response:", response.data)
      console.log("Response status:", response.status)
      console.log("User role in response:", response.data.user?.role)

      if (response.status === 200 && response.data) {
        console.log("Google signup successful!")
        toast.success("Google signup successful!", "Welcome!")

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
            toast.error("Account is registered as a doctor. Please select doctor signup.")
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

            // Navigate based on user type
            console.log("Navigating based on selected userType:", userType)
            if (userType === "doctor") {
              console.log("Google doctor signup - checking verification...")
              handleDoctorRedirection(userData)
            } else {
              console.log("Google patient signup - going to home...")
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
        console.log("Google signup not successful:", response.data)
        toast.error(response.data.error || "Google signup failed")
      }
    } catch (error) {
      console.error("Google signup error:", error)
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
        handleGoogleError(error)
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleDoctorRedirection = (userData) => {
    console.log("Doctor signup - checking verification status...")
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

  const handleGoogleError = (error) => {
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
      errorMessage = "Authentication failed. Please try again.";
    } else if (error?.response?.status === 429) {
      errorMessage = "Too many attempts. Please try again later.";
    } else if (error?.response?.status >= 500) {
      errorMessage = "Server error. Please try again later.";
    } else if (!error?.response) {
      errorMessage = "Network error. Please check your connection.";
    }

    toast.error(errorMessage);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
        <Logo />
        <h2 className="text-center text-2xl font-semibold text-purple-600 mb-6">Create Account</h2>

        <form onSubmit={formik.handleSubmit}>
          <UserTypeToggle
            value={formik.values.userType}
            onChange={(value) => {
              console.log("UserType changed to:", value)
              formik.setFieldValue("userType", value)
            }}
          />

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input
              label="First Name"
              placeholder="John"
              value={formik.values.firstName}
              onChange={(e) => formik.setFieldValue("firstName", e.target.value)}
              error={formik.touched.firstName && formik.errors.firstName}
              icon={<User size={16} className="text-gray-400" />}
            />
            <Input
              label="Last Name"
              placeholder="Doe"
              value={formik.values.lastName}
              onChange={(e) => formik.setFieldValue("lastName", e.target.value)}
              error={formik.touched.lastName && formik.errors.lastName}
              icon={<User size={16} className="text-gray-400" />}
            />
          </div>

          <Input
            label="Username"
            placeholder="johndoe123"
            value={formik.values.username}
            onChange={(e) => formik.setFieldValue("username", e.target.value)}
            error={formik.touched.username && formik.errors.username}
            icon={<User size={16} className="text-gray-400" />}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="john@example.com"
            value={formik.values.email}
            onChange={(e) => formik.setFieldValue("email", e.target.value)}
            error={formik.touched.email && formik.errors.email}
            icon={<Mail size={16} className="text-gray-400" />}
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="9876543210"
            value={formik.values.phone}
            onChange={(e) => formik.setFieldValue("phone", e.target.value)}
            error={formik.touched.phone && formik.errors.phone}
            icon={<Phone size={16} className="text-gray-400" />}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={formik.values.password}
            onChange={(e) => formik.setFieldValue("password", e.target.value)}
            error={formik.touched.password && formik.errors.password}
            icon={<Lock size={16} className="text-gray-400" />}
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            value={formik.values.confirmPassword}
            onChange={(e) => formik.setFieldValue("confirmPassword", e.target.value)}
            error={formik.touched.confirmPassword && formik.errors.confirmPassword}
            icon={<Lock size={16} className="text-gray-400" />}
          />

          {errorMsg && (
            <div className="text-red-500 text-sm mb-4">{errorMsg}</div>
          )}

          <Button 
            type="submit" 
            className="mb-4" 
            disabled={loading || googleLoading}
          >
            {loading ? "Creating Account..." : "Sign up"}
          </Button>
        </form>

        <div className="text-center text-gray-500 text-sm my-4">Or continue with</div>

        <GoogleButton
          userType={formik.values.userType}
          onGoogleLogin={handleGoogleSignUp}
          disabled={loading || googleLoading}
          className="mb-6"
        >
          Sign up with Google
        </GoogleButton>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-purple-600 hover:text-purple-700 font-medium underline"
          >
            Login
          </button>
        </p>
      </div>
    </main>
  )
}

export default Register