"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardContent, CardTitle } from "../../components/ui/card"
import Button from "../../components/ui/Button"
import {
  Settings,
  ArrowRight,
  CreditCard,
  Receipt,
  XCircle,
  CheckCircle,
  CalendarDays,
  RefreshCw,
  Crown,
  AlertTriangle,
  Download,
} from "lucide-react"
import { useNavigate } from "react-router-dom";
import { getCurrentSubscription, getCurrentSubscriptionInvoice, cancelSubscription } from "../../endpoints/Doc" 

export default function CurrentSubscription({ onShowChangePlan }) {
    const navigate = useNavigate();
    const [subscriptionData, setSubscriptionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [invoiceLoading, setInvoiceLoading] = useState(false);

    // Fetch subscription data on component mount
    useEffect(() => {
        fetchSubscriptionData();
    }, []);

    const fetchSubscriptionData = async () => {
        try {
            setLoading(true);
            const response = await getCurrentSubscription();
            if (response.data.success && response.data.data.has_subscription) {
                setSubscriptionData(response.data.data.subscription);
            } else {
                setError("No active subscription found");
            }
        } catch (err) {
            setError("Failed to fetch subscription details");
            console.error("Error fetching subscription:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePlan = () => {
        navigate('/doctor/choosePlan');
    };

    const handleCancelSubscription = async () => {
        if (!window.confirm("Are you sure you want to cancel your subscription? This action cannot be undone.")) {
            return;
        }

        try {
            setCancelLoading(true);
            const response = await cancelSubscription({
                subscription_id: subscriptionData?.id
            });
            
            if (response.data.success) {
                alert("Subscription cancelled successfully");
                fetchSubscriptionData(); // Refresh the data
            } else {
                alert(response.data.message || "Failed to cancel subscription");
            }
        } catch (err) {
            alert("Error cancelling subscription");
            console.error("Cancel subscription error:", err);
        } finally {
            setCancelLoading(false);
        }
    };

    const handleDownloadInvoice = async () => {
    try {
        setInvoiceLoading(true);
        
        // Make API call with proper configuration for binary data
        const response = await getCurrentSubscriptionInvoice({
            format: 'pdf'
        }, {
            // Ensure the API client handles binary data correctly
            responseType: 'blob',
            headers: {
                'Accept': 'application/pdf'
            }
        });
        
        // Check if response is successful
        if (!response || response.status !== 200) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        
        // Get the blob data
        let pdfBlob;
        if (response.data instanceof Blob) {
            pdfBlob = response.data;
        } else {
            // If it's not a blob, create one
            pdfBlob = new Blob([response.data], { type: 'application/pdf' });
        }
        
        // Check blob size
        if (pdfBlob.size === 0) {
            throw new Error('Received empty PDF file');
        }
        
        // Log for debugging
        console.log('PDF blob size:', pdfBlob.size);
        console.log('PDF blob type:', pdfBlob.type);
        
        // Create object URL and download
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `invoice-${subscriptionData.id}-${new Date().toISOString().split('T')[0]}.pdf`;
        downloadLink.style.display = 'none';
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Clean up
        setTimeout(() => {
            if (document.body.contains(downloadLink)) {
                document.body.removeChild(downloadLink);
            }
            URL.revokeObjectURL(pdfUrl);
        }, 100);
        
        alert("Invoice downloaded successfully!");
        
    } catch (err) {
        console.error("Invoice download error:", err);
        
        // Detailed error handling
        let errorMessage = "Failed to download invoice";
        if (err.message.includes('empty PDF')) {
            errorMessage = "Generated PDF is empty. Please contact support.";
        } else if (err.message.includes('status: 404')) {
            errorMessage = "Invoice not found. Please ensure you have an active subscription.";
        } else if (err.message.includes('status: 403')) {
            errorMessage = "You don't have permission to download this invoice.";
        } else if (err.message.includes('status: 500')) {
            errorMessage = "Server error while generating invoice. Please try again later.";
        }
        
        alert(errorMessage);
    } finally {
        setInvoiceLoading(false);
    }
};
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };

    const getPlanIcon = (planName) => {
        switch (planName?.toLowerCase()) {
            case 'gold':
                return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
            case 'silver':
                return <Crown className="w-5 h-5 text-gray-400 fill-gray-400" />;
            case 'bronze':
                return <Crown className="w-5 h-5 text-orange-500 fill-orange-500" />;
            default:
                return <Crown className="w-5 h-5 text-blue-500 fill-blue-500" />;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'cancelled':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'expired':
                return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            default:
                return <RefreshCw className="w-4 h-4 text-blue-500" />;
        }
    };

    // Helper function to safely extract usage values
    const getUsageValue = (usageItem) => {
        if (typeof usageItem === 'number') {
            return usageItem;
        }
        if (typeof usageItem === 'object' && usageItem !== null) {
            return usageItem.used || usageItem.current || 0;
        }
        return 0;
    };

    // Helper function to safely extract limit values
    const getLimitValue = (usageItem, planLimit) => {
        if (typeof usageItem === 'object' && usageItem !== null && usageItem.limit !== undefined) {
            return usageItem.limit;
        }
        return planLimit;
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
            </div>
        );
    }

    if (error || !subscriptionData) {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <Card className="max-w-md w-full">
                        <CardContent className="text-center p-6">
                            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                            <p className="text-muted-foreground mb-4">{error}</p>
                            <Button onClick={() => navigate('/doctor/choosePlan')}>
                                Choose a Plan
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const { plan, status, start_date, end_date, days_remaining, amount_paid, usage_stats, is_active, cancelled_at } = subscriptionData;

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Current Subscription</h1>
                    <p className="text-muted-foreground">Manage your subscription plan and billing</p>
                </div>
                <Button variant="outline" onClick={handleChangePlan}>
                    <Settings className="w-4 h-4 mr-2" />
                    Change Plan
                </Button>
            </div>

            {/* Alert for cancelled/expired subscriptions */}
            {!is_active && (
                <Card className="mb-6 border-orange-200 bg-orange-50">
                    <CardContent className="flex items-center gap-3 p-4">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <div>
                            <p className="font-medium text-orange-800">
                                {status === 'cancelled' ? 'Subscription Cancelled' : 'Subscription Inactive'}
                            </p>
                            <p className="text-sm text-orange-600">
                                {cancelled_at ? `Cancelled on ${formatDate(cancelled_at)}` : 'Your subscription is not active'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Current Subscription Card */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            {getPlanIcon(plan.name)}
                            {plan.display_name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {getStatusBadge(status)}
                            <span className="text-sm capitalize">{status}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold">₹{plan.price}</span>
                            <span className="text-muted-foreground">/{plan.duration_days} days</span>
                        </div>
                        {is_active && days_remaining > 0 && (
                            <p className="text-sm text-green-600 font-medium">
                                {days_remaining} days remaining
                            </p>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <div className="font-medium">Started</div>
                                    <div className="text-muted-foreground">{formatDate(start_date)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <div className="font-medium">Expires</div>
                                    <div className="text-muted-foreground">
                                        {end_date ? formatDate(end_date) : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {is_active && (
                            <Button className="w-full justify-start" onClick={handleChangePlan}>
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Upgrade Plan
                            </Button>
                        )}
                        <Button variant="outline" className="w-full justify-start bg-transparent">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Update Payment
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full justify-start bg-transparent"
                            onClick={handleDownloadInvoice}
                            disabled={invoiceLoading}
                        >
                            {invoiceLoading ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            Download Invoice
                        </Button>
                        {is_active && (
                            <Button 
                                variant="destructive" 
                                className="w-full justify-start"
                                onClick={handleCancelSubscription}
                                disabled={cancelLoading}
                            >
                                {cancelLoading ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <XCircle className="w-4 h-4 mr-2" />
                                )}
                                Cancel Subscription
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Plan Features Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Plan Features</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {plan.max_services === -1 ? 'Unlimited services' : `${plan.max_services} services`}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {plan.max_daily_schedules === -1 ? 'Unlimited daily schedules' : `${plan.max_daily_schedules} daily schedules`}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {plan.max_monthly_schedules === -1 ? 'Unlimited monthly schedules' : `${plan.max_monthly_schedules} monthly schedules`}
                        </div>
                        {plan.can_create_online_services && (
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Online consultation services
                            </div>
                        )}
                        {plan.can_create_offline_services && (
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Offline consultation services
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Secure messaging system
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Patient history access
                        </div>
                    </CardContent>
                </Card>

                {/* Usage Statistics Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Usage Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {usage_stats ? (
                            <>
                                {usage_stats.consultations !== undefined && (
                                    <div className="grid gap-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Consultations</span>
                                            <span>
                                                {getUsageValue(usage_stats.consultations)} / 
                                                {getLimitValue(usage_stats.consultations, plan.max_services) === -1 ? ' Unlimited' : ` ${getLimitValue(usage_stats.consultations, plan.max_services)}`}
                                            </span>
                                        </div>
                                        {getLimitValue(usage_stats.consultations, plan.max_services) === -1 && (
                                            <div className="flex items-center gap-2 text-sm text-green-600">
                                                <CheckCircle className="w-4 h-4" />
                                                Unlimited
                                            </div>
                                        )}
                                    </div>
                                )}
                                {usage_stats.daily_schedules !== undefined && (
                                    <div className="grid gap-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Daily Schedules</span>
                                            <span>
                                                {getUsageValue(usage_stats.daily_schedules)} / 
                                                {getLimitValue(usage_stats.daily_schedules, plan.max_daily_schedules) === -1 ? ' Unlimited' : ` ${getLimitValue(usage_stats.daily_schedules, plan.max_daily_schedules)}`}
                                            </span>
                                        </div>
                                        {getLimitValue(usage_stats.daily_schedules, plan.max_daily_schedules) === -1 && (
                                            <div className="flex items-center gap-2 text-sm text-green-600">
                                                <CheckCircle className="w-4 h-4" />
                                                Unlimited
                                            </div>
                                        )}
                                    </div>
                                )}
                                {usage_stats.monthly_schedules !== undefined && (
                                    <div className="grid gap-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Monthly Schedules</span>
                                            <span>
                                                {getUsageValue(usage_stats.monthly_schedules)} / 
                                                {getLimitValue(usage_stats.monthly_schedules, plan.max_monthly_schedules) === -1 ? ' Unlimited' : ` ${getLimitValue(usage_stats.monthly_schedules, plan.max_monthly_schedules)}`}
                                            </span>
                                        </div>
                                        {getLimitValue(usage_stats.monthly_schedules, plan.max_monthly_schedules) === -1 && (
                                            <div className="flex items-center gap-2 text-sm text-green-600">
                                                <CheckCircle className="w-4 h-4" />
                                                Unlimited
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                Usage statistics not available
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}