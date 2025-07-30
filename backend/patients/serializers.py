import re
import random
import string
import logging

from datetime import datetime, time, date,timedelta
from django.utils import timezone as django_timezone

from decimal import Decimal
import uuid

import razorpay
from django.conf import settings

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from doctor.models import User, EmailOTP, Patient, Address, Medical_Record,Appointment,Schedules,Payment,Doctor,Service,Schedules,DoctorLocation,PatientLocation
from doctor.serializers import ServiceSerializer
from patients.utils import send_otp_email

logger = logging.getLogger(__name__)



class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add userType field to the serializer
        self.fields['userType'] = serializers.CharField(required=False)
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        user_type = attrs.get('userType')  # This comes from frontend
        
        if email and password:
            # Authenticate using email instead of username
            user = authenticate(request=self.context.get('request'), 
            username=email, password=password)
            
            if user:
                if user.role != 'patient':
                    raise AuthenticationFailed(f'This login is only for patients. Your account is registered as {user.role}.')
                
                
                
                if not user.is_active:
                    raise AuthenticationFailed('Your account is not active. Please verify your email.')
                
                
                if user.is_blocked: 
                    raise AuthenticationFailed('Your account has been blocked. Contact support.')
                
                attrs['username'] = email  # Set username to email for parent validation
            else:
                raise AuthenticationFailed('Invalid email or password')
            
        
        return super().validate(attrs)
    
    
class CustomUserCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'first_name', 'last_name', 'username', 'email', 'password', 'role', 'phone_number')
        extra_kwargs = {
            'password': {'write_only': True},
            'otp_created_at': {'read_only': True}
        }

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists, it should be unique")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long.")
        return value
        
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists, it should be unique")
        return value
        
    def validate_phone_number(self, value):
        if value and not re.match(r'^\d{10}$', value):
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")
        if value and User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("Phone number already exists.")
        return value
        
    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        if not re.search(r'[A-Za-z]', value) or not re.search(r'\d', value):
            raise serializers.ValidationError("Password must contain at least one letter and one number.")
        return value
    
    
    def create(self, validated_data):
        logger.info("Starting user creation process...")
        
        try:
            # Extract and remove password from validated data
            password = validated_data.pop('password')
            
            logger.info(f" Creating user with email: {validated_data.get('email')}")

            # Create user object
            user = User(**validated_data)
            user.set_password(password)
            user.is_active = False  
            user.save()
            
            logger.info(f"User saved: {user.id} - {user.email}")

        
            EmailOTP.objects.filter(user=user).delete()
            logger.info(f"Cleared any existing OTP records for {user.email}")


            logger.info(f"Sending OTP to {user.email}...")
            success, result = send_otp_email(user)
            
            if success:
                logger.info(f"OTP sent successfully to {user.email}")
                logger.info(f"Registration OTP sent to {user.email}")
            else:
            
                logger.error(f"Registration OTP failed for {user.email}: {result}")
                # Don't fail registration if OTP sending fails - user can resend
                logger.warning("User created but OTP sending failed - user can use resend OTP")

            return user

        except Exception as general_error:
        
            logger.error(f"Failed to create user: {str(general_error)}")
            raise serializers.ValidationError("Something went wrong during user registration. Please try again.")


class EmailOTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)

    def validate(self, data):
        email = data.get('email')
        otp = data.get('otp')

        logger.debug(f"Verifying OTP for {email}: {otp}")

        try:
            user = User.objects.get(email=email)
            logger.info(f"User found: {user.email}")
            
            try:
                email_otp = EmailOTP.objects.get(user=user)
                logger.info(f"OTP record found for {user.email}")
                logger.debug(f"Stored OTP: {email_otp.otp}, Provided OTP: {otp}")
                
                if email_otp.is_expired():
                    logger.warning(f"OTP expired for {user.email}")
                    raise serializers.ValidationError("OTP has expired. Please request a new one.")

                if email_otp.otp != otp:
                    logger.error(f"OTP mismatch for {user.email}")
                    raise serializers.ValidationError("Invalid OTP.")
                    
                logger.info(f"OTP verification successful for {user.email}")

            except EmailOTP.DoesNotExist:
                logger.error(f"No OTP record found for {user.email}")
                raise serializers.ValidationError("No OTP found for this account. Please request a new one.")

        except User.DoesNotExist:
            logger.error(f"User not found: {email}")
            raise serializers.ValidationError("User not found.")

        return data


class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Email is required.")

        try:
            user = User.objects.get(email=value)
            if user.is_active:
                raise serializers.ValidationError("User is already verified.")
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("User with this email does not exist.")

    def save(self, **kwargs):
        email = self.validated_data.get('email')
        user = User.objects.get(email=email)

        logger.info(f"Resending OTP to {email}")
        
        
        EmailOTP.objects.filter(user=user).delete()
        logger.debug(f"Cleared existing OTP records for {email}")

        success, result = send_otp_email(user)
        if not success:
            logger.error(f"Failed to resend OTP to {email}: {result}")
            raise serializers.ValidationError(f"Failed to send OTP email: {result}")

        logger.info(f"OTP resent successfully to {email}")
        return user


        
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Email is required.")
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("No user found with this email address.")
        return value

    def create(self, validated_data):
        """Handle forgot password logic when serializer.save() is called"""
        email = validated_data['email']
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")

    
        success, result = send_otp_email(user)

        if not success:
            raise serializers.ValidationError("Failed to send OTP. Please try again later.")

        return validated_data


class VerifyForgotPasswordOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)

    OTP_EXPIRY_MINUTES = 1  # configurable expiry

    def validate(self, data):
        email = data.get('email')
        otp = data.get('otp')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")

        try:
            email_otp = EmailOTP.objects.get(user=user)
        except EmailOTP.DoesNotExist:
            raise serializers.ValidationError("No OTP found. Please request a new one.")

        # Check expiry using model method
        if email_otp.is_expired():
            raise serializers.ValidationError("OTP has expired. Please request a new one.")

        if email_otp.otp != otp:
            raise serializers.ValidationError("Invalid OTP.")

    

        return data
    
    
    
class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    # Remove OTP field since it's already verified

    def validate_password(self, value):
        """Validate password strength"""
        logger.debug(f"Validating password: {value}")
        try:
            email = self.initial_data.get('email')
            user = None
            if email:
                try:
                    user = User.objects.get(email=email)
                    logger.debug(f"Found user for password validation: {user.email}")
                except User.DoesNotExist:
                    logger.debug("User not found for password validation")
                    pass
            
            validate_password(value, user=user)
            logger.debug(f"Password validation passed")
        except DjangoValidationError as e:
            logger.error(f"Password validation failed: {e.messages}")
            raise serializers.ValidationError(list(e.messages))
        
        return value

    def validate(self, data):
        logger.debug("Starting full data validation")
        
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirm_password')

        # Check if passwords match
        if password != confirm_password:
            logger.debug("DEBUG - Passwords don't match")
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })

        # Just verify user exists (OTP already verified in previous step)
        try:
            user = User.objects.get(email=email)
            logger.debug(f"Found user: {user.email}")
        except User.DoesNotExist:
            logger.debug("User not found")
            raise serializers.ValidationError({
                'email': 'User not found.'
            })

        logger.info("All validation passed")
        return data

    def save(self, **kwargs):
        email = self.validated_data['email']
        password = self.validated_data['password']
        user = User.objects.get(email=email)

        logger.info(f"DEBUG - Saving password for user: {user.email}")
        
        user.set_password(password)
        user.save()

        logger.info("Password saved successfully")
        return user

    

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile (User + Patient)"""

    # Computed Fields
    full_name = serializers.SerializerMethodField()
    member_since = serializers.SerializerMethodField()
    last_visit = serializers.SerializerMethodField()

    # Write-only (for update)
    blood_group = serializers.CharField(max_length=5, required=False, allow_blank=True, write_only=True)
    age = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    gender = serializers.ChoiceField(choices=Patient.GENDER_CHOICES, required=False, allow_blank=True, write_only=True)

    # Read-only (for frontend display)
    patient_blood_group = serializers.SerializerMethodField()
    patient_age = serializers.SerializerMethodField()
    patient_gender = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()
    has_profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'phone_number', 'role', 'is_active', 
            'member_since', 'last_visit',

            # Write-only inputs
            'blood_group', 'age', 'gender',

            # Patient read-only info
            'patient_blood_group', 'patient_age', 'patient_gender',
            'profile_picture_url', 'has_profile_picture',
        ]
        read_only_fields = ['id', 'role', 'is_active','email']

    # === Computed Field Methods ===

    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.email or obj.username

    def get_member_since(self, obj):
        
        
        return obj.date_joined.strftime('%Y-%m-%d') if hasattr(obj, 'date_joined') and obj.date_joined else None

    def get_last_visit(self, obj):
        return obj.last_login.strftime('%Y-%m-%d') if obj.last_login else None

    def get_patient_blood_group(self, obj):
        return getattr(getattr(obj, "patient_profile", None), "blood_group", None)

    def get_patient_age(self, obj):
        return getattr(getattr(obj, "patient_profile", None), "age", None)

    def get_patient_gender(self, obj):
        return getattr(getattr(obj, "patient_profile", None), "gender", None)

    def get_profile_picture_url(self, obj):
        patient = getattr(obj, "patient_profile", None)
        if patient and patient.profile_picture:
        
            return patient.profile_picture.url
        return None

    def get_has_profile_picture(self, obj):
        patient = getattr(obj, "patient_profile", None)
        return bool(patient and patient.profile_picture)

    

    def validate_phone_number(self, value):
        if value:
            # More comprehensive phone validation
            phone_pattern = re.compile(r'^\+?1?\d{9,15}$')
            cleaned = re.sub(r'[\s\-\(\)]', '', value)  # Remove spaces, dashes, parentheses
            if not phone_pattern.match(cleaned):
                raise serializers.ValidationError("Invalid phone number format. Use format: +1234567890")
        return value

    def validate_age(self, value):
        if value is not None and (value < 0 or value > 150):
            raise serializers.ValidationError("Age must be between 0 and 150.")
        return value

    def validate_blood_group(self, value):
        if value:
            valid_blood_groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
            if value not in valid_blood_groups:
                raise serializers.ValidationError(f"Blood group must be one of: {', '.join(valid_blood_groups)}")
        return value

    # === Update Logic ===

    def update(self, instance, validated_data):
        # Extract and separate patient data
        patient_data = {}
        for field in ['blood_group', 'age', 'gender']:
            if field in validated_data:
                patient_data[field] = validated_data.pop(field)

        # Remove sensitive or restricted fields that shouldn't be updated via this serializer
        restricted_fields = ['password', 'is_staff', 'is_superuser', 'is_active', 'role', 'date_joined', 'last_login']
        for field in restricted_fields:
            validated_data.pop(field, None)

        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update or create patient profile (only for patients)
        if instance.role == 'patient' and patient_data:
            try:
                patient_profile, created = Patient.objects.get_or_create(user=instance)
                for attr, value in patient_data.items():
                    setattr(patient_profile, attr, value)
                patient_profile.save()
            except Exception as e:
                raise serializers.ValidationError(f"Error updating patient profile: {str(e)}")

        return instance    
    

class AddressSerializer(serializers.ModelSerializer):
    """Serializer for user addresses"""
    
    class Meta:
        model = Address
        fields = [
            'id', 'address_line_1', 'street', 'city', 'state', 'postal_code',
            'country', 'address_type', 'label', 'is_primary', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, data):
        user = self.context.get('user')
        
        # Ensure only one primary address per user
        if data.get('is_primary', False) and user:
            existing_primary = Address.objects.filter(
                user=user, 
                is_primary=True,
                is_delete=False
            ).exclude(id=self.instance.id if self.instance else None)
            
            if existing_primary.exists():
                raise serializers.ValidationError(
                    "You can only have one primary address. Please unset the current primary address first."
                )
        
        return data
    
    def validate_postal_code(self, value):
        if not value or len(value.strip()) < 3:
            raise serializers.ValidationError("Postal code must be at least 3 characters long.")
        return value


class AddressListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing addresses"""
    
    class Meta:
        model = Address
        fields = [
            'id', 'address_line_1', 'street', 'city', 'state', 'postal_code',
            'country', 'address_type', 'label', 'is_primary'
        ]


class ProfilePictureSerializer(serializers.Serializer):
    """Serializer for profile picture operations"""
    profile_picture = serializers.ImageField(write_only=True)
    profile_picture_url = serializers.URLField(read_only=True)
    has_profile_picture = serializers.BooleanField(read_only=True)
    upload_date = serializers.DateTimeField(read_only=True)
    
    def validate_profile_picture(self, value):
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."
            )
        
        # Validate file size (5MB max)
        max_size = 5 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError(
                f"File size too large. Maximum {max_size // (1024*1024)}MB allowed."
            )
        
        return value

class UserStatusSerializer(serializers.Serializer):
    is_active=serializers.BooleanField(required=True) 
    
    
    def update(self,instance,validated_data):
        
        if instance.is_staff and not validated_data.get('is_active', True):
            raise serializers.ValidationError(
                "Staff accounts cannot be deactivated through this interface."
            )
        instance.is_active= validated_data.get('is_active', instance.is_active)
        instance.save()
        return instance
    
class BlockUnBlockStatus(serializers.Serializer):
    is_blocked=serializers.BooleanField(required=True)
    
    def update(self,instance,validated_data):
        if instance.is_staff and not validated_data.get('is_blocked',True):
            raise serializers.ValidationError(
                "Staff accounts cannot be deactivated through this interface."
            )
            
        instance.is_blocked=validated_data.get('is_blocked',instance.is_blocked)
        instance.save()
        return instance
    
    
    
from doctor.models import DoctorCertification,DoctorEducation

    
class PatientDoctorEducationSerializer(serializers.ModelSerializer):
    """Simplified education serializer for patient view"""
    class Meta:
        model = DoctorEducation
        fields = ['degree_name', 'institution_name', 'year_of_completion']


class PatientDoctorCertificationSerializer(serializers.ModelSerializer):
    """Simplified certification serializer for patient view"""
    class Meta:
        model = DoctorCertification
        fields = ['certification_name', 'issued_by', 'year_of_issue']



    
    
class MedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    
    class Meta:
        model = Medical_Record
        fields = [
            'id', 'patient', 'patient_name', 'chronic_diseases', 'allergies', 
            'medications', 'surgeries', 'lifestyle', 'vaccination_history',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'patient_name']

    def validate_chronic_diseases(self, value):
        """Validate chronic diseases field"""
        if value and len(value.strip()) > 1000:
            raise serializers.ValidationError("Chronic diseases description is too long (max 1000 characters)")
        return value.strip() if value else ""

    def validate_allergies(self, value):
        """Validate allergies field"""
        if value and len(value.strip()) > 1000:
            raise serializers.ValidationError("Allergies description is too long (max 1000 characters)")
        return value.strip() if value else ""

    def validate_medications(self, value):
        """Validate medications field"""
        if value and len(value.strip()) > 1500:
            raise serializers.ValidationError("Medications description is too long (max 1500 characters)")
        return value.strip() if value else ""

    def validate_surgeries(self, value):
        """Validate surgeries field"""
        if value and len(value.strip()) > 1500:
            raise serializers.ValidationError("Surgeries description is too long (max 1500 characters)")
        return value.strip() if value else ""

    def validate_lifestyle(self, value):
        """Validate lifestyle field"""
        if value and len(value.strip()) > 1000:
            raise serializers.ValidationError("Lifestyle description is too long (max 1000 characters)")
        return value.strip() if value else ""

    def validate_vaccination_history(self, value):
        """Validate vaccination history field"""
        if value and len(value.strip()) > 1000:
            raise serializers.ValidationError("Vaccination history is too long (max 1000 characters)")
        return value.strip() if value else ""

    def validate_patient(self, value):
        """Validate patient exists and doesn't already have a medical record"""
        if not value:
            raise serializers.ValidationError("Patient is required")
        
        # Check if patient already has a medical record (for POST only)
        if self.instance is None:  # Creating new record
            if Medical_Record.objects.filter(patient=value).exists():
                raise serializers.ValidationError("Patient already has a medical record")
        
        return value
    
    
class AppointmentSerializer(serializers.ModelSerializer):
    """Comprehensive appointment serializer"""
    
    # Read-only computed fields
    patient_name = serializers.SerializerMethodField()

    patient_age = serializers.SerializerMethodField()
    patient_gender = serializers.SerializerMethodField()
    patient_email = serializers.SerializerMethodField()
    patient_phone = serializers.SerializerMethodField()
    patient_profile_image = serializers.SerializerMethodField()
    
    
    
    doctor_name = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()
    formatted_date_time = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_reschedule = serializers.SerializerMethodField()
    
    doctor_id = serializers.SerializerMethodField() 
    service_id = serializers.SerializerMethodField()
    
    # Override the slot_time field to handle string inputs
    slot_time = serializers.TimeField(format='%H:%M')
    

    doctor = serializers.CharField(write_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'doctor', 'service', 'schedule',
            'appointment_date', 'slot_time', 'mode', 'address',
            'status', 'total_fee', 'is_paid', 'notes',
            'created_at', 'updated_at', 'medical_record','service_id',
            # Computed fields
            'patient_name', 'doctor_name', 'service_name','doctor_id',
            'formatted_date_time', 'status_display',
            'can_cancel', 'can_reschedule','patient_age', 'patient_gender', 'patient_email', 
            'patient_phone', 'patient_profile_image',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_patient_name(self, obj):
        user = obj.patient.user
        return f"{user.first_name} {user.last_name}".strip() or user.email

    def get_doctor_name(self, obj):
        user = obj.doctor.user
        return f"{user.first_name} {user.last_name}".strip() or user.email
    
    def get_patient_age(self, obj):
        if obj.patient and hasattr(obj.patient, 'age'):
            return obj.patient.age
        elif obj.patient and hasattr(obj.patient, 'date_of_birth'):
            # Calculate age from date of birth
            from datetime import date
            dob = obj.patient.date_of_birth
            if dob:
                today = date.today()
                return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return None

    def get_patient_gender(self, obj):
        if obj.patient and hasattr(obj.patient, 'gender'):
            return obj.patient.gender
        return None

    def get_patient_email(self, obj):
        if obj.patient and obj.patient.user:
            return obj.patient.user.email
        return None

    def get_patient_phone(self, obj):
        # Check patient model first for phone field
        if obj.patient and hasattr(obj.patient, 'phone'):
            return obj.patient.phone
        # Fallback to user model phone_number field
        elif obj.patient and obj.patient.user and hasattr(obj.patient.user, 'phone_number'):
            return obj.patient.user.phone_number
        return None

    def get_patient_profile_image(self, obj):
        
        if obj.patient and hasattr(obj.patient, 'profile_picture'):
            if obj.patient.profile_picture:
                return obj.patient.profile_picture.url
        return None
    
    def get_doctor_id(self, obj):
        """Return the doctor's user ID for frontend use"""
        return str(obj.doctor.user.id) if obj.doctor and obj.doctor.user else None

    def get_service_name(self, obj):
        return obj.service.service_name if obj.service else 'General Consultation'
    
    def get_service_id(self, obj):
        """Return the service ID for frontend use"""
        return str(obj.service.id) if obj.service else None

    def get_formatted_date_time(self, obj):
        if obj.appointment_date and obj.slot_time:
            date_str = obj.appointment_date.strftime('%Y-%m-%d')
            time_str = obj.slot_time.strftime('%I:%M %p')
            return f"{date_str} at {time_str}"
        return None

    def get_status_display(self, obj):
        status_map = {
            'pending': 'Pending Confirmation',
            'confirmed': 'Confirmed',
            'cancelled': 'Cancelled',
            'completed': 'Completed'
        }
        return status_map.get(obj.status, obj.status.title())

    def get_can_cancel(self, obj):
        """Check if appointment can be cancelled - Fixed version"""
        
        # 1. Check status first
        if obj.status in ['cancelled', 'completed']:
            return False
        
        
        
        # 3. Check if date and time exist
        if not obj.appointment_date or not obj.slot_time:
            return False
        
        # 4. Calculate time difference
        try:
            from datetime import datetime
            from django.utils import timezone as django_timezone
            
            # Combine date and time
            appointment_datetime = datetime.combine(obj.appointment_date, obj.slot_time)
            
            # Make timezone aware if needed
            if django_timezone.is_naive(appointment_datetime):
                appointment_datetime = django_timezone.make_aware(appointment_datetime)
            
            # Get current time
            current_time = django_timezone.now()
            
            # Calculate difference in hours
            time_diff = appointment_datetime - current_time
            hours_until_appointment = time_diff.total_seconds() / 3600
            
            # Allow cancellation if more than 24 hours away
            # For testing, you can reduce this to 1 hour: hours_until_appointment > 1
            return hours_until_appointment > 24
            
        except Exception as e:
            # Log the error for debugging
            logger.error(f"Error in get_can_cancel: {e}")
            return False

    def get_can_reschedule(self, obj):
        """Same logic as cancel"""
        return self.get_can_cancel(obj)

    # Alternative versions for different business rules:

    def get_can_cancel_flexible(self, obj):
        """More flexible cancellation policy"""
        # Allow cancel for pending/confirmed appointments
        if obj.status in ['pending', 'confirmed']:
            # Check if appointment is in the future
            if obj.appointment_date and obj.slot_time:
                appointment_datetime = datetime.combine(obj.appointment_date, obj.slot_time)
                if django_timezone.is_naive(appointment_datetime):
                    appointment_datetime = django_timezone.make_aware(appointment_datetime)
                
                # Allow cancellation if appointment is in the future
                return appointment_datetime > django_timezone.now()
            
            # If no date/time, allow cancellation based on status
            return True
        
        return False

    def get_can_cancel_business_hours(self, obj):
        """Only allow cancellation during business hours"""
        if obj.status not in ['pending', 'confirmed']:
            return False
        
        current_time = django_timezone.now()
        current_hour = current_time.hour
        
        # Allow cancellation only during business hours (9 AM - 5 PM)
        if 9 <= current_hour <= 17:
            return self.get_can_cancel(obj)
        
        return False

    def to_internal_value(self, data):
        """Override to handle string inputs for slot_time and doctor UUID"""
        data = data.copy()
        
        # Handle different slot_time property names
        if 'startTime' in data and 'slot_time' not in data:
            data['slot_time'] = data['startTime']
        
        # Handle slot_time conversion - support both 12-hour and 24-hour formats
        if 'slot_time' in data and isinstance(data['slot_time'], str):
            slot_time_str = data['slot_time'].strip()
            
            # Check if it's 12-hour format (contains AM/PM)
            if 'AM' in slot_time_str.upper() or 'PM' in slot_time_str.upper():
                try:
                    # Convert 12-hour to 24-hour format
                    time_obj = datetime.strptime(slot_time_str, '%I:%M %p').time()
                    data['slot_time'] = time_obj.strftime('%H:%M')
                except ValueError:
                    try:
                        # Try without space before AM/PM
                        time_obj = datetime.strptime(slot_time_str, '%I:%M%p').time()
                        data['slot_time'] = time_obj.strftime('%H:%M')
                    except ValueError:
                        # Let the field validation handle the error
                        pass
            else:
                # It's already in 24-hour format, just ensure proper formatting
                try:
                    # Try to parse time string like "09:00" or "09:00:00"
                    time_obj = datetime.strptime(slot_time_str, '%H:%M').time()
                    data['slot_time'] = time_obj.strftime('%H:%M')
                except ValueError:
                    try:
                        # Try with seconds
                        time_obj = datetime.strptime(slot_time_str, '%H:%M:%S').time()
                        data['slot_time'] = time_obj.strftime('%H:%M')
                    except ValueError:
                        # Let the field validation handle the error
                        pass
        
        return super().to_internal_value(data)

    def validate_appointment_date(self, value):
        """Validate appointment date"""
        if not value:
            raise serializers.ValidationError("Appointment date is required.")
        
        if value < date.today():
            raise serializers.ValidationError("Appointment date cannot be in the past.")
        
        # Check if it's too far in the future (6 months)
        max_date = date.today() + django_timezone.timedelta(days=180)
        if value > max_date:
            raise serializers.ValidationError("Appointment date cannot be more than 6 months in the future.")
        
        return value

    def validate_doctor(self, value):
        """Validate doctor ID - handle both UUID strings and integers"""
        if isinstance(value, str):
            try:
                
                doctor_uuid = uuid.UUID(value)
                
                user = User.objects.filter(
                    id=doctor_uuid,
                    role='doctor',
                    is_active=True,
                    doctor_profile__verification_status='approved'
                ).select_related('doctor_profile').first()
                
                if not user:
                    raise serializers.ValidationError(f"Doctor with ID {value} does not exist or is not approved.")
                
                
                return user.doctor_profile
                
            except ValueError:
                
                try:
                    doctor_id = int(value)
                    
                    user = User.objects.filter(
                        id=doctor_id,
                        role='doctor',
                        is_active=True,
                        doctor_profile__verification_status='approved'
                    ).select_related('doctor_profile').first()
                    
                    if not user:
                        raise serializers.ValidationError(f"Doctor with ID {doctor_id} does not exist or is not approved.")
                    
                    
                    return user.doctor_profile
                    
                except ValueError:
                    raise serializers.ValidationError("Invalid doctor ID format.")
        elif isinstance(value, int):
            
            user = User.objects.filter(
                id=value,
                role='doctor',
                is_active=True,
                doctor_profile__verification_status='approved'
            ).select_related('doctor_profile').first()
            
            if not user:
                raise serializers.ValidationError(f"Doctor with ID {value} does not exist or is not approved.")
            
            
            return user.doctor_profile
        
        
        if isinstance(value, Doctor):
            return value
        elif isinstance(value, User) and value.role == 'doctor':
            return value.doctor_profile
        
        return value

    def validate_service(self, value):
        """Validate service ID"""
        if not value:
            return None
        if isinstance(value, str):
            try:
                service_id = int(value)
                if not Service.objects.filter(id=service_id).exists():
                    raise serializers.ValidationError(f"Service with ID {service_id} does not exist.")
                return Service.objects.get(id=service_id)
            except ValueError:
                raise serializers.ValidationError("Invalid service ID format.")
        elif isinstance(value, int):
            if not Service.objects.filter(id=value).exists():
                raise serializers.ValidationError(f"Service with ID {value} does not exist.")
            return Service.objects.get(id=value)
        return value

    def validate_schedule(self, value):
        """Validate schedule ID"""
        if not value:
            return None
        if isinstance(value, str):
            try:
                schedule_id = int(value)
                if not Schedules.objects.filter(id=schedule_id).exists():
                    raise serializers.ValidationError(f"Schedule with ID {schedule_id} does not exist.")
                return Schedules.objects.get(id=schedule_id)
            except ValueError:
                raise serializers.ValidationError("Invalid schedule ID format.")
        elif isinstance(value, int):
            if not Schedules.objects.filter(id=value).exists():
                raise serializers.ValidationError(f"Schedule with ID {value} does not exist.")
            return Schedules.objects.get(id=value)
        return value

    def validate_address(self, value):
        """Validate address ID for offline appointments"""
        if not value:
            return None
        
        if isinstance(value, str):
            try:
                # Check if it's a string address (direct address input)
                if not value.isdigit():
                    # This is a direct address string, not an ID
                    return value
                # It's an ID, get the Address object
                address_id = int(value)
                if not Address.objects.filter(id=address_id).exists():
                    raise serializers.ValidationError(f"Address with ID {address_id} does not exist.")
                return Address.objects.get(id=address_id)
            except ValueError:
                raise serializers.ValidationError("Invalid address ID format.")
        return value

    def validate_medical_record(self, value):
        """Validate medical record ID"""
        if not value:
            return None
        if isinstance(value, str):
            try:
                record_id = int(value)
                if not Medical_Record.objects.filter(id=record_id).exists():
                    raise serializers.ValidationError(f"Medical record with ID {record_id} does not exist.")
                return Medical_Record.objects.get(id=record_id)
            except ValueError:
                raise serializers.ValidationError("Invalid medical record ID format.")
        elif isinstance(value, int):
            if not Medical_Record.objects.filter(id=value).exists():
                raise serializers.ValidationError(f"Medical record with ID {value} does not exist.")
            return Medical_Record.objects.get(id=value)
        return value

    def validate(self, data):
        """Cross-field validation"""
        appointment_date = data.get('appointment_date')
        slot_time = data.get('slot_time')
        doctor = data.get('doctor')
        mode = data.get('mode')
        address = data.get('address')

        # Validate datetime combination
        if appointment_date and slot_time:
            appointment_datetime = datetime.combine(appointment_date, slot_time)
            appointment_datetime = django_timezone.make_aware(appointment_datetime)
            
            if appointment_datetime <= django_timezone.now() + django_timezone.timedelta(hours=1):
                raise serializers.ValidationError({
                    'appointment_date': 'Appointment must be scheduled at least 1 hour in advance.'
                })

        # Validate address for offline appointments
        if mode == 'offline' and not address:
            raise serializers.ValidationError({
                'address': 'Address is required for offline appointments.'
            })

        # Check for double booking
        if doctor and appointment_date and slot_time:
            existing = Appointment.objects.filter(
                doctor=doctor,
                appointment_date=appointment_date,
                slot_time=slot_time,
                status__in=['pending', 'confirmed']
            ).exclude(id=self.instance.id if self.instance else None)
            
            if existing.exists():
                raise serializers.ValidationError({
                    'slot_time': 'This time slot is already booked.'
                })

        return data

    def create(self, validated_data):
        """Create appointment with proper handling"""
        # Handle address field for offline appointments
        address_data = validated_data.pop('address', None)
        
        # Create the appointment first
        appointment = Appointment.objects.create(**validated_data)
        
        # Handle address assignment
        if address_data:
            if isinstance(address_data, str) and not address_data.isdigit():
                # It's a direct address string, store it in notes or handle as needed
                if appointment.notes:
                    appointment.notes += f"\nAddress: {address_data}"
                else:
                    appointment.notes = f"Address: {address_data}"
                appointment.save()
            else:
                # It's an Address object
                appointment.address = address_data
                appointment.save()
        
        return appointment

    def update(self, instance, validated_data):
        """Update appointment with proper handling"""
        # Handle address field for offline appointments
        address_data = validated_data.pop('address', None)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Handle address assignment
        if address_data:
            if isinstance(address_data, str) and not address_data.isdigit():
                # It's a direct address string
                if instance.notes:
                    # Remove old address from notes if present
                    notes_lines = instance.notes.split('\n')
                    notes_lines = [line for line in notes_lines if not line.startswith('Address:')]
                    instance.notes = '\n'.join(notes_lines)
                    instance.notes += f"\nAddress: {address_data}"
                else:
                    instance.notes = f"Address: {address_data}"
                instance.address = None
            else:
                # It's an Address object
                instance.address = address_data
        
        instance.save()
        return instance
    
class BookingDoctorDetailSerializer(serializers.ModelSerializer):
    """Doctor details for booking page"""
    
    full_name = serializers.SerializerMethodField()
    specialization = serializers.CharField(source='doctor_profile.specialization', read_only=True)
    profile_image = serializers.SerializerMethodField()
    hospital = serializers.CharField(source='doctor_profile.clinic_name', read_only=True)
    available_modes = serializers.SerializerMethodField()
    services = serializers.SerializerMethodField()
    consultation_fee = serializers.SerializerMethodField()
    selected_service = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'specialization', 'consultation_fee',
            'profile_image', 'hospital', 'available_modes', 'services',
            'selected_service'
        ]
    
    def get_full_name(self, obj):
        """Get full name with proper validation"""
        if not obj:
            return None
        
        # Check if first_name and last_name exist and are not empty
        first_name = getattr(obj, 'first_name', '') or ''
        last_name = getattr(obj, 'last_name', '') or ''
        
        full_name = f"{first_name} {last_name}".strip()
        
        # Return full name if available, otherwise email, otherwise fallback
        if full_name:
            return full_name
        elif hasattr(obj, 'email') and obj.email:
            return obj.email
        else:
            return f"User {obj.id}"
    
    def get_profile_image(self, obj):
        """Get profile image with proper error handling"""
        try:
            doctor = getattr(obj, "doctor_profile", None)
            if doctor and hasattr(doctor, 'profile_picture') and doctor.profile_picture:
                # Handle both Cloudinary and regular file fields
                if hasattr(doctor.profile_picture, 'url'):
                    return doctor.profile_picture.url
                else:
                    return str(doctor.profile_picture)
            return None
        except AttributeError:
            return None
    
    def get_consultation_fee(self, obj):
        """Return consultation fee based on selected service or default doctor fee"""
        try:
            doctor = getattr(obj, "doctor_profile", None)
            if not doctor:
                return {'online': 0, 'offline': 0}
            
            # Check if a specific service was selected
            selected_service_id = self.context.get('selected_service_id')
            if selected_service_id:
                try:
                    # Make sure the service relationship exists
                    if hasattr(doctor, 'service_set'):
                        service = doctor.service_set.get(id=selected_service_id, is_active=True)
                        service_fee = float(service.service_fee) if service.service_fee else 0
                        return {
                            'online': service_fee,
                            'offline': service_fee
                        }
                except Exception as e:
                    # Log the error for debugging
                    logger.error(f"Error getting selected service: {e}")
                    pass
            
            # Fallback to doctor's default consultation fee
            default_fee = 0
            if hasattr(doctor, 'consultation_fee') and doctor.consultation_fee:
                try:
                    default_fee = float(doctor.consultation_fee)
                except (ValueError, TypeError):
                    default_fee = 0
            
            return {
                'online': default_fee,
                'offline': default_fee
            }
        except Exception as e:
            logger.error(f"Error in get_consultation_fee: {e}")
            return {'online': 0, 'offline': 0}
    
    def get_selected_service(self, obj):
        """Return details of the selected service"""
        try:
            doctor = getattr(obj, "doctor_profile", None)
            if not doctor:
                return None
            
            selected_service_id = self.context.get('selected_service_id')
            if selected_service_id:
                try:
                    if hasattr(doctor, 'service_set'):
                        service = doctor.service_set.get(id=selected_service_id, is_active=True)
                        return {
                            'id': service.id,
                            'name': getattr(service, 'service_name', ''),
                            'fee': float(service.service_fee) if service.service_fee else 0,
                            'description': getattr(service, 'description', '')
                        }
                except Exception as e:
                    logger.error(f"Error getting selected service details: {e}")
                    pass
            return None
        except Exception as e:
            logger.error(f"Error in get_selected_service: {e}")
            return None
    
    def get_available_modes(self, obj):
        """Get available consultation modes"""
        try:
            doctor = getattr(obj, "doctor_profile", None)
            if not doctor:
                return []
            
            modes = []
            if getattr(doctor, 'consultation_mode_online', False):
                modes.append('Online')
            if getattr(doctor, 'consultation_mode_offline', False):
                modes.append('Offline')
            return modes
        except Exception as e:
            logger.error(f"Error in get_available_modes: {e}")
            return []
    
    def get_services(self, obj):
        """Return all available services for this doctor"""
        try:
            doctor = getattr(obj, "doctor_profile", None)
            if not doctor:
                return []
            
            if hasattr(doctor, 'service_set'):
                services = doctor.service_set.filter(is_active=True)
                # Make sure ServiceSerializer is imported and available
                try:
                    return ServiceSerializer(services, many=True).data
                except Exception as e:
                    logger.error(f"Error serializing services: {e}")
                    # Return basic service data if ServiceSerializer fails
                    return [
                        {
                            'id': service.id,
                            'service_name': getattr(service, 'service_name', ''),
                            'service_fee': float(service.service_fee) if service.service_fee else 0,
                            'description': getattr(service, 'description', '')
                        }
                        for service in services
                    ]
            return []
        except Exception as e:
            logger.error(f"Error in get_services: {e}")
            return []
        
class ScheduleDetailSerializer(serializers.ModelSerializer):
    """Schedule details with individual time slots"""
    
    service_name = serializers.CharField(source='service.service_name', read_only=True)
    service_fee = serializers.FloatField(source='service.service_fee', read_only=True)
    time_slots = serializers.SerializerMethodField()
    
    class Meta:
        model = Schedules
        fields = [
            'id', 'service', 'service_name', 'service_fee',
            'mode', 'date', 'time_slots', 'slot_duration',
            'total_slots', 'booked_slots'
        ]
    
    def get_time_slots(self, obj):
        """Generate individual time slots based on schedule"""
        slots = []
        
        # Convert slot_duration to minutes
        slot_duration_minutes = int(obj.slot_duration.total_seconds() / 60)
        
        # Create datetime objects for start and end times
        start_datetime = datetime.combine(obj.date, obj.start_time)
        end_datetime = datetime.combine(obj.date, obj.end_time)
        
        # Generate slots
        current_slot_start = start_datetime
        slot_id = 1
        
        while current_slot_start < end_datetime:
            current_slot_end = current_slot_start + timedelta(minutes=slot_duration_minutes)
            
            # Don't create a slot if it would exceed the end time
            if current_slot_end > end_datetime:
                break
            
            # Check if this slot conflicts with break time
            if obj.break_start_time and obj.break_end_time:
                break_start = datetime.combine(obj.date, obj.break_start_time)
                break_end = datetime.combine(obj.date, obj.break_end_time)
                
                # Skip slots that overlap with break time
                if (current_slot_start < break_end and current_slot_end > break_start):
                    current_slot_start = current_slot_end
                    continue
            
            # Calculate remaining slots for this time slot
            # For simplicity, we'll distribute booked slots evenly
            total_time_slots = len(self._get_all_slots(obj))
            if total_time_slots > 0:
                avg_booked_per_slot = obj.booked_slots / total_time_slots
                remaining_slots = max(0, obj.max_patients_per_slot - int(avg_booked_per_slot))
            else:
                remaining_slots = obj.max_patients_per_slot
            
            slot_data = {
                'id': f"{obj.id}_{slot_id}",
                'startTime': current_slot_start.strftime('%I:%M %p'),
                'endTime': current_slot_end.strftime('%I:%M %p'),
                'remainingSlots': remaining_slots,
                'maxSlots': obj.max_patients_per_slot,
                'schedule_id': obj.id
            }
            
            slots.append(slot_data)
            
            # Move to next slot
            current_slot_start = current_slot_end
            slot_id += 1
        
        return slots
    
    def _get_all_slots(self, obj):
        """Helper method to get all possible slots (used for calculation)"""
        slots = []
        slot_duration_minutes = int(obj.slot_duration.total_seconds() / 60)
        start_datetime = datetime.combine(obj.date, obj.start_time)
        end_datetime = datetime.combine(obj.date, obj.end_time)
        current_slot_start = start_datetime
        
        while current_slot_start < end_datetime:
            current_slot_end = current_slot_start + timedelta(minutes=slot_duration_minutes)
            if current_slot_end > end_datetime:
                break
            
            # Check break time
            if obj.break_start_time and obj.break_end_time:
                break_start = datetime.combine(obj.date, obj.break_start_time)
                break_end = datetime.combine(obj.date, obj.break_end_time)
                if (current_slot_start < break_end and current_slot_end > break_start):
                    current_slot_start = current_slot_end
                    continue
            
            slots.append(current_slot_start)
            current_slot_start = current_slot_end
        
        return slots

class PaymentSerializer(serializers.ModelSerializer):
    """Payment serializer"""
    
    class Meta:
        model = Payment
        fields = ['id', 'appointment', 'amount', 'method', 'status', 'paid_at', 'remarks']
        
          





# class DoctorLocationSerializer(serializers.ModelSerializer):
#     """Serializer for doctor location data"""
    
#     doctor_name = serializers.CharField(source='doctor.user.get_full_name', read_only=True)
#     doctor_id = serializers.IntegerField(source='doctor.id', read_only=True)
#     distance = serializers.FloatField(read_only=True)
    
#     class Meta:
#         model = DoctorLocation
#         fields = [
#             'id', 'name', 'latitude', 'longitude', 'loc_name', 'is_active',
#             'doctor_name', 'doctor_id', 'distance', 'created_at'
#         ]
#         read_only_fields = ['id', 'created_at']
    
#     def to_representation(self, instance):
#         """Custom representation to format distance"""
#         data = super().to_representation(instance)
        
#         # Format distance to 2 decimal places if it exists
#         if 'distance' in data and data['distance'] is not None:
#             data['distance'] = round(float(data['distance']), 2)
        
#         return data

class DoctorLocationSerializer(serializers.ModelSerializer):
    """Serializer for doctor locations with distance"""
    
    # Doctor user information
    doctor_id = serializers.SerializerMethodField()  # This should be User.id
    doctor_name = serializers.SerializerMethodField()
    doctor_specialization = serializers.SerializerMethodField()
    doctor_experience = serializers.SerializerMethodField()
    doctor_rating = serializers.SerializerMethodField()
    doctor_consultation_fee = serializers.SerializerMethodField()
    doctor_image = serializers.SerializerMethodField()
    doctor_clinic_name = serializers.SerializerMethodField()
    doctor_location = serializers.SerializerMethodField()
    doctor_is_available = serializers.SerializerMethodField()
    doctor_consultation_mode_online = serializers.SerializerMethodField()
    doctor_consultation_mode_offline = serializers.SerializerMethodField()
    
    # Location information
    latitude = serializers.DecimalField(max_digits=10, decimal_places=8, read_only=True)
    longitude = serializers.DecimalField(max_digits=11, decimal_places=8, read_only=True)
    distance = serializers.SerializerMethodField()
    
    class Meta:
        model = DoctorLocation
        fields = [
            # Location fields
            'latitude', 'longitude', 'loc_name', 'distance',
            # Doctor fields  
            'doctor_id', 'doctor_name', 'doctor_specialization', 'doctor_experience',
            'doctor_rating', 'doctor_consultation_fee', 'doctor_image', 
            'doctor_clinic_name', 'doctor_location', 'doctor_is_available',
            'doctor_consultation_mode_online', 'doctor_consultation_mode_offline'
        ]
    
    def get_doctor_id(self, obj):
        """Return the User ID, not the DoctorLocation ID"""
        try:
            if obj.doctor and obj.doctor.user:
                return str(obj.doctor.user.id)  # Convert UUID to string for JSON compatibility
            return None
        except Exception as e:
            logger.error(f"Error getting doctor_id: {str(e)}")
            return None
    
    def get_doctor_name(self, obj):
        """Get doctor's full name from user model"""
        try:
            if obj.doctor and obj.doctor.user:
                full_name = obj.doctor.user.get_full_name()
                return full_name if full_name.strip() else "Unknown Doctor"
            return "Unknown Doctor"
        except Exception as e:
            logger.error(f"Error getting doctor_name: {str(e)}")
            return "Unknown Doctor"
    
    def get_doctor_specialization(self, obj):
        """Get doctor's specialization with human-readable format"""
        try:
            if obj.doctor and obj.doctor.specialization:
                return obj.doctor.get_specialization_display()  # Returns human-readable version
            return "Not specified"
        except Exception as e:
            logger.error(f"Error getting doctor_specialization: {str(e)}")
            return "Not specified"
    
    def get_doctor_experience(self, obj):
        """Get doctor's years of experience"""
        try:
            if obj.doctor and obj.doctor.experience is not None:
                return obj.doctor.experience
            return 0
        except Exception as e:
            logger.error(f"Error getting doctor_experience: {str(e)}")
            return 0
    
    def get_doctor_rating(self, obj):
        """Get doctor's rating - implement actual rating calculation if needed"""
        try:
            if obj.doctor:
                # If you have a rating field or related model, use it here
                # For now, return a default rating
                return getattr(obj.doctor, 'rating', 4.5) or 4.5
            return 0
        except Exception as e:
            logger.error(f"Error getting doctor_rating: {str(e)}")
            return 0
    
    def get_doctor_consultation_fee(self, obj):
        """Get doctor's consultation fee"""
        try:
            if obj.doctor and obj.doctor.consultation_fee is not None:
                return float(obj.doctor.consultation_fee)
            return 0
        except Exception as e:
            logger.error(f"Error getting doctor_consultation_fee: {str(e)}")
            return 0
    
    def get_doctor_image(self, obj):
        """Get doctor's profile picture - FIXED: profile_picture is in Doctor model"""
        try:
            if (obj.doctor and 
                hasattr(obj.doctor, 'profile_picture') and 
                obj.doctor.profile_picture):
                return obj.doctor.profile_picture.url
            return None
        except Exception as e:
            logger.error(f"Error getting doctor_image: {str(e)}")
            return None
    
    def get_doctor_clinic_name(self, obj):
        """Get doctor's clinic name"""
        try:
            if obj.doctor and obj.doctor.clinic_name:
                return obj.doctor.clinic_name
            return "Private Practice"
        except Exception as e:
            logger.error(f"Error getting doctor_clinic_name: {str(e)}")
            return "Private Practice"
    
    def get_doctor_location(self, obj):
        """Get doctor's location or clinic location"""
        try:
            if obj.doctor and obj.doctor.location:
                return obj.doctor.location
            elif obj.loc_name:
                return obj.loc_name
            return "Location not specified"
        except Exception as e:
            logger.error(f"Error getting doctor_location: {str(e)}")
            return "Location not specified"
    
    def get_doctor_is_available(self, obj):
        """Get doctor's availability status"""
        try:
            if obj.doctor:
                return getattr(obj.doctor, 'is_available', True)
            return False
        except Exception as e:
            logger.error(f"Error getting doctor_is_available: {str(e)}")
            return False
    
    def get_doctor_consultation_mode_online(self, obj):
        """Get if doctor provides online consultations"""
        try:
            if obj.doctor:
                return getattr(obj.doctor, 'consultation_mode_online', False)
            return False
        except Exception as e:
            logger.error(f"Error getting doctor_consultation_mode_online: {str(e)}")
            return False
    
    def get_doctor_consultation_mode_offline(self, obj):
        """Get if doctor provides offline consultations"""
        try:
            if obj.doctor:
                return getattr(obj.doctor, 'consultation_mode_offline', True)
            return True
        except Exception as e:
            logger.error(f"Error getting doctor_consultation_mode_offline: {str(e)}")
            return True
    
    def get_distance(self, obj):
        """Return the calculated distance if available"""
        try:
            return getattr(obj, 'distance', 0)
        except Exception as e:
            logger.error(f"Error getting distance: {str(e)}")
            return 0        
        
class PatientLocationSerializer(serializers.ModelSerializer):
    """Serializer for reading patient location data"""
    
    class Meta:
        model = PatientLocation
        fields = ['id', 'latitude', 'longitude', 'updated_at', 'created_at']
        read_only_fields = ['id', 'updated_at', 'created_at']

class PatientLocationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientLocation
        fields = ['latitude', 'longitude']  # Add other fields as needed
    
    def validate(self, data):
        logger.debug(f"🔍 Validating location data: {data}")
        
        # Add custom validation logic here
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if not latitude or not longitude:
            logger.error("❌ Missing latitude or longitude")
            raise serializers.ValidationError("Both latitude and longitude are required")
        
        # Validate latitude range
        if not (-90 <= latitude <= 90):
            logger.error(f"❌ Invalid latitude: {latitude}")
            raise serializers.ValidationError("Latitude must be between -90 and 90")
        
        # Validate longitude range
        if not (-180 <= longitude <= 180):
            logger.error(f"❌ Invalid longitude: {longitude}")
            raise serializers.ValidationError("Longitude must be between -180 and 180")
        
        logger.debug("✅ Location data validation passed")
        return data
    
    
class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'appointment', 'amount', 'method', 'status', 
                 'razorpay_order_id', 'razorpay_payment_id', 'paid_at', 'created_at']
        read_only_fields = ['id', 'razorpay_order_id', 'razorpay_payment_id', 'created_at']

class PaymentInitiationSerializer(serializers.Serializer):
    """Serializer for initiating payment"""
    method = serializers.ChoiceField(choices=Payment.PAYMENT_METHOD_CHOICES, default='razorpay')

class PaymentVerificationSerializer(serializers.Serializer):
    """Serializer for verifying Razorpay payment"""
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()
    
    def validate(self, attrs):
        """Verify Razorpay payment signature"""
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            
            # Verify payment signature
            client.utility.verify_payment_signature({
                'razorpay_order_id': attrs['razorpay_order_id'],
                'razorpay_payment_id': attrs['razorpay_payment_id'],
                'razorpay_signature': attrs['razorpay_signature']
            })
            
            logger.info(f"Payment signature verified for order: {attrs['razorpay_order_id']}")
            return attrs
            
        except razorpay.errors.SignatureVerificationError:
            logger.error(f"Invalid payment signature for order: {attrs['razorpay_order_id']}")
            raise serializers.ValidationError("Invalid payment signature.")
        except Exception as e:
            logger.error(f"Error verifying payment signature: {str(e)}")
            raise serializers.ValidationError("Payment verification failed.")
