import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Edit, Trash2, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule ,getServices} from '../../endpoints/Doc';
import DocHeader from '../../components/ui/DocHeader';
import DoctorSidebar from '../../components/ui/DocSide';

const ScheduleManagement = () => {
  const [schedules, setSchedules] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [viewingSchedule, setViewingSchedule] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [servicesError, setServicesError] = useState(null);
  const [formData, setFormData] = useState({
    service: '',
    mode: 'online',
    date: '',
    start_time: '',
    end_time: '',
    slot_duration_hours: '0',
    slot_duration_minutes: '30',
    break_start_time: '',
    break_end_time: '',
    total_slots: '',
    booked_slots: 0,
    max_patients_per_slot: 1,
    is_active: true
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules= async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load both schedules and services in parallel
      const [schedulesResponse, servicesResponse] = await Promise.all([
        getSchedules(),
        getServices()
      ]);

      // Handle schedules response
      let schedulesData = [];
      if (schedulesResponse?.data) {
        if (Array.isArray(schedulesResponse.data)) {
          schedulesData = schedulesResponse.data;
        } else if (schedulesResponse.data.results && Array.isArray(schedulesResponse.data.results)) {
          schedulesData = schedulesResponse.data.results;
        } else if (schedulesResponse.data.data && Array.isArray(schedulesResponse.data.data)) {
          schedulesData = schedulesResponse.data.data;
        }
      }
      setSchedules(schedulesData);

      // Handle services response
      let servicesData = [];
      if (servicesResponse?.data) {
        if (Array.isArray(servicesResponse.data)) {
          servicesData = servicesResponse.data;
        } else if (servicesResponse.data.results && Array.isArray(servicesResponse.data.results)) {
          servicesData = servicesResponse.data.results;
        } else if (servicesResponse.data.data && Array.isArray(servicesResponse.data.data)) {
          servicesData = servicesResponse.data.data;
        }
      }
      setServices(servicesData);

    } catch (error) {
      console.error('Error loading initial data:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to load data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSchedule(null);
    setError(null);
    setFormData({
      service: '',
      mode: 'online',
      date: '',
      start_time: '',
      end_time: '',
      slot_duration_hours: '0',
      slot_duration_minutes: '30',
      break_start_time: '',
      break_end_time: '',
      total_slots: '',
      booked_slots: 0,
      max_patients_per_slot: 1,
      is_active: true
    });
  };

  const handleViewDetails = (schedule) => {
    setViewingSchedule(schedule);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setViewingSchedule(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await deleteSchedule(id);
        await loadSchedules();
        setError(null);
      } catch (error) {
        console.error('Error deleting schedule:', error);
        const errorMessage = error.response?.data?.detail || 
                            error.response?.data?.message || 
                            error.message || 
                            'Failed to delete schedule';
        setError(errorMessage);
      }
    }
  };

  const handleOpenModal = (schedule = null) => {
    if (schedule) {
      setEditingSchedule(schedule);
      
      let hours = '0', minutes = '30';
      if (schedule.slot_duration) {
        const parts = schedule.slot_duration.split(':');
        if (parts.length >= 2) {
          hours = parts[0] || '0';
          minutes = parts[1] || '30';
        }
      }
      
      setFormData({
        service: schedule.service?.toString() || '',
        mode: schedule.mode || 'online',
        date: schedule.date || '',
        start_time: schedule.start_time || '',
        end_time: schedule.end_time || '',
        slot_duration_hours: hours,
        slot_duration_minutes: minutes,
        break_start_time: schedule.break_start_time || '',
        break_end_time: schedule.break_end_time || '',
        total_slots: schedule.total_slots?.toString() || '',
        booked_slots: schedule.booked_slots || 0,
        max_patients_per_slot: schedule.max_patients_per_slot || 1,
        is_active: schedule.is_active !== undefined ? schedule.is_active : true
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        service: '',
        mode: 'online',
        date: '',
        start_time: '',
        end_time: '',
        slot_duration_hours: '0',
        slot_duration_minutes: '30',
        break_start_time: '',
        break_end_time: '',
        total_slots: '',
        booked_slots: 0,
        max_patients_per_slot: 1,
        is_active: true
      });
    }
    setShowModal(true);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Add this enhanced error handling to your handleSubmit function

const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);
  setError(null);

  try {
    // Validate required fields
    if (!formData.service || isNaN(parseInt(formData.service))) {
      setError('Please select a valid service');
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      setError('Please provide both start and end times');
      return;
    }

    if (!formData.date) {
      setError('Please select a date');
      return;
    }

    // Validate date is not in the past
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      setError('Schedule date cannot be in the past');
      return;
    }

    // Validate break times
    if ((formData.break_start_time && !formData.break_end_time) || 
        (!formData.break_start_time && formData.break_end_time)) {
      setError('Both break start and end times must be provided together');
      return;
    }

    // Validate time logic
    const startTime = new Date(`1970-01-01T${formData.start_time}:00`);
    const endTime = new Date(`1970-01-01T${formData.end_time}:00`);
    
    if (startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }

    // If break times are provided, validate them
    if (formData.break_start_time && formData.break_end_time) {
      const breakStart = new Date(`1970-01-01T${formData.break_start_time}:00`);
      const breakEnd = new Date(`1970-01-01T${formData.break_end_time}:00`);
      
      if (breakStart >= breakEnd) {
        setError('Break end time must be after break start time');
        return;
      }
      
      if (breakStart < startTime || breakEnd > endTime) {
        setError('Break times must be within the schedule start and end times');
        return;
      }
    }

    const hours = formData.slot_duration_hours.padStart(2, '0');
    const minutes = formData.slot_duration_minutes.padStart(2, '0');
    const slot_duration = `${hours}:${minutes}:00`;
    
    const data = {
      service: parseInt(formData.service),
      mode: formData.mode,
      date: formData.date,
      start_time: formData.start_time ? `${formData.start_time}:00` : '',
      end_time: formData.end_time ? `${formData.end_time}:00` : '',
      slot_duration,
      break_start_time: formData.break_start_time ? `${formData.break_start_time}:00` : null,
      break_end_time: formData.break_end_time ? `${formData.break_end_time}:00` : null,
      total_slots: formData.total_slots ? parseInt(formData.total_slots) : null,
      booked_slots: parseInt(formData.booked_slots) || 0,
      max_patients_per_slot: parseInt(formData.max_patients_per_slot) || 1,
      is_active: formData.is_active
    };

    // Remove null values to avoid backend validation issues
    Object.keys(data).forEach(key => {
      if (data[key] === null || data[key] === '') {
        delete data[key];
      }
    });

    console.log('=== DEBUG INFO ===');
    console.log('Form data:', formData);
    console.log('Submitting data:', data);
    console.log('Available services:', services);
    console.log('Selected service:', getSelectedService());
    console.log('==================');

    let response;
    if (editingSchedule) {
      response = await updateSchedule(editingSchedule.id, data);
    } else {
      response = await createSchedule(data);
    }
    
    console.log('Success response:', response);
    
    await loadSchedules();
    handleCloseModal();
  } catch (error) {
    console.error('=== ERROR DEBUG INFO ===');
    console.error('Full error object:', error);
    console.error('Error response:', error.response);
    console.error('Error response data:', error.response?.data);
    console.error('Error response status:', error.response?.status);
    console.error('Error response headers:', error.response?.headers);
    console.error('Error request:', error.request);
    console.error('Error config:', error.config);
    console.error('========================');
    
    let errorMessage = 'Failed to save schedule';
    
    if (error.response?.data) {
      const responseData = error.response.data;
      
      if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else if (responseData.detail) {
        errorMessage = responseData.detail;
      } else if (responseData.message) {
        errorMessage = responseData.message;
      } else if (responseData.non_field_errors) {
        errorMessage = responseData.non_field_errors.join(', ');
      } else if (responseData.field_errors) {
        // Handle the specific error format from your backend
        const fieldErrors = [];
        Object.keys(responseData.field_errors).forEach(key => {
          const errors = responseData.field_errors[key];
          if (Array.isArray(errors)) {
            fieldErrors.push(`${key}: ${errors.join(', ')}`);
          } else {
            fieldErrors.push(`${key}: ${errors}`);
          }
        });
        if (fieldErrors.length > 0) {
          errorMessage = fieldErrors.join('; ');
        }
      } else {
        // Generic field error handling
        const fieldErrors = [];
        Object.keys(responseData).forEach(key => {
          if (key === 'success') return; // Skip success field
          
          const value = responseData[key];
          if (Array.isArray(value)) {
            fieldErrors.push(`${key}: ${value.join(', ')}`);
          } else if (typeof value === 'string') {
            fieldErrors.push(`${key}: ${value}`);
          } else if (typeof value === 'object') {
            fieldErrors.push(`${key}: ${JSON.stringify(value)}`);
          }
        });
        if (fieldErrors.length > 0) {
          errorMessage = fieldErrors.join('; ');
        }
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.log('Final error message:', errorMessage);
    setError(errorMessage);
  } finally {
    setSubmitting(false);
  }
};


  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      return timeString;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatDuration = (duration) => {
    if (!duration) return '';
    try {
      const [hours, minutes] = duration.split(':');
      const hoursNum = parseInt(hours);
      const minutesNum = parseInt(minutes);
      
      if (hoursNum > 0) {
        return `${hoursNum}h ${minutesNum}m`;
      }
      return `${minutesNum}m`;
    } catch (error) {
      return duration;
    }
  };

  const getSelectedService = () => {
    const serviceId = parseInt(formData.service);
    return services.find(service => service.id === serviceId);
  };

  const getAvailableSlots = (schedule) => {
    if (schedule.available_slots !== undefined) {
      return schedule.available_slots;
    }
    const totalSlots = schedule.total_slots || 0;
    const bookedSlots = schedule.booked_slots || 0;
    return Math.max(0, totalSlots - bookedSlots);
  };

  const isFullyBooked = (schedule) => {
    if (schedule.is_fully_booked !== undefined) {
      return schedule.is_fully_booked;
    }
    return getAvailableSlots(schedule) === 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DocHeader />
      <div className="flex">
        <DoctorSidebar />
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Schedule Management</h1>
                  <p className="text-gray-600 mt-1">Manage your appointment availability</p>
                </div>
                <button
                  onClick={() => handleOpenModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Plus size={20} />
                  Add New Schedule
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                  <span className="text-red-800">{error}</span>
                </div>
              </div>
            )}

            {Array.isArray(schedules) && schedules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="text-indigo-600" size={20} />
                          <span className="font-semibold text-gray-900">
                            {formatDate(schedule.date)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal(schedule)}
                            className="text-gray-500 hover:text-indigo-600 transition-colors p-1"
                            aria-label="Edit schedule"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="text-gray-500 hover:text-red-600 transition-colors p-1"
                            aria-label="Delete schedule"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock size={16} />
                          <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            schedule.mode === 'Online' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {schedule.mode}
                          </div>
                          {!schedule.is_active && (
                            <div className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Inactive
                            </div>
                          )}
                        </div>

                        <div className="text-sm text-gray-700">
                          <div className="font-medium">{schedule.service_name || 'Service'}</div>
                          {schedule.service_description && (
                            <div className="text-gray-500 truncate">{schedule.service_description}</div>
                          )}
                        </div>

                        <div className="text-sm text-gray-600">
                          <div>Duration: {formatDuration(schedule.slot_duration)}</div>
                          <div>Max per slot: {schedule.max_patients_per_slot}</div>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600">
                          <Users size={16} />
                          <span className="text-sm">
                            {getAvailableSlots(schedule)} of {schedule.total_slots} slots available
                          </span>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isFullyBooked(schedule) ? 'bg-red-500' : 'bg-indigo-600'
                            }`}
                            style={{ 
                              width: `${((schedule.total_slots - getAvailableSlots(schedule)) / schedule.total_slots) * 100}%` 
                            }}
                          ></div>
                        </div>

                        {schedule.break_start_time && schedule.break_end_time && (
                          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            Break: {formatTime(schedule.break_start_time)} - {formatTime(schedule.break_end_time)}
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleViewDetails(schedule)}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules available</h3>
                <p className="text-gray-600 mb-6">Get started by creating your first schedule.</p>
                <button
                  onClick={() => handleOpenModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors mx-auto"
                >
                  <Plus size={20} />
                  Add New Schedule
                </button>
              </div>
            )}

            {/* Schedule Modal */}
            {showModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">
                        {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
                      </h2>
                      <button
                        onClick={handleCloseModal}
                        className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                        aria-label="Close modal"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                      {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3 mb-4">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="text-red-500 flex-shrink-0" size={16} />
                            <span className="text-red-800 text-sm">{error}</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service *
                          </label>
                        <select
                              name="service"
                              value={formData.service}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              required
                              disabled={services.length === 0}
                            >
                              <option value="">{services.length === 0 ? 'Loading services...' : 'Select a service'}</option>
                              {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.service_name} - {service.service_mode} (${service.service_fee})
                                </option>
                              ))}
                            </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Consultation Mode *
                          </label>
                          <select
                            name="mode"
                            value={formData.mode}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          >
                            <option value="online">Online</option>
                            <option value="offline">In-Person</option>
                          </select>
                        </div>
                      </div>

                      {getSelectedService() && (
                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="text-sm text-blue-800">
                            <div className="font-medium">Selected Service Details:</div>
                            <div className="mt-1">
                              <span className="font-medium">Mode:</span> {getSelectedService().service_mode} | 
                              <span className="font-medium ml-2">Fee:</span> ${getSelectedService().service_fee}
                            </div>
                            {getSelectedService().description && (
                              <div className="mt-1 text-blue-700">
                                {getSelectedService().description}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date *
                        </label>
                        <input
                          type="date"
                          name="date"
                          value={formData.date}
                          onChange={handleInputChange}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Time *
                          </label>
                          <input
                            type="time"
                            name="start_time"
                            value={formData.start_time}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Time *
                          </label>
                          <input
                            type="time"
                            name="end_time"
                            value={formData.end_time}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Slot Duration *
                        </label>
                        <div className="flex gap-2">
                          <select
                            name="slot_duration_hours"
                            value={formData.slot_duration_hours}
                            onChange={handleInputChange}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {Array.from({ length: 5 }, (_, i) => (
                              <option key={i} value={i}>{i} hour{i !== 1 ? 's' : ''}</option>
                            ))}
                          </select>
                          <select
                            name="slot_duration_minutes"
                            value={formData.slot_duration_minutes}
                            onChange={handleInputChange}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {[0, 15, 30, 45].map((min) => (
                              <option key={min} value={min}>{min} minutes</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Break Start Time
                          </label>
                          <input
                            type="time"
                            name="break_start_time"
                            value={formData.break_start_time}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Break End Time
                          </label>
                          <input
                            type="time"
                            name="break_end_time"
                            value={formData.break_end_time}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Total Slots
                          </label>
                          <input
                            type="number"
                            name="total_slots"
                            value={formData.total_slots}
                            onChange={handleInputChange}
                            placeholder="Auto-calculated if empty"
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max Patients per Slot
                          </label>
                          <input
                            type="number"
                            name="max_patients_per_slot"
                            value={formData.max_patients_per_slot}
                            onChange={handleInputChange}
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {editingSchedule && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Booked Slots
                          </label>
                          <input
                            type="number"
                            name="booked_slots"
                            value={formData.booked_slots}
                            onChange={handleInputChange}
                            min="0"
                            max={formData.total_slots || 999}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      )}

                      <div className="mb-6">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={handleInputChange}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Active Schedule
                          </span>
                        </label>
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              {editingSchedule ? 'Updating...' : 'Creating...'}
                            </>
                          ) : (
                            <>
                              <CheckCircle size={16} />
                              {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Details Modal */}
            {showDetailsModal && viewingSchedule && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">Schedule Details</h2>
                      <button
                        onClick={handleCloseDetailsModal}
                        className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                        aria-label="Close details modal"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold text-gray-900 mb-2">Basic Information</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Date:</span> {formatDate(viewingSchedule.date)}
                            </div>
                            <div>
                              <span className="font-medium">Time:</span> {formatTime(viewingSchedule.start_time)} - {formatTime(viewingSchedule.end_time)}
                            </div>
                            <div>
                              <span className="font-medium">Mode:</span> 
                              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                viewingSchedule.mode === 'Online' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {viewingSchedule.mode}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Status:</span> 
                              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                viewingSchedule.is_active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {viewingSchedule.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold text-gray-900 mb-2">Service Information</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Service:</span> {viewingSchedule.service_name}
                            </div>
                            <div>
                              <span className="font-medium">Fee:</span> ${viewingSchedule.service_fee}
                            </div>
                            <div>
                              <span className="font-medium">Service Mode:</span> {viewingSchedule.service_mode}
                            </div>
                            {viewingSchedule.service_description && (
                              <div>
                                <span className="font-medium">Description:</span> 
                                <p className="text-gray-600 mt-1">{viewingSchedule.service_description}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {servicesError && (
                          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="text-red-500 flex-shrink-0" size={16} />
                              <span className="text-red-800 text-sm">{servicesError}</span>
                            </div>
                          </div>
                        )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold text-gray-900 mb-2">Slot Configuration</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Slot Duration:</span> {formatDuration(viewingSchedule.slot_duration)}
                            </div>
                            <div>
                              <span className="font-medium">Max Patients per Slot:</span> {viewingSchedule.max_patients_per_slot}
                            </div>
                            <div>
                              <span className="font-medium">Total Slots:</span> {viewingSchedule.total_slots}
                            </div>
                            <div>
                              <span className="font-medium">Booked Slots:</span> {viewingSchedule.booked_slots}
                            </div>
                            <div>
                              <span className="font-medium">Available Slots:</span> 
                              <span className={`ml-2 font-semibold ${
                                getAvailableSlots(viewingSchedule) > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {getAvailableSlots(viewingSchedule)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold text-gray-900 mb-2">Break Time</h3>
                          <div className="space-y-2 text-sm">
                            {viewingSchedule.break_start_time && viewingSchedule.break_end_time ? (
                              <>
                                <div>
                                  <span className="font-medium">Break Start:</span> {formatTime(viewingSchedule.break_start_time)}
                                </div>
                                <div>
                                  <span className="font-medium">Break End:</span> {formatTime(viewingSchedule.break_end_time)}
                                </div>
                                <div>
                                  <span className="font-medium">Break Duration:</span> {viewingSchedule.break_duration || 'N/A'}
                                </div>
                              </>
                            ) : (
                              <div className="text-gray-600">No break time scheduled</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-2">Booking Progress</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Booking Progress</span>
                            <span>{viewingSchedule.booked_slots} / {viewingSchedule.total_slots} slots</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all duration-300 ${
                                isFullyBooked(viewingSchedule) ? 'bg-red-500' : 'bg-indigo-600'
                              }`}
                              style={{ 
                                width: `${((viewingSchedule.total_slots - getAvailableSlots(viewingSchedule)) / viewingSchedule.total_slots) * 100}%` 
                              }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-600">
                            {isFullyBooked(viewingSchedule) ? 'Fully Booked' : `${getAvailableSlots(viewingSchedule)} slots remaining`}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-2">Timestamps</h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Created:</span> {new Date(viewingSchedule.created_at).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Last Updated:</span> {new Date(viewingSchedule.updated_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={handleCloseDetailsModal}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => {
                          handleCloseDetailsModal();
                          handleOpenModal(viewingSchedule);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Edit size={16} />
                        Edit Schedule
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleManagement;