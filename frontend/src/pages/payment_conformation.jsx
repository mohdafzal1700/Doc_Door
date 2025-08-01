import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, Calendar, Clock, MapPin, User, Building, FileText, ArrowLeft, Check, AlertCircle, Loader2, Shield, Info } from 'lucide-react';
import Button from '../components/ui/Button';
import { initiatePayment, verifyPayment, getPaymentStatus } from '../endpoints/APIs';

const PaymentPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(true);

    const { appointmentId, appointmentData } = state || {};

    useEffect(() => {
        if (!appointmentId || !appointmentData) {
            setError('Invalid appointment data. Please book an appointment first.');
            return;
        }
        // Load Razorpay script on component mount
        loadRazorpayScript();
    }, [appointmentId, appointmentData]);

    // Load Razorpay script
    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    // Handle payment initiation
    const handlePayment = async () => {
        try {
            setLoading(true);
            setError(null);

            // Check if Razorpay script is loaded
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                throw new Error('Failed to load Razorpay SDK. Please refresh and try again.');
            }

            // Initiate payment
            const paymentData = {
                amount: appointmentData.totalAmount,
                currency: 'INR'
            };

            console.log('Initiating payment for appointment:', appointmentId);
            const response = await initiatePayment(appointmentId, paymentData);

            if (!response.data || !response.data.success) {
                throw new Error(response.data?.message || response.data?.error || 'Failed to initiate payment');
            }

            const order = response.data.data;
            console.log('Payment order created:', order);

            // Validate required fields from backend
            if (!order.key) {
                throw new Error('Payment configuration missing. Please contact support.');
            }

            if (!order.razorpay_order_id && !order.order_id) {
                throw new Error('Invalid payment order. Please try again.');
            }

            // Configure Razorpay options
            const options = {
                key: order.key, // ✅ Using key from backend response
                amount: order.amount,
                currency: order.currency || 'INR',
                name: appointmentData.clinicName || 'Healthcare Booking',
                description: `Appointment with Dr. ${appointmentData.doctorName}`,
                order_id: order.razorpay_order_id || order.order_id, // Support both field names
                handler: async (response) => {
                    await handlePaymentSuccess(response);
                },
                prefill: {
                    name: appointmentData.patientInfo?.name || 'Patient',
                    email: appointmentData.patientInfo?.email || '',
                    contact: appointmentData.patientInfo?.phone || '',
                },
                theme: {
                    color: '#1E3A8A',
                },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                        setError('Payment was cancelled. You can retry payment anytime from your appointments.');
                    }
                }
            };

            // Open Razorpay checkout
            const rzp = new window.Razorpay(options);
            
            // Handle payment failure
            rzp.on('payment.failed', (response) => {
                console.error('Payment failed:', response.error);
                setError(`Payment failed: ${response.error.description || 'Please try again'}`);
                setLoading(false);
            });

            rzp.open();

        } catch (err) {
            console.error('Error initiating payment:', err);
            setError(err.message || 'Failed to initiate payment. Please try again.');
            setLoading(false);
        }
    };

    // Handle successful payment
    const handlePaymentSuccess = async (response) => {
        try {
            setPaymentProcessing(true);
            console.log('Payment success response:', response);

            // Verify payment with backend
            const verifyResponse = await verifyPayment(appointmentId, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
            });

            console.log('Payment verification response:', verifyResponse);

            if (verifyResponse.data && verifyResponse.data.success) {
                // Payment verified successfully
                console.log('Payment verified successfully');
                
                // Navigate to success page
                setTimeout(() => {
                    navigate('/patient/appointments', {
                        state: {
                            appointmentId,
                            paymentSuccess: true,
                            paymentId: response.razorpay_payment_id,
                            appointmentData,
                            message: 'Payment completed successfully!'
                        }
                    });
                }, 2000);
            } else {
                throw new Error(verifyResponse.data?.message || verifyResponse.data?.error || 'Payment verification failed');
            }
        } catch (err) {
            console.error('Payment verification error:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Payment verification failed';
            setError(`Payment completed but verification failed: ${errorMessage}. Please contact support with payment ID: ${response.razorpay_payment_id}`);
        } finally {
            setPaymentProcessing(false);
            setLoading(false);
        }
    };

    // Format date for display
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Format time for display
    const formatTime = (timeString) => {
        if (!timeString) return 'Time TBD';
        try {
            return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return timeString;
        }
    };

    if (!appointmentId || !appointmentData) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Invalid Request</h3>
                    <p className="text-gray-600 mb-6">{error || 'No appointment data found.'}</p>
                    <Button
                        onClick={() => navigate('/patient/findDoctor')}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Book New Appointment
                    </Button>
                </div>
            </div>
        );
    }

    if (paymentProcessing) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
                    <p className="text-gray-600 mb-4">Verifying payment and confirming your appointment...</p>
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            {/* Header */}
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(-1)}
                            className="mr-4"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                        <h1 className="text-2xl font-bold text-gray-900">Complete Payment</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Appointment Details */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <FileText className="w-5 h-5 mr-2" />
                                Appointment Details
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-start">
                                    <User className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-gray-900">Dr. {appointmentData.doctorName}</p>
                                        <p className="text-sm text-gray-600">{appointmentData.clinicName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                                    <span className="text-gray-900">{formatDate(appointmentData.appointmentDate)}</span>
                                </div>
                                <div className="flex items-center">
                                    <Clock className="w-5 h-5 text-gray-400 mr-3" />
                                    <span className="text-gray-900">{formatTime(appointmentData.slotTime)}</span>
                                </div>
                                <div className="flex items-center">
                                    <MapPin className="w-5 h-5 text-gray-400 mr-3" />
                                    <span className="text-gray-900 capitalize">
                                        {appointmentData.consultationMode} Consultation
                                    </span>
                                </div>
                                {appointmentData.serviceName && (
                                    <div className="flex items-center">
                                        <Building className="w-5 h-5 text-gray-400 mr-3" />
                                        <span className="text-gray-900">{appointmentData.serviceName}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Patient Information */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h3>
                            <div className="space-y-2">
                                <p><span className="font-medium">Name:</span> {appointmentData.patientInfo?.name || 'N/A'}</p>
                                <p><span className="font-medium">Email:</span> {appointmentData.patientInfo?.email || 'N/A'}</p>
                                <p><span className="font-medium">Phone:</span> {appointmentData.patientInfo?.phone || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h3>
                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-gray-600">
                                    <span>Consultation Fee</span>
                                    <span>₹{appointmentData.totalAmount}</span>
                                </div>
                                <div className="border-t pt-3">
                                    <div className="flex justify-between text-lg font-semibold text-gray-900">
                                        <span>Total Amount</span>
                                        <span>₹{appointmentData.totalAmount}</span>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                                    <div className="flex items-start">
                                        <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5" />
                                        <div>
                                            <p className="text-sm text-red-800">{error}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Button
                                onClick={handlePayment}
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-medium flex items-center justify-center"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="h-5 w-5 mr-2" />
                                        Pay ₹{appointmentData.totalAmount}
                                    </>
                                )}
                            </Button>

                            {/* Security Notice */}
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center text-sm text-gray-600">
                                    <Shield className="w-4 h-4 mr-2" />
                                    <span>Secured by Razorpay</span>
                                </div>
                            </div>

                            {/* Payment Info */}
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-start">
                                    <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5" />
                                    <div className="text-sm text-blue-800">
                                        <p className="font-medium mb-1">Payment Information</p>
                                        <p>Your appointment is confirmed. Complete payment to activate all features.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentPage;