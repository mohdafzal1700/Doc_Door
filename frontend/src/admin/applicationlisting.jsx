import React, { useState } from 'react';
import { Search, Calendar, Clock, User, Phone, Mail, Eye, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const AppointmentDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Sample appointment data
  const appointments = [
    {
      id: 1,
      patientName: "John Smith",
      patientEmail: "john.smith@email.com",
      patientPhone: "+1 (555) 123-4567",
      doctorName: "Dr. Sarah Johnson",
      specialization: "Cardiology",
      appointmentDate: "2024-07-15",
      appointmentTime: "10:00 AM",
      status: "confirmed",
      bookedDate: "2024-07-10",
      symptoms: "Chest pain, shortness of breath"
    },
    {
      id: 2,
      patientName: "Emily Davis",
      patientEmail: "emily.davis@email.com",
      patientPhone: "+1 (555) 987-6543",
      doctorName: "Dr. Michael Chen",
      specialization: "Dermatology",
      appointmentDate: "2024-07-16",
      appointmentTime: "2:30 PM",
      status: "pending",
      bookedDate: "2024-07-11",
      symptoms: "Skin rash, itching"
    },
    {
      id: 3,
      patientName: "Robert Wilson",
      patientEmail: "robert.wilson@email.com",
      patientPhone: "+1 (555) 456-7890",
      doctorName: "Dr. Lisa Anderson",
      specialization: "Orthopedics",
      appointmentDate: "2024-07-17",
      appointmentTime: "11:15 AM",
      status: "completed",
      bookedDate: "2024-07-09",
      symptoms: "Knee pain, mobility issues"
    },
    {
      id: 4,
      patientName: "Maria Garcia",
      patientEmail: "maria.garcia@email.com",
      patientPhone: "+1 (555) 321-0987",
      doctorName: "Dr. James Brown",
      specialization: "Pediatrics",
      appointmentDate: "2024-07-18",
      appointmentTime: "3:45 PM",
      status: "cancelled",
      bookedDate: "2024-07-12",
      symptoms: "Fever, cough in child"
    },
    {
      id: 5,
      patientName: "David Lee",
      patientEmail: "david.lee@email.com",
      patientPhone: "+1 (555) 654-3210",
      doctorName: "Dr. Jennifer White",
      specialization: "Neurology",
      appointmentDate: "2024-07-19",
      appointmentTime: "9:00 AM",
      status: "confirmed",
      bookedDate: "2024-07-13",
      symptoms: "Headaches, dizziness"
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'completed': return 'text-blue-600 bg-blue-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = appointment.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.specialization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    pending: appointments.filter(a => a.status === 'pending').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">A</span>
                </div>
                <span className="text-gray-700 font-medium">Admin</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Appointments Overview</h2>
            <p className="text-gray-600 mt-1">Monitor all appointments across the system</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Appointments</p>
                <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Confirmed</p>
                <p className="text-2xl font-bold text-gray-900">{statusCounts.confirmed}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{statusCounts.pending}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{statusCounts.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg inline-flex">
            {Object.entries(statusCounts).map(([status, count]) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search appointments by patient, doctor, or specialization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Appointments Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Doctor & Specialization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Appointment Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booked Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symptoms/Reason
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAppointments.length > 0 ? (
                  filteredAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-5 w-5 text-gray-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {appointment.patientName}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {appointment.patientEmail}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {appointment.patientPhone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.doctorName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {appointment.specialization}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(appointment.appointmentDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-2 text-gray-400" />
                          {appointment.appointmentTime}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                          {getStatusIcon(appointment.status)}
                          <span className="ml-1 capitalize">{appointment.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(appointment.bookedDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {appointment.symptoms}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Calendar className="h-12 w-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No appointments found
                        </h3>
                        <p className="text-gray-500">
                          {searchTerm || statusFilter !== 'all' 
                            ? 'No appointments match your current filters.' 
                            : 'No appointments have been booked yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDashboard;