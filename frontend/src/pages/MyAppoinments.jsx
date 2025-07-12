import { useState, useEffect } from "react";
import {
  Calendar, Clock, MapPin, Phone, Mail, User, FileText, Video,
  MessageCircle, Eye, X, Star, CreditCard, AlertCircle, CheckCircle,
  Timer, Loader2, RefreshCw, CalendarDays, Pencil
} from "lucide-react";
import { getAppointments, getAppointmentDetail, cancelAppointment,
  updateAppointment, getDoctorSchedulesWithParams } from "../endpoints/APIs";

import Button from "../components/ui/Button";
import { Card,CardContent,CardHeader,CardTitle } from "../components/ui/card";

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || amount === '') {
    return '0.00';
  }
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '0.00';
  }
  
  return numAmount.toFixed(2);
}

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText || 'Cancel'}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {confirmText || 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([])
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    appointmentId: null,
    loading: false
  })
  
  const [rescheduleData, setRescheduleData] = useState({
    appointmentId: null,
    newDate: "",
    newSlot: null,
    showRescheduleModal: false
  })

  useEffect(() => {
    loadAppointments()
  }, [])

  const loadAppointments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await getAppointments()
      
      if (response.data.success) {
        setAppointments(response.data.data)
        
        // DEBUG: Log appointment data
        console.log('=== APPOINTMENT DEBUG ===')
        response.data.data.forEach(apt => {
          console.log(`Appointment ${apt.id}:`, {
            status: apt.status,
            status_display: apt.status_display,
            can_cancel: apt.can_cancel,
            can_reschedule: apt.can_reschedule,
            appointment_date: apt.appointment_date,
            slot_time: apt.slot_time
          })
        })
      } else {
        setError(response.data.message || 'Failed to load appointments')
      }
    } catch (err) {
      console.error('Error loading appointments:', err)
      setError(err.response?.data?.message || 'Failed to load appointments')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadAppointments()
  }

  const handleCancelAppointment = async (appointmentId) => {
    setConfirmModal({
      isOpen: true,
      appointmentId: appointmentId,
      loading: false
    })
  }

  const confirmCancelAppointment = async () => {
    const appointmentId = confirmModal.appointmentId
    
    try {
      setConfirmModal(prev => ({ ...prev, loading: true }))
      
      const response = await cancelAppointment(appointmentId)
      
      console.log('Cancel response:', response.data);
      if (response.data.success) {
        setAppointments(prev => 
          prev.map(apt => 
            apt.id === appointmentId 
              ? { ...apt, status: 'cancelled', status_display: 'Cancelled', can_cancel: false, can_reschedule: false }
              : apt
          )
        )
        
        if (selectedAppointment?.id === appointmentId) {
          setIsModalOpen(false)
          setSelectedAppointment(null)
        }
        
        setConfirmModal({ isOpen: false, appointmentId: null, loading: false })
        alert('Appointment cancelled successfully')
      } else {
        alert(response.data.message || 'Failed to cancel appointment')
      }
    } catch (err) {
      console.error('Error cancelling appointment:', err)
      console.error('Error response:', err.response)
      console.error('Error data:', err.response?.data)
      alert(err.response?.data?.message || 'Failed to cancel appointment')
    } finally {
      setConfirmModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleViewAppointment = async (appointment) => {
    try {
      setIsModalOpen(true)
      
      const response = await getAppointmentDetail(appointment.id)
      if (response.data.success) {
        setSelectedAppointment(response.data.data)
      } else {
        setSelectedAppointment(appointment)
      }
    } catch (err) {
      console.error('Error loading appointment details:', err)
      setSelectedAppointment(appointment)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedAppointment(null)
  }

  const handleInitiateReschedule = (appointment) => {
    const appointmentDate = new Date(appointment.appointment_date)
    const currentDate = new Date()
    const timeDiff = appointmentDate.getTime() - currentDate.getTime()
    const hoursDiff = timeDiff / (1000 * 3600)
    
    if (hoursDiff < 24) {
      alert('Cannot reschedule appointments less than 24 hours in advance')
      return
    }
    
    setRescheduleData({
      appointmentId: appointment.id,
      newDate: appointment.appointment_date,
      newSlot: null,
      showRescheduleModal: true
    })
  }

  const handleConfirmReschedule = async () => {
    if (!rescheduleData.newDate || !rescheduleData.newSlot) {
      alert('Please select both date and time slot')
      return
    }

    try {
      setActionLoading(`reschedule-${rescheduleData.appointmentId}`)
      
      const updateData = {
        appointment_date: rescheduleData.newDate,
        slot_time: rescheduleData.newSlot.start_time || rescheduleData.newSlot.startTime,
        slot_id: rescheduleData.newSlot.id
      }
      
      console.log('Updating appointment with data:', updateData)
      console.log('Selected slot:', rescheduleData.newSlot)
      console.log('Attempting to reschedule appointment:', rescheduleData.appointmentId, updateData)
      const response = await updateAppointment(rescheduleData.appointmentId, updateData)
      console.log('Reschedule response:', response.data);
      
      if (response.data.success) {
        setAppointments(prev => 
          prev.map(apt => 
            apt.id === rescheduleData.appointmentId
              ? { 
                  ...apt, 
                  appointment_date: rescheduleData.newDate,
                  slot_time: rescheduleData.newSlot.start_time || rescheduleData.newSlot.startTime,
                  formatted_date_time: formatDateTime(
                    rescheduleData.newDate, 
                    rescheduleData.newSlot.start_time || rescheduleData.newSlot.startTime
                  )
                }
              : apt
          )
        )
        
        setRescheduleData({
          appointmentId: null,
          newDate: "",
          newSlot: null,
          showRescheduleModal: false
        })
        
        alert('Appointment rescheduled successfully!')
      } else {
        alert(response.data.message || 'Failed to reschedule appointment')
      }
    } catch (err) {
      console.error('Error rescheduling appointment:', err)
      alert(err.response?.data?.message || 'Failed to reschedule appointment')
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (rescheduleData.newDate && rescheduleData.appointmentId) {
        try {
          setSlotsLoading(true)
          const appointment = appointments.find(a => a.id === rescheduleData.appointmentId)
          if (!appointment) {
            setAvailableSlots([])
            return
          }
          
          const response = await getDoctorSchedulesWithParams(
            appointment.doctor_id,
            rescheduleData.newDate,
            appointment.mode,
            appointment.service_id
          )
          
          if (response.data.success) {
            const allSlots = response.data.schedules?.flatMap(schedule => 
              schedule.time_slots || []
            ) || []
            
            const today = new Date().toISOString().split('T')[0]
            const currentTime = new Date()
            
            const filteredSlots = allSlots.filter(slot => {
              if (rescheduleData.newDate === today) {
                const slotTime = new Date()
                const [hours, minutes] = (slot.start_time || slot.startTime).split(':')
                slotTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
                return slotTime > currentTime
              }
              return true
            })
            
            setAvailableSlots(filteredSlots)
          } else {
            setAvailableSlots([])
          }
        } catch (error) {
          console.error('Error fetching available slots:', error)
          setAvailableSlots([])
        } finally {
          setSlotsLoading(false)
        }
      } else {
        setAvailableSlots([])
      }
    }
    
    fetchAvailableSlots()
  }, [rescheduleData.newDate, rescheduleData.appointmentId, appointments])

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-emerald-100 text-emerald-800"
      case "pending":
        return "bg-amber-100 text-amber-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return <CheckCircle className="w-4 h-4" />
      case "pending":
        return <Timer className="w-4 h-4" />
      case "cancelled":
        return <X className="w-4 h-4" />
      case "completed":
        return <CheckCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const formatDateTime = (dateStr, timeStr) => {
    try {
      const date = new Date(dateStr)
      const [hours, minutes] = timeStr.split(':')
      const timeObj = new Date()
      timeObj.setHours(parseInt(hours), parseInt(minutes))
      
      const dateFormatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      
      const timeFormatted = timeObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      
      return `${dateFormatted} at ${timeFormatted}`
    } catch (err) {
      return `${dateStr} at ${timeStr}`
    }
  }

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-sm max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Error Loading Appointments</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">My Appointments</h1>
            <p className="text-gray-600 text-sm">Manage your upcoming medical appointments</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-4">
          {appointments.map((appointment) => {
            // Add debug log for rendering
            console.log(`Rendering appointment ${appointment.id}:`, {
              can_cancel: appointment.can_cancel,
              can_reschedule: appointment.can_reschedule,
              status: appointment.status
            })
            
            return (
              <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${getStatusColor(appointment.status)}`}>
                            {getStatusIcon(appointment.status)}
                            {appointment.status_display || appointment.status}
                          </span>
                          <span className="text-xs text-gray-500">#{appointment.id}</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{appointment.doctor_name}</h3>
                        <p className="text-sm text-gray-600">{appointment.service_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-800">
                        ${formatCurrency(appointment.total_fee)}
                      </div>
                      <div className={`text-xs ${appointment.is_paid ? "text-green-600" : "text-amber-600"}`}>
                        {appointment.is_paid ? 'Paid' : 'Pending'}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{appointment.slot_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {appointment.mode === "online" ? (
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                      ) : (
                        <MapPin className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="capitalize">
                        {appointment.mode === "online" ? "Online" : appointment.address || "Offline"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Debug info */}
                    <div className="text-xs text-gray-500 w-full mb-2">
                      Debug: can_cancel={appointment.can_cancel ? 'true' : 'false'}, 
                      can_reschedule={appointment.can_reschedule ? 'true' : 'false'}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => handleViewAppointment(appointment)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Button>

                    {appointment.can_reschedule && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => handleInitiateReschedule(appointment)}
                        disabled={actionLoading === `reschedule-${appointment.id}`}
                      >
                        {actionLoading === `reschedule-${appointment.id}` ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <CalendarDays className="w-4 h-4 mr-1" />
                        )}
                        Reschedule
                      </Button>
                    )}
                    
                    {appointment.mode === "online" && appointment.status === "confirmed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <Video className="w-4 h-4 mr-1" />
                        Join Call
                      </Button>
                    )}

                    {appointment.can_cancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                        onClick={() => handleCancelAppointment(appointment.id)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {appointments.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl p-8 shadow-sm max-w-md mx-auto">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No appointments scheduled</h3>
              <p className="text-gray-500 mb-4 text-sm">You don't have any upcoming appointments.</p>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Book Appointment</Button>
            </div>
          </div>
        )}

        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, appointmentId: null, loading: false })}
          onConfirm={confirmCancelAppointment}
          loading={confirmModal.loading}
          title="Cancel Appointment"
          message="Are you sure you want to cancel this appointment? This action cannot be undone."
          confirmText="Cancel Appointment"
          cancelText="Keep Appointment"
        />

        {rescheduleData.showRescheduleModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
              <h2 className="font-bold text-lg mb-4">Reschedule Appointment</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900">New Date</label>
                  <input
                    type="date"
                    value={rescheduleData.newDate}
                    onChange={(e) => setRescheduleData(prev => ({ 
                      ...prev, 
                      newDate: e.target.value,
                      newSlot: null
                    }))}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {rescheduleData.newDate && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">Available Time Slots</label>
                    {slotsLoading ? (
                      <div className="text-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        <p className="text-sm text-gray-500 mt-2">Loading available slots...</p>
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {availableSlots.map((slot, index) => (
                          <button
                            key={slot.id || index}
                            className={`p-3 rounded border text-sm ${
                              rescheduleData.newSlot?.id === slot.id
                                ? "bg-blue-100 border-blue-500 text-blue-700"
                                : "bg-white border-gray-300 hover:bg-gray-50"
                            }`}
                            onClick={() => setRescheduleData(prev => ({ ...prev, newSlot: slot }))}
                          >
                            {slot.start_time || slot.startTime} - {slot.end_time || slot.endTime}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-4 text-center">No available slots for this date</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setRescheduleData({
                      appointmentId: null,
                      newDate: "",
                      newSlot: null,
                      showRescheduleModal: false
                    })}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmReschedule}
                    disabled={!rescheduleData.newSlot || actionLoading?.startsWith('reschedule-')}
                  >
                    {actionLoading?.startsWith('reschedule-') ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Pencil className="w-4 h-4 mr-2" />
                    )}
                    Confirm Reschedule
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isModalOpen && selectedAppointment && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
                <h2 className="font-bold text-lg">Appointment Details</h2>
                <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedAppointment.doctor_name}</h3>
                    <p className="text-sm text-gray-600">{selectedAppointment.service_name}</p>
                    {selectedAppointment.doctor_rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm">{selectedAppointment.doctor_rating}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date & Time:</span>
                    <span className="font-medium">
                      {formatDateTime(selectedAppointment.appointment_date, selectedAppointment.slot_time)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium capitalize">
                      {selectedAppointment.mode} {selectedAppointment.mode === "offline" && selectedAppointment.address && `(${selectedAppointment.address})`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedAppointment.status)}`}>
                      {selectedAppointment.status_display || selectedAppointment.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment:</span>
                    <span className={`font-medium ${selectedAppointment.is_paid ? "text-green-600" : "text-amber-600"}`}>
                      {selectedAppointment.is_paid ? 'Paid' : 'Pending'} (${formatCurrency(selectedAppointment.total_fee)})
                    </span>
                  </div>
                </div>

                {selectedAppointment.notes && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-sm text-blue-800 mb-2">Notes</h4>
                    <p className="text-sm text-blue-700">{selectedAppointment.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Message
                  </Button>
                  <Button variant="outline" className="text-sm border-gray-300">
                    <Phone className="w-4 h-4 mr-1" />
                    Call
                  </Button>
                  {selectedAppointment.can_cancel && (
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 ml-auto text-sm"
                      onClick={() => {
                        handleCancelAppointment(selectedAppointment.id)
                      }}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel Appointment
                    </Button>
                  )}
                  {selectedAppointment.can_reschedule && (
                    <Button
                      variant="outline"
                      className="text-amber-600 border-amber-200 hover:bg-amber-50 text-sm"
                      onClick={() => {
                        handleInitiateReschedule(selectedAppointment)
                        handleCloseModal()
                      }}
                    >
                      <CalendarDays className="w-4 h-4 mr-1" />
                      Reschedule
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}