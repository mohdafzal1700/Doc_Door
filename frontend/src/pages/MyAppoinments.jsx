import { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Phone, Mail, User, FileText, Video, MessageCircle, Eye, X, Star, CreditCard, AlertCircle, CheckCircle, Timer, Loader2, RefreshCw, CalendarDays, Pencil } from "lucide-react";
import { getAppointments, getAppointmentDetail, cancelAppointment, updateAppointment, getDoctorSchedulesWithParams } from "../endpoints/APIs";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import Header from '../components/home/Header';
import toast from 'react-hot-toast';

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
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    appointmentId: null,
    loading: false
  });

  const [rescheduleData, setRescheduleData] = useState({
    appointmentId: null,
    doctorId: null,
    newDate: "",
    newSlot: null,
    showRescheduleModal: false,
    originalAppointment: null
  });

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAppointments();
      
      console.log('Load Appointments Response:', response);
      
      if (response?.data?.success) {
        setAppointments(response.data.data || []);
      } else if (response?.status === 200 && response?.data) {
        setAppointments(Array.isArray(response.data) ? response.data : []);
      } else {
        const errorMessage = response?.data?.message || 'Failed to load appointments';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error('Error loading appointments:', err);
      let errorMessage = 'Failed to load appointments';
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const handleCancelAppointment = async (appointmentId) => {
    setConfirmModal({
      isOpen: true,
      appointmentId: appointmentId,
      loading: false
    });
  };

  const confirmCancelAppointment = async () => {
    const appointmentId = confirmModal.appointmentId;
    try {
      setConfirmModal(prev => ({ ...prev, loading: true }));
      const response = await cancelAppointment(appointmentId);
      
      console.log('Cancel Response:', response);
      
      let message = '';
      if (response?.data?.success) {
        message = response.data.message || 'Appointment cancelled successfully';
      } else if (response?.status === 200 || response?.status === 204) {
        message = 'Appointment cancelled successfully';
      } else if (response?.data?.message) {
        message = response.data.message;
      } else {
        message = 'Failed to cancel appointment';
      }

      const isSuccess = response?.status >= 200 && response?.status < 300;

      if (isSuccess) {
        setAppointments(prev => prev.map(apt => 
          apt.id === appointmentId ? {
            ...apt,
            status: 'cancelled',
            status_display: 'Cancelled',
            can_cancel: false,
            can_reschedule: false
          } : apt
        ));

        if (selectedAppointment?.id === appointmentId) {
          setIsModalOpen(false);
          setSelectedAppointment(null);
        }

        setConfirmModal({
          isOpen: false,
          appointmentId: null,
          loading: false
        });
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      let errorMessage = 'Failed to cancel appointment';
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    } finally {
      setConfirmModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleViewAppointment = async (appointment) => {
    try {
      setIsModalOpen(true);
      const response = await getAppointmentDetail(appointment.id);
      if (response.data.success) {
        setSelectedAppointment(response.data.data);
      } else {
        setSelectedAppointment(appointment);
      }
    } catch (err) {
      console.error('Error loading appointment details:', err);
      setSelectedAppointment(appointment);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleInitiateReschedule = (appointment) => {
    console.log('Initiating reschedule for appointment:', appointment);

    // Check if appointment can be rescheduled (24 hours in advance)
    const appointmentDate = new Date(appointment.appointment_date);
    const currentDate = new Date();
    const timeDiff = appointmentDate.getTime() - currentDate.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);

    if (hoursDiff < 24) {
      toast.error("Cannot reschedule appointments less than 24 hours in advance");
      return;
    }

    // Extract doctor ID with better error handling
    let doctorId = null;
    if (appointment.doctor_id) {
      doctorId = appointment.doctor_id.toString();
    } else if (appointment.doctor) {
      if (typeof appointment.doctor === 'object' && appointment.doctor.id) {
        doctorId = appointment.doctor.id.toString();
      } else if (typeof appointment.doctor === 'string' || typeof appointment.doctor === 'number') {
        doctorId = appointment.doctor.toString();
      }
    }

    console.log('Extracted doctor ID:', doctorId);

    if (!doctorId || doctorId === '0' || doctorId === 'null' || doctorId === 'undefined') {
      console.error('Invalid doctor ID:', doctorId);
      toast.error("Doctor information not available for rescheduling");
      return;
    }

    // Set tomorrow as minimum date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    setRescheduleData({
      appointmentId: appointment.id,
      doctorId: doctorId,
      newDate: tomorrowStr, // Set to tomorrow by default
      newSlot: null,
      showRescheduleModal: true,
      originalAppointment: appointment
    });
  };

  // Fetch available slots when date changes
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (rescheduleData.newDate && rescheduleData.appointmentId && rescheduleData.doctorId) {
        try {
          setSlotsLoading(true);
          
          console.log('Fetching slots with params:', {
            doctorId: rescheduleData.doctorId,
            date: rescheduleData.newDate,
            mode: rescheduleData.originalAppointment?.mode,
            serviceId: rescheduleData.originalAppointment?.service_id
          });

          const response = await getDoctorSchedulesWithParams(
            rescheduleData.doctorId,
            rescheduleData.newDate,
            rescheduleData.originalAppointment?.mode || 'online',
            rescheduleData.originalAppointment?.service_id || null
          );

          console.log('Slots Response:', response);

          if (response?.data && response.data.success !== false) {
            const schedules = response.data.schedules || response.data || [];
            const allSlots = schedules.flatMap(schedule => 
              schedule.time_slots || []
            ) || [];

            // Filter out past slots for today
            const today = new Date().toISOString().split('T')[0];
            const currentTime = new Date();
            
            const filteredSlots = allSlots.filter(slot => {
              if (rescheduleData.newDate === today) {
                const slotTime = new Date();
                const timeStr = slot.start_time || slot.startTime || slot.time;
                if (!timeStr) return false;
                
                const [hours, minutes] = timeStr.split(':');
                slotTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                return slotTime > currentTime;
              }
              return true;
            });

            console.log('Filtered slots:', filteredSlots);
            setAvailableSlots(filteredSlots);
          } else {
            console.error('Invalid slots response:', response);
            setAvailableSlots([]);
            toast.error(response?.data?.message || "Failed to fetch available slots");
          }
        } catch (error) {
          console.error('Error fetching available slots:', error);
          setAvailableSlots([]);
          let errorMessage = 'Failed to fetch available slots';
          if (error?.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error?.response?.data?.error) {
            errorMessage = error.response.data.error;
          } else if (error?.message) {
            errorMessage = error.message;
          }
          toast.error(errorMessage);
        } finally {
          setSlotsLoading(false);
        }
      } else {
        setAvailableSlots([]);
      }
    };

    fetchAvailableSlots();
  }, [rescheduleData.newDate, rescheduleData.appointmentId, rescheduleData.doctorId]);

  const handleConfirmReschedule = async () => {
    if (!rescheduleData.newDate || !rescheduleData.newSlot) {
      toast.error("Please select both date and time slot");
      return;
    }

    try {
      setActionLoading(`reschedule-${rescheduleData.appointmentId}`);
      
      const slotTime = rescheduleData.newSlot.start_time || 
                      rescheduleData.newSlot.startTime || 
                      rescheduleData.newSlot.time;

      if (!slotTime) {
        toast.error("Invalid slot time selected");
        return;
      }

      const updateData = {
        appointment_date: rescheduleData.newDate,
        slot_time: slotTime,
        slot_id: rescheduleData.newSlot.id
      };

      console.log('Sending reschedule data:', updateData);

      const response = await updateAppointment(rescheduleData.appointmentId, updateData);
      
      console.log('Reschedule Response:', response);

      let isSuccess = false;
      let message = '';

      if (response?.data?.success) {
        isSuccess = true;
        message = response.data.message || 'Appointment rescheduled successfully';
      } else if (response?.status === 200 || response?.status === 204) {
        isSuccess = true;
        message = 'Appointment rescheduled successfully';
      } else if (response?.data?.message) {
        message = response.data.message;
      } else {
        message = 'Failed to reschedule appointment';
      }

      if (isSuccess) {
        // Update the appointment in the list
        setAppointments(prev => prev.map(apt => 
          apt.id === rescheduleData.appointmentId ? {
            ...apt,
            appointment_date: rescheduleData.newDate,
            slot_time: slotTime,
            formatted_date_time: formatDateTime(rescheduleData.newDate, slotTime)
          } : apt
        ));

        // Close the modal and reset data
        setRescheduleData({
          appointmentId: null,
          doctorId: null,
          newDate: "",
          newSlot: null,
          showRescheduleModal: false,
          originalAppointment: null
        });

        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (err) {
      console.error('Error rescheduling appointment:', err);
      let errorMessage = 'Failed to reschedule appointment';
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseRescheduleModal = () => {
    setRescheduleData({
      appointmentId: null,
      doctorId: null,
      newDate: "",
      newSlot: null,
      showRescheduleModal: false,
      originalAppointment: null
    });
    setAvailableSlots([]);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-emerald-100 text-emerald-800";
      case "pending":
        return "bg-amber-100 text-amber-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
        return <Timer className="w-4 h-4" />;
      case "cancelled":
        return <X className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDateTime = (dateStr, timeStr) => {
    try {
      const date = new Date(dateStr);
      const [hours, minutes] = timeStr.split(':');
      const timeObj = new Date();
      timeObj.setHours(parseInt(hours), parseInt(minutes));

      const dateFormatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const timeFormatted = timeObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return `${dateFormatted} at ${timeFormatted}`;
    } catch (err) {
      return `${dateStr} at ${timeStr}`;
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading appointments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
              <p className="text-gray-600 mt-1">Manage your upcoming medical appointments</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="space-y-4">
            {appointments.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No appointments scheduled</h3>
                <p className="text-gray-500 mb-6">You don't have any upcoming appointments.</p>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Book New Appointment
                </Button>
              </div>
            ) : (
              appointments.map((appointment) => (
                <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(appointment.status)} flex items-center gap-1`}>
                              {getStatusIcon(appointment.status)}
                              {appointment.status_display || appointment.status}
                            </span>
                            <span className="text-xs text-gray-500">#{appointment.id}</span>
                          </div>
                          <h3 className="font-semibold text-gray-900">{appointment.doctor_name}</h3>
                          <p className="text-sm text-gray-600">{appointment.service_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          ${formatCurrency(appointment.total_fee)}
                        </div>
                        <div className={`text-xs ${appointment.is_paid ? "text-green-600" : "text-amber-600"}`}>
                          {appointment.is_paid ? 'Paid' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>{appointment.slot_time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        {appointment.mode === "online" ? (
                          <Video className="w-4 h-4 text-green-500" />
                        ) : (
                          <MapPin className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="capitalize">
                          {appointment.mode === "online" ? "Online" : appointment.address || "In-person"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewAppointment(appointment)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>

                      {appointment.can_reschedule && (
                        <Button
                          variant="outline"
                          size="sm"
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
              ))
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Modal for Cancellation */}
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

      {/* Reschedule Modal */}
      {rescheduleData.showRescheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Reschedule Appointment</h2>
              <button
                onClick={handleCloseRescheduleModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Original Appointment Info */}
              {rescheduleData.originalAppointment && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Current Appointment:</p>
                  <p className="text-sm font-medium">
                    {formatDateTime(
                      rescheduleData.originalAppointment.appointment_date,
                      rescheduleData.originalAppointment.slot_time
                    )}
                  </p>
                </div>
              )}

              {/* Date Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  New Appointment Date
                </label>
                <Input
                  type="date"
                  value={rescheduleData.newDate}
                  onChange={(e) => setRescheduleData(prev => ({
                    ...prev,
                    newDate: e.target.value,
                    newSlot: null
                  }))}
                  min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]} // Tomorrow
                />
              </div>

              {/* Time Slot Selection */}
              {rescheduleData.newDate && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Available Time Slots
                  </label>
                  {slotsLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 mt-2">Loading available slots...</p>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {availableSlots.map((slot) => {
                        const timeStr = slot.start_time || slot.startTime || slot.time;
                        return (
                          <button
                            key={slot.id}
                            className={`p-3 rounded-lg border transition-all ${
                              rescheduleData.newSlot?.id === slot.id
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                            onClick={() => setRescheduleData(prev => ({ ...prev, newSlot: slot }))}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span className="text-sm font-medium">{timeStr}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">No available slots for this date</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCloseRescheduleModal}
                  disabled={actionLoading?.startsWith('reschedule-')}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmReschedule}
                  disabled={!rescheduleData.newSlot || actionLoading?.startsWith('reschedule-')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
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

      {/* Appointment Details Modal */}
      {isModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
              <h2 className="font-bold text-lg">Appointment Details</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedAppointment.doctor_name}</h3>
                  <p className="text-sm text-gray-600">{selectedAppointment.service_name}</p>
                  {selectedAppointment.doctor_rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{selectedAppointment.doctor_rating}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Date & Time:</span>
                  <span className="font-medium text-gray-900">
                    {formatDateTime(selectedAppointment.appointment_date, selectedAppointment.slot_time)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {selectedAppointment.mode}
                    {selectedAppointment.mode === "offline" && selectedAppointment.address && ` (${selectedAppointment.address})`}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(selectedAppointment.status)}`}>
                    {selectedAppointment.status_display || selectedAppointment.status}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
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

              <div className="flex flex-wrap gap-3 pt-4">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
                <Button variant="outline">
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
                {selectedAppointment.can_cancel && (
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                    onClick={() => {
                      handleCancelAppointment(selectedAppointment.id);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
                {selectedAppointment.can_reschedule && (
                  <Button
                    variant="outline"
                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={() => {
                      handleInitiateReschedule(selectedAppointment);
                      handleCloseModal();
                    }}
                  >
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Reschedule
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}