// // ============================================
// // 1. CREATE SUBSCRIPTION HOOK (hooks/useSubscription.js)
// // ============================================

// import { useState, useEffect } from 'react';
// import axios from 'axios';

// export const useSubscription = () => {
//   const [subscriptionData, setSubscriptionData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   const fetchSubscriptionStatus = async () => {
//     try {
//       setLoading(true);
//       const response = await axios.get('/api/subscription/status/');
//       if (response.data.success) {
//         setSubscriptionData(response.data.data);
//       } else {
//         setError(response.data.message);
//       }
//     } catch (err) {
//       setError('Failed to fetch subscription status');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchSubscriptionStatus();
//   }, []);

//   return {
//     subscriptionData,
//     loading,
//     error,
//     refetch: fetchSubscriptionStatus
//   };
// };

// // ============================================
// // 2. CREATE SUBSCRIPTION VALIDATION UTILITY
// // ============================================

// // utils/subscriptionUtils.js
// export const handleSubscriptionError = (error, navigate, showModal) => {
//   if (error.response?.status === 402) {
//     // Payment required - redirect to subscription plans
//     const errorData = error.response.data;
    
//     showModal({
//       title: 'Subscription Required',
//       message: errorData.message,
//       type: 'subscription_required',
//       onConfirm: () => {
//         navigate(errorData.redirect_to || '/subscription/plans');
//       }
//     });
    
//   } else if (error.response?.status === 403 && error.response.data.error_type === 'limit_reached') {
//     // Limit reached - show upgrade modal
//     const errorData = error.response.data;
    
//     showModal({
//       title: 'Plan Limit Reached',
//       message: errorData.message,
//       type: 'limit_reached',
//       currentUsage: errorData.current_usage,
//       onConfirm: () => {
//         navigate(errorData.redirect_to || '/subscription/upgrade');
//       }
//     });
//   }
// };

// // ============================================
// // 3. UPDATE YOUR SERVICE CREATION COMPONENT
// // ============================================

// // components/ServiceForm.jsx
// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useSubscription } from '../hooks/useSubscription';
// import { handleSubscriptionError } from '../utils/subscriptionUtils';

// const ServiceForm = ({ showModal }) => {
//   const navigate = useNavigate();
//   const { subscriptionData } = useSubscription();
//   const [formData, setFormData] = useState({
//     service_name: '',
//     service_mode: 'online',
//     service_fee: '',
//     description: ''
//   });

//   // Check limits before allowing form submission
//   const canCreateService = (mode) => {
//     if (!subscriptionData?.has_subscription) return false;
    
//     const usage = subscriptionData.usage_stats;
//     const plan = subscriptionData.plan;
    
//     if (mode === 'online' && !plan.can_create_online_services) return false;
//     if (mode === 'offline' && !plan.can_create_offline_services) return false;
    
//     return usage.services.used < usage.services.limit;
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
    
//     // Pre-validation check
//     if (!canCreateService(formData.service_mode)) {
//       showModal({
//         title: 'Cannot Create Service',
//         message: `You've reached the limit for ${formData.service_mode} services.`,
//         type: 'limit_reached',
//         currentUsage: subscriptionData?.usage_stats,
//         onConfirm: () => navigate('/subscription/upgrade')
//       });
//       return;
//     }

//     try {
//       const response = await axios.post('/api/services/', formData);
//       if (response.data.success) {
//         // Service created successfully
//         navigate('/services');
//       }
//     } catch (error) {
//       // Handle subscription-related errors
//       handleSubscriptionError(error, navigate, showModal);
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit}>
//       {/* Show usage stats if available */}
//       {subscriptionData?.usage_stats && (
//         <div className="usage-indicator">
//           <p>Services: {subscriptionData.usage_stats.services.used}/{subscriptionData.usage_stats.services.limit}</p>
//         </div>
//       )}

//       {/* Your existing form fields */}
//       <input
//         type="text"
//         placeholder="Service Name"
//         value={formData.service_name}
//         onChange={(e) => setFormData({...formData, service_name: e.target.value})}
//       />
      
//       <select
//         value={formData.service_mode}
//         onChange={(e) => setFormData({...formData, service_mode: e.target.value})}
//       >
//         <option value="online">Online</option>
//         <option value="offline" disabled={!subscriptionData?.plan?.can_create_offline_services}>
//           Offline {!subscriptionData?.plan?.can_create_offline_services ? '(Upgrade required)' : ''}
//         </option>
//       </select>

//       {/* Other form fields */}

//       <button 
//         type="submit" 
//         disabled={!canCreateService(formData.service_mode)}
//       >
//         Create Service
//       </button>
//     </form>
//   );
// };

// // ============================================
// // 4. UPDATE YOUR SCHEDULE CREATION COMPONENT
// // ============================================

// // components/ScheduleForm.jsx
// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useSubscription } from '../hooks/useSubscription';
// import { handleSubscriptionError } from '../utils/subscriptionUtils';

// const ScheduleForm = ({ showModal }) => {
//   const navigate = useNavigate();
//   const { subscriptionData } = useSubscription();
//   const [formData, setFormData] = useState({
//     service: '',
//     mode: 'online',
//     date: '',
//     start_time: '',
//     end_time: '',
//     slot_duration: '30'
//   });

//   const canCreateSchedule = () => {
//     if (!subscriptionData?.has_subscription) return false;
    
//     const usage = subscriptionData.usage_stats;
//     return (
//       usage.daily_schedules.used < usage.daily_schedules.limit &&
//       usage.monthly_schedules.used < usage.monthly_schedules.limit
//     );
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
    
//     // Pre-validation check
//     if (!canCreateSchedule()) {
//       const usage = subscriptionData?.usage_stats;
//       const limitType = usage.daily_schedules.used >= usage.daily_schedules.limit 
//         ? 'daily' : 'monthly';
      
//       showModal({
//         title: 'Schedule Limit Reached',
//         message: `You've reached your ${limitType} schedule limit.`,
//         type: 'limit_reached',
//         currentUsage: usage,
//         onConfirm: () => navigate('/subscription/upgrade')
//       });
//       return;
//     }

//     try {
//       const response = await axios.post('/api/schedules/', formData);
//       if (response.data.success) {
//         navigate('/schedules');
//       }
//     } catch (error) {
//       handleSubscriptionError(error, navigate, showModal);
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit}>
//       {/* Show usage stats */}
//       {subscriptionData?.usage_stats && (
//         <div className="usage-indicator">
//           <p>Today: {subscriptionData.usage_stats.daily_schedules.used}/{subscriptionData.usage_stats.daily_schedules.limit}</p>
//           <p>This Month: {subscriptionData.usage_stats.monthly_schedules.used}/{subscriptionData.usage_stats.monthly_schedules.limit}</p>
//         </div>
//       )}

//       {/* Your form fields */}
      
//       <button 
//         type="submit" 
//         disabled={!canCreateSchedule()}
//       >
//         Create Schedule
//       </button>
//     </form>
//   );
// };

// // ============================================
// // 5. SUBSCRIPTION MODAL COMPONENT
// // ============================================

// // components/SubscriptionModal.jsx
// const SubscriptionModal = ({ isOpen, modalData, onClose }) => {
//   if (!isOpen || !modalData) return null;

//   return (
//     <div className="modal-overlay">
//       <div className="modal">
//         <h3>{modalData.title}</h3>
//         <p>{modalData.message}</p>
        
//         {modalData.currentUsage && (
//           <div className="usage-stats">
//             <h4>Current Usage:</h4>
//             <p>Services: {modalData.currentUsage.services.used}/{modalData.currentUsage.services.limit}</p>
//             <p>Daily Schedules: {modalData.currentUsage.daily_schedules.used}/{modalData.currentUsage.daily_schedules.limit}</p>
//             <p>Monthly Schedules: {modalData.currentUsage.monthly_schedules.used}/{modalData.currentUsage.monthly_schedules.limit}</p>
//           </div>
//         )}
        
//         <div className="modal-actions">
//           <button onClick={onClose}>Cancel</button>
//           <button onClick={modalData.onConfirm} className="primary">
//             {modalData.type === 'subscription_required' ? 'View Plans' : 'Upgrade Now'}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };