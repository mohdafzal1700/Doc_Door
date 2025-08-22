import React, { useState, useEffect } from 'react';
import { CreditCard, Wallet, ArrowUpRight, ArrowDownLeft, Clock, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import Header from '../components/home/Header';
import PatientSidebar from '../components/ui/PatientSidebar';
import { getWallet,getAllTransactions  } from '../endpoints/APIs';

export default function WalletPage() {
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWalletData = async () => {
    try {
      const walletResponse = await getWallet();
      setWalletData(walletResponse.data.data);
    } catch (err) {
      console.error('Error fetching wallet:', err);
      setError('Failed to load wallet data');
    }
  };

  const fetchTransactions = async () => {
    try {
      const transactionResponse = await getAllTransactions();
      setTransactions(transactionResponse.data.data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchWalletData(), fetchTransactions()]);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getTransactionIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'credit':
      case 'deposit':
      case 'received':
        return <ArrowDownLeft className="w-5 h-5 text-green-600" />;
      case 'debit':
      case 'withdrawal':
      case 'sent':
        return <ArrowUpRight className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'credit':
      case 'deposit':
      case 'received':
        return 'text-green-600';
      case 'debit':
      case 'withdrawal':
      case 'sent':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <PatientSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading wallet...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 ">
      
      <Header />
      
      
        <div className="flex ">
          {/* Sidebar */}
          <PatientSidebar />

        {/* Wallet Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
              <button
                onClick={handleRefresh}
                className="text-red-600 hover:text-red-800 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Wallet Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-800">My Wallet</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Balance Card */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 shadow-lg mb-8">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 font-medium mb-1">Available Balance</p>
                <h2 className="text-3xl font-bold text-white">
                  {formatAmount(walletData?.balance)}
                </h2>
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
              <span className="text-sm text-gray-500">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Transaction List or Empty State */}
            {transactions.length === 0 ? (
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
            ) : (
              <div className="divide-y divide-gray-100">
                {transactions.map((transaction, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-full">
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {transaction.remark || `${transaction.type} Transaction`}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {transaction.type}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                          {transaction.type?.toLowerCase() === 'debit' || 
                           transaction.type?.toLowerCase() === 'withdrawal' || 
                           transaction.type?.toLowerCase() === 'sent' ? '-' : '+'}
                          {formatAmount(transaction.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}