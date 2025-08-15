import { useState, useEffect } from "react"
import Button from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/card"
import Input from "../../components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/Select"
import { Search, Video, Clock, User, Calendar, Phone, MessageCircle, RefreshCw, AlertCircle, Eye, X, MapPin, FileText, CreditCard, Activity, CheckCircle } from "lucide-react"
import DocHeader from '../../components/ui/DocHeader';
// Import the API function
import { getDoctorAppointmentDashboard, getDoctorAppointments, updateAppointmentStatus } from '../../endpoints/Doc'

export default function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("time")
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [allAppointments, setAllAppointments] = useState([])
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [appointmentToComplete, setAppointmentToComplete] = useState(null)
  const [completing, setCompleting] = useState(false)
  
  // Add missing pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch appointments on component mount and when activeTab changes
  useEffect(() => {
    fetchAppointments()
  }, [activeTab])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Fetching appointments...')
      
      // Use the correct API function for getting appointments list
      const response = await getDoctorAppointments()
      console.log('API Response:', response)
      
      if (response && response.data) {
        // Handle the response structure from Django API
        const appointmentData = Array.isArray(response.data) ? response.data : response.data.results || []
        console.log('Parsed appointments:', appointmentData)
        
        // Transform the API data to match your component structure
        const transformedAppointments = appointmentData.map(appointment => ({
          id: appointment.id,
          patientName: appointment.patient_name || getPatientName(appointment),
          age: appointment.patient_age || 'N/A',
          gender: appointment.patient_gender || 'N/A',
          email: appointment.patient_email || 'N/A',
          phone: appointment.patient_phone || 'N/A',
          profileImage: appointment.patient_profile_image || "/placeholder.svg?height=60&width=60",
          time: appointment.slot_time ? formatTime(appointment.slot_time) : 'No time',
          date: appointment.appointment_date,
          type: appointment.mode === 'online' ? 'Online' : 'Offline',
          status: appointment.status || 'pending',
          reason: appointment.notes || 'Consultation',
          duration: appointment.duration || '30 minutes',
          location: appointment.address?.address || (appointment.mode === 'offline' ? 'Room TBD' : null),
          service: appointment.service_name || 'General Consultation',
          serviceId: appointment.service_id,
          notes: appointment.notes || '',
          totalFee: appointment.total_fee || 0,
          isPaid: appointment.is_paid || false,
          formattedDateTime: appointment.formatted_date_time,
          statusDisplay: appointment.status_display,
          canCancel: appointment.can_cancel,
          canReschedule: appointment.can_reschedule,
          doctorId: appointment.doctor_id,
          createdAt: appointment.created_at,
          updatedAt: appointment.updated_at,
          medicalRecord: appointment.medical_record_details,
          mode: appointment.mode,
          schedule: appointment.schedule
        }))
        
        // Set all appointments (for stats calculation)
        setAllAppointments(transformedAppointments)
        
        // Filter appointments based on active tab
        const filteredByMode = activeTab === "all" 
          ? transformedAppointments 
          : transformedAppointments.filter(appointment => {
              return activeTab === "online" 
                ? appointment.mode === "online" 
                : appointment.mode === "offline"
            })
        
        setAppointments(filteredByMode)
      } else {
        console.warn('Unexpected response structure:', response)
        setAppointments([])
        setAllAppointments([])
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
      setError(error.response?.data?.error || error.message || 'Failed to fetch appointments')
      setAppointments([])
      setAllAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = appointment.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         appointment.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         appointment.email.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  // Add pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredAppointments.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage)

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment)
    setShowDetailsModal(true)
  }

  const handleJoinConsultation = (appointmentId) => {
    const appointment = appointments.find(a => a.id === appointmentId)
    if (appointment) {
      alert(appointment.mode === 'online' 
        ? 'Starting video consultation...' 
        : 'Starting in-person appointment...')
    }
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedAppointment(null)
  }

  // Check if appointment time has passed
  const isAppointmentTimePassed = (appointment) => {
    try {
      const now = new Date()
      // Parse the appointment date and time
      let appointmentDateTime

      // Handle different time formats
      if (appointment.time && appointment.time !== 'No time') {
        // Convert 12-hour format to 24-hour if needed
        let timeStr = appointment.time
        if (timeStr.includes('PM') || timeStr.includes('AM')) {
          const [time, period] = timeStr.split(' ')
          const [hours, minutes] = time.split(':')
          let hour24 = parseInt(hours)
          if (period === 'PM' && hour24 !== 12) {
            hour24 += 12
          } else if (period === 'AM' && hour24 === 12) {
            hour24 = 0
          }
          timeStr = `${hour24.toString().padStart(2, '0')}:${minutes}`
        }
        appointmentDateTime = new Date(`${appointment.date}T${timeStr}`)
      } else {
        // If no time, assume it's for today and has passed
        appointmentDateTime = new Date(appointment.date)
      }

      console.log('Current time:', now)
      console.log('Appointment time:', appointmentDateTime)
      console.log('Has passed:', appointmentDateTime <= now)
      
      return appointmentDateTime <= now
    } catch (error) {
      console.error('Error parsing appointment time:', error, appointment)
      return false
    }
  }

  // Handle complete button click
  const handleCompleteClick = (appointment) => {
    setAppointmentToComplete(appointment)
    setShowCompleteConfirm(true)
  }

  // Handle complete confirmation
  const handleCompleteConfirm = async (confirmed) => {
    if (!confirmed) {
      setShowCompleteConfirm(false)
      setAppointmentToComplete(null)
      return
    }

    try {
      setCompleting(true)
      
      // Call the API to update appointment status
      const response = await updateAppointmentStatus(appointmentToComplete.id, {
        status: 'completed',
        notes: `Appointment completed on ${new Date().toLocaleDateString()}`
      })
      
      console.log('Appointment status updated:', response)
      
      // Update local state with the response data
      const updatedAppointment = {
        ...appointmentToComplete,
        status: 'completed',
        statusDisplay: 'Completed'
      }
      
      const updatedAppointments = appointments.map(appointment => 
        appointment.id === appointmentToComplete.id ? updatedAppointment : appointment
      )
      
      const updatedAllAppointments = allAppointments.map(appointment => 
        appointment.id === appointmentToComplete.id ? updatedAppointment : appointment
      )
      
      setAppointments(updatedAppointments)
      setAllAppointments(updatedAllAppointments)
      
      // Show success message
      alert('Appointment marked as completed successfully!')
      
    } catch (error) {
      console.error('Error completing appointment:', error)
      // Show detailed error message
      const errorMessage = error.response?.data?.error || error.message || 'Failed to complete appointment. Please try again.'
      alert(`Error: ${errorMessage}`)
    } finally {
      setCompleting(false)
      setShowCompleteConfirm(false)
      setAppointmentToComplete(null)
    }
  }

  const getPatientName = (appointment) => {
    if (appointment.patient?.user?.first_name || appointment.patient?.user?.last_name) {
      return `${appointment.patient.user.first_name || ''} ${appointment.patient.user.last_name || ''}`.trim()
    }
    return appointment.patient?.name || appointment.patient_name || 'Unknown Patient'
  }

  const formatTime = (timeString) => {
    if (!timeString) return 'No time'
    try {
      return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return timeString
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No date'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch (error) {
      return dateString
    }
  }

  // Calculate stats based on current view
  const getStatsForCurrentView = () => {
    if (activeTab === "all") {
      return {
        online: allAppointments.filter(a => a.mode === "online").length,
        offline: allAppointments.filter(a => a.mode === "offline").length,
        total: allAppointments.length
      }
    } else {
      return {
        online: appointments.filter(a => a.mode === "online").length,
        offline: appointments.filter(a => a.mode === "offline").length,
        total: appointments.length
      }
    }
  }

  const stats = getStatsForCurrentView()

  if (loading && !appointments.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    )
  }

  if (error && !appointments.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Appointments</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchAppointments} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DocHeader title="Appointment Dashboard" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Appointments</h1>
              <p className="text-gray-600">Manage your upcoming consultations</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={fetchAppointments}
                variant="outline"
                size="sm"
                className="border-gray-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs and Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex space-x-1 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => {
                  setActiveTab("all")
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "all"
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setActiveTab("online")
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "online"
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Online
              </button>
              <button
                onClick={() => {
                  setActiveTab("offline")
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "offline"
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                In-Person
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 w-full"
                />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 mr-4">
                  <Video className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-900">
                    {allAppointments.filter(a => a.mode === "online").length}
                  </p>
                  <p className="text-sm text-blue-700">Online Appointments</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 mr-4">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">
                    {allAppointments.filter(a => a.mode === "offline").length}
                  </p>
                  <p className="text-sm text-green-700">In-Person Appointments</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 mr-4">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-900">
                    {allAppointments.length}
                  </p>
                  <p className="text-sm text-purple-700">Total Appointments</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments List */}
        {loading && !appointments.length ? (
          <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading appointments...</p>
            </div>
          </div>
        ) : error && !appointments.length ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Appointments</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchAppointments} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              {currentItems.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {currentItems.map((appointment) => (
                    <div key={appointment.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <img
                              src={appointment.profileImage}
                              alt={appointment.patientName}
                              className="w-14 h-14 rounded-full object-cover border-2 border-gray-200"
                            />
                            {appointment.mode === "online" && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{appointment.patientName}</h3>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {appointment.age} • {appointment.gender}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {appointment.time} • {formatDate(appointment.date)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleViewDetails(appointment)}
                            variant="outline"
                            size="sm"
                            className="border-gray-300 px-3 py-1 h-8"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:bg-gray-100/50 transition-colors px-3 py-1 h-8"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Message
                          </Button>

                          {(appointment.status === 'confirmed' && (isAppointmentTimePassed(appointment) || true)) && (
                            <Button
                              onClick={() => handleCompleteClick(appointment)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-300 hover:bg-green-50 transition-colors px-3 py-1 h-8"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="px-2 py-1 bg-gray-100 rounded-full text-gray-700">
                            {appointment.service}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            appointment.status === 'confirmed'
                              ? 'bg-green-100 text-green-800'
                              : appointment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : appointment.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {appointment.statusDisplay}
                          </span>
                          <span className="text-gray-600">
                            {formatCurrency(appointment.totalFee)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">No appointments found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery
                      ? "No matches for your search"
                      : activeTab === "all"
                      ? "You don't have any appointments"
                      : activeTab === "online"
                      ? "You don't have any online appointments"
                      : "You don't have any in-person appointments"}
                  </p>
                  <Button onClick={fetchAppointments} variant="outline" size="sm" className="mx-auto">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, filteredAppointments.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredAppointments.length}</span> results
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setCurrentPage(Math.max(1, currentPage - 1))
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                    className="border-gray-300"
                  >
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }

                      return (
                        <Button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          variant={currentPage === pageNum ? 'solid' : 'outline'}
                          size="sm"
                          className={`${currentPage === pageNum ? 'bg-blue-600 text-white' : 'border-gray-300'}`}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    onClick={() => {
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                    className="border-gray-300"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Complete Appointment Confirmation Modal */}
      {showCompleteConfirm && appointmentToComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Complete Appointment</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to mark the appointment with{' '}
                <span className="font-medium">{appointmentToComplete.patientName}</span> as completed?
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => handleCompleteConfirm(false)}
                  variant="outline"
                  disabled={completing}
                  className="px-6"
                >
                  No
                </Button>
                <Button
                  onClick={() => handleCompleteConfirm(true)}
                  disabled={completing}
                  className="bg-green-600 hover:bg-green-700 px-6"
                >
                  {completing ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    'Yes, Complete'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Appointment Details</h2>
                <button
                  onClick={closeDetailsModal}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Patient Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Patient Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{selectedAppointment.patientName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Age</p>
                      <p className="font-medium">{selectedAppointment.age}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Gender</p>
                      <p className="font-medium">{selectedAppointment.gender}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Contact</p>
                      <p className="font-medium">{selectedAppointment.phone}</p>
                      <p className="font-medium text-sm text-gray-600">{selectedAppointment.email}</p>
                    </div>
                  </div>
                </div>

                {/* Appointment Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Appointment Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Date & Time</p>
                      <p className="font-medium">
                        {formatDate(selectedAppointment.date)} at {selectedAppointment.time}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="font-medium capitalize">{selectedAppointment.mode}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Service</p>
                      <p className="font-medium">{selectedAppointment.service}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Duration</p>
                      <p className="font-medium">{selectedAppointment.duration}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Fee</p>
                      <p className="font-medium">{formatCurrency(selectedAppointment.totalFee)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Payment</p>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        selectedAppointment.isPaid
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedAppointment.isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedAppointment.medicalRecord && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <FileText className="w-5 h-5 text-blue-600 mr-2" />
                      Medical Record
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Record ID</p>
                        <p className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                          {selectedAppointment.medicalRecord.id}
                        </p>
                      </div>
                      {selectedAppointment.medicalRecord.symptoms && (
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Symptoms</p>
                          <p className="text-gray-700">{selectedAppointment.medicalRecord.symptoms}</p>
                        </div>
                      )}
                      {selectedAppointment.medicalRecord.diagnosis && (
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Diagnosis</p>
                          <p className="text-gray-700">{selectedAppointment.medicalRecord.diagnosis}</p>
                        </div>
                      )}
                      {selectedAppointment.medicalRecord.treatment && (
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Treatment</p>
                          <p className="text-gray-700">{selectedAppointment.medicalRecord.treatment}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Location/Notes */}
                {selectedAppointment.location && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Location</h3>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">{selectedAppointment.location}</p>
                    </div>
                  </div>
                )}

                {selectedAppointment.notes && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                    <div className="flex items-start gap-2">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">{selectedAppointment.notes}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => handleJoinConsultation(selectedAppointment.id)}
                    className="bg-blue-600 hover:bg-blue-700 flex-1 min-w-[200px]"
                  >
                    {selectedAppointment.mode === "online" ? (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        Start Consultation
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Begin Appointment
                      </>
                    )}
                  </Button>

                  <Button variant="outline" className="border-gray-300 flex-1 min-w-[200px]">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}