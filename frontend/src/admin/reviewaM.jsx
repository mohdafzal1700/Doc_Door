"use client"

import { useState, useEffect } from "react"
import { User, Star, Check, X, Clock, Eye, Loader2, Search } from "lucide-react"
import { moderateAdminReview, getAllAdminReviews } from "../endpoints/adm"
import AdminHeader from "../components/ui/AdminHeader"
import Sidebar from "../components/ui/Sidebar"

export default function AdminReviewPage() {
  const [reviews, setReviews] = useState([])
  const [summary, setSummary] = useState({})
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [moderating, setModerating] = useState({})
  const [searchTerm, setSearchTerm] = useState("")

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const response = await getAllAdminReviews()
      console.log(response.data.data)
      if (response.data.success) {
        setReviews(response.data.data)
        setSummary(response.data.summary)
        
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleModeration = async (reviewId, status) => {
    try {
      setModerating(prev => ({ ...prev, [reviewId]: true }))
      const response = await moderateAdminReview(reviewId, status)
      
      if (response.data.success) {
        setReviews(prev => 
          prev.map(review => 
            review.id === reviewId 
              ? { ...review, status: status, reviewed_at: new Date().toISOString() }
              : review
          )
        )
        
        setSummary(prev => ({
          ...prev,
          pending_count: prev.pending_count - 1,
          [status === 'approved' ? 'approved_count' : 'rejected_count']: 
            prev[status === 'approved' ? 'approved_count' : 'rejected_count'] + 1
        }))
      }
    } catch (error) {
      console.error('Error moderating review:', error)
    } finally {
      setModerating(prev => ({ ...prev, [reviewId]: false }))
    }
  }

  const handleApprove = (reviewId) => handleModeration(reviewId, 'approved')
  const handleReject = (reviewId) => handleModeration(reviewId, 'rejected')

  useEffect(() => {
    fetchReviews()
  }, [])

  const filteredReviews = reviews.filter((review) => {
    const matchesFilter = filter === "all" || review.status === filter
    const matchesSearch = searchTerm === "" || 
      review.doctor?.user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.doctor?.user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.patient?.user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.patient?.user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          <span className="text-gray-700">Loading reviews...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
            <AdminHeader/>
            <Sidebar/>

            <div className="ml-64 pt-20 px-8 pb-10">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Review Management</h1>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded border">
              <div className="text-gray-600 text-sm">Total Reviews</div>
              <div className="text-2xl font-bold">{summary.total_reviews || 0}</div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="text-gray-600 text-sm">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{summary.pending_count || 0}</div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="text-gray-600 text-sm">Approved</div>
              <div className="text-2xl font-bold text-green-600">{summary.approved_count || 0}</div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="text-gray-600 text-sm">Rejected</div>
              <div className="text-2xl font-bold text-red-600">{summary.rejected_count || 0}</div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="bg-white p-4 rounded border mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded"
                />
              </div>
              <div className="flex gap-2">
                <select 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  <option value="all">All Reviews</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {filteredReviews.length > 0 ? (
              filteredReviews.map((review) => (
                <div key={review.id} className="bg-white p-4 rounded border">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium">
                        Dr. {review.doctor_name} {review.doctor?.user?.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">{review.doctor?.specialty}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      review.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      review.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {review.status}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">Rating:</span>
                      {renderStars(review.rating)}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Patient:</span> {review.patient_name} {review.patient?.user?.last_name}
                    </p>
                    {review.description && (
                      <p className="text-sm italic">"{review.description}"</p>
                    )}
                  </div>

                  {review.status === "pending" && (
                    <div className="flex gap-2 pt-3 border-t">
                      <button
                        onClick={() => handleApprove(review.id)}
                        disabled={moderating[review.id]}
                        className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm"
                      >
                        {moderating[review.id] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(review.id)}
                        disabled={moderating[review.id]}
                        className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded text-sm"
                      >
                        {moderating[review.id] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        Reject
                      </button>
                    </div>
                  )}

                  {review.status !== 'pending' && review.reviewed_at && (
                    <div className="text-xs text-gray-500 pt-2 border-t mt-3">
                      {review.status === 'approved' ? 'Approved' : 'Rejected'} on {new Date(review.reviewed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-white p-8 text-center rounded border">
                <p className="text-gray-600">
                  {searchTerm 
                    ? `No reviews found matching "${searchTerm}"`
                    : `No ${filter === 'all' ? '' : filter + ' '}reviews found`
                  }
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="mt-3 px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </div>
       
      </div>
    </div>
  )
}