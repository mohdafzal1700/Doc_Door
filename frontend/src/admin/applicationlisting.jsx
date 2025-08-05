import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, Clock, User, Phone, Mail, Eye, CheckCircle, XCircle, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAllAdminAppointments } from '../endpoints/adm';
import AdminHeader from "../components/ui/AdminHeader";
import Sidebar from "../components/ui/Sidebar";

const AppointmentDashboard = () => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all appointments from API (no pagination)
  const fetchAllAppointments = async () => {
    setLoading(true);
    try {
      const response = await getAllAdminAppointments();
      
      if (response.data.success) {
        setAllAppointments(response.data.data);
        setError(null);
      } else {
        throw new Error(response.data.message || 'Failed to fetch appointments');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch appointments';
      setError(errorMessage);
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAllAppointments();
  }, []);

  // Filter and search appointments on frontend
  const filteredAppointments = useMemo(() => {
    let filtered = [...allAppointments];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(appointment => appointment.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(appointment => {
        const patientName = appointment.patient_name?.toLowerCase() || '';
        const doctorName = appointment.doctor_name?.toLowerCase() || '';
        const patientEmail = appointment.patient_email?.toLowerCase() || '';
        const patientPhone = appointment.patient_phone?.toLowerCase() || '';
        const serviceName = appointment.service_name?.toLowerCase() || '';
        
        return (
          patientName .includes(searchLower) ||
          doctorName.includes(searchLower) ||
          patientEmail.includes(searchLower) ||
          patientPhone.includes(searchLower) ||
          serviceName.includes(searchLower)
        );
      });
    }

    return filtered;
  }, [allAppointments, statusFilter, searchTerm]);

  // Paginate filtered results
  const paginatedAppointments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAppointments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAppointments, currentPage, itemsPerPage]);

  // Calculate pagination info
  const paginationInfo = useMemo(() => {
    const totalItems = filteredAppointments.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const hasNext = currentPage < totalPages;
    const hasPrevious = currentPage > 1;

    return {
      totalItems,
      totalPages,
      currentPage,
      hasNext,
      hasPrevious,
      itemsPerPage
    };
  }, [filteredAppointments.length, currentPage, itemsPerPage]);

  // Get status counts from all appointments
  const statusCounts = useMemo(() => {
    const counts = {
      all: allAppointments.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0
    };

    allAppointments.forEach(appointment => {
      if (counts.hasOwnProperty(appointment.status)) {
        counts[appointment.status]++;
      }
    });

    return counts;
  }, [allAppointments]);

  // Handle search
  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle status filter
  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle pagination
  const handlePageChange = (page) => {
    if (page >= 1 && page <= paginationInfo.totalPages) {
      setCurrentPage(page);
    }
  };

  // Refresh data
  const handleRefresh = () => {
    fetchAllAppointments();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'completed':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'cancelled':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (error) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Appointments</h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <button 
                onClick={handleRefresh} 
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
            <AdminHeader/>
            <Sidebar/>

            <div className="ml-64 pt-20 px-8 pb-10">
          <div className="max-w-10xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
            {/* Page Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Appointments Overview</h2>
                <p className="text-gray-600 mt-1">Monitor all appointments across the system</p>
              </div>
              <button 
                onClick={handleRefresh} 
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
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
                    <p className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : statusCounts.all}
                    </p>
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
                    <p className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : statusCounts.confirmed}
                    </p>
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
                    <p className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : statusCounts.pending}
                    </p>
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
                    <p className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : statusCounts.completed}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="mb-6">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg inline-flex">
                {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusFilter(status)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      statusFilter === status
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                    {` (${statusCounts[status] || 0})`}
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
                  placeholder="Search by patient name, doctor, email, phone..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {searchTerm && (
                <p className="text-sm text-gray-600 mt-2">
                  Showing {filteredAppointments.length} results for "{searchTerm}"
                </p>
              )}
            </div>

            {/* Appointments Table */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                  <span className="ml-2 text-gray-600">Loading appointments...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Doctor & Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mode
                        </th>
                        
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedAppointments.length > 0 ? (
                        paginatedAppointments.map((appointment) => (
                          <tr key={appointment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  {appointment.patient_profile_image ? (
                                    <img
                                      className="h-10 w-10 rounded-full object-cover"
                                      src={appointment.patient_profile_image}
                                      alt={appointment.patient_name}
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                      <User className="h-5 w-5 text-gray-600" />
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {appointment.patient_name || 'N/A'}
                                  </div>
                                  {appointment.patient_email && (
                                    <div className="text-sm text-gray-500 flex items-center">
                                      <Mail className="h-3 w-3 mr-1" />
                                      {appointment.patient_email}
                                    </div>
                                  )}
                                  {appointment.patient_phone && (
                                    <div className="text-sm text-gray-500 flex items-center">
                                      <Phone className="h-3 w-3 mr-1" />
                                      {appointment.patient_phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {appointment.doctor_name || 'N/A'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {appointment.service_name || 'General Consultation'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                                {appointment.appointment_date}
                              </div>
                              <div className="flex items-center text-sm text-gray-500">
                                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                                {appointment.slot_time} - {appointment.end_time}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                                  appointment.status
                                )}`}
                              >
                                {getStatusIcon(appointment.status)}
                                <span className="ml-1 capitalize">
                                  {appointment.status_display || appointment.status}
                                </span>
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  appointment.mode === 'online'
                                    ? 'text-blue-600 bg-blue-50'
                                    : 'text-green-600 bg-green-50'
                                }`}
                              >
                                {appointment.mode === 'online' ? 'Online' : 'Offline'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {/* <button
                                className="text-blue-600 hover:text-blue-900 flex items-center"
                                onClick={() => {
                                  // Handle view appointment details
                                  console.log('View appointment:', appointment.id);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </button> */}
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
              )}

              {/* Frontend Pagination */}
              {paginationInfo.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!paginationInfo.hasPrevious}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!paginationInfo.hasNext}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{paginationInfo.currentPage}</span> of{' '}
                        <span className="font-medium">{paginationInfo.totalPages}</span>
                        {' '}({paginationInfo.totalItems} total appointments)
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={!paginationInfo.hasPrevious}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          {paginationInfo.currentPage}
                        </span>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={!paginationInfo.hasNext}  
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </nav>
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

export default AppointmentDashboard;