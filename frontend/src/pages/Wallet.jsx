import { CreditCard, Wallet, ArrowUpRight, ArrowDownLeft, Clock, Plus } from 'lucide-react';
import Header from '../components/home/Header';
import PatientSidebar from '../components/ui/PatientSidebar';

export default function WalletPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <PatientSidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />
        
        {/* Wallet Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Wallet Header */}
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">My Wallet</h1>
          </div>

          {/* Balance Card */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 shadow-lg mb-8">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 font-medium mb-1">Available Balance</p>
                <h2 className="text-3xl font-bold text-white">$0.00</h2>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <button className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors">
              <div className="bg-blue-100 p-3 rounded-full mb-2">
                <ArrowUpRight className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Send Money</span>
            </button>
            <button className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors">
              <div className="bg-green-100 p-3 rounded-full mb-2">
                <ArrowDownLeft className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Receive Money</span>
            </button>
            <button className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors">
              <div className="bg-purple-100 p-3 rounded-full mb-2">
                <Plus className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Add Funds</span>
            </button>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                Transaction History
              </h3>
              <span className="text-sm text-gray-500">0 transactions</span>
            </div>

            {/* Empty State */}
            <div className="p-8 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Wallet className="w-10 h-10 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-700 mb-2">No transactions yet</h4>
              <p className="text-gray-500 max-w-md mx-auto mb-4">
                All your financial transactions will be displayed here once you start using your wallet.
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">
                <Plus className="w-4 h-4" />
                Make Your First Transaction
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}