"use client"
import { useState, useEffect } from "react"
import { User, Star, Clock, Loader2, Search, TrendingUp, CheckCircle } from "lucide-react"
import { docReview } from "../../endpoints/Doc"
import DocHeader from "../../components/ui/DocHeader"
import DoctorSidebar from "../../components/ui/DocSide"

export default function DoctorReviewPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const response = await docReview()
      console.log(response.data)
      if (response.data.success) {
        setReviews(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const filteredReviews = reviews.filter((review) => {
    const matchesSearch = searchTerm === "" || 
      review.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const renderStars = (rating) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0"

  const approvedReviews = reviews.filter(review => review.status === 'approved').length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-700">Loading reviews...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DocHeader />
      <div className="flex">
        <DoctorSidebar />
        <div className="flex-2 overflow-auto">
          <div className="ml-64 pt-16 px-6 pb-8">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Reviews</h1>
              <p className="text-gray-600">Track and manage your patient feedback</p>
            </div>

            {/* Compact Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Total Reviews</div>
                    <div className="text-2xl font-bold text-gray-900">{reviews.length}</div>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Average Rating</div>
                    <div className="text-2xl font-bold text-gray-900">{averageRating}</div>
                  </div>
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Approved Reviews</div>
                    <div className="text-2xl font-bold text-green-600">{approvedReviews}</div>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Search */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search reviews by patient name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Compact Reviews List */}
            <div className="space-y-4">
              {filteredReviews.length > 0 ? (
                filteredReviews.map((review) => (
                  <div key={review.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4">
                      {/* Header Section */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">
                              {review.patient_name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              {renderStars(review.rating)}
                              <span className="text-xs text-gray-500">
                                ({review.rating}/5)
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusColor(review.status)}`}>
                            {review.status}
                          </span>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(review.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {review.description && (
                        <div className="mb-3 pl-13">
                          <p className="text-gray-700 text-sm italic bg-gray-50 p-3 rounded-lg">
                            "{review.description}"
                          </p>
                        </div>
                      )}

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                        {review.appointment_date && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Appointment:</span>
                            <span className="ml-2 text-gray-700">
                              {new Date(review.appointment_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {review.reviewed_at && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">
                              {review.status === 'approved' ? 'Approved:' : 
                               review.status === 'rejected' ? 'Rejected:' : 'Reviewed:'}
                            </span>
                            <span className="ml-2 text-gray-700">
                              {new Date(review.reviewed_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Admin Notes */}
                      {review.admin_notes && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <span className="font-medium text-blue-800 text-sm">Admin Notes:</span>
                          <p className="text-blue-700 text-sm mt-1">{review.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="p-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                          {searchTerm ? "No matching reviews" : "No reviews yet"}
                        </h3>
                        <p className="text-gray-500 text-sm">
                          {searchTerm 
                            ? `No reviews found matching "${searchTerm}"`
                            : "Reviews from your patients will appear here"
                          }
                        </p>
                      </div>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}