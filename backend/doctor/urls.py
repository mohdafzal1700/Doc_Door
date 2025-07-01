from doctor.views import DoctorLoginView,DoctorProfileView,DoctorEducationView,DoctorCertificationView,LicenseUploadView,DoctorVerificationStatusView
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
]



