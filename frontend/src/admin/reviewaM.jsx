import { useState, useEffect } from "react"
import Button from "../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { User, Star, Check, X, Clock, Eye, Loader2 } from "lucide-react"

export default function AdminReviewPage() {
  const [reviews, setReviews] = useState([])
  const [summary, setSummary] = useState({})
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [moderating, setModerating] = useState({})

  // Fetch reviews from API
  const fetchReviews = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token') // Adjust based on your auth setup
      const response = await fetch('/api/admin/reviews/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.success) {
        setReviews(data.data)
        setSummary(data.summary)
      } else {
        console.error('Failed to fetch reviews:', data.message)
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle approve/reject
  const handleModeration = async (reviewId, status, adminNotes = '') => {
    try {
      setModerating(prev => ({ ...prev, [reviewId]: true }))
      
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/reviews/${reviewId}/moderate/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: status,
          admin_notes: adminNotes
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update the review in local state
        setReviews(prev => 
          prev.map(review => 
            review.id === reviewId 
              ? { ...review, status: status, reviewed_at: new Date().toISOString() }
              : review
          )
        )
        
        // Update summary counts
        setSummary(prev => ({
          ...prev,
          pending_count: prev.pending_count - 1,
          [status === 'approved' ? 'approved_count' : 'rejected_count']: 
            prev[status === 'approved' ? 'approved_count' : 'rejected_count'] + 1
        }))
        
        console.log(data.message)
      } else {
        console.error('Failed to moderate review:', data.message)
      }
    } catch (error) {
      console.error('Error moderating review:', error)
    } finally {
      setModerating(prev => ({ ...prev, [reviewId]: false }))
    }
  }

  const handleApprove = (reviewId) => {
    handleModeration(reviewId, 'approved')
  }

  const handleReject = (reviewId) => {
    handleModeration(reviewId, 'rejected')
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const filteredReviews = reviews.filter((review) => {
    if (filter === "all") return true
    return review.status === filter
  })

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
      approved: { color: "bg-green-100 text-green-800", icon: Check },
      rejected: { color: "bg-red-100 text-red-800", icon: X },
    }
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading reviews...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Management</h1>
          <p className="text-gray-600">Manage and moderate doctor feedback reviews</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reviews</p>
                  <p className="text-2xl font-bold">{summary.total_reviews || 0}</p>
                </div>
                <Eye className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{summary.pending_count || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{summary.approved_count || 0}</p>
                </div>
                <Check className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{summary.rejected_count || 0}</p>
                </div>
                <X className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {["all", "pending", "approved", "rejected"].map((status) => (
            <Button
              key={status}
              variant={filter === status ? "default" : "outline"}
              onClick={() => setFilter(status)}
              className="capitalize"
            >
              {status === "all" ? "All Reviews" : status}
            </Button>
          ))}
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <Card key={review.id} className="w-full">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {review.doctor?.user?.first_name} {review.doctor?.user?.last_name}
                      </CardTitle>
                      <p className="text-sm text-gray-500">{review.doctor?.specialty || 'Doctor'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(review.status)}
                    <p className="text-sm text-gray-500">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Patient Info */}
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Patient:</span> {review.patient?.user?.first_name} {review.patient?.user?.last_name}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Rating:</span>
                  {renderStars(review.rating)}
                  <span className="text-sm text-gray-600">({review.rating}/5)</span>
                </div>

                {/* Comment */}
                {review.description && (
                  <div>
                    <p className="text-sm font-medium mb-2">Comment:</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      "{review.description}"
                    </p>
                  </div>
                )}

                {/* Admin Notes */}
                {review.admin_notes && (
                  <div>
                    <p className="text-sm font-medium mb-2">Admin Notes:</p>
                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                      {review.admin_notes}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                {review.status === "pending" && (
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={() => handleApprove(review.id)}
                      disabled={moderating[review.id]}
                      className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                    >
                      {moderating[review.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(review.id)}
                      disabled={moderating[review.id]}
                      variant="destructive"
                      className="flex items-center gap-2"
                    >
                      {moderating[review.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      Reject
                    </Button>
                  </div>
                )}

                {/* Show moderation info for processed reviews */}
                {review.status !== 'pending' && review.reviewed_at && (
                  <div className="text-sm text-gray-500 pt-2 border-t">
                    {review.status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
                    {new Date(review.reviewed_at).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredReviews.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-gray-500">No reviews found for the selected filter.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}