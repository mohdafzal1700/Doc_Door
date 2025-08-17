import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { 
  AlertCircle, TrendingUp, Calendar, Users, DollarSign, Star, 
  CheckCircle, Clock, XCircle, BarChart3, RefreshCw, Filter, Download 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar 
} from 'recharts';
import DocHeader from '../../components/ui/DocHeader';
import DoctorSidebar from '../../components/ui/DocSide';
import { isAuthenticated, isDoctorAuthenticated, getAuthState } from '../../utils/auth';
import { fetchDoctorDashboard } from '../../endpoints/Doc';

// State reducer for better state management
const dashboardReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_DATA':
      return { 
        ...state, 
        dashboardData: action.payload, 
        loading: false, 
        error: null,
        refreshing: false 
      };
    case 'SET_FILTERS':
      return { 
        ...state, 
        dateFilters: { ...state.dateFilters, ...action.payload } 
      };
    case 'CLEAR_FILTERS':
      return { 
        ...state, 
        dateFilters: { date_from: '', date_to: '' } 
      };
    case 'SET_REFRESHING':
      return { ...state, refreshing: action.payload };
    case 'RESET':
      return {
        dashboardData: null,
        loading: true,
        error: null,
        dateFilters: { date_from: '', date_to: '' },
        refreshing: false
      };
    default:
      return state;
  }
};

const initialState = {
  dashboardData: null,
  loading: true,
  error: null,
  dateFilters: { date_from: '', date_to: '' },
  refreshing: false
};

// Utility functions
const formatters = {
  toNumber: (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  },

  currency: (value) => {
    const num = formatters.toNumber(value);
    return `₹${num.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  },

  time: (timeString) => {
    if (!timeString) return 'N/A';
    try {
      return timeString.substring(0, 5);
    } catch {
      return 'N/A';
    }
  },

  date: (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return 'N/A';
    }
  },

  dateTime: (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'N/A';
    }
  }
};

// Status configuration
const STATUS_CONFIG = {
  completed: { 
    color: 'text-green-600 bg-green-100 border-green-200', 
    icon: CheckCircle, 
    label: 'Completed' 
  },
  pending: { 
    color: 'text-orange-600 bg-orange-100 border-orange-200', 
    icon: Clock, 
    label: 'Pending' 
  },
  cancelled: { 
    color: 'text-red-600 bg-red-100 border-red-200', 
    icon: XCircle, 
    label: 'Cancelled' 
  },
  default: { 
    color: 'text-gray-600 bg-gray-100 border-gray-200', 
    icon: AlertCircle, 
    label: 'Unknown' 
  }
};

// Color classes for stat cards
const COLOR_CLASSES = {
  blue: "bg-blue-50 border-blue-200 text-blue-600",
  green: "bg-green-50 border-green-200 text-green-600",
  orange: "bg-orange-50 border-orange-200 text-orange-600",
  purple: "bg-purple-50 border-purple-200 text-purple-600",
  red: "bg-red-50 border-red-200 text-red-600"
};

// Component: StatCard
const StatCard = React.memo(({ icon: Icon, title, value, subtitle, trend, color = "blue" }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <div className={`p-3 rounded-xl ${COLOR_CLASSES[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      {trend && (
        <div className={`flex items-center text-sm font-medium ${
          trend > 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          <TrendingUp className={`h-4 w-4 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
          {Math.abs(formatters.toNumber(trend))}%
        </div>
      )}
    </div>
    <div className="mt-4">
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      <p className="text-sm text-gray-600 font-medium">{title}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  </div>
));

// Component: LoadingSpinner
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Loading dashboard...</p>
    </div>
  </div>
);

// Component: ErrorDisplay
const ErrorDisplay = ({ error, onRefresh, onRetry }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center max-w-md">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <p className="text-gray-600 mb-4">{error}</p>
      <div className="space-x-2">
        <button 
          onClick={onRefresh}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Page
        </button>
        <button 
          onClick={onRetry}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  </div>
);

// Component: AppointmentCard
const AppointmentCard = React.memo(({ appointment }) => {
  const statusInfo = STATUS_CONFIG[appointment?.status] || STATUS_CONFIG.default;
  const StatusIcon = statusInfo.icon;

  if (!appointment) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
      <div className="flex items-center space-x-3">
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
          <StatusIcon className="h-3 w-3" />
          <span className="capitalize">{appointment.status || 'unknown'}</span>
        </div>
        <div>
          <p className="font-medium text-gray-900">{appointment.patient_name || 'Unknown Patient'}</p>
          <p className="text-sm text-gray-600">
            {formatters.date(appointment.date)} at {formatters.time(appointment.time)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900">{formatters.currency(appointment.fee)}</p>
      </div>
    </div>
  );
});

// Component: ReviewCard
const ReviewCard = React.memo(({ review }) => {
  if (!review) return null;

  return (
    <div className="p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-gray-900">{review.patient_name || 'Anonymous'}</p>
        <div className="flex items-center space-x-1">
          <Star className="h-4 w-4 text-yellow-400 fill-current" />
          <span className="text-sm font-medium">{review.rating || 0}</span>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{review.comment || 'No comment'}</p>
      <p className="text-xs text-gray-500">{formatters.dateTime(review.created_at)}</p>
    </div>
  );
});

// Component: DashboardFilters
const DashboardFilters = ({ filters, onChange, onApply, onClear, onRefresh, refreshing }) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex items-center space-x-2 bg-white rounded-lg p-2 border">
      <Filter className="h-4 w-4 text-gray-500" />
      <input
        type="date"
        name="date_from"
        value={filters.date_from}
        onChange={onChange}
        className="border-0 focus:ring-0 text-sm outline-none"
        placeholder="From Date"
      />
    </div>
    
    <div className="flex items-center space-x-2 bg-white rounded-lg p-2 border">
      <input
        type="date"
        name="date_to"
        value={filters.date_to}
        onChange={onChange}
        className="border-0 focus:ring-0 text-sm outline-none"
        placeholder="To Date"
      />
    </div>
    
    <button
      onClick={onApply}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
    >
      Apply
    </button>
    
    <button
      onClick={onClear}
      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
    >
      Clear
    </button>
    
    <button
      onClick={onRefresh}
      disabled={refreshing}
      className="bg-white border text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      title="Refresh Data"
    >
      <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
    </button>
  </div>
);

// Main Component: DocDashboard
const DocDashboard = () => {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const [authState] = useState(() => getAuthState());

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentAuthState = getAuthState();
        
        if (!currentAuthState?.isLoggedIn) {
          dispatch({ type: 'SET_ERROR', payload: 'Please log in to access the dashboard' });
          return;
        }
        
        if (!currentAuthState?.isDoctor) {
          dispatch({ type: 'SET_ERROR', payload: 'Only doctors can access this dashboard' });
          return;
        }

        const isValidDoctor = await isDoctorAuthenticated();
        if (!isValidDoctor) {
          dispatch({ type: 'SET_ERROR', payload: 'Authentication failed. Please log in again.' });
          return;
        }

        loadDashboardData();
      } catch (authError) {
        console.error('Auth error:', authError);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to verify authentication. Please try logging in again.' });
      }
    };

    checkAuth();
  }, []);

  // Data loading function
  const loadDashboardData = useCallback(async (filters = {}) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      const response = await fetchDoctorDashboard(filters);
      
      if (response?.data?.success) {
        dispatch({ type: 'SET_DATA', payload: response.data.data });
      } else {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: response?.data?.message || 'Failed to load dashboard data' 
        });
      }
    } catch (err) {
      console.error('Dashboard loading error:', err);
      
      let errorMessage = 'Failed to load dashboard data';
      
      if (err.response?.status === 401) {
        errorMessage = 'Your session has expired. Please log in again.';
      } else if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to access this dashboard.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      } else if (!err.response) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_REFRESHING', payload: false });
    }
  }, []);

  // Event handlers
  const handleRefresh = useCallback(async () => {
    dispatch({ type: 'SET_REFRESHING', payload: true });
    const filters = Object.fromEntries(
      Object.entries(state.dateFilters).filter(([_, value]) => value !== '')
    );
    await loadDashboardData(filters);
  }, [state.dateFilters, loadDashboardData]);

  const handleDateFilterChange = useCallback((e) => {
    const { name, value } = e.target;
    dispatch({ type: 'SET_FILTERS', payload: { [name]: value } });
  }, []);

  const applyFilters = useCallback(() => {
    const filters = Object.fromEntries(
      Object.entries(state.dateFilters).filter(([_, value]) => value !== '')
    );
    loadDashboardData(filters);
  }, [state.dateFilters, loadDashboardData]);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
    loadDashboardData();
  }, [loadDashboardData]);

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!state.dashboardData?.monthly_revenue_trend || !Array.isArray(state.dashboardData.monthly_revenue_trend)) {
      return [];
    }
    
    return state.dashboardData.monthly_revenue_trend.map(item => ({
      month: item?.month_name || item?.month || 'Unknown',
      revenue: formatters.toNumber(item?.revenue || item?.total_revenue || 0),
      appointments: formatters.toNumber(item?.appointments || item?.total_appointments || 0)
    }));
  }, [state.dashboardData]);

  // Render loading state
  if (state.loading && !state.dashboardData) {
    return <LoadingSpinner />;
  }

  // Render error state
  if (state.error) {
    return (
      <ErrorDisplay 
        error={state.error}
        onRefresh={() => window.location.reload()}
        onRetry={() => loadDashboardData()}
      />
    );
  }

  // Render no data state
  if (!state.dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No dashboard data available.</p>
          <button 
            onClick={() => loadDashboardData()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Load Data
          </button>
        </div>
      </div>
    );
  }

  const { stats = {}, recent_appointments = [], recent_reviews = [] } = state.dashboardData;

  return (
    <div className="min-h-screen bg-gray-50">
      <DocHeader />
      <div className="flex">
        <DoctorSidebar />
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
                <p className="text-gray-600 mt-1">Welcome back! Here's your practice summary.</p>
              </div>
              
              <DashboardFilters
                filters={state.dateFilters}
                onChange={handleDateFilterChange}
                onApply={applyFilters}
                onClear={clearFilters}
                onRefresh={handleRefresh}
                refreshing={state.refreshing}
              />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard 
                icon={Calendar} 
                title="Total Appointments" 
                value={formatters.toNumber(stats.total_appointments)}
                subtitle={`${formatters.toNumber(stats.today_appointments)} scheduled today`}
                color="blue" 
              />
              <StatCard 
                icon={Users} 
                title="This Month" 
                value={formatters.toNumber(stats.this_month_appointments)}
                subtitle={`${formatters.toNumber(stats.completion_rate)}% completion rate`}
                color="green" 
              />
              <StatCard 
                icon={DollarSign} 
                title="Total Revenue" 
                value={formatters.currency(stats.total_revenue)}
                trend={stats.revenue_growth_percentage}
                color="purple" 
              />
              <StatCard 
                icon={Star} 
                title="Average Rating" 
                value={`${formatters.toNumber(stats.average_rating)}/5`}
                subtitle={`${formatters.toNumber(stats.total_reviews)} reviews`}
                color="orange" 
              />
            </div>

            {/* Charts */}
            {chartData && chartData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Performance Analytics</h2>
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                    <Download className="h-4 w-4 mr-1" />
                    Export Data
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Revenue Chart */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                      Revenue Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="month" 
                          stroke="#64748b" 
                          fontSize={12} 
                          tickMargin={10} 
                        />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={12} 
                          tickFormatter={(value) => `₹${value/1000}k`}
                        />
                        <Tooltip 
                          formatter={(value) => [formatters.currency(value), 'Revenue']}
                          labelStyle={{ color: '#374151' }}
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 7, fill: '#1d4ed8' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Appointments Chart */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-green-600" />
                      Appointments Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="month" 
                          stroke="#64748b" 
                          fontSize={12} 
                          tickMargin={10} 
                        />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip 
                          formatter={(value) => [value, 'Appointments']}
                          labelStyle={{ color: '#374151' }}
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Bar 
                          dataKey="appointments" 
                          fill="#10b981" 
                          radius={[6, 6, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activities */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Recent Appointments */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                    Recent Appointments
                  </h2>
                  <span className="text-sm text-gray-500">
                    {recent_appointments.length} items
                  </span>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recent_appointments.length > 0 ? (
                    recent_appointments.map((appointment) => (
                      <AppointmentCard key={appointment?.id || Math.random()} appointment={appointment} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No recent appointments</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Reviews */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Star className="h-5 w-5 mr-2 text-yellow-500" />
                    Recent Reviews
                  </h2>
                  <span className="text-sm text-gray-500">
                    {recent_reviews.length} items
                  </span>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recent_reviews.length > 0 ? (
                    recent_reviews.map((review) => (
                      <ReviewCard key={review?.id || Math.random()} review={review} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Star className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No reviews yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocDashboard;