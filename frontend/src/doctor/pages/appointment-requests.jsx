import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Mail, CheckCircle, XCircle, AlertCircle, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import DocHeader from '../../components/ui/DocHeader';
import { getPendingAppointmentRequests, appointmentRequestAction } from '../../endpoints/Doc';

const AppointmentRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  // Fetch pending requests on component mount
  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const response = await getPendingAppointmentRequests();
      
      if (response && response.data) {
        const results = Array.isArray(response.data) ? response.data : [];
        setRequests(results);
        setSummary({});
      } else {
        console.warn('Unexpected response structure:', response);
        setRequests([]);
        setSummary({});
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setRequests([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Filter requests based on search and filter criteria
  const filteredRequests = React.useMemo(() => {
    return requests.filter(request => {
      const matchesSearch = searchTerm === '' || 
        request.patient?.user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.patient?.user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.patient?.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.patient?.phone?.includes(searchTerm) ||
        request.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.patient_phone?.includes(searchTerm) ||
        request.patient_email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === 'all' || request.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    });
  }, [requests, searchTerm, filterStatus]);

  const currentItems = filteredRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleRequestAction = async (appointmentId, action, reason = '') => {
    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
      await appointmentRequestAction(appointmentId, { action, reason });
      await fetchPendingRequests();
      alert(`Request ${action}d successfully!`);
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      alert(`Error ${action}ing request: ${error.response?.data?.error || error.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  // ... (keep other helper functions like formatDate, formatTime, getPatientName, etc.)

  return (
    <div className="min-h-screen bg-gray-50">
      <DocHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Appointments Request</h1>
          <div className="flex items-center space-x-4 mb-6">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
              All
            </button>
            <button className="px-4 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-100 transition">
              Online
            </button>
            <button className="px-4 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-100 transition">
              In-Person
            </button>
          </div>

          {/* Search and Filter */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <select
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  onClick={fetchPendingRequests}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Appointments List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading && requests.length === 0 ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading appointments...</p>
              </div>
            ) : currentItems.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {requests.length === 0 ? 'No appointments found' : 'No appointments match your search criteria'}
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-200">
                  {currentItems.map((request) => (
                    <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4 mb-3">
                            <div className="flex items-center space-x-2">
                              <User className="h-5 w-5 text-gray-500" />
                              <span className="font-medium text-gray-800">
                                {getPatientName(request)}
                              </span>
                              <span className="text-sm text-gray-500">
                                {request.patient?.age || ''} {request.patient?.gender || ''}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 mb-3">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-5 w-5 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                {formatDate(request.appointment_date)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-5 w-5 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                {formatTime(request.slot_time)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                              request.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : request.status === 'confirmed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {request.status?.charAt(0).toUpperCase() + request.status?.slice(1)}
                            </span>
                            {request.service?.name && (
                              <span className="text-sm text-gray-600">
                                {request.service.name}
                              </span>
                            )}
                            {request.price && (
                              <span className="text-sm font-medium text-gray-800">
                                ${request.price}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <button className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition flex items-center space-x-1">
                            <span>View</span>
                          </button>
                          <button className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition flex items-center space-x-1">
                            <span>Message</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <button
                      onClick={() => paginate(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md flex items-center space-x-1 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Previous</span>
                    </button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                        <button
                          key={number}
                          onClick={() => paginate(number)}
                          className={`w-8 h-8 flex items-center justify-center rounded-md ${
                            currentPage === number 
                              ? 'bg-blue-600 text-white' 
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          {number}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md flex items-center space-x-1 disabled:opacity-50"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentRequestsPage;