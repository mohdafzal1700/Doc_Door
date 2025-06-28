"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Mail, ArrowLeft } from "lucide-react"
import Input from "../components/ui/Input"
import Button from "../components/ui/Button"
import { forgotPassword } from "../endpoints/APIs"


const ForgotPassword = () => {
    const navigate = useNavigate()
    const [email, setEmail] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isOtpSent, setIsOtpSent] = useState(false)

    const validateEmail = () => {
        if (!email) {
        setError("Email is required")
        return false
        } else if (!/\S+@\S+\.\S+/.test(email)) {
        setError("Please enter a valid email address")
        return false
        }
        setError("")
        return true
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (validateEmail()) {
            setIsLoading(true)
            try {
                // Call the actual API
                const response = await forgotPassword(email)
                console.log("OTP sent successfully:", response.data)
                
                // Show success message or navigate to OTP verification
                setIsOtpSent(true)
                // Alternative: Navigate to OTP verification with email
                navigate("/verify-otp", { state: { email } })
                
            } catch (error) {
                console.error("Failed to send OTP:", error)
                
                // Handle different error scenarios
                if (error.response?.status === 404) {
                    setError("Email address not found. Please check and try again.")
                } else if (error.response?.status === 429) {
                    setError("Too many requests. Please wait before trying again.")
                } else if (error.response?.data?.message) {
                    setError(error.response.data.message)
                } else {
                    setError("Failed to send OTP. Please try again.")
                }
            } finally {
                setIsLoading(false)
            }
        }
    }

    const handleBackToLogin = () => {
        navigate("/login")
    }

    const handleTryAgain = () => {
        setIsOtpSent(false)
        setError("")
        setEmail("")
    }


    if (isOtpSent) {
        return (
        <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Check Your Email</h2>
                <p className="text-gray-600 mb-6">
                We've sent a password reset link to <br />
                <span className="font-medium text-gray-800">{email}</span>
                </p>
                <Button onClick={handleBackToLogin} className="mb-4">
                Back to Login
                </Button>
                <p className="text-sm text-gray-500">
                Didn't receive the email?{" "}
                <button
                    onClick={() => setIsOtpSent(false)}
                    className="text-purple-600 hover:text-purple-700 font-medium underline"
                >
                    Try again
                </button>
                </p>
            </div>
            </div>
        </main>
        )
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
            {/* Back Button */}
            <button
            onClick={handleBackToLogin}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-6 transition-colors"
            >
            <ArrowLeft size={20} className="mr-2" />
            Back to Login
            </button>

            {/* Header */}
            <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Forgot Password</h2>
            <p className="text-gray-600">
                Enter your email address and we'll send you a one-time password to reset your password.
            </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
            <Input
                label=""
                type="email"
                placeholder="Enter Registered email"
                value={email}
                onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError("")
                }}
                error={error}
                icon={<Mail size={18} className="text-gray-400" />}
            />

            <Button type="submit" disabled={isLoading} className="mb-4">
                {isLoading ? "Sending..." : "Send OTP"}
            </Button>
            </form>

            {/* Footer */}
            <p className="text-center text-sm text-gray-600">
            Remember your password?{" "}
            <button onClick={handleBackToLogin} className="text-purple-600 hover:text-purple-700 font-medium underline">
                Sign in
            </button>
            </p>
        </div>
        </main>
    )
    }

    export default ForgotPassword
