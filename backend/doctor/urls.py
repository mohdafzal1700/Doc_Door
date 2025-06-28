from doctor.views import DoctorLoginView,DoctorProfileView,DoctorEducationView,DoctorCertificationView
from django.urls import path
from . import views


urlpatterns = [
    path('login/', DoctorLoginView.as_view(), name='doctor_login'),
    path('profile/', DoctorProfileView.as_view(), name='profile-setup'),

    # Step 2: Education
    path('education/', DoctorEducationView.as_view(), name='doctor-education'),
    
    # Step 3: Certification
    path('certification/', DoctorEducationView.as_view(), name='doctor-education'),
    
    # Step 4: License Upload
    path('verification/license-upload/', views.LicenseUploadView.as_view(), name='license-upload'),
    
    # Verification Status
    path('verification/status/', views.verification_status_view, name='verification-status')
]


# management/commands/update_verification_status.py
# Run this command after migration to update existing records
# from django.core.management.base import BaseCommand
# from myapp.models import Doctor

# class Command(BaseCommand):
#     help = 'Update verification status for existing doctors'

#     def handle(self, *args, **options):
#         doctors = Doctor.objects.all()
#         updated_count = 0
        
#         for doctor in doctors:
#             # Check each step
#             doctor.check_profile_completion()
#             doctor.check_education_completion()
#             doctor.check_certification_completion()
#             doctor.check_license_completion()
#             updated_count += 1
            
#         self.stdout.write(
#             self.style.SUCCESS(
#                 f'Successfully updated verification status for {updated_count} doctors'
#             )
#         )