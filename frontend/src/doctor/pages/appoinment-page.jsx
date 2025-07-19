"use client"

import { useState, useEffect } from "react"
import Button from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/card"
import Input from "../../components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/Select"
import { Search, Video, Clock, User, Calendar, Phone, MessageCircle, RefreshCw, AlertCircle, Eye, X, MapPin, FileText, CreditCard, Activity } from "lucide-react"
import DocHeader from '../../components/ui/DocHeader';
import DoctorSidebar from '../../components/ui/DocSide';

// Import the API function
import { getDoctorAppointmentDashboard, getDoctorAppointments } from '../../endpoints/Doc'

export default function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState("online")
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
        
        // Filter by mode on the frontend since backend doesn't have this filter
        const filteredByMode = appointmentData.filter(appointment => {
          return activeTab === "online" ? appointment.mode === "online" : appointment.mode === "offline"
        })
        
        // Transform the API data to match your component structure
        const transformedAppointments = filteredByMode.map(appointment => ({
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
          medicalRecord: appointment.medical_record,
          mode: appointment.mode,
          schedule: appointment.schedule
        }))
        
        setAppointments(transformedAppointments)
        setAllAppointments(transformedAppointments) 
      } else {
        console.warn('Unexpected response structure:', response)
        setAppointments([])
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
      setError(error.response?.data?.error || error.message || 'Failed to fetch appointments')
      setAppointments([])
    } finally {
      setLoading(false)
    }

  }

  const filteredAppointmentsByTab = allAppointments.filter(appointment => {
  return activeTab === "online" ? appointment.mode === "online" : appointment.mode === "offline"
})

  const filteredAppointments = filteredAppointmentsByTab.filter((appointment) => {
  const matchesSearch = appointment.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       appointment.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       appointment.email.toLowerCase().includes(searchQuery.toLowerCase())
  // Remove the matchesTab logic since we already filtered by tab
  return matchesSearch
})

  const refreshAppointments = async () => {
    setRefreshing(true)
    await fetchAppointments()
    setRefreshing(false)
  }

  const handleViewDetails = async (appointmentId) => {
    try {
      setLoadingDetails(true)
      setShowDetailsModal(true)
      
      // Find the appointment in our existing data rather than making a new API call
      const appointment = appointments.find(a => a.id === appointmentId)
      
      if (appointment) {
        setSelectedAppointment(appointment)
      } else {
        setError('Appointment details not found')
      }
    } catch (error) {
      console.error('Error fetching appointment details:', error)
      setError('Failed to load appointment details')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleJoinConsultation = async (appointmentId) => {
    try {
      console.log("Joining consultation for appointment:", appointmentId)
      
      // Find the appointment in our existing data
      const appointment = appointments.find(a => a.id === appointmentId)
      
      if (appointment) {
        if (appointment.mode === 'online') {
          alert('Redirecting to video consultation...')
        } else {
          alert('Starting offline appointment...')
        }
      } else {
        alert('Appointment not found')
      }
    } catch (error) {
      console.error('Error joining consultation:', error)
      alert('Error starting consultation: ' + (error.response?.data?.error || error.message))
    }
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedAppointment(null)
  }

  // Helper function to get patient name from nested structure
  const getPatientName = (appointment) => {
    if (appointment.patient?.user?.first_name || appointment.patient?.user?.last_name) {
      return `${appointment.patient.user.first_name || ''} ${appointment.patient.user.last_name || ''}`.trim()
    }
    return appointment.patient?.name || appointment.patient_name || 'Unknown Patient'
  }

  // Helper function to format time
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

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  // Helper function to format date
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

  // Filter appointments based on search query and active tab
  // const filteredAppointments = appointments.filter((appointment) => {
  //   const matchesSearch = appointment.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //                        appointment.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //                        appointment.email.toLowerCase().includes(searchQuery.toLowerCase())
  //   const matchesTab = activeTab === "online" ? appointment.type === "Online" : appointment.type === "Offline"
  //   return matchesSearch && matchesTab
  // })

  // Sort appointments
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    if (sortBy === "time") {
      return a.time.localeCompare(b.time)
    }
    if (sortBy === "name") {
      return a.patientName.localeCompare(b.patientName)
    }
    return 0
  })

  const getCurrentDate = () => {
    const today = new Date()
    return today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Show loading state
  if (loading && appointments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error && appointments.length === 0) {
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
      {/* Header */}
      <DocHeader title="Appointment Dashboard" />
      <div className="flex">
<DoctorSidebar/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8 bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Today's Appointments</h1>
              <p className="text-gray-600">{getCurrentDate()}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={refreshAppointments}
                disabled={refreshing}
                variant="outline"
                className="flex items-center gap-2"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Error banner */}
          {error && appointments.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs and Filters */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-6">
          {/* Tabs */}
          <div className="flex gap-0 mb-6 border-b border-gray-200">
            <button
              onClick={() => {
                setActiveTab("online")
                fetchAppointments("online")
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === "online"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Online Appointments
            </button>
            <button
              onClick={() => {
                setActiveTab("offline")
                fetchAppointments("offline")
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === "offline"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Offline Appointments
            </button>
          </div>

          {/* Search and Sort */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search patients by name, phone or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 w-full"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48 bg-white border-gray-300">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">Sort by Time</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-4 flex items-center">
              <div className="p-3 rounded-full bg-blue-100 mr-4">
                <Video className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-900">
                  {appointments.filter((apt) => apt.type === "Online").length}
                </div>
                <div className="text-sm text-blue-700">Online Appointments</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-100">
            <CardContent className="p-4 flex items-center">
              <div className="p-3 rounded-full bg-green-100 mr-4">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-900">
                  {appointments.filter((apt) => apt.type === "Offline").length}
                </div>
                <div className="text-sm text-green-700">Offline Appointments</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-100">
            <CardContent className="p-4 flex items-center">
              <div className="p-3 rounded-full bg-purple-100 mr-4">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-900">{appointments.length}</div>
                <div className="text-sm text-purple-700">Total Appointments</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Appointment Cards */}
        <div className="space-y-4">
          {sortedAppointments.length > 0 ? (
            sortedAppointments.map((appointment) => (
              <Card key={appointment.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Profile Image */}
                      <div className="relative">
                        <img
                          src={appointment.profileImage || "/placeholder.svg"}
                          alt={appointment.patientName}
                          className="w-14 h-14 rounded-full object-cover border-2 border-gray-200"
                        />
                        {appointment.type === "Online" && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>

                      {/* Patient Info */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{appointment.patientName}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {appointment.age} years • {appointment.gender}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {appointment.time}
                          </span>
                          {appointment.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {appointment.location}
                            </span>
                          )}
                        </div>
                        {appointment.service && (
                          <div className="mt-1 text-sm text-blue-600">
                            {appointment.service}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      <Button
                        onClick={() => handleViewDetails(appointment.id)}
                        variant="outline"
                        size="sm"
                        className="text-gray-600 border-gray-300 bg-transparent"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      <Button
                        onClick={() => handleJoinConsultation(appointment.id)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {appointment.type === "Online" ? (
                          <>
                            <Video className="w-4 h-4 mr-1" />
                            Join
                          </>
                        ) : (
                          <>
                            <Calendar className="w-4 h-4 mr-1" />
                            Start
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Additional Info Row */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span>
                          <strong>Reason:</strong> {appointment.reason}
                        </span>
                        <span>
                          <strong>Duration:</strong> {appointment.duration}
                        </span>
                        <span>
                          <strong>Fee:</strong> {formatCurrency(appointment.totalFee)}
                        </span>
                        {appointment.statusDisplay && (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            appointment.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800'
                              : appointment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : appointment.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {appointment.statusDisplay}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="text-gray-600 border-gray-300 bg-transparent">
                          <Phone className="w-4 h-4 mr-1" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline" className="text-gray-600 border-gray-300 bg-transparent">
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Message
                        </Button>
                      </div>
                    </div>
                    {appointment.notes && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Notes:</strong> {appointment.notes}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm">
              <div className="max-w-md mx-auto">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No appointments scheduled</h3>
                <p className="text-gray-500 mb-4">
                  {activeTab === "online" 
                    ? "You don't have any online appointments for today" 
                    : "You don't have any in-person appointments for today"}
                </p>
                <Button onClick={refreshAppointments} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Appointment Details</h2>
                <Button
                  onClick={closeDetailsModal}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading appointment details...</p>
                </div>
              ) : selectedAppointment ? (
                <div className="space-y-6">
                  {/* Patient Information */}
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Patient Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Name</p>
                        <p className="font-medium">{selectedAppointment.patientName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Age</p>
                        <p className="font-medium">{selectedAppointment.age || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Gender</p>
                        <p className="font-medium">{selectedAppointment.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{selectedAppointment.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{selectedAppointment.email || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Appointment Information */}
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Appointment Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Date & Time</p>
                        <p className="font-medium">{selectedAppointment.formattedDateTime || `${formatDate(selectedAppointment.date)} at ${selectedAppointment.time}`}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Type</p>
                        <p className="font-medium">{selectedAppointment.type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Service</p>
                        <p className="font-medium">{selectedAppointment.service}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          selectedAppointment.status === 'confirmed' 
                            ? 'bg-green-100 text-green-800'
                            : selectedAppointment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : selectedAppointment.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedAppointment.statusDisplay || selectedAppointment.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Fee</p>
                        <p className="font-medium">{formatCurrency(selectedAppointment.totalFee)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Payment Status</p>
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

                  {/* Location/Address (for offline appointments) */}
                  {selectedAppointment.mode === 'offline' && (
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Location</h3>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <p className="text-gray-700">{selectedAppointment.location || 'Address not provided'}</p>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedAppointment.notes && (
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                      <div className="flex items-start gap-2">
                        <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                        <p className="text-gray-700">{selectedAppointment.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Actions</h3>
                    <div className="flex flex-wrap gap-3">
                      {selectedAppointment.canCancel && (
                        <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
                          Cancel Appointment
                        </Button>
                      )}
                      {selectedAppointment.canReschedule && (
                        <Button variant="outline" size="sm" className="text-blue-600 border-blue-300 hover:bg-blue-50">
                          Reschedule
                        </Button>
                      )}
                      <Button 
                        onClick={() => handleJoinConsultation(selectedAppointment.id)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {selectedAppointment.type === "Online" ? (
                          <>
                            <Video className="w-4 h-4 mr-1" />
                            Join Consultation
                          </>
                        ) : (
                          <>
                            <Calendar className="w-4 h-4 mr-1" />
                            Start Appointment
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Created: {formatDate(selectedAppointment.createdAt)}</p>
                    <p>Last Updated: {formatDate(selectedAppointment.updatedAt)}</p>
                    <p>Appointment ID: {selectedAppointment.id}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Details</h3>
                  <p className="text-gray-500 mb-4">Could not load appointment details. Please try again.</p>
                  <Button 
                    onClick={() => handleViewDetails(selectedAppointment?.id)} 
                    variant="outline"
                    size="sm"
                    className="flex items-center mx-auto"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}