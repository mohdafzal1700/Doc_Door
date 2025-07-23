from doctor.views import (DoctorLoginView,DoctorProfileView,
DoctorEducationView,DoctorCertificationView,LicenseUploadView,
DoctorVerificationStatusView,ServiceView,ScheduleView)
from django.urls import path
from . import views


urlpatterns = [
    path('login/', DoctorLoginView.as_view(), name='doctor_login'),
    path('profile/', DoctorProfileView.as_view(), name='profile-setup'),


    path('education/', DoctorEducationView.as_view(), name='doctor-education'),
    
    
    path('certification/', DoctorCertificationView.as_view(), name='doctor-education'),
    
    
    path('license/', LicenseUploadView.as_view(), name='license-upload'),
    
    
    path('verification-status/', DoctorVerificationStatusView.as_view(), name='doctor-verification-status'),
    path('service/',ServiceView.as_view(),name='doctor-service'),
    path('scheduleView/',ScheduleView.as_view(),name='doctor-scheduleView'),
    path('scheduleView/<int:schedule_id>/', ScheduleView.as_view(), name='doctor-scheduleView-detail'),
    
    path('location/create/', views.DoctorLocationCreateView.as_view(), name='doctor-location-create'),
    path('location/list/', views.DoctorLocationListView.as_view(), name='doctor-location-list'),
    path('location/update/<int:id>/', views.DoctorLocationUpdateView.as_view(), name='doctor-location-update'),
    path('location/update/', views.DoctorLocationUpdateCurrentView.as_view(), name='doctor-location-update-current'),
    path('location/delete/<int:id>/', views.DoctorLocationDeleteView.as_view(), name='doctor-location-delete'),
    path('location/current/', views.DoctorCurrentLocationView.as_view(), name='doctor-current-location'),
    path('appointments/dashboard/', views.DoctorAppointmentDashboardView.as_view(), name='doctor_appointment_dashboard'),
    path('appointments/', views.DoctorAppointmentsListView.as_view(), name='doctor_appointments_list'),
    path('appointments/pending/', views.PendingAppointmentsView.as_view(), name='pending_appointments'),
    path('appointments/today/', views.TodayAppointmentsView.as_view(), name='today_appointments'),
    path('appointments/upcoming/', views.UpcomingAppointmentsView.as_view(), name='upcoming_appointments'),
    path('appointments/<int:appointment_id>/', views.AppointmentDetailView.as_view(), name='appointment_detail'),
    path('appointments/<int:appointment_id>/handle/', views.HandleAppointmentRequestView.as_view(), name='handle_appointment_request'),
    path('appointments/<int:appointment_id>/status/', views.UpdateAppointmentStatusView.as_view(), name='update_appointment_status'),
    path('appointments/<int:appointment_id>/reschedule/', views.RescheduleAppointmentView.as_view(), name='reschedule_appointment'),
    path('subscription-status/', views.SubscriptionStatusView.as_view(), name='subscription-status'),
    path('subscriptions/', views.SubscriptionPlanListView.as_view(), name='subscription-plan-list'),
    path('subscriptions/<int:id>/', views.SubscriptionPlanDetailView.as_view(), name='subscription-plan-detail'),
    path('activate/', views.SubscriptionActivationView.as_view(), name='subscription-activate'),
    path('update/', views.SubscriptionUpdateView.as_view(), name='subscription-update'),
    path('verify-payment/', views.PaymentVerificationView.as_view(), name='payment-verification'),
    path('cancel/', views.SubscriptionCancellationView.as_view(), name='subscription-cancel'),
    path('subscription/invoice/',views.SubscriptionInvoiceView.as_view(), name='current-subscription-invoice'),
    
    # For specific subscription invoice
    path('subscription/<int:subscription_id>/invoice/', views.SubscriptionInvoiceView.as_view(), name='subscription-invoice'),

    path('subscription/history/', views.SubscriptionHistoryView.as_view(), name='subscription-history'),
    path('subscription/current/', views.CurrentSubscriptionView.as_view(), name='current-subscription')


]

