// hooks/useSubscription.js
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getSubscriptionStatus } from '../endpoints/Doc';

export const useSubscription = () => {
    const [subscriptionData, setSubscriptionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Use ref to prevent unnecessary re-renders when data hasn't actually changed
    const subscriptionDataRef = useRef(null);

    const fetchSubscriptionStatus = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            console.log('Fetching subscription status...'); // Debug log
            const response = await getSubscriptionStatus();
            console.log('Subscription response:', response); // Debug log
            
            if (response.data.success) {
                const newData = response.data.data;
                
                // Only update state if data has actually changed
                if (JSON.stringify(subscriptionDataRef.current) !== JSON.stringify(newData)) {
                    setSubscriptionData(newData);
                    subscriptionDataRef.current = newData;
                    console.log('Subscription data set:', newData); // Debug log
                }
            } else {
                const errorMsg = response.data.message || 'Failed to fetch subscription status';
                console.error('Subscription fetch failed:', errorMsg);
                setError(errorMsg);
            }
        } catch (err) {
            console.error('Subscription fetch error:', err);
            
            // Handle different error scenarios with more specific logging
            if (err.response?.status === 403) {
                const errorMsg = 'Access denied. Only doctors can check subscription status.';
                console.error('403 Error:', errorMsg);
                setError(errorMsg);
            } else if (err.response?.status === 500) {
                const errorMsg = 'Server error. Please try again later.';
                console.error('500 Error:', errorMsg);
                setError(errorMsg);
            } else if (err.response?.status === 402) {
                const errorMsg = 'Subscription required for this action.';
                console.error('402 Error:', errorMsg);
                setError(errorMsg);
            } else {
                const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch subscription status';
                console.error('General Error:', errorMsg);
                setError(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscriptionStatus();
    }, [fetchSubscriptionStatus]);

    // Use useMemo instead of useCallback for computed values that depend on subscriptionData
    // This will only recalculate when subscriptionData actually changes
    const memoizedHelpers = useMemo(() => {
        console.log('Recalculating memoized helpers...'); // Debug log to see when this runs
        
        const hasActiveSubscription = () => {
            const hasSubscription = subscriptionData?.has_subscription || false;
            console.log('hasActiveSubscription check:', hasSubscription, subscriptionData); // Debug log
            return hasSubscription;
        };

        const getCurrentPlan = () => {
            const plan = subscriptionData?.plan || null;
            console.log('getCurrentPlan:', plan); // Debug log
            return plan;
        };

        const getUsageStats = () => {
            const usage = subscriptionData?.usage_stats || null;
            console.log('getUsageStats:', usage); // Debug log
            return usage;
        };

        const isNearLimit = (type) => {
            const usage = getUsageStats();
            const plan = getCurrentPlan();
            
            if (!usage || !plan) {
                console.log('isNearLimit: No usage or plan data', { usage, plan });
                return false;
            }
            
            let result = false;
            switch (type) {
                case 'services':
                    result = usage.services_count >= (plan.max_services * 0.8);
                    break;
                case 'daily_schedules':
                    result = usage.daily_schedules_count >= (plan.max_daily_schedules * 0.8);
                    break;
                case 'monthly_schedules':
                    result = usage.monthly_schedules_count >= (plan.max_monthly_schedules * 0.8);
                    break;
                default:
                    result = false;
            }
            
            console.log(`isNearLimit(${type}):`, result, { usage, plan });
            return result;
        };

        const canCreateService = (type) => {
            const usage = getUsageStats();
            const plan = getCurrentPlan();
            
            console.log('canCreateService check:', { type, usage, plan });
            
            if (!usage || !plan) {
                console.log('canCreateService: No usage or plan data');
                return false;
            }
            
            // Check if user has reached the maximum number of services
            if (usage.services_count >= plan.max_services) {
                console.log('canCreateService: Max services reached', usage.services_count, plan.max_services);
                return false;
            }
            
            // Check service type permissions
            if (type === 'online') {
                const canCreate = plan.can_create_online_services;
                console.log('canCreateService: Online service check', canCreate);
                return canCreate;
            } else if (type === 'offline') {
                const canCreate = plan.can_create_offline_services;
                console.log('canCreateService: Offline service check', canCreate);
                return canCreate;
            }
            
            // For general service creation check
            console.log('canCreateService: General check - true');
            return true;
        };

        return {
            hasActiveSubscription,
            getCurrentPlan,
            getUsageStats,
            isNearLimit,
            canCreateService
        };
    }, [subscriptionData]); // Only recalculate when subscriptionData changes

    // These methods don't depend on subscriptionData, so keep them as useCallback
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const resetSubscription = useCallback(() => {
        setSubscriptionData(null);
        subscriptionDataRef.current = null;
        setError(null);
        setLoading(false);
    }, []);
    
    return {
        subscriptionData,
        loading,
        error,
        refetch: fetchSubscriptionStatus,
        clearError,
        resetSubscription,
        // Spread the memoized helpers
        ...memoizedHelpers
    };
};

// Updated handleSubscriptionError function with better error detection
export const createSubscriptionErrorModal = (error) => {
    console.log('createSubscriptionErrorModal called with:', error); // Debug log
    
    // Handle API response errors
    if (error?.response?.status === 402) {
        return {
            isOpen: true,
            title: 'Subscription Required',
            message: 'You need an active subscription to access this feature.',
            confirmText: 'View Plans',
            cancelText: 'Cancel',
            onConfirm: () => {
                window.location.href = '/doctor/choosePlan';
            }
        };
    } else if (error?.response?.status === 403) {
        const errorData = error.response.data;
        
        if (errorData?.error_type === 'limit_reached') {
            return {
                isOpen: true,
                title: 'Plan Limit Reached',
                message: errorData.message || 'You have reached the limit for your current plan.',
                confirmText: 'Upgrade Plan',
                cancelText: 'Cancel',
                onConfirm: () => {
                    window.location.href = '/doctor/choosePlan';
                }
            };
        } else {
            return {
                isOpen: true,
                title: 'Feature Not Available',
                message: errorData?.message || 'This feature is not available in your current plan.',
                confirmText: 'View Plans',
                cancelText: 'Cancel',
                onConfirm: () => {
                    window.location.href = '/doctor/choosePlan';
                }
            };
        }
    } else if (error?.response?.status === 500) {
        return {
            isOpen: true,
            title: 'Server Error',
            message: 'A server error occurred. Please try again later.',
            confirmText: 'OK',
            cancelText: null,
            onConfirm: () => {}
        };
    }
    
    // Handle subscription-specific errors
    if (typeof error === 'string' && error.includes('subscription')) {
        return {
            isOpen: true,
            title: 'Subscription Issue',
            message: error,
            confirmText: 'View Plans',
            cancelText: 'Cancel',
            onConfirm: () => {
                window.location.href = '/subscription/plans';
            }
        };
    }
    
    // Default error modal
    return {
        isOpen: true,
        title: 'Error',
        message: error?.message || error || 'An error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: null,
        onConfirm: () => {}
    };
};