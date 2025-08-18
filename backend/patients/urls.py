from django.urls import path
from .views import (
    # Auth & User
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    CustomLogoutView,
    RegisterUserView,
    EmailOTPVerifyView,
    ResendOTPView,
    ForgotPasswordView,
    VerifyForgotPasswordOTPView,
    ResetPasswordView,
    UserProfileView,
    ProfilePictureView,
    AddressManagementView,
    GoogleLoginView,

    # Doctor & Patient
    PatientDoctorView,

    # Medical Records & Appointments
    MedicalRecordManagementView,
    AppointmentManagementView,
    AppointmentDetailView,

    # Booking & Schedules
    DoctorBookingDetailView,
    DoctorSchedulesView,

    # Location & Nearby Search
    UpdatePatientLocationView,
    CurrentPatientLocationView,
    SearchNearbyDoctorsView,

    # Payments
    PaymentInitiationView,
    PaymentVerificationView,
    PaymentStatusView,
    
    PatientReviewCreateView,
    PatientReviewDeleteView,
    DoctorReviewsListView,
    
    Wallet,
    Transaction
)

urlpatterns = [
    # Authentication
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('google/', GoogleLoginView.as_view(), name='google_login'),
    path('logout/', CustomLogoutView.as_view(), name='logout'),

    # Registration & OTP
    path('register/', RegisterUserView.as_view(), name='register'),
    path('verify-email/', EmailOTPVerifyView.as_view(), name='verify_email'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend_otp'),

    # Password Reset
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('verify-forgot-password-otp/', VerifyForgotPasswordOTPView.as_view(), name='verify_forgot_password_otp'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset_password'),

    # Profile
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/picture/', ProfilePictureView.as_view(), name='profile-picture'),

    # Address Management
    path('addresses/', AddressManagementView.as_view(), name='addresses-list'),
    path('addresses/create/', AddressManagementView.as_view(), name='addresses-create'),
    path('addresses/<uuid:address_id>/', AddressManagementView.as_view(), name='addresses-detail'),

    # Patient-Doctor Relationship
    path('patientDoctor/', PatientDoctorView.as_view(), name='patient_doctor_list'),
    path('patientDoctor/<uuid:pk>/', PatientDoctorView.as_view(), name='patient_doctor_detail'),

    # Medical Records
    path('medical_records/', MedicalRecordManagementView.as_view(), name='medical_records'),

    # Appointments
    path('appointments/', AppointmentManagementView.as_view(), name='appointment-management'),
    path('appointments/<uuid:appointment_id>/', AppointmentDetailView.as_view(), name='appointment-detail-uuid'),
    path('appointments/<int:appointment_id>/', AppointmentDetailView.as_view(), name='appointment-detail-int'),

    # Booking & Doctor Schedules
    path('booking/doctor/<uuid:pk>/', DoctorBookingDetailView.as_view(), name='doctor-booking-detail'),
    path('booking/doctor/<uuid:doctor_id>/schedules/', DoctorSchedulesView.as_view(), name='doctor-schedules'),

    # Patient Location
    path('patients/location/update/', UpdatePatientLocationView.as_view(), name='patient-location-update'),
    path('patients/location/current/', CurrentPatientLocationView.as_view(), name='patient-location-current'),

    # Search
    path('search/nearby-doctors/', SearchNearbyDoctorsView.as_view(), name='search-nearby-doctors'),

    # Payments
    path('appointments/<int:appointment_id>/payment/initiate/', PaymentInitiationView.as_view(), name='payment-initiate'),
    path('appointments/<int:appointment_id>/payment/verify/', PaymentVerificationView.as_view(), name='payment-verify'),
    path('appointments/<int:appointment_id>/payment/status/', PaymentStatusView.as_view(), name='payment-status'),
    path('reviews/doctor/<uuid:doctor_id>/', DoctorReviewsListView.as_view(), name='doctor-reviews-list'),
    path('reviews/create/', PatientReviewCreateView.as_view(), name='patient-review-create'),
    path('reviews/delete/<int:pk>/', PatientReviewDeleteView.as_view(), name='patient-review-delete'),
    
    path('wallet/', Wallet.as_view(), name='wallet'),
    path('transaction/', Transaction.as_view(), name='patient-transaction'),
]
