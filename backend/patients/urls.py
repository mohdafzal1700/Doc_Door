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
    UserProfileView
    
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
    
]
