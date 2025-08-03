import { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Phone, Mail, User, FileText, Video, MessageCircle, Eye, X, Star, CreditCard, AlertCircle,Stethoscope, CheckCircle, Timer, Loader2, RefreshCw, CalendarDays, Pencil } from "lucide-react";
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
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <h3 className="text-lg font-semibold mb-3 text-gray-900">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {cancelText || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function PatientAppointments() {
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
      
      if (response?.data?.success) {
        setAppointments(response.data.data || []);
      } else {
        setError('Failed to load appointments');
      }
    } catch (err) {
      console.error('Error loading appointments:', err);
      setError('Failed to load appointments');
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
      
      if (response?.status >= 200 && response?.status < 300) {
        setAppointments(prev => prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, status: 'cancelled', status_display: 'Cancelled', can_cancel: false, can_reschedule: false }
            : apt
        ));
        
        if (selectedAppointment?.id === appointmentId) {
          setIsModalOpen(false);
          setSelectedAppointment(null);
        }
        
        setConfirmModal({ isOpen: false, appointmentId: null, loading: false });
      }
    } catch (err) {
      console.error('Error cancelling appointment:', err);
    } finally {
      setConfirmModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleViewAppointment = async (appointment) => {
    try {
      setIsModalOpen(true);
      setSelectedAppointment(appointment);
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
    const appointmentDate = new Date(appointment.appointment_date);
    const currentDate = new Date();
    const timeDiff = appointmentDate.getTime() - currentDate.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);

    if (hoursDiff < 24) {
      alert("Cannot reschedule appointments less than 24 hours in advance");
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    setRescheduleData({
      appointmentId: appointment.id,
      doctorId: appointment.doctor_id || '1',
      newDate: tomorrowStr,
      newSlot: null,
      showRescheduleModal: true,
      originalAppointment: appointment
    });
  };

  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (rescheduleData.newDate && rescheduleData.appointmentId && rescheduleData.doctorId) {
        try {
          setSlotsLoading(true);
          const response = await getDoctorSchedules(rescheduleData.doctorId, rescheduleData.newDate);
          
          if (response?.data && response.data.success !== false) {
            const schedules = response.data.schedules || response.data || [];
            const allSlots = schedules.flatMap(schedule => schedule.time_slots || []) || [];
            setAvailableSlots(allSlots);
          } else {
            setAvailableSlots([]);
          }
        } catch (error) {
          console.error('Error fetching available slots:', error);
          setAvailableSlots([]);
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
      alert("Please select both date and time slot");
      return;
    }

    try {
      setActionLoading(`reschedule-${rescheduleData.appointmentId}`);
      const slotTime = rescheduleData.newSlot.start_time;
      
      const updateData = {
        appointment_date: rescheduleData.newDate,
        slot_time: slotTime,
        slot_id: rescheduleData.newSlot.id
      };

      const response = await updateAppointment(rescheduleData.appointmentId, updateData);
      
      if (response?.status >= 200 && response?.status < 300) {
        setAppointments(prev => prev.map(apt => 
          apt.id === rescheduleData.appointmentId
            ? { ...apt, appointment_date: rescheduleData.newDate, slot_time: slotTime }
            : apt
        ));
        
        setRescheduleData({
          appointmentId: null,
          doctorId: null,
          newDate: "",
          newSlot: null,
          showRescheduleModal: false,
          originalAppointment: null
        });
      }
    } catch (err) {
      console.error('Error rescheduling appointment:', err);
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
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-sm max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Error Loading Appointments</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center mx-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Patient Header */}
        <div className="bg-white rounded-xl shadow-sm mb-6 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">John Doe</h1>
                <p className="text-gray-600">ID: #12345 • john.doe@email.com</p>
                <p className="text-sm text-gray-500 mt-1">Patient since January 2023</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">My Appointments</h2>
                  <p className="text-gray-600">Manage your upcoming medical appointments</p>
                </div>
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Book New Appointment
              </button>
            </div>
          </div>

          <div className="p-6">
            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No appointments scheduled</h3>
                <p className="text-gray-500 mb-6">You don't have any upcoming appointments.</p>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                  Book New Appointment
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Stethoscope className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(appointment.status)} flex items-center gap-1`}>
                              {getStatusIcon(appointment.status)}
                              {appointment.status_display || appointment.status}
                            </span>
                            <span className="text-xs text-gray-500">#{appointment.id}</span>
                          </div>
                          <h3 className="font-semibold text-lg text-gray-900">{appointment.doctor_name}</h3>
                          <p className="text-sm text-gray-600">{appointment.doctor_specialty}</p>
                          {appointment.doctor_rating && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm text-gray-600">{appointment.doctor_rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg text-gray-900">
                          ${formatCurrency(appointment.total_fee)}
                        </div>
                        <div className={`text-sm flex items-center gap-1 ${appointment.is_paid ? "text-green-600" : "text-amber-600"}`}>
                          <CreditCard className="w-4 h-4" />
                          {appointment.is_paid ? 'Paid' : 'Pending'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">{formatDate(appointment.appointment_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">{appointment.slot_time} ({appointment.duration})</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        {appointment.mode === "online" ? (
                          <Video className="w-4 h-4 text-green-500" />
                        ) : (
                          <MapPin className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-sm font-medium capitalize">
                          {appointment.mode === "online" ? "Online" : appointment.address || "In-person"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-sm text-gray-800 mb-2">Appointment Details</h4>
                      <p className="text-sm text-gray-700 mb-2">{appointment.service_name}</p>
                      <p className="text-sm text-gray-600">{appointment.problem}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleViewAppointment(appointment)}
                        className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </button>
                      
                      {appointment.can_reschedule && (
                        <button
                          onClick={() => handleInitiateReschedule(appointment)}
                          disabled={actionLoading === `reschedule-${appointment.id}`}
                          className="flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `reschedule-${appointment.id}` ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CalendarDays className="w-4 h-4 mr-2" />
                          )}
                          Reschedule
                        </button>
                      )}

                      {appointment.mode === "online" && appointment.status === "confirmed" && (
                        <button className="flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                          <Video className="w-4 h-4 mr-2" />
                          Join Call
                        </button>
                      )}

                      {appointment.can_cancel && (
                        <button
                          onClick={() => handleCancelAppointment(appointment.id)}
                          className="flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors ml-auto"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-xl text-gray-900">Reschedule Appointment</h2>
              <button
                onClick={handleCloseRescheduleModal}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Original Appointment Info */}
              {rescheduleData.originalAppointment && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium mb-1">Current Appointment:</p>
                  <p className="text-sm text-blue-800">
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
                <input
                  type="date"
                  value={rescheduleData.newDate}
                  onChange={(e) => setRescheduleData(prev => ({
                    ...prev,
                    newDate: e.target.value,
                    newSlot: null
                  }))}
                  min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                      <p className="text-sm text-gray-500 mt-2">Loading available slots...</p>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
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
                            onClick={() => setRescheduleData(prev => ({
                              ...prev,
                              newSlot: slot
                            }))}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="w-4 h-4" />
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
                <button
                  onClick={handleCloseRescheduleModal}
                  disabled={actionLoading?.startsWith('reschedule-')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReschedule}
                  disabled={!rescheduleData.newSlot || actionLoading?.startsWith('reschedule-')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {actionLoading?.startsWith('reschedule-') ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Pencil className="w-4 h-4 mr-2" />
                  )}
                  Confirm Reschedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {isModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Stethoscope className="w-6 h-6 text-blue-600" />
                  <h2 className="font-bold text-xl text-gray-900">Appointment Details</h2>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700 p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Doctor Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">{selectedAppointment.doctor_name}</h3>
                  <p className="text-gray-600">{selectedAppointment.doctor_specialty}</p>
                  {selectedAppointment.doctor_rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-gray-600">{selectedAppointment.doctor_rating}</span>
                      <span className="text-xs text-gray-500">(4.8/5.0)</span>
                    </div>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(selectedAppointment.status)}`}>
                  {selectedAppointment.status_display || selectedAppointment.status}
                </span>
              </div>

              <div className="h-px bg-gray-200"></div>

              {/* Appointment Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 text-gray-900">Date & Time</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{formatDate(selectedAppointment.appointment_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{selectedAppointment.slot_time} ({selectedAppointment.duration})</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-gray-900">Appointment Type</h4>
                  <div className="flex items-center gap-2 text-gray-700">
                    {selectedAppointment.mode === "online" ? (
                      <>
                        <Video className="w-4 h-4 text-green-500" />
                        <span>Online Consultation</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>In-Person Visit</span>
                      </>
                    )}
                  </div>
                  {selectedAppointment.address && (
                    <p className="text-sm text-gray-600 mt-1 ml-6">{selectedAppointment.address}</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-gray-900">Service</h4>
                  <p className="text-gray-700">{selectedAppointment.service_name}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-gray-900">Payment</h4>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    <span className={`font-medium ${selectedAppointment.is_paid ? "text-green-600" : "text-amber-600"}`}>
                      {selectedAppointment.is_paid ? 'Paid' : 'Pending'} - ${formatCurrency(selectedAppointment.total_fee)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <h4 className="font-semibold mb-3 text-gray-900">Problem Description</h4>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-700">{selectedAppointment.problem}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedAppointment.notes && (
                <div>
                  <h4 className="font-semibold mb-3 text-gray-900">Notes</h4>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-blue-800">{selectedAppointment.notes}</p>
                  </div>
                </div>
              )}

              <div className="h-px bg-gray-200"></div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {selectedAppointment.status === "confirmed" && selectedAppointment.mode === "online" && (
                  <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center">
                    <Video className="w-4 h-4 mr-2" />
                    Join Video Call
                  </button>
                )}

                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message Doctor
                </button>

                <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  Call Clinic
                </button>

                {selectedAppointment.can_reschedule && (
                  <button
                    onClick={() => {
                      handleInitiateReschedule(selectedAppointment);
                      handleCloseModal();
                    }}
                    className="border border-amber-300 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-50 flex items-center"
                  >
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Reschedule
                  </button>
                )}

                {selectedAppointment.can_cancel && (
                  <button
                    onClick={() => {
                      handleCancelAppointment(selectedAppointment.id);
                    }}
                    className="border border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 flex items-center ml-auto"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel Appointment
                  </button>
                )}
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-gray-900">Need Help?</h4>
                <div className="flex flex-col sm:flex-row gap-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="w-4 h-4" />
                    <span>Call: +1 (555) 123-4567</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="w-4 h-4" />
                    <span>Email: support@healthcare.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}