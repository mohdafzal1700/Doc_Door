"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, Mail, CheckCircle } from "lucide-react"
import Button from "../components/ui/Button"
import OtpInput from "../components/ui/OtpInput"
import { verifyEmailOtp, resendOtp } from "../endpoints/APIs"

const VerifyEmailOtp = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || "user@example.com"

  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  // Redirect if no email is provided
  useEffect(() => {
    if (!location.state?.email) {
      navigate("/register")
    }
  }, [location.state, navigate])

  // Timer for resend functionality
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [resendTimer])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const handleOtpChange = (value) => {
    setOtp(value)
    if (error) setError("")
    if (success) setSuccess("")
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()

    if (otp.length !== 4) {
      setError("Please enter the complete 4-digit OTP")
      return
    }

    if (!/^\d{4}$/.test(otp)) {
      setError("OTP should contain only numbers")
      return
    }

    setIsLoading(true)
    setError("")
    
    try {
      const formBody = {
        email: email,
        otp: otp
      }
      
      const response = await verifyEmailOtp(formBody)
      console.log("Email verified successfully:", response.data)

      setIsVerified(true)
      setError("")
      setSuccess("Email verified successfully!")

      // Auto redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login", { 
          state: { 
            message: "Email verified successfully! You can now log in.",
            email: email
          } 
        })
      }, 3000)
      
    } catch (error) {
      console.error("Email verification failed:", error)
      
      if (error.response?.status === 400) {
        const errorMessage = error.response.data?.message || error.response.data?.error
        if (errorMessage?.toLowerCase().includes("expired")) {
          setError("OTP has expired. Please request a new one.")
        } else if (errorMessage?.toLowerCase().includes("invalid")) {
          setError("Invalid OTP. Please check and try again.")
        } else if (errorMessage?.toLowerCase().includes("already verified")) {
          setError("Email is already verified. Redirecting to login...")
          setTimeout(() => navigate("/login", { state: { email } }), 2000)
        } else {
          setError("Invalid OTP. Please try again.")
        }
      } else if (error.response?.status === 404) {
        setError("Email not found. Please try registering again.")
      } else if (error.response?.status === 429) {
        setError("Too many attempts. Please wait before trying again.")
      } else if (error.response?.data?.message) {
        setError(error.response.data.message)
      } else {
        setError("Verification failed. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (!canResend) return

    setIsLoading(true)
    setError("")
    setSuccess("")
    
    try {
      const response = await resendOtp(email)
      console.log("OTP resent successfully:", response.data)

      setResendTimer(60)
      setCanResend(false)
      setOtp("")
      setSuccess("New OTP sent to your email!")
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
      
    } catch (error) {
      console.error("Failed to resend OTP:", error)
      
      if (error.response?.status === 429) {
        setError("Too many requests. Please wait before trying again.")
      } else if (error.response?.status === 404) {
        setError("Email not found. Please try registering again.")
      } else if (error.response?.status === 400) {
        const errorMessage = error.response.data?.message || error.response.data?.error
        if (errorMessage?.toLowerCase().includes("already verified")) {
          setError("Email is already verified. Redirecting to login...")
          setTimeout(() => navigate("/login", { state: { email } }), 2000)
        } else {
          setError(errorMessage || "Failed to resend OTP. Please try again.")
        }
      } else if (error.response?.data?.message) {
        setError(error.response.data.message)
      } else {
        setError("Failed to resend OTP. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToRegister = () => {
    navigate("/register")
  }

  const handleProceedToLogin = () => {
    navigate("/login", { 
      state: { 
        email: email,
        message: "Email verified successfully! Please log in."
      } 
    })
  }

  // Success view after verification
  if (isVerified) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-100 via-green-200 to-green-400 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Email Verified!</h2>
          <p className="text-gray-600 mb-6">
            Your email <span className="font-medium text-gray-800">{email}</span> has been successfully verified.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            You will be automatically redirected to login in a few seconds...
          </p>
          <Button onClick={handleProceedToLogin} className="w-full bg-green-600 hover:bg-green-700">
            Continue to Login
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-blue-400 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
        {/* Back Button */}
        <button
          onClick={handleBackToRegister}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-6 transition-colors duration-200"
          disabled={isLoading}
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Register
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={32} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Verify Your Email</h2>
          <p className="text-gray-600 mb-2">Enter the 4-digit verification code sent to:</p>
          <p className="font-medium text-gray-800 text-sm bg-gray-50 px-3 py-2 rounded-lg inline-block">
            {email}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm text-center font-medium">{success}</p>
          </div>
        )}

        {/* OTP Form */}
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <OtpInput 
            length={4} 
            value={otp} 
            onChange={handleOtpChange} 
            error={error}
            disabled={isLoading}
          />

          <Button 
            type="submit" 
            disabled={isLoading || otp.length !== 4} 
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Verifying...
              </span>
            ) : (
              "Verify Email"
            )}
          </Button>
        </form>

        {/* Resend Section */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="text-center">
            {!canResend ? (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Didn't receive the code?</p>
                <p className="text-sm text-gray-500">
                  Resend available in <span className="font-medium text-blue-600">{formatTime(resendTimer)}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600 mb-4">Didn't receive the code?</p>
            )}

            <Button
              variant="outline"
              onClick={handleResendOtp}
              disabled={!canResend || isLoading}
              className={`w-full border-blue-200 text-blue-600 hover:bg-blue-50 ${
                !canResend ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Sending..." : "Resend Verification Code"}
            </Button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need to use a different email?{" "}
              <button
                onClick={handleBackToRegister}
                className="text-blue-600 hover:text-blue-700 font-medium underline"
                disabled={isLoading}
              >
                Go back to register
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default VerifyEmailOtp