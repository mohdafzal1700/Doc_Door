"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, Mail } from "lucide-react"
import Button from "../components/ui/Button"
import OtpInput from "../components/ui/OtpInput"
import { verifyForgotOtp, forgotPassword } from "../endpoints/APIs"

const VerifyOtp = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || "user@example.com"

  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const [canResend, setCanResend] = useState(false)

  // Redirect if no email is provided
  useEffect(() => {
    if (!location.state?.email) {
      navigate("/forgot-password")
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
      
      const response = await verifyForgotOtp(formBody)
      console.log("OTP verified successfully:", response.data)

      // Navigate to reset password page with email, OTP, and any token from response
      navigate("/reset-password", { 
        state: { 
          email, 
          otp,
          token: response.data.token || response.data.reset_token || response.data.access_token
        } 
      })
      
    } catch (error) {
      console.error("OTP verification failed:", error)
      
      if (error.response?.status === 400) {
        const errorMessage = error.response.data?.message || error.response.data?.error
        if (errorMessage?.toLowerCase().includes("expired")) {
          setError("OTP has expired. Please request a new one.")
        } else if (errorMessage?.toLowerCase().includes("invalid")) {
          setError("Invalid OTP. Please check and try again.")
        } else {
          setError("Invalid OTP. Please try again.")
        }
      } else if (error.response?.status === 404) {
        setError("Email not found. Please try again.")
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
      // Call the forgot password API again to resend OTP
      const response = await forgotPassword(email)
      console.log("OTP resent successfully:", response.data)

      // Reset timer to 1 minute
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
        setError("Email not found. Please go back and verify your email.")
      } else if (error.response?.status === 400) {
        const errorMessage = error.response.data?.message || error.response.data?.error
        setError(errorMessage || "Failed to resend OTP. Please try again.")
      } else if (error.response?.data?.message) {
        setError(error.response.data.message)
      } else {
        setError("Failed to resend OTP. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToForgotPassword = () => {
    navigate("/forgot-password")
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-400 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
        {/* Back Button */}
        <button
          onClick={handleBackToForgotPassword}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-6 transition-colors duration-200"
          disabled={isLoading}
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Forgot Password
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={32} className="text-purple-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Verify OTP</h2>
          <p className="text-gray-600 mb-2">Enter the 4-digit code sent to:</p>
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
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Verifying...
              </span>
            ) : (
              "Verify OTP"
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
                  Resend available in <span className="font-medium text-purple-600">{formatTime(resendTimer)}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600 mb-4">Didn't receive the code?</p>
            )}

            <Button
              variant="outline"
              onClick={handleResendOtp}
              disabled={!canResend || isLoading}
              className={`w-full border-purple-200 text-purple-600 hover:bg-purple-50 ${
                !canResend ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Sending..." : "Resend OTP"}
            </Button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Wrong email?{" "}
              <button
                onClick={handleBackToForgotPassword}
                className="text-purple-600 hover:text-purple-700 font-medium underline"
                disabled={isLoading}
              >
                Change email
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default VerifyOtp