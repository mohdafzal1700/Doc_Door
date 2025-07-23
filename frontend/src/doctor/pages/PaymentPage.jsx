import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { activateSubscription, verifyPayment } from '../../endpoints/Doc';
import { Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import DocHeader from '../../components/ui/DocHeader';

const PaymentPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const selectedPlan = state?.selectedPlan;

  useEffect(() => {
    if (!selectedPlan) {
      setError('No plan selected. Please go back and select a plan.');
      return;
    }

    const loadRazorpay = () => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
      return script;
    };

    const initiatePayment = async () => {
      setLoading(true);
      try {
        const response = await activateSubscription({
          plan_id: selectedPlan.id,
        });

        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to initiate payment');
        }

        const order = response.data.data;

        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: 'INR',
          name: 'Your Company Name',
          description: `Subscription for ${selectedPlan.name}`,
          order_id: order.order_id,
          handler: async (response) => {
            try {
              const verifyResponse = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              if (verifyResponse.data.success) {
                navigate('/payment-success', { state: { selectedPlan, paymentDetails: response } });
              } else {
                throw new Error(verifyResponse.data.error || 'Payment verification failed');
              }
            } catch (err) {
              console.error('Payment verification error:', err);
              setError('Payment verification failed. Please contact support.');
              navigate('/payment-failure', { state: { error: err.message } });
            }
          },
          prefill: {
            name: 'Customer Name',
            email: 'customer@example.com',
            contact: '9999999999',
          },
          theme: {
            color: '#1E3A8A',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();

        rzp.on('payment.failed', (response) => {
          console.error('Payment failed:', response.error);
          setError('Payment failed. Please try again.');
          navigate('/payment-failure', { state: { error: response.error.description } });
        });
      } catch (err) {
        console.error('Error initiating payment:', err);
        setError('Failed to initiate payment. Please try again or contact support.');
      } finally {
        setLoading(false);
      }
    };

    const script = loadRazorpay();
    script.onload = initiatePayment;

    return () => {
      document.body.removeChild(script);
    };
  }, [selectedPlan, navigate]);

  if (!selectedPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <DocHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-4">No Plan Selected</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button
            onClick={() => navigate('/choose-plan')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3"
          >
            Go Back to Plans
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <DocHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Initiating payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <DocHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Payment Error</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => navigate('/choose-plan')}
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
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <DocHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Processing Payment</h3>
        <p className="text-gray-600">Please complete the payment in the Razorpay checkout window.</p>
      </div>
    </div>
  );
};

export default PaymentPage;