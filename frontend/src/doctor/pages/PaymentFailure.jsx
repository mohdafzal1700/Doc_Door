import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import DocHeader from '../../components/ui/DocHeader';

const PaymentFailure = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const error = state?.error;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <DocHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Payment Failed</h3>
        <p className="text-gray-600 mb-6">{error || 'Something went wrong during payment. Please try again.'}</p>
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
};

export default PaymentFailure;