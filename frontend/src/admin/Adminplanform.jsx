import React, { useState } from 'react';
import { ArrowLeft, Plus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { createSubscriptionPlan } from '../endpoints/adm';

export default function SubscriptionPlanForm() {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    duration_days: 30,
    max_services: 3,
    max_schedules_per_day: 2,
    max_schedules_per_month: 20,
    can_create_online_service: true,
    can_create_offline_service: false,
    is_active: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null
  const [errorMessage, setErrorMessage] = useState('');

  const planChoices = [
    { value: 'basic', label: 'Basic Plan' },
    { value: 'standard', label: 'Standard Plan' },
    
    { value: 'premium', label: 'Premium Plan' },
    { value: 'enterprise', label: 'Enterprise Plan' }
    ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) || 0 : value)
    }));
    
    // Clear any previous error status when user starts typing
    if (submitStatus === 'error') {
      setSubmitStatus(null);
      setErrorMessage('');
    }
  };

  const validateForm = () => {
    if (!formData.name) {
      setErrorMessage('Please select a plan type');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setErrorMessage('Please enter a valid price');
      return false;
    }
    if (formData.duration_days <= 0) {
      setErrorMessage('Duration must be at least 1 day');
      return false;
    }
    if (formData.max_services <= 0) {
      setErrorMessage('Max services must be at least 1');
      return false;
    }
    if (formData.max_schedules_per_day <= 0) {
      setErrorMessage('Max schedules per day must be at least 1');
      return false;
    }
    if (formData.max_schedules_per_month <= 0) {
      setErrorMessage('Max schedules per month must be at least 1');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!validateForm()) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);
    setErrorMessage('');

    try {
      // Convert price to decimal format for the API
      const planData = {
        ...formData,
        price: parseFloat(formData.price).toFixed(2)
      };

      console.log('Submitting plan data:', planData);
      
      const response = await createSubscriptionPlan(planData);
      console.log('Plan created successfully:', response.data);
      
      setSubmitStatus('success');
      
      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          name: '',
          price: '',
          duration_days: 30,
          max_services: 3,
          max_schedules_per_day: 2,
          max_schedules_per_month: 20,
          can_create_online_service: true,
          can_create_offline_service: false,
          is_active: true
        });
        setSubmitStatus(null);
      }, 2000);

    } catch (error) {
      console.error('Error creating plan:', error);
      setSubmitStatus('error');
      
      // Handle different types of errors
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else if (error.response?.data?.name) {
        setErrorMessage(`Name: ${error.response.data.name[0]}`);
      } else if (error.response?.data) {
        // Handle field-specific errors
        const errorFields = Object.keys(error.response.data);
        if (errorFields.length > 0) {
          const firstError = error.response.data[errorFields[0]];
          setErrorMessage(`${errorFields[0]}: ${Array.isArray(firstError) ? firstError[0] : firstError}`);
        } else {
          setErrorMessage('Failed to create subscription plan. Please try again.');
        }
      } else {
        setErrorMessage('Network error. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = () => {
    if (submitStatus === 'success') {
      return <CheckCircle className="text-green-500" size={20} />;
    } else if (submitStatus === 'error') {
      return <AlertCircle className="text-red-500" size={20} />;
    }
    return null;
  };

  const getStatusMessage = () => {
    if (submitStatus === 'success') {
      return <span className="text-green-600 text-sm">Plan created successfully!</span>;
    } else if (submitStatus === 'error' && errorMessage) {
      return <span className="text-red-600 text-sm">{errorMessage}</span>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button className="mr-4 p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Subscription Plan</h1>
            <p className="text-gray-600">Create a new subscription plan for your customers</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="space-y-6">
              {/* Plan Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Plan Name *
                </label>
                <select
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select plan type</option>
                  {planChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="Enter price"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Duration */}
              <div>
                <label htmlFor="duration_days" className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (days) *
                </label>
                <input
                  type="number"
                  id="duration_days"
                  name="duration_days"
                  value={formData.duration_days}
                  onChange={handleInputChange}
                  placeholder="e.g., 30 days, 365 days"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Feature Limits */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Feature Limits</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="max_services" className="block text-sm font-medium text-gray-700 mb-2">
                      Max Services *
                    </label>
                    <input
                      type="number"
                      id="max_services"
                      name="max_services"
                      value={formData.max_services}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="max_schedules_per_day" className="block text-sm font-medium text-gray-700 mb-2">
                      Max Schedules/Day *
                    </label>
                    <input
                      type="number"
                      id="max_schedules_per_day"
                      name="max_schedules_per_day"
                      value={formData.max_schedules_per_day}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="max_schedules_per_month" className="block text-sm font-medium text-gray-700 mb-2">
                      Max Schedules/Month *
                    </label>
                    <input
                      type="number"
                      id="max_schedules_per_month"
                      name="max_schedules_per_month"
                      value={formData.max_schedules_per_month}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Permissions</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="can_create_online_service"
                      name="can_create_online_service"
                      checked={formData.can_create_online_service}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="can_create_online_service" className="ml-2 text-sm text-gray-700">
                      Can create online services
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="can_create_offline_service"
                      name="can_create_offline_service"
                      checked={formData.can_create_offline_service}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="can_create_offline_service" className="ml-2 text-sm text-gray-700">
                      Can create offline services
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                      Plan is active
                    </label>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {(submitStatus || errorMessage) && (
                <div className="flex items-center space-x-2">
                  {getStatusIcon()}
                  {getStatusMessage()}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
                    isSubmitting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : submitStatus === 'success'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Creating Plan...</span>
                    </>
                  ) : submitStatus === 'success' ? (
                    <>
                      <CheckCircle size={20} />
                      <span>Plan Created!</span>
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      <span>Add Plan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}