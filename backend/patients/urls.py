from django.urls import path
from .views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    RegisterUserView,
    EmailOTPVerifyView,
    ResendOTPView,
    ForgotPasswordView,
    VerifyForgotPasswordOTPView,
    ResetPasswordView,
    CustomLogoutView,
    ProfilePictureView,
    AddressManagementView,
    UserProfileView,
    PatientDoctorView,
    MedicalRecordManagementView,
    AppointmentManagementView,
    AppointmentDetailView,
    DoctorSchedulesView,
    
    DoctorBookingDetailView,
    PaymentView,
    
    UpdatePatientLocationView,
    # AppointmentLocationDetailView,
    UpdatePatientLocationView,
    
    CurrentPatientLocationView,
    SearchNearbyDoctorsView,
    # AppointmentLocationDetailView,
    
    )

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', CustomLogoutView.as_view(), name='logout'),

    path('register/', RegisterUserView.as_view(), name='register'),
    path('verify-email/', EmailOTPVerifyView.as_view(), name='verify_email'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend_otp'),

    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('verify-forgot-password-otp/', VerifyForgotPasswordOTPView.as_view(), name='verify_forgot_password_otp'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset_password'),
    
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/picture/', ProfilePictureView.as_view(), name='profile-picture'),
    
    path('addresses/', AddressManagementView.as_view(), name='addresses-list'),
    path('addresses/create/', AddressManagementView.as_view(), name='addresses-create'),
    path('addresses/<uuid:address_id>/', AddressManagementView.as_view(), name='addresses-detail'),
    
    path('patientDoctor/', PatientDoctorView.as_view(), name='patient_doctor_list'),
    path('patientDoctor/<uuid:pk>/', PatientDoctorView.as_view(), name='patient_doctor_detail'),
    
    path('medical_records/', MedicalRecordManagementView.as_view(), name='medical_records'),
    
    path('appointments/', AppointmentManagementView.as_view(), name='appointment-management'),
    path('appointments/<uuid:appointment_id>/', AppointmentDetailView.as_view(), name='appointment-detail-uuid'),
    path('appointments/<int:appointment_id>/', AppointmentDetailView.as_view(), name='appointment-detail-int'),
    

    path('booking/doctor/<uuid:pk>/', DoctorBookingDetailView.as_view(), name='doctor-booking-detail'),
    path('booking/doctor/<uuid:doctor_id>/schedules/', DoctorSchedulesView.as_view(), name='doctor-schedules'),
    # path('appointments/<int:pk>/location/', AppointmentLocationDetailView.as_view(), name='appointment-location-detail'),
    
    path('patients/location/update/', UpdatePatientLocationView.as_view(), name='patient-location-update'),
    
    path('patients/location/current/', CurrentPatientLocationView.as_view(), name='patient-location-current'),


    path('search/nearby-doctors/', SearchNearbyDoctorsView.as_view(), name='search-nearby-doctors'),
    

]

    

