// Fixed Login.jsx with proper redirection logic
"use client"

import { useFormik } from "formik"
import * as Yup from "yup"
import { useNavigate } from "react-router-dom"
import { Mail, Lock, LogIn } from "lucide-react"
import { useState } from "react"
import { useContext } from "react"
import { ToastContext } from "../components/ui/Toast"
import Logo from "../components/ui/Logo.jsx"
import Input from "../components/ui/Input.jsx"
import Button from "../components/ui/Button.jsx"
import UserTypeToggle from "../components/ui/UserTypeToggle.jsx"
import GoogleButton from "../components/ui/GoogleButton.jsx"
import { login } from "../endpoints/APIs.js"
import { doctorLogin } from "../endpoints/Doc.js"
import { setAuthData } from "../utils/auth.js"
import { useToast } from "../components/ui/Toast"

const Login = () => {
    const navigate = useNavigate()
    // const [errorMsg, setErrorMsg] = useState("")
    const [loading, setLoading] = useState(false)
    const toast = useToast() 

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
            // setErrorMsg("")
            
            try {
                console.log("Starting login process:", values)
                
                let response;
                
                // Choose the appropriate login function based on userType
                if (values.userType === "doctor") {
                    console.log("🩺 Calling doctor login...")
                    response = await doctorLogin(values)
                } else {
                    console.log("🏥 Calling patient login...")
                    response = await login(values)
                }
                
                console.log("📡 Login response:", response.data)
                
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
                    
                    console.log("👤 User data:", userData)
                    console.log("🔑 Tokens received:", { 
                        access: tokens.access ? "✅" : "❌", 
                        refresh: tokens.refresh ? "✅" : "❌" 
                    })
                    
                    if (userData && tokens.access) {
                        // Store auth data with tokens and user type
                        const authStored = setAuthData(
                            userData, 
                            tokens, 
                            values.userType
                        )
                        
                        if (authStored) {
                            console.log("✅ Auth data stored successfully")
                            
                            // Dispatch auth state change event
                            window.dispatchEvent(new Event("authStateChanged"))
                            
                            // Navigate based on user type
                            setTimeout(() => {
                                if (values.userType === "doctor") {
                                    handleDoctorRedirection(userData)
                                } else {
                                    // Regular patient login
                                    console.log("🏥 Patient login - going to home...")
                                    navigate("/home")
                                }
                            }, 100)
                        } else {
                            console.error("❌ Failed to store auth data")
                            toast.error("Failed to save login state. Please try again.")
                        }
                    } else {
                        console.error("❌ No user details or tokens received")
                        toast.error("Invalid response from server. Please try again.")
                    }
                } else {
                    // Handle unsuccessful login
                    console.log("❌ Login not successful:", response.data)
                    toast.error(response.data.message || response.data.error || "Login failed")
                }
                
            } catch (error) {
                console.error("❌ Login error:", error)
                handleLoginError(error)
            } finally {
                setLoading(false)
            }
        },
    })


    const handleDoctorRedirection = (userData) => {
        console.log("Doctor login - checking verification status from login response...")
        console.log("Full user data received:", userData);
        
        const verificationStatus = getDoctorVerificationStatus(userData);
        
        console.log("Verification status:", verificationStatus);
        
        
        switch(verificationStatus) {
            case 'verified':
            case 'approved':
                console.log("Doctor fully verified - going to dashboard...")
                navigate("/doctor/home")
                break;
                
            case 'pending_approval':
            case 'under_review':
                console.log("Doctor verification pending - going to pre-verification view...")
                navigate("/doctor/verification")
                break;
                
            case 'rejected':
                console.log("Doctor verification rejected - going to pre-verification view...")
                navigate("/doctor/verification")
                break;
                
            case 'incomplete':
            default:
                console.log("Doctor verification incomplete - going to pre-verification view...")
                navigate("/doctor/verification")
        }
    }


    const getDoctorVerificationStatus = (userData) => {
        console.log("📋 Checking verification status from login data:", userData)
        
    
        

        const doctorProfile= userData.doctor_profile||userData.profile;

        if (doctorProfile){

            if (doctorProfile.verification_status){
                console.log(' Found explicit verification_status:", doctorProfile.verification_status');
                return doctorProfile.verification_status;
            }


        const {
            is_profile_setup_done = false,
            is_education_done = false,
            is_certification_done = false,
            is_license_done = false
        } = doctorProfile;

        console.log("📊 Profile completion status:", {
            is_profile_setup_done,
            is_education_done,
            is_certification_done,
            is_license_done
        });

        if (is_profile_setup_done && is_education_done && is_certification_done && is_license_done) {
            console.log("All steps completed - status: pending_approval");
            return 'pending_approval';
        }

        if (is_profile_setup_done|| is_education_done||is_certification_done||is_license_done){
            console.log("Waiting for the approval")
            return 'incomplete';
        }

        console.log("No steps completed - status: incomplete");
        return 'incomplete';

    }

        

        if (userData.verification_status){
            console.log('Found User_Level verification:' ,userData.verification_status)
            return userData.verification_status
        }

            if (userData.is_active === true && userData.role==='doctor'){
                if (!doctorProfile) {
                console.log("User is_active but no doctor_profile - status: incomplete");
                return 'incomplete';
            }
        }
    
    console.log("Unable to determine status - defaulting to: incomplete");
    return 'incomplete';
        
        
    }

    
    const handleLoginError = (error) => {
        console.error("📡 Error response:", error?.response?.data)
        
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

    return(
        <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
                <Logo />
                <p className="text-center text-gray-600 mb-6">Please sign in to your account</p>

                <form onSubmit={formik.handleSubmit}>
                    <UserTypeToggle
                        value={formik.values.userType}
                        onChange={(value) => formik.setFieldValue("userType", value)}
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

                    {/* {errorMsg && (
                        <div className="text-red-500 text-sm mb-4 p-3 bg-red-50 rounded-md border border-red-200">
                            {errorMsg}
                        </div>
                    )} */}

                    <div className="text-right mb-6">
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-sm text-gray-500 hover:text-purple-600 transition-colors"
                        >
                            Forgot password?
                        </button>
                    </div>

                    <Button type="submit" className="mb-4" disabled={loading}>
                        <LogIn size={18} className="mr-2" />
                        {loading ? "Signing in..." : "Sign in"}
                    </Button>
                </form>

                <div className="text-center text-gray-500 text-sm my-4">Or continue with</div>

                <GoogleButton onClick={() => console.log("Google sign-in")} className="mb-6">
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