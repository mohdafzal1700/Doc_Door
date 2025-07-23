import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import DocHeader from '../../components/ui/DocHeader';

const PaymentSuccess = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const selectedPlan = state?.selectedPlan;
  const subscriptionId = state?.subscriptionId; // Assuming this is passed after successful payment

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <DocHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Payment Successful!</h3>
        <p className="text-gray-600 mb-6">
          Your {selectedPlan?.name} plan has been activated successfully.
        </p>
        <div className="flex justify-center gap-4">
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3"
          >
            Go to Dashboard
          </Button>
          <Button
            onClick={() => navigate('/subscription-management', { 
              state: { 
                currentPlan: selectedPlan,
                subscriptionId 
              } 
            })}
            variant="outline"
            className="border-gray-300 hover:bg-gray-50 px-6 py-3"
          >
            Manage Subscription
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;