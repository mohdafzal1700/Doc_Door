"use client"

import { useFormik } from "formik"
import * as Yup from "yup"
import { useNavigate } from "react-router-dom"
import { Mail, Lock, User, Phone } from "lucide-react"
import { useState } from "react"

import Logo from "../components/ui/Logo.jsx"
import Input from "../components/ui/Input.jsx"
import Button from "../components/ui/Button.jsx"
import UserTypeToggle from "../components/ui/UserTypeToggle.jsx"
import GoogleButton from "../components/ui/GoogleButton.jsx"
import { register } from "../endpoints/APIs.js" 

const Register = () => {
    const navigate = useNavigate()
    const [errorMsg, setErrorMsg] = useState("")
    const [loading, setLoading] = useState(false)

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
            firstName: Yup.string().required("First name is required"),
            lastName: Yup.string().required("Last name is required"),
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
                
                // Simulate API call for now
                await new Promise((resolve) => setTimeout(resolve, 2000))
                
                // Uncomment when you have the API endpoint
                const response = await register(registrationData)
                console.log("Registration successful:", response)
                
                // Navigate to login or OTP verification page after successful registration
                navigate('/verify-email-otp', { 
                    state: { 
                        email: values.email,
                        message: "Registration successful! Please verify your email to continue."
                    } 
                })
                
            } catch (error) {
                console.error("Registration error:", error)
                // Handle specific backend validation errors
                if (error?.response?.data) {
                    const backendErrors = error.response.data
                    
                    // Handle field-specific errors
                    if (backendErrors.username) {
                        formik.setFieldError("username", backendErrors.username[0])
                    }
                    if (backendErrors.email) {
                        formik.setFieldError("email", backendErrors.email[0])
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
                    
                    // General error message
                    if (backendErrors.detail || backendErrors.message) {
                        setErrorMsg(backendErrors.detail || backendErrors.message)
                    }
                } else {
                    setErrorMsg("Something went wrong. Please try again.")
                }
            } finally {
                setLoading(false)
            }
        },
    })

    const handleGoogleSignUp = () => {
        console.log("Google sign up clicked")
        // Handle Google sign up logic here
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                <Logo />

                <h2 className="text-center text-2xl font-semibold text-purple-600 mb-6">Create Account</h2>

                <form onSubmit={formik.handleSubmit}>
                    <UserTypeToggle
                        value={formik.values.userType}
                        onChange={(value) => formik.setFieldValue("userType", value)}
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

                    <Button type="submit" className="mb-4" disabled={loading}>
                        {loading ? "Creating Account..." : "Sign up"}
                    </Button>
                </form>

                <div className="text-center text-gray-500 text-sm my-4">Or continue with</div>

                <GoogleButton onClick={handleGoogleSignUp} className="mb-6">
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