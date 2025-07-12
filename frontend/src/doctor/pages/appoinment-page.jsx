"use client"

import { useState, useEffect } from "react"
import Button from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/card"
import Input from "../../components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/Select"
import { Search, Video, Clock, User, Calendar, Phone, MessageCircle, RefreshCw, AlertCircle } from "lucide-react"

// Import the API functions
import { getDoctorUpcomingAppointments, getDoctorAppointmentDetail } from '../../endpoints/Doc'

export default function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState("online")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("time")
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch appointments on component mount and when activeTab changes
  useEffect(() => {
    fetchUpcomingAppointments()
  }, [])

  const fetchUpcomingAppointments = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Fetching upcoming appointments...')
      
      const response = await getDoctorUpcomingAppointments()
      console.log('API Response:', response)
      
      if (response && response.data) {
        // Handle the response structure from Django API
        const appointmentData = Array.isArray(response.data) ? response.data : response.data.results || []
        console.log('Parsed appointments:', appointmentData)
        
        // Transform the API data to match our component structure
        const transformedAppointments = appointmentData.map(appointment => ({
          id: appointment.id,
          patientName: getPatientName(appointment),
          age: appointment.patient?.age || 'N/A',
          gender: appointment.patient?.gender || 'N/A',
          profileImage: appointment.patient?.profile_image || "/placeholder.svg?height=60&width=60",
          time: formatTime(appointment.slot_time),
          date: appointment.appointment_date,
          type: appointment.appointment_type === 'online' ? 'Online' : 'Offline',
          status: appointment.status || 'scheduled',
          reason: appointment.reason || 'Consultation',
          duration: appointment.duration || '30 minutes',
          phone: appointment.patient?.phone || appointment.patient?.user?.phone || 'N/A',
          email: appointment.patient?.user?.email || 'N/A',
          location: appointment.location || (appointment.appointment_type === 'offline' ? 'Room TBD' : null),
          service: appointment.service?.name || 'General Consultation',
          notes: appointment.notes || ''
        }))
        
        setAppointments(transformedAppointments)
      } else {
        console.warn('Unexpected response structure:', response)
        setAppointments([])
      }
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error)
      setError(error.response?.data?.error || error.message || 'Failed to fetch appointments')
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const refreshAppointments = async () => {
    setRefreshing(true)
    await fetchUpcomingAppointments()
    setRefreshing(false)
  }

  const handleJoinConsultation = async (appointmentId) => {
    try {
      console.log("Joining consultation for appointment:", appointmentId)
      
      // Fetch detailed appointment information
      const response = await getDoctorAppointmentDetail(appointmentId)
      console.log('Appointment details:', response.data)
      
      // Here you would typically:
      // 1. For online appointments: redirect to video consultation platform
      // 2. For offline appointments: mark as started or show patient info
      
      if (response.data.appointment_type === 'online') {
        // Redirect to video consultation
        // window.location.href = `/consultation/${appointmentId}`
        alert('Redirecting to video consultation...')
      } else {
        // Start offline appointment
        alert('Starting offline appointment...')
      }
    } catch (error) {
      console.error('Error joining consultation:', error)
      alert('Error starting consultation: ' + (error.response?.data?.error || error.message))
    }
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

  // Filter appointments based on search query and active tab
  const filteredAppointments = appointments.filter((appointment) => {
    const matchesSearch = appointment.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         appointment.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         appointment.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === "online" ? appointment.type === "Online" : appointment.type === "Offline"
    return matchesSearch && matchesTab
  })

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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Appointments</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchUpcomingAppointments} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back, Dr. Smith</h1>
              <p className="text-blue-600 underline cursor-pointer hover:text-blue-700">
                {"Here's your appointment schedule for today"}
              </p>
              <p className="text-sm text-gray-500 mt-1">{getCurrentDate()}</p>
            </div>
            <Button
              onClick={refreshAppointments}
              disabled={refreshing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error && appointments.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 mb-6">
          <Button
            variant={activeTab === "online" ? "default" : "outline"}
            onClick={() => setActiveTab("online")}
            className={`rounded-r-none border-r-0 ${
              activeTab === "online"
                ? "bg-blue-900 text-white hover:bg-blue-800 border-blue-900"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Online Appointments
          </Button>
          <Button
            variant={activeTab === "offline" ? "default" : "outline"}
            onClick={() => setActiveTab("offline")}
            className={`rounded-l-none ${
              activeTab === "offline"
                ? "bg-blue-900 text-white hover:bg-blue-800 border-blue-900"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Offline Appointments
          </Button>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 bg-white border-gray-300">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Sort by Time</SelectItem>
              <SelectItem value="name">Sort by Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Appointment Cards */}
        <div className="space-y-4">
          {sortedAppointments.map((appointment) => (
            <Card key={appointment.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Profile Image */}
                    <div className="relative">
                      <img
                        src={appointment.profileImage || "/placeholder.svg"}
                        alt={appointment.patientName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                      {appointment.type === "Online" && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>

                    {/* Patient Info */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{appointment.patientName}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {appointment.age} years
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {appointment.time}
                        </span>
                        {appointment.location && <span className="text-gray-500">• {appointment.location}</span>}
                      </div>
                      {appointment.service && (
                        <div className="mt-1 text-sm text-blue-600">
                          Service: {appointment.service}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center gap-3">
                    {appointment.type === "Online" ? (
                      <Button
                        onClick={() => handleJoinConsultation(appointment.id)}
                        className="bg-blue-900 hover:bg-blue-800 text-white px-6"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Join Consultation
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleJoinConsultation(appointment.id)}
                        className="bg-blue-900 hover:bg-blue-800 text-white px-6"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Start Appointment
                      </Button>
                    )}
                  </div>
                </div>

                {/* Additional Info Row */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span>
                        <strong>Reason:</strong> {appointment.reason}
                      </span>
                      <span>
                        <strong>Duration:</strong> {appointment.duration}
                      </span>
                      {appointment.status && (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          appointment.status === 'confirmed' 
                            ? 'bg-green-100 text-green-800'
                            : appointment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
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
          ))}
        </div>

        {/* Empty State */}
        {sortedAppointments.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl p-12 shadow-sm max-w-md mx-auto">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">No appointments scheduled</h3>
              <p className="text-gray-500 mb-4">
                {activeTab === "online" ? "No online appointments for today" : "No offline appointments for today"}
              </p>
              <Button onClick={refreshAppointments} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-blue-900 mb-1">
                {appointments.filter((apt) => apt.type === "Online").length}
              </div>
              <div className="text-sm text-blue-700">Online Appointments</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-green-900 mb-1">
                {appointments.filter((apt) => apt.type === "Offline").length}
              </div>
              <div className="text-sm text-green-700">Offline Appointments</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-purple-900 mb-1">{appointments.length}</div>
              <div className="text-sm text-purple-700">Total Appointments</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}