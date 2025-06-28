"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react"
import Button from "../components/ui/Button"
import { resetPassword } from "../endpoints/APIs" // Import the API function

const ResetPassword = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const email = location.state?.email || ""
    const otp = location.state?.otp || ""
    const token = location.state?.token || "" // Reset token from OTP verification

    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
    })
    const [errors, setErrors] = useState({})
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    // Redirect if no email or OTP (user shouldn't access this page directly)
    useEffect(() => {
        if (!email || !otp) {
            navigate("/forgot-password")
        }
    }, [email, otp, navigate])

    const handlePasswordChange = (e) => {
        const value = e.target.value
        setFormData((prev) => ({ ...prev, password: value }))
        if (errors.password) {
            setErrors((prev) => ({ ...prev, password: "" }))
        }
    }

    const handleConfirmPasswordChange = (e) => {
        const value = e.target.value
        setFormData((prev) => ({ ...prev, confirmPassword: value }))
        if (errors.confirmPassword) {
            setErrors((prev) => ({ ...prev, confirmPassword: "" }))
        }
    }

    const validateForm = () => {
        const newErrors = {}

        if (!formData.password) {
            newErrors.password = "Password is required"
        } else if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters"
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
            newErrors.password = "Password must contain at least one uppercase letter, one lowercase letter, and one number"
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Please confirm your password"
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords don't match"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (validateForm()) {
            setIsLoading(true)
            try {
                // Prepare form body for API call
                const formBody = {
                    email: email,
                    otp: otp,
                    password: formData.password,
                    confirm_password: formData.confirmPassword
                }

                // Add token if available (some backends might require it)
                if (token) {
                    formBody.token = token
                }

                // Call the actual API
                const response = await resetPassword(formBody)
                console.log("Password reset successful:", response.data)

                // Show success state
                setIsSuccess(true)

                // Redirect to login after 3 seconds
                setTimeout(() => {
                    navigate("/login", {
                        state: {
                            message: "Password reset successful! Please login with your new password.",
                            type: "success"
                        },
                    })
                }, 3000)

            } catch (error) {
                console.error("Password reset failed:", error)
                
                // Handle different error scenarios
                if (error.response?.status === 400) {
                    const errorData = error.response.data
                    if (errorData.password) {
                        setErrors({ password: Array.isArray(errorData.password) ? errorData.password[0] : errorData.password })
                    } else if (errorData.confirm_password) {
                        setErrors({ confirmPassword: Array.isArray(errorData.confirm_password) ? errorData.confirm_password[0] : errorData.confirm_password })
                    } else if (errorData.otp) {
                        setErrors({ general: "OTP has expired or is invalid. Please request a new password reset." })
                    } else if (errorData.message || errorData.error) {
                        setErrors({ general: errorData.message || errorData.error })
                    } else {
                        setErrors({ general: "Please check your password requirements and try again." })
                    }
                } else if (error.response?.status === 404) {
                    setErrors({ general: "Reset session not found. Please start the password reset process again." })
                } else if (error.response?.status === 410) {
                    setErrors({ general: "Reset link has expired. Please request a new password reset." })
                } else if (error.response?.status === 429) {
                    setErrors({ general: "Too many attempts. Please try again later." })
                } else if (error.response?.data?.message) {
                    setErrors({ general: error.response.data.message })
                } else {
                    setErrors({ general: "Failed to reset password. Please try again." })
                }
            } finally {
                setIsLoading(false)
            }
        }
    }

    const getPasswordStrength = (password) => {
        let strength = 0
        if (password.length >= 8) strength++
        if (/[a-z]/.test(password)) strength++
        if (/[A-Z]/.test(password)) strength++
        if (/\d/.test(password)) strength++
        if (/[^A-Za-z0-9]/.test(password)) strength++
        return strength
    }

    const getStrengthColor = (strength) => {
        if (strength <= 2) return "bg-red-500"
        if (strength <= 3) return "bg-yellow-500"
        return "bg-green-500"
    }

    const getStrengthText = (strength) => {
        if (strength <= 2) return "Weak"
        if (strength <= 3) return "Medium"
        return "Strong"
    }

    const handleStartOver = () => {
        navigate("/forgot-password")
    }

    // Don't render if missing required data
    if (!email || !otp) {
        return null
    }

    // Success state
    if (isSuccess) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
                <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} className="text-green-600" />
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Password Reset Successful!</h2>
                        <p className="text-gray-600 mb-6">
                            Your password has been reset successfully. You can now login with your new password.
                        </p>
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-2"></div>
                            <span className="text-gray-600">Redirecting to login...</span>
                        </div>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} className="text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-2">Reset Password</h2>
                    <p className="text-gray-600">
                        Create a new password for your account
                        <br />
                        <span className="font-medium text-gray-800">{email}</span>
                    </p>
                </div>

                {/* General Error */}
                {errors.general && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-800 text-sm">{errors.general}</p>
                        {(errors.general.includes("expired") || errors.general.includes("not found")) && (
                            <button
                                onClick={handleStartOver}
                                className="mt-2 text-purple-600 hover:text-purple-700 font-medium underline text-sm"
                            >
                                Start password reset again
                            </button>
                        )}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {/* New Password */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock size={18} className="text-gray-400" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter new password"
                                value={formData.password}
                                onChange={handlePasswordChange}
                                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                tabIndex="-1"
                            >
                                {showPassword ? (
                                    <EyeOff size={18} className="text-gray-400 hover:text-gray-600" />
                                ) : (
                                    <Eye size={18} className="text-gray-400 hover:text-gray-600" />
                                )}
                            </button>
                        </div>
                        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                    </div>

                    {/* Password Strength Indicator */}
                    {formData.password && (
                        <div className="mb-4">
                            <div className="flex items-center space-x-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${getStrengthColor(getPasswordStrength(formData.password))}`}
                                        style={{ width: `${(getPasswordStrength(formData.password) / 5) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="text-xs text-gray-600">{getStrengthText(getPasswordStrength(formData.password))}</span>
                            </div>
                        </div>
                    )}

                    {/* Confirm Password */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock size={18} className="text-gray-400" />
                            </div>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm new password"
                                value={formData.confirmPassword}
                                onChange={handleConfirmPasswordChange}
                                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                tabIndex="-1"
                            >
                                {showConfirmPassword ? (
                                    <EyeOff size={18} className="text-gray-400 hover:text-gray-600" />
                                ) : (
                                    <Eye size={18} className="text-gray-400 hover:text-gray-600" />
                                )}
                            </button>
                        </div>
                        {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                    </div>

                    {/* Password Requirements */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">Password must contain:</p>
                        <ul className="text-xs text-gray-600 space-y-1">
                            <li className={`flex items-center ${formData.password.length >= 8 ? "text-green-600" : ""}`}>
                                <span className="mr-2">{formData.password.length >= 8 ? "✓" : "•"}</span>
                                At least 8 characters
                            </li>
                            <li className={`flex items-center ${/[a-z]/.test(formData.password) ? "text-green-600" : ""}`}>
                                <span className="mr-2">{/[a-z]/.test(formData.password) ? "✓" : "•"}</span>
                                One lowercase letter
                            </li>
                            <li className={`flex items-center ${/[A-Z]/.test(formData.password) ? "text-green-600" : ""}`}>
                                <span className="mr-2">{/[A-Z]/.test(formData.password) ? "✓" : "•"}</span>
                                One uppercase letter
                            </li>
                            <li className={`flex items-center ${/\d/.test(formData.password) ? "text-green-600" : ""}`}>
                                <span className="mr-2">{/\d/.test(formData.password) ? "✓" : "•"}</span>
                                One number
                            </li>
                        </ul>
                    </div>

                    <Button type="submit" disabled={isLoading} className="mb-4">
                        {isLoading ? "Resetting Password..." : "Reset Password"}
                    </Button>
                </form>

                {/* Footer */}
                <p className="text-center text-sm text-gray-600">
                    Remember your password?{" "}
                    <button
                        onClick={() => navigate("/login")}
                        className="text-purple-600 hover:text-purple-700 font-medium underline"
                    >
                        Back to Login
                    </button>
                </p>
            </div>
        </main>
    )
}

export default ResetPassword