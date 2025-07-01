from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import uuid
from django.utils import timezone
from cloudinary.models import CloudinaryField
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken



class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email required')
        email = self.normalize_email(email)
        
        # Handle name fields properly
        extra_fields.setdefault('is_active', False)
        first_name = extra_fields.pop('first_name', '')
        last_name = extra_fields.pop('last_name', '')
        
        user = self.model(
            email=email, 
            first_name=first_name,
            last_name=last_name,
            **extra_fields
        )
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'admin')  # Set default role for superuser
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password=password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('doctor', 'Doctor'),
        ('patient', 'Patient'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30, null=True, blank=True)
    last_name = models.CharField(max_length=30, null=True, blank=True)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)  # Add default
    reference_id = models.UUIDField(null=True, blank=True)
    phone_number = models.CharField(max_length=15, blank=True)
    is_blocked = models.BooleanField(default=False)
    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'role']  # Fixed: removed 'name', added 'first_name'

    objects = UserManager()

    def __str__(self):
        return f"{self.email} - {self.role}"

    @property
    def name(self):
        """Property to get full name for compatibility"""
        return f"{self.first_name} {self.last_name}".strip()
    
    def check_and_update_verification_status(self):
        """Check if all verification steps are complete and update status"""
        if hasattr(self, 'doctor_profile') and self.role == 'doctor':
            doctor = self.doctor_profile
            all_steps_complete = (
                doctor.is_profile_setup_done and
                doctor.is_education_done and
                doctor.is_certification_done and
                doctor.is_license_done
            )
            
            if all_steps_complete != self.is_fully_verified:
                self.is_fully_verified = all_steps_complete
                self.save(update_fields=['is_fully_verified'])
            
            return all_steps_complete
        return False

    
class Doctor(models.Model):
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]
    
    VERIFICATION_STATUS_CHOICES = [
        ('incomplete', 'Incomplete'),
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    SPECIALIZATION_CHOICES = [
        ('cardiology', 'Cardiology'),
        ('neurology', 'Neurology'),
        ('orthopedics', 'Orthopedics'),
        ('pediatrics', 'Pediatrics'),
        ('dermatology', 'Dermatology'),
        ('psychiatry', 'Psychiatry'),
        ('general_medicine', 'General Medicine'),
        ('gynecology', 'Gynecology'),
        ('surgery', 'Surgery'),
        ('ophthalmology', 'Ophthalmology'),
        ('ent', 'ENT'),
        ('radiology', 'Radiology'),
    ]
    
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField('User', on_delete=models.CASCADE, related_name='doctor_profile', null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    specialization = models.CharField(max_length=100, choices=SPECIALIZATION_CHOICES, null=True, blank=True)
    experience = models.IntegerField(null=True, blank=True)
    # Add alias property for experience_years to maintain compatibility
    @property
    def experience_years(self):
        return self.experience
    
    profile_picture = CloudinaryField('image', blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    date_of_birth = models.DateField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=20, 
        choices=VERIFICATION_STATUS_CHOICES,
        default='incomplete'
    )
    is_profile_setup_done = models.BooleanField(default=False)
    # Add alias property for profile_completed to maintain compatibility
    @property
    def profile_completed(self):
        return self.is_profile_setup_done
    
    is_education_done = models.BooleanField(default=False)
    is_certification_done = models.BooleanField(default=False)
    is_license_done = models.BooleanField(default=False)
    consultation_mode_online = models.BooleanField(default=False)
    consultation_mode_offline = models.BooleanField(default=False)
    clinic_name = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)
    
    # ADD THESE NEW FIELDS that your code is expecting:
    license_number = models.CharField(max_length=50, blank=True, null=True)
    
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2,null=True, blank=True, default=0.00)
    is_available = models.BooleanField(default=True)
    
    
    def check_verification_completion(self):
        """Check if all verification steps are complete and update status"""
        print(f"🔍 Checking verification for Doctor {self.id}")
        print(f"Profile setup: {self.is_profile_setup_done}")
        print(f"Education: {self.is_education_done}")
        print(f"Certification: {self.is_certification_done}")
        print(f"License: {self.is_license_done}")
        print(f"Current status: {self.verification_status}")
        
        if (self.is_profile_setup_done and 
            self.is_education_done and 
            self.is_certification_done and 
            self.is_license_done):
            
            # Only update if currently incomplete
            if self.verification_status == 'incomplete':
                self.verification_status = 'pending_approval'
                self.save(update_fields=['verification_status'])
                print(f"✅ Updated verification status to: {self.verification_status}")
            else:
                print(f"ℹ️ Status already: {self.verification_status}")
        else:
            print("❌ Not all verification steps complete")
        
        return self.verification_status
    
    
    
    def check_profile_completion(self):
        """Check if profile setup is complete"""
        required_fields = [
            'specialization', 'experience', 'clinic_name', 'location', 
            'license_number', 'consultation_fee', 'date_of_birth', 'gender'
        ]
        
        # Check if user has required name fields
        user_complete = bool(self.user.first_name and self.user.last_name)
        
        # Check if doctor has all required fields
        doctor_complete = all(getattr(self, field, None) is not None for field in required_fields)
        
        was_complete = self.is_profile_setup_done
        self.is_profile_setup_done = user_complete and doctor_complete
        
        if was_complete != self.is_profile_setup_done:
            self.save(update_fields=['is_profile_setup_done'])
            print(f"✅ Profile completion updated: {self.is_profile_setup_done}")
        
        # Check overall verification after updating profile status
        self.check_verification_completion()
        
        return self.is_profile_setup_done

    def check_education_completion(self):
        """Check if education step is complete"""
        has_education = self.educations.exists()
        
        if has_education != self.is_education_done:
            self.is_education_done = has_education
            self.save(update_fields=['is_education_done'])
            print(f"✅ Education completion updated: {self.is_education_done}")
            if self.user:
                self.check_verification_completion()
        
        return self.is_education_done

    def check_certification_completion(self):
        """Check if certification step is complete"""
        has_certification = self.certifications.exists()
        
        if has_certification != self.is_certification_done:
            self.is_certification_done = has_certification
            self.save(update_fields=['is_certification_done'])
            print(f"✅ Certification completion updated: {self.is_certification_done}")
            if self.user:
                self.check_verification_completion()
        
        return has_certification

    def check_license_completion(self):
        """Check if license step is complete"""
        has_license = hasattr(self, 'proof') and self.proof is not None
        
        if has_license != self.is_license_done:
            self.is_license_done = has_license
            self.save(update_fields=['is_license_done'])
            print(f"✅ License completion updated: {self.is_license_done}")
            if self.user:
                self.check_verification_completion()
        
        return has_license
    
class Patient(models.Model):
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField('User', on_delete=models.CASCADE, related_name='patient_profile',null=True, blank=True)
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)
    profile_picture = CloudinaryField('image', blank=True, null=True)  # ✅ Cloudinary image field
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    def __str__(self):
        return f"{self.user.email} - Patient"



class EmailOTP(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_otp')
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(default=timezone.now)

    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=1)

    def __str__(self):
        return f"OTP for {self.user.email}"
    
    
class Address(models.Model):
    ADDRESS_TYPE_CHOICES = [
        ('home', 'Home'),
        ('work', 'Work'),
        ('billing', 'Billing'),
        ('shipping', 'Shipping'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name="addresses")
    address_line_1 = models.CharField(max_length=255)
    street = models.CharField(max_length=255, blank=True, null=True)  # changed from address_line_2
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)
    address_type = models.CharField(
        max_length=50,
        choices=ADDRESS_TYPE_CHOICES,
        default='home'
    )
    label = models.CharField(max_length=50, blank=True, null=True)
    is_delete = models.BooleanField(default=False)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.label or self.address_type} address for {self.user.username} (Primary: {self.is_primary})"
    
    
class DoctorEducation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='educations')

    degree_name = models.CharField(max_length=100)
    institution_name = models.CharField(max_length=255)
    year_of_completion = models.PositiveIntegerField()
    degree_certificate_id = models.CharField(
        max_length=100, 
        default='PENDING_UPDATE'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.degree_name} - {self.doctor.id}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update doctor's education completion status
        self.doctor.check_education_completion()

    
class DoctorCertification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='certifications')

    certification_name = models.CharField(max_length=100)
    issued_by = models.CharField(max_length=100)
    year_of_issue = models.PositiveIntegerField()
    certification_certificate_id = models.CharField(
        max_length=100,
        default='PENDING_UPDATE'
    )
    certificate_image = CloudinaryField('image', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.certification_name} - {self.doctor.id}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update doctor's certification completion status
        self.doctor.check_certification_completion()
class DoctorProof(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.OneToOneField(Doctor, on_delete=models.CASCADE, related_name='proof')

    medical_license_number = models.CharField(max_length=100)
    license_doc_id = models.CharField(max_length=100)
    license_proof_image = CloudinaryField('image', blank=True, null=True)
    id_proof=CloudinaryField('image', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Proof - {self.doctor.id}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update doctor's license completion status
        self.doctor.check_license_completion()
        
        
        
        
