import React, { useState, useEffect } from 'react';
import { 
  Edit, 
  Trash2, 
  Plus, 
  Search,
  Bell,
  ChevronDown,
  LayoutDashboard,
  Users,
  FileText,
  UserCheck,
  Calendar,
  CreditCard,
  Building2,
  Eye,
  Settings,
  X,
  Save,
  Loader2,
  XCircle,
  CheckCircle
} from 'lucide-react';
import Sidebar from '../components/ui/Sidebar';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  createSubscriptionPlan 
} from '../endpoints/adm';

export default function SubscriptionPlansManager() {
  const [activeMenu, setActiveMenu] = useState('Plans');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState({
    message: '',
    type: '', // 'general' or 'form'
    fields: {} // field-specific errors
  });
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    duration_days: '',
    max_services: '',
    max_schedules_per_day: '',
    max_schedules_per_month: '',
    can_create_online_service: true,
    can_create_offline_service: false,
    is_active: true
  });
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      duration_days: '',
      max_services: '',
      max_schedules_per_day: '',
      max_schedules_per_month: '',
      can_create_online_service: true,
      can_create_offline_service: false,
      is_active: true
    });
    setError({ message: '', type: '', fields: {} });
    setEditingPlan(null);
    setSuccess('');
  };

  const handleCreatePlan = () => {
    resetForm();
    setShowModal(true);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError({ message: '', type: '', fields: {} });
      const response = await getAllSubscriptionPlans();
      
      const plansData = response.data || response;
      setPlans(Array.isArray(plansData) ? plansData : []);
    } catch (error) {
      console.error('Error loading plans:', error);
      setError({
        message: 'Failed to load subscription plans. Please try again later.',
        type: 'general'
      });
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlan = async (planId) => {

    if (!planId) {
    console.error('Plan ID is required');
    setError('Invalid plan ID');
    return;
  }
    try {
      setLoading(true);
      const response = await getSubscriptionPlanById(planId);
      const planData = response.data || response;
      setViewingPlan(planData);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching plan details:', error);
      setError({
        message: 'Failed to load plan details. Please try again.',
        type: 'general'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = async (plan) => {
    if (!plan || !plan.id) {
    console.error('Invalid plan object:', plan);
    setError('Invalid plan data');
    return;
  }
    try {
      let fullPlan = plan;
      if (!plan.created_at) {
        const response = await getSubscriptionPlanById(plan.id);
        fullPlan = response.data || response;
      }

      setEditingPlan(fullPlan);
      setFormData({
        name: fullPlan.name || '',
        price: fullPlan.price?.toString() || '',
        duration_days: fullPlan.duration_days?.toString() || '',
        max_services: fullPlan.max_services?.toString() || '',
        max_schedules_per_day: fullPlan.max_schedules_per_day?.toString() || '',
        max_schedules_per_month: fullPlan.max_schedules_per_month?.toString() || '',
        can_create_online_service: fullPlan.can_create_online_service ?? true,
        can_create_offline_service: fullPlan.can_create_offline_service ?? false,
        is_active: fullPlan.is_active ?? true
      });
      setError({ message: '', type: '', fields: {} });
      setShowModal(true);
    } catch (error) {
      console.error('Error preparing plan for edit:', error);
      setError({
        message: 'Failed to load plan for editing. Please try again.',
        type: 'general'
      });
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!planId) {
    setError('Plan ID is required');
    return;
  }
    if (window.confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      try {
        await deleteSubscriptionPlan(planId);
        await loadPlans();
        setSuccess('Plan deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        console.error('Error deleting plan:', error);
        setError({
          message: 'Failed to delete plan. Please try again.',
          type: 'general'
        });
      }
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = ['Plan name is required'];
    } else if (formData.name.trim().length > 50) {
      errors.name = ['Plan name must be less than 50 characters'];
    }
    
    if (!formData.price || isNaN(formData.price) || parseFloat(formData.price) <= 0) {
      errors.price = ['Price must be a valid number greater than 0'];
    }
    
    if (!formData.duration_days || isNaN(formData.duration_days) || parseInt(formData.duration_days) <= 0) {
      errors.duration_days = ['Duration must be a whole number greater than 0'];
    }
    
    if (!formData.max_services || isNaN(formData.max_services) || parseInt(formData.max_services) <= 0) {
      errors.max_services = ['Max services must be a whole number greater than 0'];
    }
    
    if (!formData.max_schedules_per_day || isNaN(formData.max_schedules_per_day) || parseInt(formData.max_schedules_per_day) <= 0) {
      errors.max_schedules_per_day = ['Max schedules per day must be a whole number greater than 0'];
    }
    
    if (!formData.max_schedules_per_month || isNaN(formData.max_schedules_per_month) || parseInt(formData.max_schedules_per_month) <= 0) {
      errors.max_schedules_per_month = ['Max schedules per month must be a whole number greater than 0'];
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError({ message: '', type: '', fields: {} });
    setSuccess('');

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setError({
        message: 'Please fix the errors in the form',
        type: 'form',
        fields: validationErrors
      });
      setSubmitting(false);
      return;
    }

    try {
      const planData = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        duration_days: parseInt(formData.duration_days),
        max_services: parseInt(formData.max_services),
        max_schedules_per_day: parseInt(formData.max_schedules_per_day),
        max_schedules_per_month: parseInt(formData.max_schedules_per_month),
        can_create_online_service: formData.can_create_online_service,
        can_create_offline_service: formData.can_create_offline_service,
        is_active: formData.is_active
      };

      if (editingPlan) {
        await updateSubscriptionPlan(editingPlan.id, planData);
        setSuccess('Plan updated successfully');
      } else {
        await createSubscriptionPlan(planData);
        setSuccess('Plan created successfully');
      }

      setTimeout(() => {
        setShowModal(false);
        resetForm();
        loadPlans();
      }, 1500);
    } catch (error) {
      console.error('Error saving plan:', error);
      
      let errorMessage = 'Failed to save plan. Please try again.';
      let fieldErrors = {};
      
      if (error.response?.data) {
        if (error.response.data.errors) {
          fieldErrors = error.response.data.errors;
          errorMessage = 'Please fix the errors in the form';
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else {
          Object.keys(error.response.data).forEach(field => {
            if (Array.isArray(error.response.data[field])) {
              fieldErrors[field] = error.response.data[field];
            }
          });
          if (Object.keys(fieldErrors).length > 0) {
            errorMessage = 'Please fix the errors in the form';
          }
        }
      }

      setError({
        message: errorMessage,
        type: Object.keys(fieldErrors).length ? 'form' : 'general',
        fields: fieldErrors
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPlans = plans.filter(plan =>
    (plan.display_name && plan.display_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (plan.name && plan.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    totalPlans: plans.length,
    activePlans: plans.filter(p => p.is_active).length,
    totalRevenue: plans.reduce((sum, plan) => sum + (plan.price * 30), 0),
  };

  const getPlanFeatures = (plan) => {
    return [
      `${plan.max_services || 0} services allowed`,
      `${plan.max_schedules_per_day || 0} schedules per day`,
      `${plan.max_schedules_per_month || 0} schedules per month`,
      plan.can_create_online_service ? 'Online services' : 'No online services',
      plan.can_create_offline_service ? 'Offline services' : 'No offline services'
    ];
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading subscription plans...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
        </div>
        <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Subscription Plans</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your subscription plans and pricing</p>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  A
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-700">Admin</span>
                  <ChevronDown size={16} className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
              <button 
                onClick={() => setSuccess('')}
                className="ml-auto text-green-500 hover:text-green-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Error Message */}
          {error.message && (
            <div className={`mb-4 p-4 rounded-lg ${
              error.type === 'general' 
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <div className="flex items-start">
                <XCircle className={`h-5 w-5 flex-shrink-0 ${
                  error.type === 'general' ? 'text-red-500' : 'text-yellow-500'
                }`} />
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${
                    error.type === 'general' ? 'text-red-800' : 'text-yellow-800'
                  }`}>
                    {error.message}
                  </h3>
                  {error.type === 'form' && (
                    <div className="mt-2 text-sm">
                      <ul className="list-disc pl-5 space-y-1">
                        {Object.values(error.fields).flat().map((msg, i) => (
                          <li key={i} className={error.type === 'general' ? 'text-red-700' : 'text-yellow-700'}>
                            {msg}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setError({ message: '', type: '', fields: {} })}
                  className={`ml-auto ${
                    error.type === 'general' ? 'text-red-500 hover:text-red-700' : 'text-yellow-500 hover:text-yellow-700'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search plans..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-80"
                />
              </div>
              <span className="text-sm text-gray-500">
                Showing {filteredPlans.length} of {plans.length} plans
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={loadPlans}
                disabled={loading}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Refresh
              </button>
              <button 
                onClick={handleCreatePlan}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Add New Plan
              </button>
            </div>
          </div>

          

          {/* Plans Grid */}
          {filteredPlans.length === 0 && !loading ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No plans found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'No plans match your search criteria.' : 'Get started by creating your first subscription plan.'}
              </p>
              {!searchTerm && (
                <button 
                  onClick={handleCreatePlan}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors"
                >
                  <Plus size={16} />
                  Create First Plan
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {plan.display_name || plan.name}
                      </h3>
                      <p className="text-sm text-gray-500">{plan.duration_days} days</p>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleViewPlan(plan.id)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => handleEditPlan(plan)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Plan"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeletePlan(plan.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Plan"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-500 ml-1">/{plan.duration_days}d</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      plan.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {getPlanFeatures(plan).map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-gray-600 leading-relaxed">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
              </h2>
              <button 
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Plan Type *
                    </label>
                    <select
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className={`w-full px-3 py-2 border ${
                        error.fields.name ? 'border-red-300' : 'border-gray-300'
                        } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                        required
                    >
                        <option value="">Select plan type</option>
                        <option value="basic">Basic Plan</option>
                        <option value="standard">Standard Plan</option>
                        <option value="pro">Pro Plan</option>
                        <option value="premium">Premium Plan</option>
                        <option value="enterprise">Enterprise Plan</option>
                    </select>
                    {error.fields.name && (
                        <p className="text-red-500 text-sm mt-1">{error.fields.name[0]}</p>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className={`w-full px-3 py-2 border ${
                      error.fields.price ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    required
                  />
                  {error.fields.price && (
                    <p className="text-red-500 text-sm mt-1">{error.fields.price[0]}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({...formData, duration_days: e.target.value})}
                    className={`w-full px-3 py-2 border ${
                      error.fields.duration_days ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    required
                  />
                  {error.fields.duration_days && (
                    <p className="text-red-500 text-sm mt-1">{error.fields.duration_days[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Services *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_services}
                    onChange={(e) => setFormData({...formData, max_services: e.target.value})}
                    className={`w-full px-3 py-2 border ${
                      error.fields.max_services ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    required
                  />
                  {error.fields.max_services && (
                    <p className="text-red-500 text-sm mt-1">{error.fields.max_services[0]}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Schedules Per Day *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_schedules_per_day}
                    onChange={(e) => setFormData({...formData, max_schedules_per_day: e.target.value})}
                    className={`w-full px-3 py-2 border ${
                      error.fields.max_schedules_per_day ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    required
                  />
                  {error.fields.max_schedules_per_day && (
                    <p className="text-red-500 text-sm mt-1">{error.fields.max_schedules_per_day[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Schedules Per Month *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_schedules_per_month}
                    onChange={(e) => setFormData({...formData, max_schedules_per_month: e.target.value})}
                    className={`w-full px-3 py-2 border ${
                      error.fields.max_schedules_per_month ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    required
                  />
                  {error.fields.max_schedules_per_month && (
                    <p className="text-red-500 text-sm mt-1">{error.fields.max_schedules_per_month[0]}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="online_service"
                    checked={formData.can_create_online_service}
                    onChange={(e) => setFormData({...formData, can_create_online_service: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="online_service" className="ml-2 text-sm text-gray-700">
                    Can Create Online Services
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="offline_service"
                    checked={formData.can_create_offline_service}
                    onChange={(e) => setFormData({...formData, can_create_offline_service: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="offline_service" className="ml-2 text-sm text-gray-700">
                    Can Create Offline Services
                  </label>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Active Plan
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {showDetailModal && viewingPlan && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Plan Details - {viewingPlan?.display_name || viewingPlan?.name || 'Unknown Plan'}
        </h2>
        <button 
          onClick={() => {
            setShowDetailModal(false);
            setViewingPlan(null);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
              Basic Information
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Plan Name</label>
                <p className="text-gray-900 mt-1">{viewingPlan?.display_name || viewingPlan?.name || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Price</label>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ${viewingPlan?.price ? parseFloat(viewingPlan.price).toFixed(2) : 'N/A'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Duration</label>
                <p className="text-gray-900 mt-1">{viewingPlan?.duration_days || 'N/A'} days</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    viewingPlan?.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {viewingPlan?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Limitations */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
              Plan Limitations
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Max Services</label>
                <p className="text-gray-900 mt-1">{viewingPlan?.max_services || 'Unlimited'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Max Schedules Per Day</label>
                <p className="text-gray-900 mt-1">{viewingPlan?.max_schedules_per_day || 'Unlimited'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Max Schedules Per Month</label>
                <p className="text-gray-900 mt-1">{viewingPlan?.max_schedules_per_month || 'Unlimited'}</p>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
              Permissions
            </h3>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  viewingPlan?.can_create_online_service ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-gray-900">
                  {viewingPlan?.can_create_online_service ? 'Can create online services' : 'Cannot create online services'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  viewingPlan?.can_create_offline_service ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-gray-900">
                  {viewingPlan?.can_create_offline_service ? 'Can create offline services' : 'Cannot create offline services'}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
              Metadata
            </h3>
            
            <div className="space-y-3">
              {viewingPlan?.created_at && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Created</label>
                  <p className="text-gray-900 mt-1">
                    {new Date(viewingPlan.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
              
              {viewingPlan?.updated_at && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900 mt-1">
                    {new Date(viewingPlan.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
              
              {viewingPlan?.id && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Plan ID</label>
                  <p className="text-gray-900 mt-1 font-mono text-sm bg-gray-50 px-2 py-1 rounded">
                    {viewingPlan.id}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    setViewingPlan(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEditPlan(viewingPlan);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Edit size={16} />
                  Edit Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
