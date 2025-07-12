from doctor.views import (DoctorLoginView,DoctorProfileView,
DoctorEducationView,DoctorCertificationView,LicenseUploadView,
DoctorVerificationStatusView,ServiceView,ScheduleView)
from django.urls import path
from . import views


urlpatterns = [
    path('login/', DoctorLoginView.as_view(), name='doctor_login'),
    path('profile/', DoctorProfileView.as_view(), name='profile-setup'),

    # Step 2: Education
    path('education/', DoctorEducationView.as_view(), name='doctor-education'),
    
    # Step 3: Certification
    path('certification/', DoctorCertificationView.as_view(), name='doctor-education'),
    
    # Step 4: License Upload
    path('license/', LicenseUploadView.as_view(), name='license-upload'),
    
    # Verification Status
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
    
    path('appointments/', views.DoctorAppointmentsView.as_view(), name='doctor_appointments'),
    
    
    path('appointments/requests/', views.PendingAppointmentRequestsView.as_view(), name='pending_appointment_requests'),
    

    path('appointments/today/', views.DoctorTodayAppointmentsView.as_view(), name='doctor_today_appointments'),
    
    
    path('appointments/upcoming/', views.DoctorUpcomingAppointmentsView.as_view(), name='doctor_upcoming_appointments'),
    
    path('appointments/<int:appointment_id>/', views.DoctorAppointmentDetailView.as_view(), name='doctor_appointment_detail'),
    
   
    path('appointments/<int:appointment_id>/action/', views.AppointmentRequestActionView.as_view(), name='appointment_request_action'),
    
    
    path('appointments/bulk-action/', views.BulkAppointmentRequestActionView.as_view(), name='bulk_appointment_action'),
    
    
    path('appointments/<int:appointment_id>/status/', views.UpdateAppointmentStatusView.as_view(), name='update_appointment_status'),
    
    
    path('appointments/<int:appointment_id>/reschedule/', views.RescheduleAppointmentView.as_view(), name='reschedule_appointment'),
]




