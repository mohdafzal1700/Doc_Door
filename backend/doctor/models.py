from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import uuid
from django.utils import timezone
from cloudinary.models import CloudinaryField
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from django.core.exceptions import ValidationError
from math import radians, cos, sin, asin, sqrt


import logging

logger = logging.getLogger(__name__)

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
    
    def get_full_name(self):
        """Return the full name for the user."""
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name if full_name else self.username or self.email
    
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # ADD THESE NEW FIELDS that your code is expecting:
    license_number = models.CharField(max_length=50, blank=True, null=True)
    admin_comment = models.TextField(blank=True, null=True)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2,null=True, blank=True, default=0.00)
    is_available = models.BooleanField(default=True)
    
    
    def check_verification_completion(self):
        """Check if all verification steps are complete and update status"""
        logger.debug(f"Checking verification for Doctor {self.id}")
        logger.debug(f"Profile setup: {self.is_profile_setup_done}")
        logger.debug(f"Education: {self.is_education_done}")
        logger.debug(f"Certification: {self.is_certification_done}")
        logger.debug(f"License: {self.is_license_done}")
        logger.debug(f"Current status: {self.verification_status}")
        
        if (self.is_profile_setup_done and 
            self.is_education_done and 
            self.is_certification_done and 
            self.is_license_done):
            
            # Only update if currently incomplete
            if self.verification_status == 'incomplete':
                self.verification_status = 'pending_approval'
                self.save(update_fields=['verification_status'])
                logger.info(f"Doctor {self.id} verification status updated to: {self.verification_status}")
            else:
                logger.debug(f"Doctor {self.id} status already: {self.verification_status}")
        else:
            logger.debug(f"Doctor {self.id} - Not all verification steps complete")
        
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
            print(f" Profile completion updated: {self.is_profile_setup_done}")
        
        # Check overall verification after updating profile status
        self.check_verification_completion()
        
        return self.is_profile_setup_done

    def check_education_completion(self):
        """Check if education step is complete"""
        has_education = self.educations.exists()
        
        if has_education != self.is_education_done:
            self.is_education_done = has_education
            self.save(update_fields=['is_education_done'])
            logger.info(f"Education completion updated for doctor {self.id}: {self.is_education_done}")
            if self.user:
                self.check_verification_completion()
        
        return self.is_education_done

    def check_certification_completion(self):
        """Check if certification step is complete"""
        has_certification = self.certifications.exists()
        
        if has_certification != self.is_certification_done:
            self.is_certification_done = has_certification
            self.save(update_fields=['is_certification_done'])
            logger.info(f" Certification completion updated: {self.is_certification_done}")
            if self.user:
                self.check_verification_completion()
        
        return has_certification

    def check_license_completion(self):
        """Check if license step is complete"""
        has_license = hasattr(self, 'proof') and self.proof is not None
        
        if has_license != self.is_license_done:
            self.is_license_done = has_license
            self.save(update_fields=['is_license_done'])
            logger.info(f" License completion updated: {self.is_license_done}")
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
    profile_picture = CloudinaryField('image', blank=True, null=True)  # Cloudinary image field
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.email} - Patient"
    
    def name(self):
        """Return patient's name from user model"""
        if self.user:
            return self.user.name
        return f"Patient {self.id}"



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
        
        
        


class Service(models.Model):
    doctor = models.ForeignKey('Doctor', on_delete=models.CASCADE)
    service_name = models.CharField(max_length=50)
    service_mode = models.CharField(max_length=20, choices=[('online', 'Online'), ('offline', 'Offline')])
    service_fee = models.FloatField()
    description = models.CharField(max_length=1500)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.service_name

class Schedules(models.Model):
    doctor = models.ForeignKey('Doctor', on_delete=models.CASCADE)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    mode = models.CharField(max_length=20, choices=[('online', 'Online'), ('offline', 'Offline')])
    date = models.DateField(auto_now=False, auto_now_add=False)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_duration = models.DurationField()
    
    # Break fields
    break_start_time = models.TimeField(null=True, blank=True, help_text="Start time for break (optional)")
    break_end_time = models.TimeField(null=True, blank=True, help_text="End time for break (optional)")
    
    total_slots = models.PositiveIntegerField(default=0, help_text="Total number of slots available")
    booked_slots = models.PositiveIntegerField(default=0, help_text="Number of slots already booked")
    max_patients_per_slot = models.PositiveIntegerField(default=1, help_text="Maximum patients per slot")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    

    class Meta:
        verbose_name = "Schedule"
        verbose_name_plural = "Schedules"
        ordering = ['date', 'start_time']

    def __str__(self):
        return f"{self.doctor} - {self.service} on {self.date}"

    def clean(self):
        """Comprehensive validation for the schedule"""
        errors = {}
        
        # Validate basic time logic
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                errors['end_time'] = "End time must be after start time."
        
        # Validate break times
        if self.break_start_time and self.break_end_time:
            # Break end must be after break start
            if self.break_start_time >= self.break_end_time:
                errors['break_end_time'] = "Break end time must be after break start time."
            
            # Break must be within schedule time
            if self.start_time and self.end_time:
                if self.break_start_time < self.start_time:
                    errors['break_start_time'] = "Break start time must be within schedule hours."
                if self.break_end_time > self.end_time:
                    errors['break_end_time'] = "Break end time must be within schedule hours."
        
        # Validate if only one break time is provided
        if bool(self.break_start_time) != bool(self.break_end_time):
            if not self.break_start_time:
                errors['break_start_time'] = "Break start time is required when break end time is provided."
            if not self.break_end_time:
                errors['break_end_time'] = "Break end time is required when break start time is provided."
        
        # Validate date is not in the past
        if self.date and self.date < timezone.now().date():
            errors['date'] = "Schedule date cannot be in the past."
        
        # Validate slot duration
        if self.slot_duration and self.slot_duration <= timedelta(0):
            errors['slot_duration'] = "Slot duration must be positive."
        
        # Validate booked slots don't exceed total slots
        if self.booked_slots > self.total_slots:
            errors['booked_slots'] = "Booked slots cannot exceed total slots."
        
        # Validate service mode matches schedule mode
        # if self.service and self.service.service_mode != self.mode:
        #     errors['mode'] = f"Schedule mode must match service mode: {self.service.service_mode}"
        
        # Validate max patients per slot
        if self.max_patients_per_slot <= 0:
            errors['max_patients_per_slot'] = "Maximum patients per slot must be at least 1."
        
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        """Override save to run validation and calculate total slots"""
        self.full_clean()
        
        # Auto-calculate total slots if not provided
        if not self.total_slots and self.start_time and self.end_time and self.slot_duration:
            self.total_slots = self.calculate_total_slots()
        
        super().save(*args, **kwargs)

    def calculate_total_slots(self):
        """Calculate total available slots considering breaks"""
        if not all([self.start_time, self.end_time, self.slot_duration]):
            return 0
        
        # Convert to datetime for calculation
        start_dt = datetime.combine(self.date, self.start_time)
        end_dt = datetime.combine(self.date, self.end_time)
        
        # Calculate total working time
        total_working_time = end_dt - start_dt
        
        # Subtract break time if exists
        if self.break_start_time and self.break_end_time:
            break_start_dt = datetime.combine(self.date, self.break_start_time)
            break_end_dt = datetime.combine(self.date, self.break_end_time)
            break_duration = break_end_dt - break_start_dt
            total_working_time -= break_duration
        
        # Calculate number of slots
        if total_working_time.total_seconds() <= 0:
            return 0
        
        return int(total_working_time.total_seconds() / self.slot_duration.total_seconds())

    def get_available_slots(self):
        """Get number of available slots"""
        return max(0, self.total_slots - self.booked_slots)

    def is_fully_booked(self):
        """Check if schedule is fully booked"""
        return self.booked_slots >= self.total_slots

    def can_book_slot(self, requested_slots=1):
        """Check if requested number of slots can be booked"""
        return self.get_available_slots() >= requested_slots and self.is_active

    def get_break_duration(self):
        """Get break duration in minutes"""
        if self.break_start_time and self.break_end_time:
            break_start = datetime.combine(self.date, self.break_start_time)
            break_end = datetime.combine(self.date, self.break_end_time)
            return (break_end - break_start).total_seconds() / 60
        return 0

    def get_working_hours(self):
        """Get total working hours excluding breaks"""
        if not all([self.start_time, self.end_time]):
            return 0
        
        start_dt = datetime.combine(self.date, self.start_time)
        end_dt = datetime.combine(self.date, self.end_time)
        total_time = (end_dt - start_dt).total_seconds() / 3600  # Convert to hours
        
        # Subtract break time
        break_hours = self.get_break_duration() / 60
        return max(0, total_time - break_hours)

    def validate_booking_time(self, booking_time):
        """Validate if a booking time is valid (not during break)"""
        if not self.break_start_time or not self.break_end_time:
            return True
        
        return not (self.break_start_time <= booking_time <= self.break_end_time)
    

class DoctorLocation(models.Model):
    doctor = models.ForeignKey('Doctor', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)  # "Main Clinic", "Home Office"
    latitude = models.DecimalField(max_digits=10, decimal_places=8)
    longitude = models.DecimalField(max_digits=11, decimal_places=8)
    loc_name = models.CharField(max_length=100, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_current = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return f"{self.doctor.user.username} - {self.name}"
    
    def calculate_distance_to(self, lat, lng):
        """Calculate distance to given coordinates in km"""
        lat1, lng1, lat2, lng2 = map(radians, [float(self.latitude), float(self.longitude), lat, lng])
        dlng = lng2 - lng1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # Earth's radius in km
        return c * r
    
    
class PatientLocation(models.Model):
    patient = models.OneToOneField('Patient', on_delete=models.CASCADE, related_name='location')
    latitude = models.DecimalField(max_digits=20, decimal_places=15)
    longitude = models.DecimalField(max_digits=21, decimal_places=15)
    
    
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.patient.user.username} - {self.address}"
    
    

    
class Medical_Record(models.Model):
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name='medical_record')
    chronic_diseases = models.TextField(blank=True, help_text="List chronic diseases (e.g., diabetes, asthma)")
    allergies = models.TextField(blank=True, help_text="List any allergies (e.g., dust, peanuts, penicillin)")

    medications = models.TextField(blank=True, help_text="Current medications with dosage")
    surgeries = models.TextField(blank=True, help_text="Past surgeries and approximate dates")
    
    lifestyle = models.TextField(blank=True, help_text="Smoking, alcohol, diet, exercise habits")

    vaccination_history = models.TextField(blank=True, help_text="Mention vaccines taken (e.g., COVID, Tetanus)")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    

class Appointment(models.Model):
    
    patient = models.ForeignKey('Patient', on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey('Doctor', on_delete=models.CASCADE, related_name='appointments')
    schedule = models.ForeignKey('Schedules', on_delete=models.CASCADE, related_name='appointments')
    service = models.ForeignKey('Service', on_delete=models.SET_NULL, null=True, blank=True)
    
    appointment_date = models.DateField()  
    slot_time = models.TimeField()  
    mode = models.CharField(max_length=20, choices=[('online', 'Online'), ('offline', 'Offline')])
    
    address = models.ForeignKey('Address', on_delete=models.SET_NULL, null=True, blank=True, related_name='appointments')

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    medical_record = models.ForeignKey('Medical_Record', on_delete=models.SET_NULL, null=True, blank=True, related_name='appointments')
    total_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Auto-calculated
    is_paid = models.BooleanField(default=False)

    notes = models.TextField(blank=True, null=True)
    
    doctor_location = models.ForeignKey(DoctorLocation, on_delete=models.SET_NULL, null=True, blank=True)
    patient_latitude = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    patient_longitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    patient_address = models.CharField(max_length=255, blank=True)
    distance_km = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Auto-calculate total_fee
        if self.service:
            # Convert to Decimal to ensure consistent types
            service_fee = Decimal(str(self.service.service_fee or 0))
            consultation_fee = Decimal(str(self.doctor.consultation_fee or 0))
            self.total_fee = service_fee + consultation_fee
        else:
            # If no service, just use doctor's consultation fee
            self.total_fee = Decimal(str(self.doctor.consultation_fee or 0))
        
        super().save(*args, **kwargs)
        
        
    def update_patient_location(self):
        """Update patient location from their current location"""
        current_location = PatientLocation.objects.filter(
            patient=self.patient, 
            is_current=True
        ).first()
        
        if current_location:
            self.patient_latitude = current_location.latitude
            self.patient_longitude = current_location.longitude
            self.patient_address = current_location.address
            
            # Calculate distance if doctor location is set
            if self.doctor_location:
                self.distance_km = self.doctor_location.calculate_distance_to(
                    float(self.patient_latitude), 
                    float(self.patient_longitude)
                )
            self.save()

    def __str__(self):
        return f"Appointment: {self.patient.user.email} with {self.doctor.user.email} on {self.appointment_date} at {self.slot_time}"
    
    


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('upi', 'UPI'),
        ('bank_transfer', 'Bank Transfer'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment = models.OneToOneField('Appointment', on_delete=models.CASCADE, related_name='payment')
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')

    remarks = models.TextField(blank=True, null=True)

    paid_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment for {self.appointment} - {self.status}"
    
    



