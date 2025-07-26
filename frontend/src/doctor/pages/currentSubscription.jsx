"use client"
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useState, useEffect } from "react"
import { Card, CardHeader, CardContent, CardTitle } from "../../components/ui/card"
import Button from "../../components/ui/Button"
import DocHeader from "../../components/ui/DocHeader"
import DoctorSidebar from "../../components/ui/DocSide"
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
import { 
  getCurrentSubscription, 
  cancelSubscription,
  getCurrentSubscriptionInvoice,
  getSubscriptionInvoiceById 
} from "../../endpoints/Doc"

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
      
      // Debug the full response
      console.log('DEBUG: Full API response:', response);
      console.log('DEBUG: Response data:', response.data);

      if (response.data.success && response.data.data.has_subscription) {
        console.log('DEBUG: Subscription data found:', response.data.data.subscription);
        console.log('DEBUG: Subscription ID:', response.data.data.subscription?.id);
        setSubscriptionData(response.data.data.subscription);
      } else {
        console.log('DEBUG: No subscription found or success=false');
        console.log('DEBUG: has_subscription:', response.data.data?.has_subscription);
        setError("No active subscription found");
      }
    } catch (err) {
      console.log('DEBUG: Error in fetchSubscriptionData:', err);
      console.log('DEBUG: Error response:', err.response?.data);
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

  // Professional PDF generation function
  const generateProfessionalPDF = (invoiceData) => {
    const doc = new jsPDF();
    
    // Set up colors
    const primaryColor = [41, 128, 185]; // Blue
    const secondaryColor = [52, 73, 94]; // Dark gray
    const accentColor = [241, 196, 15]; // Gold
    
    // Header Section
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Company/App Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Doc Door', 20, 25);
    
    // Invoice Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE', 160, 25);
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Invoice Details Box
    doc.setFillColor(248, 249, 250);
    doc.rect(140, 50, 65, 35, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(140, 50, 65, 35, 'S');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Number:', 145, 60);
    doc.text('Invoice Date:', 145, 68);
    doc.text('Status:', 145, 76);
    
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceData.invoice_number, 145, 64);
    doc.text(new Date(invoiceData.invoice_date).toLocaleDateString(), 145, 72);
    
    // Status with color
    doc.setFillColor(...accentColor);
    doc.rect(145, 78, 20, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID', 147, 81.5);
    doc.setTextColor(0, 0, 0);
    
    // Customer Details Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('Bill To:', 20, 60);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(invoiceData.customer_details.name, 20, 70);
    doc.text(invoiceData.customer_details.email, 20, 78);
    if (invoiceData.customer_details.phone !== 'N/A') {
      doc.text(`Phone: ${invoiceData.customer_details.phone}`, 20, 86);
    }
    
    // Subscription Details Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('Subscription Details:', 20, 105);
    
    // Create subscription details table
    const subscriptionData = [
      ['Plan Name', invoiceData.subscription_details.plan_name],
      ['Start Date', new Date(invoiceData.subscription_details.start_date).toLocaleDateString()],
      ['End Date', invoiceData.subscription_details.end_date ? new Date(invoiceData.subscription_details.end_date).toLocaleDateString() : 'N/A'],
      ['Duration', `${invoiceData.subscription_details.duration_days} days`]
    ];
    
    autoTable(doc, {
      startY: 110,
      head: [['Description', 'Details']],
      body: subscriptionData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [52, 73, 94]
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      margin: { left: 20, right: 20 }
    });
    
    // Line Items Table
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 160;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('Invoice Items:', 20, finalY);
    
    const lineItems = [
      [
        invoiceData.subscription_details.plan_name + ' Subscription',
        '1',
        `₹${invoiceData.billing_details.base_amount}`,
        `₹${invoiceData.billing_details.base_amount}`
      ]
    ];
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Description', 'Qty', 'Rate', 'Amount']],
      body: lineItems,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [52, 73, 94]
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      margin: { left: 20, right: 20 }
    });
    
    // Billing Summary
    const summaryY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 210;
    const summaryX = 130;
    
    // Summary box
    doc.setFillColor(248, 249, 250);
    doc.rect(summaryX - 5, summaryY, 80, 35, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(summaryX - 5, summaryY, 80, 35, 'S');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Subtotal
    doc.text('Subtotal:', summaryX, summaryY + 8);
    doc.text(`₹${invoiceData.billing_details.base_amount}`, summaryX + 40, summaryY + 8);
    
    // Tax
    doc.text(`Tax (${invoiceData.billing_details.tax_rate}):`, summaryX, summaryY + 16);
    doc.text(`₹${invoiceData.billing_details.tax_amount}`, summaryX + 40, summaryY + 16);
    
    // Total line
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(summaryX, summaryY + 20, summaryX + 70, summaryY + 20);
    
    // Total amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text('Total Amount:', summaryX, summaryY + 28);
    doc.text(`₹${invoiceData.billing_details.total_amount}`, summaryX + 40, summaryY + 28);
    
    // Payment Details Section
    const paymentY = summaryY + 45;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('Payment Information:', 20, paymentY);
    
    const paymentData = [
      ['Payment Method', invoiceData.payment_details.payment_method],
      ['Payment ID', invoiceData.payment_details.razorpay_payment_id || 'N/A'],
      ['Payment Date', invoiceData.payment_details.paid_at ? new Date(invoiceData.payment_details.paid_at).toLocaleDateString() : 'N/A']
    ];
    
    autoTable(doc, {
      startY: paymentY + 5,
      head: [['Field', 'Details']],
      body: paymentData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [52, 73, 94]
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      margin: { left: 20, right: 20 }
    });
    
    // Footer
    const footerY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 280;
    
    // Thank you message
    doc.setFillColor(...accentColor);
    doc.rect(20, footerY, 170, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Thank you for your business!', 105, footerY + 9, { align: 'center' });
    
    // Company info footer
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('This is a computer generated invoice. No signature required.', 105, footerY + 25, { align: 'center' });
    doc.text('For support, contact: support@mediconsultpro.com', 105, footerY + 30, { align: 'center' });
    
    return doc;
  };

  // Updated function to handle professional PDF invoice download
  const handleDownloadInvoice = async () => {
    if (!subscriptionData?.id) {
      alert("No subscription ID found");
      return;
    }

    try {
      setInvoiceLoading(true);
      
      const response = await getSubscriptionInvoiceById(subscriptionData.id);
      
      if (response.data && response.data.success) {
        const invoiceData = response.data.data;
        
        // Generate professional PDF (try autoTable version first, fallback to simple version)
        let pdf;
        try {
          pdf = generateProfessionalPDF(invoiceData);
        } catch (autoTableError) {
          console.warn("autoTable failed, using simple PDF generation:", autoTableError);
          pdf = generateSimpleProfessionalPDF(invoiceData);
        }
        
        // Download the PDF
        pdf.save(`Invoice_${invoiceData.invoice_number}.pdf`);
        
        console.log("Professional PDF invoice downloaded successfully");
        
      } else {
        alert("Failed to download invoice: " + (response.data?.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Download invoice error:", err);
      alert("Error downloading invoice");
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Simple PDF generation without autoTable dependency
  const generateSimpleProfessionalPDF = (invoiceData) => {
    const doc = new jsPDF();
    
    // Set up colors
    const primaryColor = [41, 128, 185]; // Blue
    const secondaryColor = [52, 73, 94]; // Dark gray
    const accentColor = [241, 196, 15]; // Gold
    
    // Header Section
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Company/App Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MediConsult Pro', 20, 25);
    
    // Invoice Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE', 160, 25);
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Invoice Details Box
    doc.setFillColor(248, 249, 250);
    doc.rect(140, 50, 65, 35, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(140, 50, 65, 35, 'S');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Number:', 145, 60);
    doc.text('Invoice Date:', 145, 68);
    doc.text('Status:', 145, 76);
    
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceData.invoice_number, 145, 64);
    doc.text(new Date(invoiceData.invoice_date).toLocaleDateString(), 145, 72);
    
    // Status with color
    doc.setFillColor(...accentColor);
    doc.rect(145, 78, 20, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID', 147, 81.5);
    doc.setTextColor(0, 0, 0);
    
    // Customer Details Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('Bill To:', 20, 60);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(invoiceData.customer_details.name, 20, 70);
    doc.text(invoiceData.customer_details.email, 20, 78);
    if (invoiceData.customer_details.phone !== 'N/A') {
      doc.text(`Phone: ${invoiceData.customer_details.phone}`, 20, 86);
    }
    
    // Subscription Details Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('Subscription Details:', 20, 105);
    
    // Manual table for subscription details
    let yPos = 115;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    const subscriptionDetails = [
      ['Plan Name:', invoiceData.subscription_details.plan_name],
      ['Start Date:', new Date(invoiceData.subscription_details.start_date).toLocaleDateString()],
      ['End Date:', invoiceData.subscription_details.end_date ? new Date(invoiceData.subscription_details.end_date).toLocaleDateString() : 'N/A'],
      ['Duration:', `${invoiceData.subscription_details.duration_days} days`]
    ];
    
    subscriptionDetails.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 25, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, yPos);
      yPos += 8;
    });
    
    // Line Items Section
    yPos += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('Invoice Items:', 20, yPos);
    
    // Line items header
    yPos += 10;
    doc.setFillColor(...primaryColor);
    doc.rect(20, yPos - 5, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 25, yPos);
    doc.text('Qty', 120, yPos);
    doc.text('Rate', 140, yPos);
    doc.text('Amount', 170, yPos);
    
    // Line items data
    yPos += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceData.subscription_details.plan_name + ' Subscription', 25, yPos);
    doc.text('1', 120, yPos);
    doc.text(`₹${invoiceData.billing_details.base_amount}`, 140, yPos);
    doc.text(`₹${invoiceData.billing_details.base_amount}`, 170, yPos);
    
    // Billing Summary
    yPos += 20;
    const summaryX = 130;
    
    // Summary box
    doc.setFillColor(248, 249, 250);
    doc.rect(summaryX - 5, yPos, 65, 35, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(summaryX - 5, yPos, 65, 35, 'S');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    // Subtotal
    doc.text('Subtotal:', summaryX, yPos + 8);
    doc.text(`₹${invoiceData.billing_details.base_amount}`, summaryX + 35, yPos + 8);
    
    // Tax
    doc.text(`Tax (${invoiceData.billing_details.tax_rate}):`, summaryX, yPos + 16);
    doc.text(`₹${invoiceData.billing_details.tax_amount}`, summaryX + 35, yPos + 16);
    
    // Total line
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(summaryX, yPos + 20, summaryX + 55, yPos + 20);
    
    // Total amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text('Total Amount:', summaryX, yPos + 28);
    doc.text(`₹${invoiceData.billing_details.total_amount}`, summaryX + 35, yPos + 28);
    
    // Payment Details Section
    yPos += 50;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('Payment Information:', 20, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    const paymentDetails = [
      ['Payment Method:', invoiceData.payment_details.payment_method],
      ['Payment ID:', invoiceData.payment_details.razorpay_payment_id || 'N/A'],
      ['Payment Date:', invoiceData.payment_details.paid_at ? new Date(invoiceData.payment_details.paid_at).toLocaleDateString() : 'N/A']
    ];
    
    paymentDetails.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 25, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, yPos);
      yPos += 8;
    });
    
    // Footer
    yPos += 15;
    
    // Thank you message
    doc.setFillColor(...accentColor);
    doc.rect(20, yPos, 170, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Thank you for your business!', 105, yPos + 9, { align: 'center' });
    
    // Company info footer
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('This is a computer generated invoice. No signature required.', 105, yPos + 25, { align: 'center' });
    doc.text('For support, contact: support@mediconsultpro.com', 105, yPos + 30, { align: 'center' });
    
    return doc;
  };

  // Alternative function to view invoice details (instead of download)
  const handleViewInvoice = async () => {
    if (!subscriptionData?.id) {
      alert("No subscription ID found");
      return;
    }

    try {
      setInvoiceLoading(true);
      const response = await getSubscriptionInvoiceById(subscriptionData.id);
      
      if (response.data && response.data.success) {
        const invoiceData = response.data.data;
        
        // Create a detailed alert with invoice information
        const invoiceDetails = `
Invoice Details:
================

Invoice Number: ${invoiceData.invoice_number}
Date: ${new Date(invoiceData.invoice_date).toLocaleDateString()}
Status: ${invoiceData.status.toUpperCase()}

Customer: ${invoiceData.customer_details.name}
Email: ${invoiceData.customer_details.email}

Plan: ${invoiceData.subscription_details.plan_name}
Duration: ${invoiceData.subscription_details.duration_days} days

Base Amount: ₹${invoiceData.billing_details.base_amount}
Tax (${invoiceData.billing_details.tax_rate}): ₹${invoiceData.billing_details.tax_amount}
Total Amount: ₹${invoiceData.billing_details.total_amount}

Payment Method: ${invoiceData.payment_details.payment_method}
Payment ID: ${invoiceData.payment_details.razorpay_payment_id || 'N/A'}
        `;
        
        alert(invoiceDetails);
        
      } else {
        alert("Failed to fetch invoice details: " + (response.data?.message || "Unknown error"));
      }
    } catch (err) {
      alert("Error fetching invoice details");
      console.error("View invoice error:", err);
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

  const {
    plan,
    status,
    start_date,
    end_date,
    days_remaining,
    amount_paid,
    usage_stats,
    is_active,
    cancelled_at
  } = subscriptionData;

  return (
    <div>
      <DocHeader/>
      <div className="flex">
        <DoctorSidebar/>
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
                  <Button
                    className="w-full justify-start"
                    onClick={handleChangePlan}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full justify-start bg-transparent"
                >
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
                  Download Invoice PDF
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start bg-transparent"
                  onClick={handleViewInvoice}
                  disabled={invoiceLoading}
                >
                  {invoiceLoading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Receipt className="w-4 h-4 mr-2" />
                  )}
                  View Invoice Details
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
                            {getLimitValue(usage_stats.consultations, plan.max_services) === -1
                              ? ' Unlimited'
                              : ` ${getLimitValue(usage_stats.consultations, plan.max_services)}`}
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
                            {getLimitValue(usage_stats.daily_schedules, plan.max_daily_schedules) === -1
                              ? ' Unlimited'
                              : ` ${getLimitValue(usage_stats.daily_schedules, plan.max_daily_schedules)}`}
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
                            {getLimitValue(usage_stats.monthly_schedules, plan.max_monthly_schedules) === -1
                              ? ' Unlimited'
                              : ` ${getLimitValue(usage_stats.monthly_schedules, plan.max_monthly_schedules)}`}
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
      </div>
    </div>
  )
}