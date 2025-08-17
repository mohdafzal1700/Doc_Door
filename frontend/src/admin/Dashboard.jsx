import React, { useState, useEffect } from 'react';
import { 
  Users, TrendingUp, DollarSign, CheckCircle, Clock, XCircle, 
  Download, Calendar, Eye, UserCheck, FileText, BarChart3, 
  Activity, CreditCard, AlertCircle, Search, Filter, RefreshCw 
} from 'lucide-react';
import { 
  getAdminUsers, getAdminDashboard, getAdminRevenue, 
  getPendingVerifications, downloadAdminReport 
} from '../endpoints/adm';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: ''
  });
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (activeTab) {
        case 'dashboard':
          const dashboard = await getAdminDashboard();
          console.log('Dashboard response:', dashboard);
          setDashboardData(dashboard.data || dashboard);
          break;
        case 'revenue':
          const revenue = await getAdminRevenue();
          console.log('Revenue response:', revenue);
          setRevenueData(revenue.data || revenue);
          break;
        case 'users':
          const users = await getAdminUsers();
          console.log('Users response:', users);
          setUsersData(users.data || users);
          break;
        case 'verifications':
          const pending = await getPendingVerifications();
          console.log('Verifications response:', pending);
          setPendingData(pending.data || pending);
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError(`Failed to load ${activeTab} data: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationAction = async (doctorId, action) => {
    try {
      console.log(`${action} doctor ${doctorId}`);
      alert(`Doctor ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      loadData();
    } catch (error) {
      console.error('Error processing verification:', error);
      alert('Error processing verification. Please try again.');
    }
  };

  // Enhanced download function using your existing API
  const downloadReport = async () => {
    try {
      setIsDownloading(true);
      setError(null);

      // Prepare parameters
      const params = {};
      if (dateRange.start_date) {
        params.start_date = dateRange.start_date;
      }
      if (dateRange.end_date) {
        params.end_date = dateRange.end_date;
      }

      console.log('📡 Downloading PDF with params:', params);

      // Call your existing API function
      const response = await downloadAdminReport(params);

      console.log('📄 PDF Response:', {
        status: response.status,
        headers: response.headers,
        dataType: typeof response.data,
        dataSize: response.data?.size || 'unknown'
      });

      // Check if we got a valid blob
      if (!response.data || !(response.data instanceof Blob)) {
        throw new Error('Invalid response: Expected PDF blob but got ' + typeof response.data);
      }

      // Check blob size
      if (response.data.size === 0) {
        throw new Error('Received empty PDF file');
      }

      // Check if it's actually a PDF
      if (response.data.type && !response.data.type.includes('pdf')) {
        console.warn('⚠️ Unexpected blob type:', response.data.type);
        // Don't throw error, sometimes blob type might not be set correctly
      }

      // Create download link
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with timestamp
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
      const filename = `admin_comprehensive_report_${dateStr}_${timeStr}.pdf`;
      
      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      console.log('✅ PDF downloaded successfully:', filename);

      // Show success message
      const successMessage = `Report downloaded successfully! (${(blob.size / 1024).toFixed(1)} KB)`;
      alert(successMessage);

    } catch (error) {
      console.error('❌ PDF download failed:', error);
      
      // Enhanced error handling
      let errorMessage = 'Failed to download report';
      
      if (error.response) {
        // Server responded with error status
        console.log('Server error response:', error.response);
        
        if (error.response.status === 403) {
          errorMessage = 'Access denied. Please ensure you have admin privileges.';
        } else if (error.response.status === 401) {
          errorMessage = 'Authentication required. Please login again.';
        } else if (error.response.status === 500) {
          errorMessage = 'Server error while generating report. Please try again later.';
        } else if (error.response.data) {
          // Try to extract error message from response
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          }
        }
      } else if (error.request) {
        // Network error
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        // Other errors
        errorMessage = error.message || errorMessage;
      }

      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
      
    } finally {
      setIsDownloading(false);
    }
  };

  // Date range helper functions
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyDatePreset = (days) => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);

    setDateRange({
      start_date: startDate.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0]
    });
  };

  const clearDateRange = () => {
    setDateRange({
      start_date: '',
      end_date: ''
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₹0';
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(numericAmount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const StatCard = ({ title, value, icon: Icon, trend, color = "blue", subtitle }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-2xl font-bold text-${color}-600 mb-1`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'} mt-1 flex items-center`}>
              {trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1 rotate-180" />}
              {Math.abs(trend)}%
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-50`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const TabButton = ({ id, label, icon: Icon, active, onClick, count }) => (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors relative ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
      }`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
      {count && (
        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
          active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );

  const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  const ErrorMessage = ({ message, onRetry }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
      <p className="text-gray-600 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Try Again
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <div className="ml-4 text-sm text-gray-500">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced PDF Download Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Generate Comprehensive Report</h3>
              <p className="text-sm text-gray-600 mt-1">Download detailed analytics and insights</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={downloadReport}
                disabled={isDownloading}
                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Report
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Date Range Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => handleDateChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => handleDateChange('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quick Select
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyDatePreset(7)}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors"
                >
                  7 days
                </button>
                <button
                  onClick={() => applyDatePreset(30)}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors"
                >
                  30 days
                </button>
                <button
                  onClick={() => applyDatePreset(90)}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors"
                >
                  90 days
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actions
              </label>
              <button
                onClick={clearDateRange}
                className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Dates
              </button>
            </div>
          </div>

          {/* Date Range Preview */}
          {(dateRange.start_date || dateRange.end_date) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <Calendar className="w-4 h-4 inline mr-2" />
                <strong>Report Period:</strong> {' '}
                {dateRange.start_date ? formatDate(dateRange.start_date) : 'Beginning'} - {' '}
                {dateRange.end_date ? formatDate(dateRange.end_date) : 'Now'}
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && error.includes('download') && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-800">Download Failed</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <div className="mt-3 flex space-x-3">
                    <button
                      onClick={downloadReport}
                      disabled={isDownloading}
                      className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => setError(null)}
                      className="text-sm text-red-600 hover:text-red-800 px-3 py-1 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
          <TabButton
            id="dashboard"
            label="Overview"
            icon={BarChart3}
            active={activeTab === 'dashboard'}
            onClick={setActiveTab}
          />
          <TabButton
            id="revenue"
            label="Revenue"
            icon={DollarSign}
            active={activeTab === 'revenue'}
            onClick={setActiveTab}
          />
          <TabButton
            id="users"
            label="Users"
            icon={Users}
            active={activeTab === 'users'}
            onClick={setActiveTab}
          />
          <TabButton
            id="verifications"
            label="Verifications"
            icon={UserCheck}
            active={activeTab === 'verifications'}
            onClick={setActiveTab}
            count={pendingData?.total_pending}
          />
        </div>

        {loading && <LoadingSpinner />}
        {error && !error.includes('download') && <ErrorMessage message={error} onRetry={loadData} />}

        {/* Dashboard Overview */}
        {activeTab === 'dashboard' && dashboardData && !loading && !error && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Revenue"
                value={formatCurrency(dashboardData.revenue?.total_revenue || 0)}
                icon={DollarSign}
                color="green"
                trend={12.5}
                subtitle="This period"
              />
              <StatCard
                title="Active Subscriptions"
                value={dashboardData.revenue?.active_subscriptions || 0}
                icon={CreditCard}
                color="blue"
                trend={8.2}
                subtitle="Currently active"
              />
              <StatCard
                title="Total Doctors"
                value={dashboardData.users?.total_doctors || 0}
                icon={Users}
                color="purple"
                trend={15.3}
                subtitle="Registered"
              />
              <StatCard
                title="Verified Doctors"
                value={dashboardData.users?.verified_doctors || 0}
                icon={CheckCircle}
                color="green"
                subtitle={`${Math.round(((dashboardData.users?.verified_doctors || 0) / (dashboardData.users?.total_doctors || 1)) * 100)}% verified`}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Revenue Trend */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Monthly Revenue Trend</h3>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="space-y-4">
                  {dashboardData.revenue?.monthly_trends?.map((item, index) => {
                    const maxRevenue = Math.max(...(dashboardData.revenue?.monthly_trends?.map(t => parseFloat(t.revenue)) || [1]));
                    const percentage = (parseFloat(item.revenue) / maxRevenue) * 100;
                    return (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 w-20">{item.month}</span>
                        <div className="flex items-center flex-1 mx-4">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-20 text-right">
                          {formatCurrency(item.revenue)}
                        </span>
                      </div>
                    );
                  }) || []}
                </div>
              </div>

              {/* Plan Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Subscription Plans</h3>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <div className="space-y-4">
                  {dashboardData.revenue?.plan_breakdown?.map((plan, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-900">{plan.plan_name}</h4>
                        <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                          {formatCurrency(plan.price)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="w-4 h-4 mr-1" />
                          {plan.active_subscriptions} active
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(plan.total_revenue)}
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Analytics */}
        {activeTab === 'revenue' && revenueData && !loading && !error && (
          <div className="space-y-6">
            {/* Revenue Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Completed Payments"
                value={revenueData.payment_breakdown?.find(p => p.status === 'completed')?.count || 0}
                icon={CheckCircle}
                color="green"
                subtitle={formatCurrency(revenueData.payment_breakdown?.find(p => p.status === 'completed')?.amount || 0)}
              />
              <StatCard
                title="Pending Payments"
                value={revenueData.payment_breakdown?.find(p => p.status === 'pending')?.count || 0}
                icon={Clock}
                color="yellow"
                subtitle={formatCurrency(revenueData.payment_breakdown?.find(p => p.status === 'pending')?.amount || 0)}
              />
              <StatCard
                title="Failed Payments"
                value={revenueData.payment_breakdown?.find(p => p.status === 'failed')?.count || 0}
                icon={XCircle}
                color="red"
                subtitle={formatCurrency(revenueData.payment_breakdown?.find(p => p.status === 'failed')?.amount || 0)}
              />
            </div>

            {/* Daily Revenue */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Daily Revenue (Last 5 Days)</h3>
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div className="space-y-3">
                {revenueData.daily_revenue?.map((day, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-900">{formatDate(day.date)}</span>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <CreditCard className="w-4 h-4 mr-1" />
                        {day.subscriptions} subs
                      </div>
                      <span className="text-sm font-bold text-green-600">
                        {formatCurrency(day.revenue)}
                      </span>
                    </div>
                  </div>
                )) || []}
              </div>
            </div>

            {/* Payment Status Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {revenueData.payment_breakdown?.map((status, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                    <p className="text-3xl font-bold text-gray-900 mb-2">{status.count}</p>
                    <p className="text-sm text-gray-600 capitalize mb-2">{status.status}</p>
                    <p className="text-sm font-medium text-green-600">
                      {formatCurrency(status.amount)}
                    </p>
                  </div>
                )) || []}
              </div>
            </div>
          </div>
        )}

        {/* Users Analytics */}
        {activeTab === 'users' && usersData && !loading && !error && (
          <div className="space-y-6">
            {/* User Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard
                title="Total Doctors"
                value={usersData.doctor_stats?.total || 0}
                icon={Users}
                color="blue"
              />
              <StatCard
                title="Verified"
                value={usersData.doctor_stats?.verified || 0}
                icon={CheckCircle}
                color="green"
              />
              <StatCard
                title="Pending"
                value={usersData.doctor_stats?.pending || 0}
                icon={Clock}
                color="yellow"
              />
              <StatCard
                title="With Subscription"
                value={usersData.doctor_stats?.with_subscription || 0}
                icon={CreditCard}
                color="purple"
              />
              <StatCard
                title="Total Patients"
                value={usersData.patient_stats?.total || 0}
                icon={Users}
                color="indigo"
              />
            </div>

            {/* Growth Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Doctor Growth</h3>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="space-y-3">
                  {usersData.growth_trends?.doctors?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600">{item.month}</span>
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${(item.count / 35) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-green-600">+{item.count}</span>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Top Specializations</h3>
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="space-y-3">
                  {usersData.specializations?.map((spec, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-900">{spec.specialization}</span>
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(spec.count / 50) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-blue-600">{spec.count}</span>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Verifications */}
        {activeTab === 'verifications' && pendingData && !loading && !error && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="w-6 h-6 text-yellow-500 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Pending Verifications ({pendingData.total_pending || 0})
                  </h3>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search doctors..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Verification List */}
            <div className="space-y-4">
              {(pendingData.pending_verifications || [])
                .filter(doctor => 
                  doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  doctor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((doctor) => (
                  <div key={doctor.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900">{doctor.name}</h4>
                        <p className="text-gray-600 flex items-center mt-1">
                          <span>{doctor.email}</span>
                        </p>
                        <div className="flex items-center mt-2 text-sm text-gray-500">
                          <FileText className="w-4 h-4 mr-1" />
                          <span>{doctor.specialization}</span>
                          <span className="mx-2">•</span>
                          <span>{doctor.experience} years exp</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleVerificationAction(doctor.id, 'approve')}
                          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleVerificationAction(doctor.id, 'reject')}
                          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">License Number</p>
                        <p className="text-sm font-medium text-gray-900">{doctor.license_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Clinic</p>
                        <p className="text-sm font-medium text-gray-900">{doctor.clinic_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Location</p>
                        <p className="text-sm font-medium text-gray-900">{doctor.location}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Submitted</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(doctor.submitted_date)}</p>
                      </div>
                    </div>

                    {/* Completion Status */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">Verification Checklist</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { key: 'profile_complete', label: 'Profile' },
                          { key: 'education_complete', label: 'Education' },
                          { key: 'certification_complete', label: 'Certification' },
                          { key: 'license_complete', label: 'License' }
                        ].map((item) => (
                          <div key={item.key} className="flex items-center">
                            {doctor[item.key] ? (
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500 mr-2" />
                            )}
                            <span className={`text-sm ${doctor[item.key] ? 'text-green-700' : 'text-red-700'}`}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Overall completion percentage */}
                      <div className="mt-4">
                        {(() => {
                          const completedItems = [
                            doctor.profile_complete,
                            doctor.education_complete,
                            doctor.certification_complete,
                            doctor.license_complete
                          ].filter(Boolean).length;
                          const completionPercentage = (completedItems / 4) * 100;
                          
                          return (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 mr-3">Overall Progress:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                                <div
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    completionPercentage === 100
                                      ? 'bg-green-500'
                                      : completionPercentage >= 75
                                      ? 'bg-blue-500'
                                      : completionPercentage >= 50
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${completionPercentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-gray-700">
                                {completionPercentage.toFixed(0)}%
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Empty State */}
            {(pendingData.pending_verifications || [])
              .filter(doctor => 
                doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doctor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase())
              ).length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'No matching verifications found' : 'No pending verifications'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm ? 'Try adjusting your search criteria.' : 'All doctor verifications are up to date!'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Show message when no data is loaded and not loading */}
        {!loading && !error && !dashboardData && !revenueData && !usersData && !pendingData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Admin Dashboard</h3>
            <p className="text-gray-600 mb-4">Select a tab above to view analytics data.</p>
            <button
              onClick={loadData}
              className="flex items-center mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Load Dashboard Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;