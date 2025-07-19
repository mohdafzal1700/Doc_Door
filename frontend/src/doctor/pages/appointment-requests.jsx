import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Mail, CheckCircle, XCircle, AlertCircle, Search, Filter } from 'lucide-react';

// Import the API functions (assuming they're in a separate file)
import { getPendingAppointmentRequests, 
  appointmentRequestAction, 
  
} from '../../endpoints/Doc';

const AppointmentRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState({});

  // Fetch pending requests on component mount
  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      console.log('Fetching pending requests...');
      
      const response = await getPendingAppointmentRequests();
      console.log('API Response:', response);
      
      // Handle the structured response from Django API
      if (response && response.data) {
        const results = Array.isArray(response.data) ? response.data : [];
        setRequests(results);
        setSummary({});
        console.log('Raw API response:', response.data);
console.log('Parsed appointment count:', results.length);
        setRequests(Array.isArray(results) ? results : []);
        setSummary(summary);
      } else {
        console.warn('Unexpected response structure:', response);
        setRequests([]);
        setSummary({});
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      console.error('Error details:', error.response?.data || error.message);
      setRequests([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (appointmentId, action, reason = '') => {
    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
      console.log(`${action}ing appointment ${appointmentId} with reason:`, reason);
      
      const response = await appointmentRequestAction(appointmentId, {
        action,
        reason
      });
      
      console.log('Action response:', response);
      
      // Refresh the requests list
      await fetchPendingRequests();
      
      // Show success message (you can replace with toast notification)
      alert(`Request ${action}d successfully!`);
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      console.error('Error details:', error.response?.data || error.message);
      alert(`Error ${action}ing request: ${error.response?.data?.error || error.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedRequests.length === 0) {
      alert('Please select at least one request');
      return;
    }

    const reason = prompt(`Enter reason for bulk ${action}:`);
    if (reason === null) return; // User cancelled

    try {
      setLoading(true);
      console.log(`Bulk ${action}ing appointments:`, selectedRequests);
      
      await bulkAppointmentRequestAction({
        appointment_ids: selectedRequests,
        action,
        reason
      });
      
      // Clear selection and refresh
      setSelectedRequests([]);
      await fetchPendingRequests();
      
      alert(`Bulk ${action} completed successfully!`);
    } catch (error) {
      console.error(`Error in bulk ${action}:`, error);
      console.error('Error details:', error.response?.data || error.message);
      alert(`Error in bulk ${action}: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleRequestSelection = (requestId) => {
    setSelectedRequests(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  // Filter requests based on search and filter criteria
  const filteredRequests = React.useMemo(() => {
    console.log('Filtering requests. Total requests:', requests.length);
    
    return requests.filter(request => {
      // Debug individual request structure
      if (requests.length > 0 && requests.indexOf(request) === 0) {
        console.log('Sample request structure:', request);
      }
      
      const matchesSearch = searchTerm === '' || 
        request.patient?.user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.patient?.user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.patient?.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.patient?.phone?.includes(searchTerm) ||
        // Fallback for different field names
        request.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.patient_phone?.includes(searchTerm) ||
        request.patient_email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === 'all' || request.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    });
  }, [requests, searchTerm, filterStatus]);

  const selectAllRequests = () => {
    const allIds = filteredRequests.map(req => req.id);
    setSelectedRequests(
      selectedRequests.length === allIds.length ? [] : allIds
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'No time';
    try {
      return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid time';
    }
  };

  // Helper function to get patient name from nested structure
  const getPatientName = (request) => {
    if (request.patient?.user?.first_name || request.patient?.user?.last_name) {
      return `${request.patient.user.first_name || ''} ${request.patient.user.last_name || ''}`.trim();
    }
    return request.patient_name || 'Unknown Patient';
  };

  // Helper function to get patient phone
  const getPatientPhone = (request) => {
    return request.patient?.phone || request.patient_phone || 'No phone';
  };

  // Helper function to get patient email
  const getPatientEmail = (request) => {
    return request.patient?.user?.email || request.patient_email || 'No email';
  };

  if (loading && requests.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointment requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Appointment Requests</h1>
          <p className="text-gray-600">Manage pending patient appointment requests</p>
          
          {/* Summary Statistics */}
          {Object.keys(summary).length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{summary.total_pending || 0}</div>
                <div className="text-sm text-blue-600">Total Pending</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">{summary.urgent_today || 0}</div>
                <div className="text-sm text-yellow-600">Urgent (Today)</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{summary.this_week || 0}</div>
                <div className="text-sm text-green-600">This Week</div>
              </div>
            </div>
          )}
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by patient name, phone, or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRequests.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedRequests.length} request(s) selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Bulk Approve
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Bulk Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Requests List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Pending Requests ({filteredRequests.length})
              </h2>
              {filteredRequests.length > 0 && (
                <button
                  onClick={selectAllRequests}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {selectedRequests.length === filteredRequests.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {requests.length === 0 ? 'No appointment requests found' : 'No requests match your search criteria'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-2 text-blue-600 hover:text-blue-700"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedRequests.includes(request.id)}
                        onChange={() => toggleRequestSelection(request.id)}
                        className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {getPatientName(request)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {getPatientPhone(request)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {getPatientEmail(request)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {formatDate(request.appointment_date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {formatTime(request.slot_time)}
                            </span>
                          </div>
                          {request.service?.name && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">
                                Service: {request.service.name}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {request.reason && (
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Reason:</strong> {request.reason}
                          </p>
                        )}
                        
                        {request.notes && (
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Notes:</strong> {request.notes}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            request.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-800'
                              : request.status === 'confirmed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {request.status?.charAt(0).toUpperCase() + request.status?.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {request.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRequestAction(request.id, 'approve')}
                          disabled={actionLoading[request.id]}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {actionLoading[request.id] ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Enter reason for rejection (optional):');
                            if (reason !== null) {
                              handleRequestAction(request.id, 'reject', reason);
                            }
                          }}
                          disabled={actionLoading[request.id]}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          {actionLoading[request.id] ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentRequestsPage;