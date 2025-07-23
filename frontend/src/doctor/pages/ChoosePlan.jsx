
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from "../../components/ui/card";
import Button from "../../components/ui/Button";
import DocHeader from "../../components/ui/DocHeader";
import { Plus, CalendarDays, Crown, Award, CheckCircle, Star, Shield, Clock, Headset, HeartPulse, Users, CreditCard, ArrowRight, AlertCircle, ChevronDown, ChevronUp, X, Loader2 } from "lucide-react";
import { getSubscriptionPlan, getSubscriptionPlans } from "../../endpoints/Doc";
import { verifyPayment, activateSubscription } from "../../endpoints/Doc";
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 pb-4">
      <button
        className="flex justify-between items-center w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <h4 className="font-medium text-gray-900">{question}</h4>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen && <p className="text-gray-600 mt-2">{answer}</p>}
    </div>
  );
};

export default function ChoosePlanDashboard() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const navigate = useNavigate();

  // Load Razorpay script dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await getSubscriptionPlans();
        
        let plansData;
        if (Array.isArray(response.data)) {
          plansData = response.data;
        } else if (response.data?.results) {
          plansData = response.data.results;
        } else if (response.data?.data) {
          plansData = response.data.data;
        } else {
          throw new Error('Invalid response format');
        }
        
        const transformedPlans = plansData
          .filter(plan => plan?.is_active)
          .map(plan => transformPlanData(plan))
          .filter(Boolean)
          .sort((a, b) => a.duration_days - b.duration_days);
        
        setPlans(transformedPlans);
      } catch (err) {
        console.error('Error fetching plans:', err);
        setError('Failed to load plans. Please refresh or try again later.');
        toast.error('Failed to load subscription plans');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const transformPlanData = (apiPlan) => {
    if (!apiPlan) return null;

    const planConfig = {
      basic: {
        icon: CalendarDays,
        color: "bg-blue-100 text-blue-600",
        isPopular: false,
        cta: "Get Started",
        gradient: "from-blue-500 to-blue-600",
        badge: null
      },
      gold: {
        icon: Crown,
        color: "bg-yellow-100 text-yellow-600",
        isPopular: true,
        cta: "Most Popular",
        gradient: "from-yellow-500 to-yellow-600",
        badge: "Best Value"
      },
      platinum: {
        icon: Award,
        color: "bg-purple-100 text-purple-600",
        isPopular: false,
        cta: "Go Premium",
        gradient: "from-purple-500 to-purple-600",
        badge: "VIP"
      }
    };

    const planName = (apiPlan.name || '').toLowerCase();
    const config = planConfig[planName] || planConfig.basic;
    
    const getDurationDisplay = (days) => {
      if (!days || days <= 31) return "Monthly";
      if (days <= 93) return "Quarterly"; 
      if (days >= 365) return "Annual";
      return `${days} days`;
    };

    const features = [
      { 
        text: `Up to ${apiPlan.max_services || 0} service${apiPlan.max_services !== 1 ? 's' : ''}`,
        icon: HeartPulse
      },
      { 
        text: `${apiPlan.max_schedules_per_day || 0} daily schedules`,
        icon: CalendarDays
      },
      { 
        text: `${apiPlan.max_schedules_per_month || 0} monthly schedules`,
        icon: CalendarDays
      },
      ...(apiPlan.can_create_online_service ? [{ 
        text: "Online service creation", 
        icon: Users 
      }] : []),
      ...(apiPlan.can_create_offline_service ? [{ 
        text: "Offline service creation", 
        icon: Users 
      }] : []),
      { 
        text: "Secure messaging", 
        icon: Shield 
      },
      { 
        text: "24/7 availability", 
        icon: Clock 
      },
      { 
        text: "Patient history access", 
        icon: Users 
      }
    ];

    return {
      id: apiPlan.id,
      name: apiPlan.display_name || apiPlan.name || 'Standard Plan',
      price: apiPlan.price || 0,
      formattedPrice: `₹${apiPlan.price || 0}`,
      duration: getDurationDisplay(apiPlan.duration_days),
      duration_days: apiPlan.duration_days || 30,
      icon: config.icon,
      color: config.color,
      features,
      isPopular: config.isPopular,
      cta: config.cta,
      badge: config.badge,
      gradient: config.gradient,
      apiData: apiPlan
    };
  };

  const handlePlanSelect = async (planId) => {
    if (!planId) {
      setError('Invalid plan selected. Please try again.');
      toast.error('Invalid plan selected');
      return;
    }
    try {
      setLoading(true);
      const response = await getSubscriptionPlan(planId);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to retrieve plan details');
      }
      setSelectedPlan(transformPlanData(response.data.data));
      setShowConfirmation(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error selecting plan:', err.response?.data || err.message);
      setError('Failed to load plan details. Please try again or contact support.');
      toast.error('Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };
const handleConfirmPayment = async () => {
  if (!selectedPlan) {
    setError('No plan selected. Please try again.');
    toast.error('No plan selected');
    return;
  }

  try {
    setPaymentLoading(true);
    toast.loading('Initiating payment...', { id: 'payment' });
    
    // Create Razorpay order using activateSubscription API
    const orderResponse = await activateSubscription({ 
      plan_id: selectedPlan.id 
    });
    
    if (!orderResponse.data.success) {
      throw new Error(orderResponse.data.message || 'Failed to create order');
    }

    const orderData = orderResponse.data.data;
    
    // Initialize Razorpay payment
    const options = {
      key: orderData.key, // Using key from backend response
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Your Company Name',
      description: `Payment for ${orderData.plan.name}`,
      order_id: orderData.order_id,
      handler: async function (response) {
        try {
          toast.loading('Verifying payment...', { id: 'payment' });
          
          // Verify payment using your verifyPayment API
          const verificationResponse = await verifyPayment({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (!verificationResponse.data.success) {
            throw new Error(verificationResponse.data.message || 'Payment verification failed');
          }

          toast.success('Payment successful! Your subscription is now active.', { id: 'payment' });
          setShowConfirmation(false);
          
          // Optionally redirect to dashboard or refresh subscription status
          navigate('/doctor/currentSubscription');
          
        } catch (err) {
          console.error('Payment verification error:', err);
          const errorMessage = err.response?.data?.message || err.message || 'Payment processing failed';
          toast.error(`Payment verification failed: ${errorMessage}`, { id: 'payment' });
        } finally {
          setPaymentLoading(false);
        }
      },
      prefill: {
        name: 'Customer Name',
        email: 'customer@example.com',
        contact: '9999999999',
      },
      theme: {
        color: '#3B82F6',
      },
    };

    const rzp = new window.Razorpay(options);
    
    rzp.on('payment.failed', function (response) {
      console.error('Razorpay payment failed:', response.error);
      toast.error(`Payment failed: ${response.error.description || 'Please try again'}`, { id: 'payment' });
      setPaymentLoading(false);
    });
    
    rzp.open();
    
  } catch (err) {
    console.error('Error initiating payment:', err);
    const errorMessage = err.response?.data?.message || err.message || 'Failed to initiate payment';
    toast.error(`Error: ${errorMessage}`, { id: 'payment' });
    setPaymentLoading(false);
  }
};
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <DocHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-16 animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-1/2 mx-auto mb-6"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 h-96 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-6"></div>
                <div className="h-12 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto mb-8"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-4 bg-gray-200 rounded w-full"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <DocHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center max-w-md mx-auto px-4 py-16">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex justify-center gap-4">
              <Button 
                onClick={() => window.location.reload()} 
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3"
              >
                Try Again
              </Button>
              <Button 
                variant="outline"
                className="border-gray-300 hover:bg-gray-50 px-6 py-3"
              >
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Toaster position="top-right" />
      <DocHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence>
          {showConfirmation && selectedPlan && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-12 bg-white rounded-xl shadow-lg p-8 border border-gray-200"
              role="dialog"
              aria-labelledby="confirmation-title"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 id="confirmation-title" className="text-2xl font-bold text-gray-900">Confirm Your Subscription</h2>
                <button 
                  onClick={() => setShowConfirmation(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  disabled={paymentLoading}
                  aria-label="Close confirmation"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="flex items-center mb-4">
                  <div className={`p-2 ${selectedPlan.color} rounded-lg mr-3`}>
                    <selectedPlan.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedPlan.name}</h3>
                    <p className="text-sm text-gray-500">{selectedPlan.duration} Plan</p>
                    {selectedPlan.badge && (
                      <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold mt-1">
                        {selectedPlan.badge}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-gray-900">
                    {selectedPlan.formattedPrice}
                  </span>
                  <span className="text-gray-500">/ {selectedPlan.duration}</span>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">What you'll get:</h4>
                <ul className="space-y-2">
                  {selectedPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-blue-800 font-medium mb-1">Important Information:</p>
                    <ul className="text-blue-700 space-y-1">
                      <li>• Immediate plan activation after payment</li>
                      <li>• Secure payment processing via Razorpay</li>
                      <li>• Instant access to all plan features</li>
                      <li>• Flexible cancellation with no fees</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center mb-6 text-sm text-gray-500">
                <Shield className="w-4 h-4 mr-2" />
                <span>Secured by Razorpay</span>
              </div>

              {paymentLoading && (
                <div className="flex items-center justify-center mb-6 text-blue-600">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span>Processing your request...</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 border-gray-300 hover:bg-gray-100 transition-all duration-200"
                  disabled={paymentLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPayment}
                  className={`flex-1 transition-all duration-200 ${
                    selectedPlan.isPopular 
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Activate & Pay
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mb-16">
          <span className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium mb-4">
            Flexible Pricing
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose the Right Plan for Your Practice
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Select the perfect package that fits your needs and budget.
            <span className="block mt-3 text-blue-600 font-medium flex items-center justify-center">
              <CheckCircle className="w-5 h-5 mr-1" />
              14-day free trial. No credit card required.
            </span>
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button 
              className={`px-6 py-2 rounded-md font-medium ${!showComparison ? 'bg-white shadow-sm' : 'text-gray-500'}`}
              onClick={() => setShowComparison(false)}
            >
              View Plans
            </button>
            <button 
              className={`px-6 py-2 rounded-md font-medium ${showComparison ? 'bg-white shadow-sm' : 'text-gray-500'}`}
              onClick={() => setShowComparison(true)}
            >
              Compare Features
            </button>
          </div>
        </div>

        {showComparison ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 mb-16">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-4 text-left font-medium text-gray-500">Features</th>
                    {plans.map(plan => (
                      <th key={plan.id} className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-gray-900">{plan.name}</span>
                          <span className="text-gray-500">{plan.formattedPrice}/{plan.duration}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">Services</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="px-6 py-4 text-center">
                        {plan.features.find(f => f.text.includes('service'))?.text || '-'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">Daily Schedules</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="px-6 py-4 text-center">
                        {plan.features.find(f => f.text.includes('daily'))?.text.split(' ')[0] || '-'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">Online Services</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="px-6 py-4 text-center">
                        {plan.features.some(f => f.text.includes('Online')) ? '✓' : '✗'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">Offline Services</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="px-6 py-4 text-center">
                        {plan.features.some(f => f.text.includes('Offline')) ? '✓' : '✗'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">Support</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="px-6 py-4 text-center">
                        {plan.features.some(f => f.text.includes('24/7')) ? '24/7' : 'Business hours'}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-6 py-4"></td>
                    {plans.map(plan => (
                      <td key={plan.id} className="px-6 py-4 text-center">
                        <Button
                          onClick={() => handlePlanSelect(plan.id)}
                          className={`w-full ${plan.isPopular ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 'bg-gray-900'}`}
                        >
                          {plan.cta}
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {plans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                {plans.map((plan) => (
                  <div 
                    key={plan.id} 
                    className={`relative transition-all hover:-translate-y-1 ${plan.isPopular ? 'md:-mt-4' : ''}`}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                        Most Popular
                      </div>
                    )}

                    <Card className={`h-full flex flex-col transition-all duration-300 hover:shadow-lg ${plan.isPopular ? 'border-2 border-yellow-400' : 'border-gray-200'}`}>
                      <CardHeader className="pb-0">
                        <div className="flex justify-center mb-4">
                          <div className={`p-3 ${plan.color.split(' ')[0]} ${plan.color.split(' ')[1]} rounded-full`}>
                            <plan.icon className="w-8 h-8" />
                          </div>
                        </div>
                        
                        <CardTitle className="text-center text-2xl font-bold text-gray-900">
                          {plan.name}
                        </CardTitle>
                        
                        <div className="text-center mt-4">
                          <span className="text-4xl font-bold text-gray-900">
                            {plan.formattedPrice}
                          </span>
                          <span className="text-gray-500 ml-2">/ {plan.duration}</span>
                        </div>
                        
                        {plan.badge && (
                          <div className="mt-4 text-center">
                            <span className="inline-block bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                              {plan.badge}
                            </span>
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="py-6 flex-grow">
                        <ul className="space-y-3">
                          {plan.features.slice(0, 5).map((feature, index) => (
                            <li key={index} className="flex items-start">
                              <feature.icon className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                              <span className="text-gray-700">{feature.text}</span>
                            </li>
                          ))}
                          {plan.features.length > 5 && (
                            <li className="text-blue-600 font-medium flex items-center">
                              <Plus className="w-4 h-4 mr-1" />
                              {plan.features.length - 5} more features
                            </li>
                          )}
                        </ul>
                      </CardContent>

                      <CardFooter className="pt-0">
                        <Button
                          onClick={() => handlePlanSelect(plan.id)}
                          className={`w-full py-4 text-lg font-medium transition-all transform hover:scale-[1.02] ${
                            plan.isPopular 
                              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700'
                              : 'bg-gray-900 hover:bg-gray-800'
                          }`}
                        >
                          {plan.cta}
                          {plan.isPopular && <Star className="w-5 h-5 ml-2" />}
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
                <p className="text-gray-600">No subscription plans available at the moment.</p>
              </div>
            )}
          </>
        )}

        <div className="mb-16">
          <h3 className="text-center text-2xl font-bold text-gray-900 mb-8">Trusted by Healthcare Professionals</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: "This platform transformed my practice management. Highly recommend!",
                author: "Dr. Sarah Johnson",
                role: "Cardiologist",
                rating: 5
              },
              {
                quote: "The gold plan gives me everything I need at a reasonable price.",
                author: "Dr. Michael Chen",
                role: "Pediatrician",
                rating: 4
              },
              {
                quote: "Excellent customer support and reliable service.",
                author: "Dr. Priya Patel",
                role: "Dermatologist",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 italic mb-4">"{testimonial.quote}"</p>
                <div className="flex items-center">
                  <div className="bg-blue-100 text-blue-600 rounded-full w-10 h-10 flex items-center justify-center font-bold mr-3">
                    {testimonial.author.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{testimonial.author}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FAQItem 
              question="Can I change plans later?"
              answer="Yes, you can upgrade or downgrade your plan at any time. Changes will take effect at your next billing cycle."
            />
            <FAQItem 
              question="Is there a free trial?"
              answer="Yes, we offer a 14-day free trial with full features. No credit card required to start your trial."
            />
            <FAQItem 
              question="How does billing work?"
              answer="We bill automatically at the start of each billing cycle. You'll receive an email receipt for each payment."
            />
            <FAQItem 
              question="Can I cancel anytime?"
              answer="Absolutely! You can cancel anytime with no cancellation fees. Your subscription will remain active until the end of your current billing period."
            />
          </div>
          <div className="text-center mt-8">
            <Button variant="outline" className="border-gray-300 hover:bg-gray-50">
              View all FAQs
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h3>
          <p className="text-gray-600 max-w-2xl mx-auto mb-6">
            Our team is here to help you choose the right plan for your practice needs.
          </p>
          <div className="flex justify-center gap-4">
            <Button className="bg-blue-600 hover:bg-blue-700 px-6 py-3">
              <Headset className="w-5 h-5 mr-2" />
              Contact Sales
            </Button>
            <Button variant="outline" className="border-gray-300 hover:bg-gray-50 px-6 py-3">
              Live Chat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
