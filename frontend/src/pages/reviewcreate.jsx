"use client"
import { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import Button from "../components/ui/Button"
import Input from "../components/ui/Input"
import { Card, CardContent } from "../components/ui/card"
import { User, Send, Loader2 } from "lucide-react"
import { createReview } from "../endpoints/APIs"
import { getCurrentUserId, getStoredUserData } from "../utils/auth"

const feedbackOptions = [
  "Excellent Communication",
  "Helpful Advice", 
  "On-Time Consultation",
  "Professional Manner",
  "Clear Explanation",
  "Patient & Attentive",
]

export default function DoctorFeedbackForm() {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Get data from navigation state
  const { doctorId, doctorName, doctorDept, appointmentId } = location.state || {}
  
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState([])
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)
  const [errorMessage, setErrorMessage] = useState("")

  // Redirect if no doctor data is provided
  useEffect(() => {
    if (!doctorId) {
      navigate("/")
    }
  }, [doctorId, navigate])

  const handleStarClick = (starIndex) => {
    setRating(starIndex)
  }

  const handleStarHover = (starIndex) => {
    setHoveredRating(starIndex)
  }

  const handleStarLeave = () => {
    setHoveredRating(0)
  }

  const toggleOption = (option) => {
    setSelectedOptions((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Reset previous errors
    setErrorMessage("")
    setSubmitStatus(null)
    
    // Basic validation
    if (rating === 0) {
      setErrorMessage('Please select a rating before submitting.')
      return
    }

    // Get userId
    const userId = getCurrentUserId()
    console.log("Current User ID:", userId)
    
    // Check if user is authenticated
    if (!userId) {
      setErrorMessage('Please log in to submit a review.')
      navigate('/login')
      return
    }

    setIsSubmitting(true)

    try {
      const reviewData = {
        doctor: doctorId,
        rating: rating,
        description: comment || '',
      }

      // Add appointment if provided
      if (appointmentId) {
        reviewData.appointment = appointmentId
      }

      console.log("Submitting review data:", reviewData)

      const response = await createReview(reviewData)
      console.log('Review submitted successfully:', response.data)
      
      setSubmitStatus('success')
      
      // Reset form after successful submission
      setRating(0)
      setSelectedOptions([])
      setComment("")
      
      // Optionally redirect after success
      setTimeout(() => {
        navigate('/dashboard') // or wherever you want to redirect
      }, 2000)

    } catch (error) {
      console.error('Full error object:', error)
      
      let errorMsg = 'Failed to submit review. Please try again.'
      
      if (error.response) {
        console.error('Error response:', error.response.data)
        
        // Handle specific error messages from backend
        if (error.response.status === 403) {
          errorMsg = error.response.data?.message || 'Access forbidden. Please ensure you have a patient profile.'
        } else if (error.response.status === 400) {
          errorMsg = error.response.data?.message || 'Invalid data provided.'
          
          // Handle validation errors
          if (error.response.data?.errors) {
            const errors = error.response.data.errors
            errorMsg = Object.values(errors).flat().join(', ')
          }
        } else if (error.response.status === 500) {
          errorMsg = 'Server error. Please try again later.'
        }
      } else if (error.request) {
        errorMsg = 'Network error. Please check your connection.'
      }
      
      setErrorMessage(errorMsg)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading if no doctor data
  if (!doctorId) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Doctor Info */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {doctorName || "Dr. Sarah Johnson"}
                </h3>
                <p className="text-sm text-gray-500">
                  {doctorDept || "Cardiologist"}
                </p>
              </div>
            </div>

            {/* Rating Question */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">
                How was your consultation?
              </h4>
              
              {/* Star Rating */}
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleStarClick(star)}
                    onMouseEnter={() => handleStarHover(star)}
                    onMouseLeave={handleStarLeave}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <svg
                      className={`w-6 h-6 ${
                        star <= (hoveredRating || rating)
                          ? "text-yellow-400 fill-current"
                          : "text-gray-300"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Options */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">
                Select all that apply:
              </h4>
              <div className="flex flex-wrap gap-2">
                {feedbackOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleOption(option)}
                    className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                      selectedOptions.includes(option)
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment Section */}
            <div className="space-y-2">
              <label className="block font-medium text-gray-900">
                Share your experience (optional)
              </label>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us more about your consultation..."
                className="min-h-[100px] resize-none border-gray-300 focus:border-blue-400 focus:ring-blue-400"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-md">
                <p className="text-red-700 text-sm">{errorMessage}</p>
              </div>
            )}

            {/* Status Messages */}
            {submitStatus === 'success' && (
              <div className="p-3 bg-green-100 border border-green-300 rounded-md">
                <p className="text-green-700 text-sm">
                  Review submitted successfully! Thank you for your feedback.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || rating === 0}
              className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Review
                  <Send className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}