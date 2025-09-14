import io
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Sum, Avg, Count, Q
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib.colors import HexColor, Color

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
import re
import razorpay

from .models import (
    User,
    Doctor,
    DoctorEducation,
    DoctorCertification,
    DoctorProof,
    Service,
    Schedules,
    DoctorLocation,
    Appointment
)

from doctor.models import SubscriptionPlan, DoctorSubscription, SubscriptionUpgrade
from adminside.serializers import SubscriptionPlanSerializer

# ReportLab imports for PDF generation
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.widgets.markers import makeMarker

# Logger setup
logger = logging.getLogger(__name__)



class CustomDoctorTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'
    
    def __init__(self, *args, **kwargs):
        '''Remove the default 'username' field because authentication uses 'email' instead'''
        
        super().__init__(*args, **kwargs)
        if 'username' in self.fields:
            del self.fields['username']
        
        self.fields['email'] = serializers.EmailField()
        self.fields['userType'] = serializers.CharField(required=False)

    def validate(self, attrs):
        try:
            email = attrs.get('email')
            password = attrs.get('password')
            
            logger.info(f"Doctor login validation for email: {email}")
            
            if not email or not password:
                raise AuthenticationFailed('Email and password are required')
            
            user = authenticate(
                request=self.context.get('request'), 
                username=email, 
                password=password
            )
            
            if not user:
                logger.warning(f"Authentication failed for email: {email}")
                raise AuthenticationFailed('Invalid email or password')
            
            user_role = getattr(user, 'role', None)
            if user_role != 'doctor':
                logger.warning(f"Non-doctor login attempt: {email} (role: {user_role})")
                raise AuthenticationFailed(
                    f'This login is only for doctors. Your account is registered as {user_role or "unknown"}.'
                )
            
            if not user.is_active:
                logger.warning(f"Inactive user login attempt: {email}")
                raise AuthenticationFailed(
                    'Your account is not active. Please verify your email.'
                )
            
            if hasattr(user, 'is_blocked') and getattr(user, 'is_blocked', False):
                logger.warning(f"Blocked user login attempt: {email}")
                raise AuthenticationFailed(
                    'Your account has been blocked. Contact support.'
                )
            
            # Set username for parent validation
            attrs['username'] = email
            
            # Store user for later use
            self.user = user
            
        except AuthenticationFailed:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in doctor login validation: {str(e)}", exc_info=True)
            raise AuthenticationFailed('An error occurred during authentication')
        
        try:
            # Call parent validation to generate tokens
            data = super().validate(attrs)
            
            # Add doctor-specific data to token response
            doctor_profile = None
            try:
                
                if hasattr(self.user, 'doctor_profile'):
                    doctor_profile = self.user.doctor_profile
                # elif hasattr(self.user, 'doctorprofile'):  
                #     doctor_profile = self.user.doctorprofile
            except Exception as profile_error:
                logger.warning(f"Could not access doctor profile for {self.user.email}: {str(profile_error)}")
                doctor_profile = None
            
            doctor_profile_data = None
            if doctor_profile:
                try:
                    doctor_profile_data = {
                        'verification_status': getattr(doctor_profile, 'verification_status', 'incomplete'),
                        'is_profile_setup_done': getattr(doctor_profile, 'is_profile_setup_done', False),
                        'is_education_done': getattr(doctor_profile, 'is_education_done', False),
                        'is_certification_done': getattr(doctor_profile, 'is_certification_done', False),
                        'is_license_done': getattr(doctor_profile, 'is_license_done', False),
                        'specialization': getattr(doctor_profile, 'specialization', None),
                        'experience': getattr(doctor_profile, 'experience', None),
                    }
                except Exception as profile_data_error:
                    logger.warning(f"Error building doctor profile data: {str(profile_data_error)}")
                    doctor_profile_data = {
                        'verification_status': 'incomplete',
                        'is_profile_setup_done': False,
                        'is_education_done': False,
                        'is_certification_done': False,
                        'is_license_done': False,
                        'specialization': None,
                        'experience': None,
                    }
                    
            data['user'] = {
                'id': str(self.user.id),  # Convert UUID to string
                'email': self.user.email,
                'first_name': getattr(self.user, 'first_name', ''),
                'last_name': getattr(self.user, 'last_name', ''),
                'role': getattr(self.user, 'role', 'doctor'),
                'is_active': self.user.is_active,
                'doctor_profile': doctor_profile_data
            }
            
            logger.info(f"Doctor login successful for: {self.user.email}")
            return data
            
        except Exception as e:
            logger.error(f"Error in token generation: {str(e)}", exc_info=True)
            raise AuthenticationFailed('An error occurred during token generation')

    @classmethod
    def get_token(cls, user):
        """Override to add custom claims to token"""
        try:
            token = super().get_token(user)
            
            # Add custom claims - CRITICAL: Convert ALL UUIDs to strings for JSON serialization
            token['user_id'] = str(user.id)  # Convert UUID to string
            token['email'] = user.email
            token['role'] = getattr(user, 'role', 'doctor')
            
            return token
        except Exception as e:
            logger.error(f"Error generating token for user {user.email}: {str(e)}")
            raise
        
        
class DoctorProfileSerializer(serializers.ModelSerializer):
    """Serializer for doctor profile (User + Doctor)"""

    # Computed Fields
    full_name = serializers.SerializerMethodField()
    member_since = serializers.SerializerMethodField()
    last_login_date = serializers.SerializerMethodField()

    # Write-only (for update)
    first_name = serializers.CharField(max_length=50, required=False, allow_blank=True, write_only=True)
    last_name = serializers.CharField(max_length=50, required=False, allow_blank=True, write_only=True)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True, write_only=True)
    years_of_experience = serializers.IntegerField(required=False, allow_null=True, write_only=True, min_value=0)
    profile_image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    consultation_mode_online = serializers.BooleanField(required=False, write_only=True)
    consultation_mode_offline = serializers.BooleanField(required=False, write_only=True)
    clinic_name = serializers.CharField(max_length=200, required=False, allow_blank=True, write_only=True)
    location = serializers.CharField(max_length=200, required=False, allow_blank=True, write_only=True)
    license_number = serializers.CharField(max_length=50, required=False, allow_blank=True, write_only=True)
    consultation_fee = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, write_only=True)

    date_of_birth = serializers.DateField(required=False, allow_null=True, write_only=True)
    gender = serializers.ChoiceField(
        choices=Doctor.GENDER_CHOICES, 
        required=False, 
        allow_null=True, 
        write_only=True
    )


    # Read-only (for frontend display)
    doctor_first_name = serializers.SerializerMethodField()
    doctor_last_name = serializers.SerializerMethodField()
    doctor_specialization = serializers.SerializerMethodField()
    doctor_experience = serializers.SerializerMethodField()
    doctor_bio = serializers.SerializerMethodField()
    doctor_license_number = serializers.SerializerMethodField()
    doctor_consultation_fee = serializers.SerializerMethodField()
    doctor_consultation_mode_online = serializers.SerializerMethodField()
    doctor_consultation_mode_offline = serializers.SerializerMethodField()
    doctor_clinic_name = serializers.SerializerMethodField()
    doctor_location = serializers.SerializerMethodField()
    doctor_is_available = serializers.SerializerMethodField()
    doctor_verification_status = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()
    has_profile_picture = serializers.SerializerMethodField()
    profile_completed = serializers.SerializerMethodField()
    doctor_department = serializers.SerializerMethodField()
    doctor_gender = serializers.SerializerMethodField()
    doctor_date_of_birth = serializers.SerializerMethodField() 
    

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name',
            'phone_number', 'role', 'is_active', 
            'member_since', 'last_login_date',

            # Write-only inputs
            'first_name', 'last_name', 'department', 'years_of_experience',
            'profile_image', 'consultation_mode_online', 'consultation_mode_offline',
            'clinic_name', 'location', 'license_number', 'consultation_fee',
            'date_of_birth', 'gender',

            # Doctor read-only info
            'doctor_first_name', 'doctor_last_name', 'doctor_department', 
            'doctor_experience', 'doctor_bio', 'doctor_license_number',
            'doctor_consultation_fee', 'doctor_consultation_mode_online',
            'doctor_consultation_mode_offline', 'doctor_clinic_name', 
            'doctor_location', 'doctor_is_available', 'doctor_verification_status',
            'profile_picture_url', 'has_profile_picture', 'profile_completed',
            'doctor_specialization','doctor_gender',
            'doctor_date_of_birth'
        ]
        read_only_fields = ['id', 'role', 'is_active']



    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.email or obj.username

    def get_member_since(self, obj):
        return obj.date_joined.strftime('%Y-%m-%d') if hasattr(obj, 'date_joined') and obj.date_joined else None

    def get_last_login_date(self, obj):
        return obj.last_login.strftime('%Y-%m-%d') if obj.last_login else None

    def get_doctor_first_name(self, obj):
        return obj.first_name or ''

    def get_doctor_last_name(self, obj):
        return obj.last_name or ''

    def get_doctor_department(self, obj):
        """Return the specialization field for department compatibility"""
        specialization = getattr(getattr(obj, "doctor_profile", None), "specialization", '')
        return specialization
    
    def get_doctor_specialization(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "specialization", '')

    def get_doctor_experience(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "experience", 0)

    def get_doctor_bio(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "bio", '')

    def get_doctor_license_number(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "license_number", '')

    def get_doctor_consultation_fee(self, obj):
        fee = getattr(getattr(obj, "doctor_profile", None), "consultation_fee", 0.00)
        return float(fee) if fee else 0.00

    def get_doctor_consultation_mode_online(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "consultation_mode_online", False)

    def get_doctor_consultation_mode_offline(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "consultation_mode_offline", False)

    def get_doctor_clinic_name(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "clinic_name", '')

    def get_doctor_location(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "location", '')

    def get_doctor_is_available(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "is_available", True)

    def get_doctor_verification_status(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "verification_status", 'pending')

    def get_profile_picture_url(self, obj):
        doctor = getattr(obj, "doctor_profile", None)
        if doctor and doctor.profile_picture:
            return doctor.profile_picture.url
        return None
    
    def get_doctor_date_of_birth(self, obj):
        """Return the date of birth from doctor profile"""
        dob = getattr(getattr(obj, "doctor_profile", None), "date_of_birth", None)
        return dob.strftime('%Y-%m-%d') if dob else None

    def get_has_profile_picture(self, obj):
        doctor = getattr(obj, "doctor_profile", None)
        return bool(doctor and doctor.profile_picture)

    def get_profile_completed(self, obj):
        doctor = getattr(obj, "doctor_profile", None)
        return getattr(doctor, "is_profile_setup_done", False) if doctor else False
    
    def get_doctor_gender(self, obj):
        """Return the gender from doctor profile"""
        return getattr(getattr(obj, "doctor_profile", None), "gender", '')



    def validate_name_field(self, value, field_name):
        """Generic name field validation for first_name, last_name"""
        if not value or not value.strip():
            raise serializers.ValidationError(f"{field_name} cannot be blank or contain only whitespace.")
        
        cleaned_value = value.strip()
        
        name_pattern = re.compile(r'^[a-zA-Z\s\'-]+$')
        if not name_pattern.match(cleaned_value):
            raise serializers.ValidationError(f"{field_name} can only contain letters, spaces, hyphens, and apostrophes.")
        
        if len(cleaned_value) < 2:
            raise serializers.ValidationError(f"{field_name} must be at least 2 characters long.")
        
        if len(cleaned_value) > 50:
            raise serializers.ValidationError(f"{field_name} cannot exceed 50 characters.")
        
        return cleaned_value

    def validate_first_name(self, value):
        return self.validate_name_field(value, "First name")

    def validate_last_name(self, value):
        return self.validate_name_field(value, "Last name")

    def validate_location(self, value):
        """Validate location field"""
        if not value or not value.strip():
            raise serializers.ValidationError("Location cannot be blank or contain only whitespace.")
        
        cleaned_value = value.strip()
        
        location_pattern = re.compile(r'^[a-zA-Z\s,.\'-]+$')
        if not location_pattern.match(cleaned_value):
            raise serializers.ValidationError("Location contains invalid characters. Only letters, numbers, spaces, commas, periods, hyphens, and apostrophes are allowed.")
        
        if len(cleaned_value) < 3:
            raise serializers.ValidationError("Location must be at least 3 characters long.")
        
        if len(cleaned_value) > 200:
            raise serializers.ValidationError("Location cannot exceed 200 characters.")
        
        return cleaned_value

    def validate_date_of_birth(self, value):
        """Validate date of birth - cannot be in future and reasonable age limits"""
        if not value:
            return value
        
        today = date.today()
        
        if value > today:
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        
        if age < 18:
            raise serializers.ValidationError("Doctor must be at least 18 years old.")
        
        if age > 100:
            raise serializers.ValidationError("Please enter a valid date of birth.")
        
        return value

    def validate_experience(self, value):
        """Validate years of experience"""
        if value is None:
            return value
        
        if not isinstance(value, (int, float)) or value < 0:
            raise serializers.ValidationError("Years of experience must be a positive number.")
        
        if value > 60:
            raise serializers.ValidationError("Years of experience cannot exceed 60 years.")
        
        return int(value)

    def validate_years_of_experience(self, value):
        return self.validate_experience(value)

    def validate_phone_number(self, value):
        """Enhanced phone number validation"""
        if not value or not value.strip():
            raise serializers.ValidationError("Phone number cannot be blank.")
        
        cleaned = re.sub(r'[^\d+]', '', value.strip())
        
        if not cleaned:
            raise serializers.ValidationError("Phone number must contain at least one digit.")
        
        digits_only = re.sub(r'[^\d]', '', cleaned)
        
        if len(digits_only) < 10:
            raise serializers.ValidationError("Phone number must be at least 10 digits long.")
        
        if len(digits_only) > 15:
            raise serializers.ValidationError("Phone number cannot exceed 15 digits.")
        
        if len(set(digits_only)) == 1:
            raise serializers.ValidationError("Phone number cannot contain all identical digits.")
        
        invalid_patterns = ['1234567890', '0987654321', '1111111111', '0000000000']
        if digits_only in invalid_patterns or digits_only[-10:] in invalid_patterns:
            raise serializers.ValidationError("Please enter a valid phone number.")
        
        phone_pattern = re.compile(r'^[\+]?[\d\s\-\(\)]+$')
        if not phone_pattern.match(value.strip()):
            raise serializers.ValidationError("Phone number contains invalid characters. Use only digits, +, spaces, hyphens, and parentheses.")
        
        return value.strip()

    def validate_email(self, value):
        """Enhanced email validation"""
        if not value or not value.strip():
            raise serializers.ValidationError("Email cannot be blank.")
        
        cleaned_email = value.strip().lower()
        
        email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        if not email_pattern.match(cleaned_email):
            raise serializers.ValidationError("Please enter a valid email address.")
        
        user = self.instance
        if user and User.objects.filter(email=cleaned_email).exclude(id=user.id).exists():
            raise serializers.ValidationError("This email is already in use.")
        
        return cleaned_email

    def validate_consultation_fee(self, value):
        """Enhanced consultation fee validation"""
        if value is None:
            return value
        
        # if not isinstance(value, (int, float)):
        #     raise serializers.ValidationError("Consultation fee must be a number.")
        
        if value < 0:
            raise serializers.ValidationError("Consultation fee cannot be negative.")
        
        if value > 10000: 
            raise serializers.ValidationError("Consultation fee seems too high. Please enter a reasonable amount.")
        
        return round(float(value), 2)

    def validate_clinic_name(self, value):
        """Validate clinic name"""
        if not value or not value.strip():
            raise serializers.ValidationError("Clinic name cannot be blank or contain only whitespace.")
        
        cleaned_value = value.strip()
        
        clinic_pattern = re.compile(r'^[a-zA-Z0-9\s,.\'&()-]+$')
        if not clinic_pattern.match(cleaned_value):
            raise serializers.ValidationError("Clinic name contains invalid characters.")
        
        if len(cleaned_value) < 3:
            raise serializers.ValidationError("Clinic name must be at least 3 characters long.")
        
        if len(cleaned_value) > 100:
            raise serializers.ValidationError("Clinic name cannot exceed 100 characters.")
        
        return cleaned_value

    def validate_specialization(self, value):
        """Validate medical specialization"""
        if not value or not value.strip():
            raise serializers.ValidationError("Specialization cannot be blank or contain only whitespace.")
        
        cleaned_value = value.strip()
        
        spec_pattern = re.compile(r'^[a-zA-Z\s\-()&,]+$')
        if not spec_pattern.match(cleaned_value):
            raise serializers.ValidationError("Specialization can only contain letters, spaces, hyphens, parentheses, and commas.")
        
        if len(cleaned_value) < 3:
            raise serializers.ValidationError("Specialization must be at least 3 characters long.")
        
        if len(cleaned_value) > 100:
            raise serializers.ValidationError("Specialization cannot exceed 100 characters.")
        
        return cleaned_value

    def validate_license_number(self, value):
        """Validate medical license number"""
        if not value or not value.strip():
            raise serializers.ValidationError("License number cannot be blank or contain only whitespace.")
        
        cleaned_value = value.strip().upper()
        
        # License numbers typically contain letters and numbers
        license_pattern = re.compile(r'^[A-Z0-9\-/]+$')
        if not license_pattern.match(cleaned_value):
            raise serializers.ValidationError("License number can only contain letters, numbers, hyphens, and forward slashes.")
        
        if len(cleaned_value) < 5:
            raise serializers.ValidationError("License number must be at least 5 characters long.")
        
        if len(cleaned_value) > 20:
            raise serializers.ValidationError("License number cannot exceed 20 characters.")
        
        return cleaned_value

    def validate_bio(self, value):
        """Validate doctor bio"""
        if value and value.strip():
            cleaned_value = value.strip()
            
            if len(cleaned_value) < 10:
                raise serializers.ValidationError("Bio must be at least 10 characters long if provided.")
            
            if len(cleaned_value) > 1000:
                raise serializers.ValidationError("Bio cannot exceed 1000 characters.")
            
            return cleaned_value
        
        return value

    def validate(self, data):
        """Overall validation for the serializer"""
        consultation_online = data.get('consultation_mode_online')
        consultation_offline = data.get('consultation_mode_offline')
        
        # Validate consultation modes
        if consultation_online is not None or consultation_offline is not None:
            if not consultation_online and not consultation_offline:
                raise serializers.ValidationError("At least one consultation mode must be selected.")
        
        # Cross-field validation for date of birth and experience
        dob = data.get('date_of_birth')
        experience = data.get('experience') or data.get('years_of_experience')
        
        if dob and experience:
            today = date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            # Experience cannot be more than age - 18 (assuming medical school at 18)
            max_possible_experience = age - 18
            if experience > max_possible_experience:
                raise serializers.ValidationError(f"Years of experience ({experience}) seems inconsistent with date of birth. Maximum possible experience based on age: {max_possible_experience}")
        
        return data


    def update(self, instance, validated_data):
        
        logger.debug(f" DEBUG: Received validated_data keys: {list(validated_data.keys())}")
        
        # Extract and separate doctor data
        doctor_data = {}
        user_fields = ['first_name', 'last_name']
        doctor_fields = [
            'department', 'years_of_experience', 'profile_image', 
            'consultation_mode_online', 'consultation_mode_offline',
            'clinic_name', 'location', 'license_number', 'consultation_fee',
            'date_of_birth', 'gender'
        ]
        logger.debug(f" DEBUG: Looking for doctor_fields: {doctor_fields}")
        
        # Extract user fields
        for field in user_fields:
            if field in validated_data:
                doctor_data[field] = validated_data.pop(field)
        
        # Extract doctor fields and map them correctly
        for field in doctor_fields:
            if field in validated_data:
                value = validated_data.pop(field)
                
                logger.debug(f" DEBUG: Processing field '{field}' with value: {value} (type: {type(value)})")
                
                if field == 'department':
                    doctor_data['specialization'] = value
                elif field == 'years_of_experience':
                    doctor_data['experience'] = value
                    logger.debug(f" DEBUG: Mapped years_of_experience={value} to experience")
                elif field == 'profile_image':
                    doctor_data['profile_picture'] = value
                else:
                    doctor_data[field] = value

        restricted_fields = ['password', 'is_staff', 'is_superuser', 'is_active', 'role', 'date_joined', 'last_login']
        for field in restricted_fields:
            validated_data.pop(field, None)

        user_updated = False
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            user_updated = True
            logger.debug(f" DEBUG: Updated user.{attr} = {value}")
        

        for field in ['first_name', 'last_name']:
            if field in doctor_data:
                setattr(instance, field, doctor_data.pop(field))
                user_updated = True
                logger.debug(f" DEBUG: Updated user.{field} from doctor_data")
        
        if user_updated:
            instance.save()
            logger.debug("DEBUG: User model saved")

        if instance.role == 'doctor' and doctor_data:
            logger.debug(f" DEBUG: Updating doctor profile with data: {doctor_data}")
            try:
                doctor_profile, created = Doctor.objects.get_or_create(
                    user=instance,
                    defaults={
                        'specialization': '',
                        'experience': 0,
                        'bio': '',
                        'license_number': '',
                        'consultation_fee': 0.00,
                        'is_available': True,
                        'consultation_mode_online': False,
                        'consultation_mode_offline': False,
                        'clinic_name': '',
                        'location': '',
                        'created_at': timezone.now(),
                        'updated_at': timezone.now(),
                        'gender': None,
                        'date_of_birth': None,
                        'verification_status': 'incomplete',
                    }
                )
                
                for attr, value in doctor_data.items():
                    old_value = getattr(doctor_profile, attr, 'NOT_FOUND')
                    setattr(doctor_profile, attr, value)
                    logger.debug(f" DEBUG: doctor.{attr}: {old_value} -> {value}")
                
                doctor_profile.updated_at = timezone.now()
                doctor_profile.save()
                logger.debug("DEBUG: Doctor profile saved")
                
                if self._is_profile_complete(doctor_profile):
                    doctor_profile.is_profile_setup_done = True
                    doctor_profile.save()
                    logger.debug("DEBUG: Profile marked as complete")
                else:
                    logger.debug("DEBUG: Profile still incomplete")
                    
            except Exception as e:
                logger.debug(f"DEBUG: Error updating doctor profile: {str(e)}")
                raise serializers.ValidationError(f"Error updating doctor profile: {str(e)}")
        else:
            logger.debug(f"DEBUG: Not updating doctor profile. Role: {instance.role}, doctor_data: {bool(doctor_data)}")

        return instance

    def _is_profile_complete(self, doctor_profile):
        """Check if doctor profile has all required fields"""
        required_fields = [
            'specialization', 'experience', 'license_number'
        ]
        
        for field in required_fields:
            value = getattr(doctor_profile, field, None)
            if not value or (isinstance(value, str) and not value.strip()):
                return False
        
        # Check if at least one consultation mode is selected
        if not doctor_profile.consultation_mode_online and not doctor_profile.consultation_mode_offline:
            return False
            
        return True
    
    def get_doctor_educations(self, obj):
        doctor = getattr(obj, "doctor_profile", None)
        if not doctor:
            return []
        
        educations = doctor.educations.all()
        return [{
            'degree_name': edu.degree_name,
            'institution_name': edu.institution_name,
            'year_of_completion': edu.year_of_completion
        } for edu in educations]

    def get_doctor_certifications(self, obj):
        doctor = getattr(obj, "doctor_profile", None)
        if not doctor:
            return []
        
        certifications = doctor.certifications.all()
        return [{
            'certification_name': cert.certification_name,
            'issued_by': cert.issued_by,
            'year_of_issue': cert.year_of_issue
        } for cert in certifications]
    
    
class DoctorEducationSerializer(serializers.ModelSerializer):
    """Serializer for doctor Education """ 
    
    first_name = serializers.CharField(source='doctor.user.first_name', read_only=True)
    last_name = serializers.CharField(source='doctor.user.last_name', read_only=True)
    phone_number = serializers.CharField(source='doctor.user.phone_number', read_only=True)
    email = serializers.EmailField(source='doctor.user.email', read_only=True)
    is_active = serializers.BooleanField(source='doctor.user.is_active', read_only=True)
    role = serializers.CharField(source='doctor.user.role', read_only=True)
    
    class Meta:
        model = DoctorEducation
        fields = [
            'id', 'degree_name', 'institution_name', 'year_of_completion', 
            'degree_certificate_id',
            # User fields (read-only for context)
            'first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role'
        ]
        read_only_fields = ['id', 'first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role']
    
    def validate_year_of_completion(self, value):
        current_year = datetime.now().year
        if value > current_year:
            raise serializers.ValidationError("Year of completion cannot be in the future.")
        if value < 1900:
            raise serializers.ValidationError("Year of completion seems too old.")
        return value
    
    def validate_degree_name(self, value):
        """Validate degree name"""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError("Degree name must be at least 2 characters long.")
        return value.strip()
    
    def validate_institution_name(self, value):
        """Validate institution name"""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError("Institution name must be at least 2 characters long.")
        return value.strip()
    
    def create(self, validated_data):
        """Override create to update education completion status"""
        instance = super().create(validated_data)
        
        if hasattr(instance, 'doctor'):
            instance.doctor.check_education_completion()
            instance.doctor.check_verification_completion()
        return instance
    
    def update(self, instance, validated_data):
        """Override update to check completion status"""
        instance = super().update(instance, validated_data)
        # Update education completion status
        if hasattr(instance, 'doctor'):
            instance.doctor.check_education_completion()
            # Also trigger overall verification check
            instance.doctor.check_verification_completion()
        return instance

class DoctorCertificationSerializer(serializers.ModelSerializer):
    """Serializer for doctor Certification (User + Doctor)"""
    
    first_name = serializers.CharField(source='doctor.user.first_name', read_only=True)
    last_name = serializers.CharField(source='doctor.user.last_name', read_only=True)
    phone_number = serializers.CharField(source='doctor.user.phone_number', read_only=True)
    email = serializers.EmailField(source='doctor.user.email', read_only=True)
    is_active = serializers.BooleanField(source='doctor.user.is_active', read_only=True)
    role = serializers.CharField(source='doctor.user.role', read_only=True)
    certificate_image_url = serializers.SerializerMethodField()
    has_certificate_image = serializers.SerializerMethodField()
    
    
    class Meta:
        model = DoctorCertification
        fields = [
            'id', 'certification_name', 'issued_by', 'year_of_issue',
            'certification_certificate_id', 'certificate_image',
            'certificate_image_url', 'has_certificate_image',
            # User fields (read-only for context)
            'first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role'
        ]
        read_only_fields = ['id', 'first_name', 'last_name', 'phone_number', 'email', 'is_active', 
                            'role', 'certificate_image_url','has_certificate_image']
    
    def get_certificate_image_url(self, obj):
        """Return the Cloudinary URL for certificate image"""
        if obj.certificate_image:
            return obj.certificate_image.url
        return None
    
    def get_has_certificate_image(self, obj):
        """Check if certification has an image"""
        return bool(obj.certificate_image)
    
    def validate_year_of_issue(self, value):
        current_year = datetime.now().year
        if value > current_year:
            raise serializers.ValidationError("Year of issue cannot be in the future.")
        if value < 1900:
            raise serializers.ValidationError("Year of issue seems too old.")
        return value
    
    def validate_certification_name(self, value):
        """Validate certification name"""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError("Certification name must be at least 2 characters long.")
        return value.strip()
    
    def validate_issued_by(self, value):
        """Validate issuing authority"""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError("Issuing authority must be at least 2 characters long.")
        return value.strip()
    
    def create(self, validated_data):
        """Override create to update certification completion status"""
        instance = super().create(validated_data)
        if hasattr(instance, 'doctor'):
            instance.doctor.check_certification_completion()
            instance.doctor.check_verification_completion()
        return instance
    
    def update(self, instance, validated_data):
        """Override update to check completion status"""
        instance = super().update(instance, validated_data)
        if hasattr(instance, 'doctor'):
            instance.doctor.check_certification_completion()
            instance.doctor.check_verification_completion()
        return instance


class DoctorProofSerializer(serializers.ModelSerializer):
    """Serializer for doctor Proof (User + Doctor)""" 
    first_name = serializers.CharField(source='doctor.user.first_name', read_only=True)
    last_name = serializers.CharField(source='doctor.user.last_name', read_only=True)
    phone_number = serializers.CharField(source='doctor.user.phone_number', read_only=True)
    email = serializers.EmailField(source='doctor.user.email', read_only=True)
    is_active = serializers.BooleanField(source='doctor.user.is_active', read_only=True)
    role = serializers.CharField(source='doctor.user.role', read_only=True)
    license_image_url = serializers.SerializerMethodField()
    has_license_image = serializers.SerializerMethodField()
    id_proof_url=serializers.SerializerMethodField()
    has_id_proof=serializers.SerializerMethodField()
    
    
    class Meta:
        model = DoctorProof
        fields = [
            'medical_license_number', 'license_doc_id',
            'license_proof_image', 'id_proof','license_image_url','has_license_image','id_proof_url','has_id_proof',
            # User fields (read-only for context)
            'first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role'
        ]
        read_only_fields = ['first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role']
    
    def get_has_id_proof(self,obj):
        return bool(obj.id_proof)
    
    def get_id_proof_url(self,obj):
        if obj.id_proof:
            return obj.id_proof.url
        return None
    
    def get_has_license_image(self,obj):
        return bool(obj.license_proof_image)
    
    def get_license_image_url(self, obj):  
        if obj.license_proof_image:
            return obj.license_proof_image.url
        return None
    
    def validate_medical_license_number(self, value):
        if not value or len(value.strip()) < 3:
            raise serializers.ValidationError("Medical license number is required and must be valid.")
        return value.strip()
    
    def validate_license_doc_id(self, value):
        """Validate license document ID"""
        if value and len(value.strip()) < 3:
            raise serializers.ValidationError("License document ID must be at least 3 characters long.")
        return value.strip() if value else value
    
    def create(self, validated_data):
        """Override create to update license completion status"""
        instance = super().create(validated_data)
        if hasattr(instance, 'doctor'):
            instance.doctor.check_profile_completion()
        return instance
    
    def update(self, instance, validated_data):
        """Override update to check completion status"""
        instance = super().update(instance, validated_data)
        if hasattr(instance, 'doctor'):
            instance.doctor.check_profile_completion()
        return instance


class VerificationStatusSerializer(serializers.ModelSerializer):
    """Serializer for doctor Fully Verification (User + Doctor)"""
    
    is_profile_setup_done = serializers.BooleanField(read_only=True)
    is_education_done = serializers.BooleanField(read_only=True)
    is_certification_done = serializers.BooleanField(read_only=True)
    is_license_done = serializers.BooleanField(read_only=True)
    
    # User verification status
    is_fully_verified = serializers.BooleanField(source='user.is_fully_verified', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    
    # User basic info
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    
    class Meta:
        model = Doctor
        fields = [
            # Doctor verification fields
            'is_profile_setup_done', 'is_education_done',
            'is_certification_done', 'is_license_done',
            # User verification and basic info
            'is_fully_verified', 'is_active',
            'first_name', 'last_name', 'phone_number', 'email', 'role'
        ]


class CompleteDoctorProfileSerializer(serializers.ModelSerializer):
    """Serializer for Doctor Profile Complete Checking(User + Doctor)"""
    
    # User fields
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    is_fully_verified = serializers.BooleanField(source='user.is_fully_verified', read_only=True)
    
    # Related data
    educations = DoctorEducationSerializer(source='doctoreducation_set', many=True, read_only=True)
    certifications = DoctorCertificationSerializer(source='doctorcertification_set', many=True, read_only=True)
    proof = DoctorProofSerializer(source='doctorproof', read_only=True)
    
    class Meta:
        model = Doctor
        fields = [
            # Doctor basic info
            'id', 'gender', 'specialization', 'experience', 'profile_picture',
            'bio', 'date_of_birth',
            # User info
            'first_name', 'last_name', 'phone_number', 'email', 'is_active', 
            'role', 'is_fully_verified',
            # Verification status
            'is_profile_setup_done', 'is_education_done', 'is_certification_done', 
            'is_license_done',
            # Related data
            'educations', 'certifications', 'proof',
            # Timestamps
            'created_at', 'updated_at'
        ]
        
        
class doctorStatusSerializer(serializers.Serializer):
    """Serializer for doctor Status (User + Doctor)"""
    
    is_active=serializers.BooleanField(required=True) 
    def update(self,instance,validated_data):
        
        if instance.is_staff and not validated_data.get('is_active', True):
            raise serializers.ValidationError(
                "Staff accounts cannot be deactivated through this interface."
            )
        instance.is_active= validated_data.get('is_active', instance.is_active)
        instance.save()
        return instance
    
    
class DoctorApplicationListSerializer(serializers.ModelSerializer):
    """Simple serializer for listing doctors pending approval"""
    
    # Use your existing computed fields
    full_name = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()
    doctor_specialization = serializers.SerializerMethodField()
    doctor_experience = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'phone_number', 'full_name',
            'profile_picture_url', 'doctor_specialization', 'doctor_experience'
        ]
    
    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.email
    
    def get_profile_picture_url(self, obj):
        doctor = getattr(obj, "doctor_profile", None)
        if doctor and doctor.profile_picture:
            return doctor.profile_picture.url
        return None
    
    def get_doctor_specialization(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "specialization", '')
    
    def get_doctor_experience(self, obj):
        return getattr(getattr(obj, "doctor_profile", None), "experience", 0)


    # def update(self, instance, validated_data):
    #     action = validated_data.get('action')  # 'approve' or 'reject'
    #     admin_comments = validated_data.get('admin_comments', '')
        
    #     doctor_profile = instance.doctor_profile
        
    #     if action == 'approve':
    #         doctor_profile.verification_status = 'approved'
    #     elif action == 'reject':
    #         doctor_profile.verification_status = 'rejected'
    #         doctor_profile.rejection_reason = admin_comments
        
    #     doctor_profile.save()
        
    #     if action == 'approve':
    #         instance.is_active = True
    #         instance.save(update_fields=['is_active'])
        
    #     return instance

class DoctorApplicationDetailSerializer(serializers.ModelSerializer):
    """Complete doctor application details using your existing serializers"""
    
    doctor_profile = serializers.SerializerMethodField()
    doctor_educations = serializers.SerializerMethodField()
    doctor_certifications = serializers.SerializerMethodField()
    doctor_proof = serializers.SerializerMethodField()
    verification_summary = serializers.SerializerMethodField()
    
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone_number', 'last_login',
            'doctor_profile', 'doctor_educations', 'doctor_certifications', 
            'doctor_proof', 'verification_summary'
        ]
    
    def get_doctor_profile(self, obj):
        """Get complete doctor profile info"""
        doctor = getattr(obj, "doctor_profile", None)
        if not doctor:
            return None
            
        return {
            # Basic Info
            'id': str(doctor.id),
            'first_name': obj.first_name or '',
            'last_name': obj.last_name or '',
            'full_name': f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.email,
            'email': obj.email,
            'phone_number': obj.phone_number or '',
            
            # Doctor Details
            'specialization': doctor.specialization or '',
            'experience': doctor.experience or 0,
            'gender': doctor.gender or '',
            'date_of_birth': doctor.date_of_birth.strftime('%Y-%m-%d') if doctor.date_of_birth else None,
            'bio': doctor.bio or '',
            'license_number': doctor.license_number or '',
            'consultation_fee': float(doctor.consultation_fee) if doctor.consultation_fee else 0.00,
            'consultation_mode_online': doctor.consultation_mode_online,
            'consultation_mode_offline': doctor.consultation_mode_offline,
            'clinic_name': doctor.clinic_name or '',
            'location': doctor.location or '',
            'is_available': doctor.is_available,
            'profile_picture_url': doctor.profile_picture.url if doctor.profile_picture else None,
            'has_profile_picture': bool(doctor.profile_picture),
            'verification_status': doctor.verification_status,
            'created_at': doctor.created_at.strftime('%Y-%m-%d %H:%M:%S') if doctor.created_at else None,
            'updated_at': doctor.updated_at.strftime('%Y-%m-%d %H:%M:%S') if doctor.updated_at else None,
        }
    
    def get_doctor_educations(self, obj):
        """Get all education details"""
        doctor = getattr(obj, "doctor_profile", None)
        if not doctor:
            return []
        
        educations = doctor.educations.all()
        return [{
            'id': str(edu.id),
            'degree_name': edu.degree_name,
            'institution_name': edu.institution_name,
            'year_of_completion': edu.year_of_completion,
            'degree_certificate_id': edu.degree_certificate_id,
            'created_at': edu.created_at.strftime('%Y-%m-%d') if edu.created_at else None
        } for edu in educations]
    
    def get_doctor_certifications(self, obj):
        """Get all certification details"""
        doctor = getattr(obj, "doctor_profile", None)
        if not doctor:
            return []
        
        certifications = doctor.certifications.all()
        return [{
            'id': str(cert.id),
            'certification_name': cert.certification_name,
            'issued_by': cert.issued_by,
            'year_of_issue': cert.year_of_issue,
            'certification_certificate_id': cert.certification_certificate_id,
            'certificate_image_url': cert.certificate_image.url if cert.certificate_image else None,
            'has_certificate_image': bool(cert.certificate_image),
            'created_at': cert.created_at.strftime('%Y-%m-%d') if cert.created_at else None
        } for cert in certifications]
    
    def get_doctor_proof(self, obj):
        """Get license and proof details"""
        doctor = getattr(obj, "doctor_profile", None)
        if not doctor or not hasattr(doctor, 'proof'):
            return None
        
        proof = doctor.proof
        return {
            'id': str(proof.id),
            'medical_license_number': proof.medical_license_number,
            'license_doc_id': proof.license_doc_id,
            'license_image_url': proof.license_proof_image.url if proof.license_proof_image else None,
            'has_license_image': bool(proof.license_proof_image),
            'id_proof_url': proof.id_proof.url if proof.id_proof else None,
            'has_id_proof': bool(proof.id_proof),
            'created_at': proof.created_at.strftime('%Y-%m-%d') if proof.created_at else None
        }
    
    def get_verification_summary(self, obj):
        """Get verification status summary"""
        doctor = getattr(obj, "doctor_profile", None)
        if not doctor:
            return None
            
        return {
            'is_profile_setup_done': doctor.is_profile_setup_done,
            'is_education_done': doctor.is_education_done,
            'is_certification_done': doctor.is_certification_done,
            'is_license_done': doctor.is_license_done,
            'verification_status': doctor.verification_status,
            'all_steps_complete': all([
                doctor.is_profile_setup_done,
                doctor.is_education_done,
                doctor.is_certification_done,
                doctor.is_license_done
            ]),
            'completion_percentage': int(sum([
                doctor.is_profile_setup_done,
                doctor.is_education_done,
                doctor.is_certification_done,
                doctor.is_license_done
            ]) / 4 * 100)
        }


class DoctorApprovalActionSerializer(serializers.Serializer):
    """Simple approve/reject serializer"""
    
    ACTION_CHOICES = [
        ('approve', 'Approve'),
        ('reject', 'Reject')
    ]
    
    action = serializers.ChoiceField(choices=ACTION_CHOICES, required=True)
    admin_comment = serializers.CharField(
        max_length=500, 
        required=False, 
        allow_blank=True,
        help_text="Optional comment (required for rejections)"
    )
    
    def validate(self, data):
        action = data.get('action')
        admin_comment = data.get('admin_comment', '').strip()
        
        # Require comment for rejections
        if action == 'reject' and not admin_comment:
            raise serializers.ValidationError({
                'admin_comment': 'Comment is required when rejecting an application.'
            })
        
        return data
    
    def update(self, instance, validated_data):
        """Update doctor verification status"""
        
        doctor = instance.doctor_profile
        action = validated_data['action']
        admin_comment = validated_data.get('admin_comment', '')
        
        if action == 'approve':
            doctor.verification_status = 'approved'
            instance.is_active = True 
            doctor.admin_comment = admin_comment if admin_comment else ''
            
        elif action == 'reject':
            doctor.verification_status = 'rejected'
            doctor.admin_comment = admin_comment
        
        # Save both user and doctor
        doctor.save()
        instance.save()
        
        logger.info(f" APPROVAL ACTION: {action.upper()} for Doctor {doctor.id}")
        logger.info(f"Admin Comment: {admin_comment}")
        
        return instance
    
    
class ServiceSerializer(serializers.ModelSerializer):
    """Serializer for Service model with plan-based validation"""
    
    total_fee = serializers.SerializerMethodField()
    
    
    class Meta:
        model = Service
        fields = [
            'id', 'service_name', 'service_mode', 'service_fee', 'description', 
            'is_active', 'created_at', 'updated_at', 'total_fee', 'slot_duration'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'total_fee']

    def validate_service_name(self, value):
        """Validate service name based on choices"""
        valid_choices = ['basic', 'standard', 'premium']
        if value not in valid_choices:
            raise serializers.ValidationError(f"Service name must be one of {valid_choices}")
        return value

    def validate_service_mode(self, value):
        """Validate service mode"""
        valid_modes = ['online', 'offline']
        if value not in valid_modes:
            raise serializers.ValidationError(f"Service mode must be one of {valid_modes}")
        return value

    def validate_service_fee(self, value):
        """Validate service fee with general constraints"""
        if value < 0:
            raise serializers.ValidationError("Service fee cannot be negative.")
        if value > 1000:
            raise serializers.ValidationError("Service fee cannot exceed ₹1000.")
        return value

    def validate_description(self, value):
        """Validate description"""
        if not value or len(value.strip()) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters long.")
        if len(value.strip()) > 1500:
            raise serializers.ValidationError("Description cannot exceed 1500 characters.")
        return value.strip()

    def validate_slot_duration(self, value):
        """Validate slot duration with general constraints"""
        if value <= timedelta(0):
            raise serializers.ValidationError("Slot duration must be greater than 0.")
        if value > timedelta(hours=2):
            raise serializers.ValidationError("Slot duration cannot exceed 2 hours.")
        return value

    def _validate_basic_service(self, data):
        """Validate Basic service specific constraints"""
        logger.debug("Applying Basic service-specific validations")
        errors = {}
        
        # Fee validation: ₹50 to ₹200
        service_fee = data.get('service_fee')
        if service_fee is not None:
            if service_fee < 50:
                logger.warning(f"Basic service fee too low: ₹{service_fee}")
                errors['service_fee'] = 'Basic service fee must be at least ₹50'
            elif service_fee > 200:
                logger.warning(f"Basic service fee too high: ₹{service_fee}")
                errors['service_fee'] = 'Basic service fee cannot exceed ₹200'
        
        # Duration validation: 15 or 30 minutes only
        slot_duration = data.get('slot_duration')
        if slot_duration is not None:
            allowed_durations = [timedelta(minutes=15), timedelta(minutes=30)]
            if slot_duration not in allowed_durations:
                logger.warning(f"Basic service invalid duration: {slot_duration}")
                errors['slot_duration'] = 'Basic service can only have 15 or 30 minute slots'
        
        # Mode restriction: only online for basic
        service_mode = data.get('service_mode')
        if service_mode == 'offline':
            logger.warning("Basic service cannot be offline")
            errors['service_mode'] = 'Basic service can only be online'
        
        return errors

    def _validate_standard_service(self, data):
        """Validate Standard service specific constraints"""
        logger.debug("Applying Standard service-specific validations")
        errors = {}
        
        # Fee validation: ₹150 to ₹400
        service_fee = data.get('service_fee')
        if service_fee is not None:
            if service_fee < 150:
                logger.warning(f"Standard service fee too low: ₹{service_fee}")
                errors['service_fee'] = 'Standard service fee must be at least ₹150'
            elif service_fee > 400:
                logger.warning(f"Standard service fee too high: ₹{service_fee}")
                errors['service_fee'] = 'Standard service fee cannot exceed ₹400'
        
        # Duration validation: 15, 30, or 45 minutes
        slot_duration = data.get('slot_duration')
        if slot_duration is not None:
            allowed_durations = [
                timedelta(minutes=15), 
                timedelta(minutes=30), 
                timedelta(minutes=45)
            ]
            if slot_duration not in allowed_durations:
                logger.warning(f"Standard service invalid duration: {slot_duration}")
                errors['slot_duration'] = 'Standard service can have 15, 30, or 45 minute slots'
        
        # Both online and offline allowed for standard
        
        return errors

    def _validate_premium_service(self, data):
        """Validate Premium service specific constraints"""
        logger.debug("Applying Premium service-specific validations")
        errors = {}
        
        # Fee validation: ₹300 to ₹1000
        service_fee = data.get('service_fee')
        if service_fee is not None:
            if service_fee < 300:
                logger.warning(f"Premium service fee too low: ₹{service_fee}")
                errors['service_fee'] = 'Premium service fee must be at least ₹300'
            elif service_fee > 1000:
                logger.warning(f"Premium service fee too high: ₹{service_fee}")
                errors['service_fee'] = 'Premium service fee cannot exceed ₹1000'
        
        # Duration validation: 15, 30, 45, 60, or 90 minutes
        slot_duration = data.get('slot_duration')
        if slot_duration is not None:
            allowed_durations = [
                timedelta(minutes=15), 
                timedelta(minutes=30), 
                timedelta(minutes=45),
                timedelta(minutes=60),
                timedelta(minutes=90)
            ]
            if slot_duration not in allowed_durations:
                logger.warning(f"Premium service invalid duration: {slot_duration}")
                errors['slot_duration'] = 'Premium service can have 15, 30, 45, 60, or 90 minute slots'
        
        return errors

    def _check_doctor_plan_access(self, service_name, service_mode):
        """Check if doctor's subscription plan allows this service type"""
        request = self.context.get('request')
        if not request or not hasattr(request.user, 'doctor_profile'):
            return False, "Doctor profile not found"
        
        doctor = request.user.doctor_profile
        
        # Check if doctor has active subscription
        if not doctor.has_subscription():
            return False, "No active subscription found"
        
        current_plan = doctor.get_current_plan()
        if not current_plan:
            return False, "No active subscription found"
        
        allowed_service_types = getattr(current_plan, 'allowed_service_types', [])
        
        if service_name not in allowed_service_types:
            return False, f"Your {current_plan.get_name_display()} plan doesn't allow {service_name} services"
        
        # Check service mode permissions
        if service_mode == 'online' and not getattr(current_plan, 'can_create_online_service', True):
            return False, f"Your {current_plan.get_name_display()} plan doesn't allow online services"
        
        if service_mode == 'offline' and not getattr(current_plan, 'can_create_offline_service', False):
            return False, f"Your {current_plan.get_name_display()} plan doesn't allow offline services"
        
        return True, "Access granted"

    def get_total_fee(self, obj):
        """Calculate total fee (service fee + doctor consultation fee)"""
        doctor_fee = getattr(obj.doctor, 'consultation_fee', 0) or 0
        service_fee = obj.service_fee or 0
        return float(doctor_fee) + float(service_fee)

    def validate(self, data):
        """Cross-field validation with service-specific business logic"""
        logger.debug(f"Service validation started with data: {data}")
        
        service_name = data.get('service_name')
        service_mode = data.get('service_mode', 'online')
        
        # Check doctor's plan access first
        has_access, access_message = self._check_doctor_plan_access(service_name, service_mode)
        if not has_access:
            logger.warning(f"Plan access denied: {access_message}")
            raise serializers.ValidationError({
                'plan_access': access_message,
                'redirect_to': 'subscription_upgrade' if 'plan doesn\'t allow' in access_message else 'subscription_plans'
            })
        
        # Service-specific validation
        service_errors = {}
        
        if service_name == 'basic':
            service_errors = self._validate_basic_service(data)
        elif service_name == 'standard':
            service_errors = self._validate_standard_service(data)
        elif service_name == 'premium':
            service_errors = self._validate_premium_service(data)
        
        if service_errors:
            logger.warning(f"Service-specific validation failed for {service_name} service: {service_errors}")
            raise serializers.ValidationError(service_errors)
        
        # Check subscription limits
        request = self.context.get('request')
        if request and hasattr(request.user, 'doctor_profile'):
            doctor = request.user.doctor_profile
            
            can_create = doctor.can_create_service(service_mode)
            
            if not can_create:
                if not doctor.has_subscription():
                    logger.warning(f"No active subscription for doctor {doctor.id}")
                    raise serializers.ValidationError({
                        'subscription': 'Active subscription required to create services.',
                        'redirect_to': 'subscription_plans'
                    })
                else:
                    # Get usage stats for detailed error message
                    usage_stats = doctor.get_usage_stats()
                    current_plan = doctor.get_current_plan()
                    
                    logger.warning(f"Service limit reached for doctor {doctor.id}")
                    raise serializers.ValidationError({
                        'service_limit': f'Cannot create {service_mode} service. Maximum {current_plan.max_services} services allowed in {current_plan.get_name_display()} plan.',
                        'current_usage': usage_stats,
                        'redirect_to': 'subscription_upgrade'
                    })
        
        logger.debug("Service validation completed successfully")
        return data
class SchedulesSerializer(serializers.ModelSerializer):
    """Serializer for Schedules model with doctor and service details and appointment protection"""
    
    # Doctor fields for context
    doctor_first_name = serializers.CharField(source='doctor.user.first_name', read_only=True)
    doctor_last_name = serializers.CharField(source='doctor.user.last_name', read_only=True)
    doctor_phone = serializers.CharField(source='doctor.user.phone_number', read_only=True)
    doctor_email = serializers.EmailField(source='doctor.user.email', read_only=True)
    doctor_name = serializers.SerializerMethodField(read_only=True)
    
    # Service fields for context
    service_name = serializers.CharField(source='service.service_name', read_only=True)
    service_mode = serializers.CharField(source='service.service_mode', read_only=True)
    service_fee = serializers.FloatField(source='service.service_fee', read_only=True)
    service_description = serializers.CharField(source='service.description', read_only=True)
    
    # Calculated fields
    available_slots = serializers.SerializerMethodField(read_only=True)
    is_fully_booked = serializers.SerializerMethodField(read_only=True)
    working_hours = serializers.SerializerMethodField(read_only=True)
    break_duration = serializers.SerializerMethodField(read_only=True)
    available_services = serializers.SerializerMethodField(read_only=True)
    
    # Appointment protection fields
    has_appointments = serializers.SerializerMethodField(read_only=True)
    appointments_count = serializers.SerializerMethodField(read_only=True)
    earliest_appointment = serializers.SerializerMethodField(read_only=True)
    latest_appointment = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Schedules
        fields = [
            'id', 'doctor', 'service', 'mode', 'date', 'start_time', 'end_time',
            'slot_duration', 'break_start_time', 'break_end_time', 'total_slots',
            'booked_slots', 'max_patients_per_slot', 'is_active', 'created_at', 'updated_at',
            # Doctor fields
            'doctor_first_name', 'doctor_last_name', 'doctor_phone', 'doctor_email', 'doctor_name',
            # Service fields
            'service_name', 'service_mode', 'service_fee', 'service_description', 'available_services',
            # Calculated fields
            'available_slots', 'is_fully_booked', 'working_hours', 'break_duration',
            # Appointment fields
            'has_appointments', 'appointments_count', 'earliest_appointment', 'latest_appointment'
        ]
        
        read_only_fields = [
            'id', 'doctor', 'created_at', 'updated_at',
            'doctor_first_name', 'doctor_last_name', 'doctor_phone', 'doctor_email', 'doctor_name',
            'service_name', 'service_mode', 'service_fee', 'service_description', 'available_services',
            'available_slots', 'is_fully_booked', 'working_hours', 'break_duration',
            'has_appointments', 'appointments_count', 'earliest_appointment', 'latest_appointment'
        ]

    # Existing methods
    def get_doctor_name(self, obj):
        if obj.doctor and obj.doctor.user:
            return f"{obj.doctor.user.first_name} {obj.doctor.user.last_name}".strip()
        return None

    def get_available_services(self, obj):
        if obj.doctor:
            services = obj.doctor.service_set.filter(is_active=True)
            return ServiceSerializer(services, many=True).data
        return []

    def get_available_slots(self, obj):
        return obj.get_available_slots()

    def get_is_fully_booked(self, obj):
        return obj.is_fully_booked()

    def get_working_hours(self, obj):
        return obj.get_working_hours()

    def get_break_duration(self, obj):
        return obj.get_break_duration()

    # Appointment protection methods
    def get_has_appointments(self, obj):
        try:
            
            return Appointment.objects.filter(
                schedule=obj,
                status__in=['confirmed', 'pending'],
                appointment_date=obj.date
            ).exists()
        except:
            return False

    def get_appointments_count(self, obj):
        try:
            
            return Appointment.objects.filter(
                schedule=obj,
                status__in=['confirmed', 'pending'],
                appointment_date=obj.date
            ).count()
        except:
            return 0

    def get_earliest_appointment(self, obj):
        try:
            
            earliest = Appointment.objects.filter(
                schedule=obj,
                status__in=['confirmed', 'pending'],
                appointment_date=obj.date
            ).order_by('slot_time').first()
            if earliest:
                return earliest.slot_time.strftime('%H:%M')
        except:
            pass
        return None

    def get_latest_appointment(self, obj):
        try:
            
            latest = Appointment.objects.filter(
                schedule=obj,
                status__in=['confirmed', 'pending'],
                appointment_date=obj.date
            ).order_by('-slot_time').first()
            if latest:
                return latest.slot_time.strftime('%H:%M')
        except:
            pass
        return None

    def validate(self, data):
        """Enhanced cross-field validation with appointment protection"""
        errors = {}
        
        # Basic time validation
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        if start_time and end_time and start_time >= end_time:
            errors['end_time'] = "End time must be after start time."

        # Break time validation
        break_start_time = data.get('break_start_time')
        break_end_time = data.get('break_end_time')
        if break_start_time and break_end_time:
            if break_start_time >= break_end_time:
                errors['break_end_time'] = "Break end time must be after break start time."
            if start_time and break_start_time < start_time:
                errors['break_start_time'] = "Break start time must be within schedule hours."
            if end_time and break_end_time > end_time:
                errors['break_end_time'] = "Break end time must be within schedule hours."

        # Validate both break times provided together
        if bool(break_start_time) != bool(break_end_time):
            if not break_start_time:
                errors['break_start_time'] = "Break start time is required when break end time is provided."
            if not break_end_time:
                errors['break_end_time'] = "Break end time is required when break start time is provided."

        # Validate slots
        booked_slots = data.get('booked_slots', 0)
        total_slots = data.get('total_slots', 0)
        if booked_slots > total_slots:
            errors['booked_slots'] = "Booked slots cannot exceed total slots."

        # Subscription validation
        request = self.context.get('request')
        if request and hasattr(request.user, 'role') and request.user.role == 'doctor':
            try:
                doctor = Doctor.objects.get(user=request.user)
                schedule_date = data.get('date')
                if schedule_date and not doctor.can_create_schedule(schedule_date):
                    plan = doctor.get_current_plan()
                    if not plan:
                        errors['subscription'] = 'Active subscription required to create schedules.'
                    else:
                        usage_stats = doctor.get_usage_stats()
                        if usage_stats['daily_schedules']['used'] >= usage_stats['daily_schedules']['limit']:
                            errors['schedule_limit'] = 'Daily schedule limit reached for your plan.'
                        elif usage_stats['monthly_schedules']['used'] >= usage_stats['monthly_schedules']['limit']:
                            errors['schedule_limit'] = 'Monthly schedule limit reached for your plan.'
            except Doctor.DoesNotExist:
                pass

        # Appointment protection for updates
        if self.instance:
            try:
                
                existing_appointments = Appointment.objects.filter(
                    schedule=self.instance,
                    status__in=['confirmed', 'pending'],
                    appointment_date=self.instance.date
                )
                
                if existing_appointments.exists():
                    # Prevent critical time changes
                    if start_time and start_time != self.instance.start_time:
                        errors['start_time'] = "Cannot change start time when appointments exist"
                    if end_time and end_time != self.instance.end_time:
                        errors['end_time'] = "Cannot change end time when appointments exist"
                    if data.get('slot_duration') and data.get('slot_duration') != self.instance.slot_duration:
                        errors['slot_duration'] = "Cannot change slot duration when appointments exist"
            except ImportError:
                pass

        if errors:
            raise serializers.ValidationError(errors)
        return data

    def create(self, validated_data):
        """Override create to handle auto-calculation"""
        instance = super().create(validated_data)
        
        # Auto-calculate total slots
        if (not instance.total_slots and instance.start_time and 
            instance.end_time and instance.slot_duration):
            instance.total_slots = instance.calculate_total_slots()
            instance.save()

        # Update doctor's consultation mode
        doctor = instance.doctor
        if instance.mode == 'online':
            doctor.consultation_mode_online = True
        elif instance.mode == 'offline':
            doctor.consultation_mode_offline = True
        doctor.save()
        
        return instance

    def update(self, instance, validated_data):
        """Override update with recalculation"""
        instance = super().update(instance, validated_data)
        
        # Recalculate total slots if needed
        time_fields = ['start_time', 'end_time', 'slot_duration', 'break_start_time', 'break_end_time']
        if any(field in validated_data for field in time_fields):
            if (instance.start_time and instance.end_time and instance.slot_duration):
                calculated_slots = instance.calculate_total_slots()
                if calculated_slots != instance.total_slots:
                    instance.total_slots = calculated_slots
                    instance.save()

        # Update doctor's consultation mode
        doctor = instance.doctor
        if instance.mode == 'online':
            doctor.consultation_mode_online = True
        elif instance.mode == 'offline':
            doctor.consultation_mode_offline = True
        doctor.save()
        
        return instance
    
    
class DoctorLocationSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.user.get_full_name', read_only=True)
    distance = serializers.FloatField(read_only=True)
    
    class Meta:
        model = DoctorLocation
        fields = ['id', 'name', 'latitude', 'longitude', 'loc_name', 'is_active',
                  'is_current', 'doctor_name', 'distance', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_latitude(self, value):
        if not (-90 <= value <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90 degrees")
        return value
    
    def validate_longitude(self, value):
        if not (-180 <= value <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180 degrees")
        return value


class DoctorLocationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorLocation
        fields = ['name', 'latitude', 'longitude', 'loc_name', 'is_active', 'is_current']
        extra_kwargs = {
            'latitude': {'required': True},
            'longitude': {'required': True},
            'name': {'required': True},
        }
    
    def validate_latitude(self, value):
        if not (-90 <= value <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90 degrees")
        return value
    
    def validate_longitude(self, value):
        if not (-180 <= value <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180 degrees")
        return value


class DoctorLocationUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating doctor location"""
    
    class Meta:
        model = DoctorLocation
        fields = ['name', 'latitude', 'longitude', 'loc_name', 'is_active', 'is_current']
        extra_kwargs = {
            'latitude': {'required': True},
            'longitude': {'required': True},
        }
    
    def validate_latitude(self, value):
        if not (-90 <= value <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90 degrees")
        return value
    
    def validate_longitude(self, value):
        if not (-180 <= value <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180 degrees")
        return value
    
    


def generate_short_receipt(prefix, doctor_id, timestamp=None):
    """Generate a short receipt string that fits Razorpay's 40-character limit"""
    if timestamp is None:
        timestamp = int(timezone.now().timestamp())
    
    # Create a hash of doctor_id and timestamp for uniqueness
    hash_input = f"{doctor_id}_{timestamp}"
    short_hash = hashlib.md5(hash_input.encode()).hexdigest()[:8]
    
    # Format: prefix_hash (e.g., "sub_a1b2c3d4" or "upg_a1b2c3d4")
    receipt = f"{prefix}_{short_hash}"
    
    # Ensure it's within 40 characters (should be around 12-16 chars)
    return receipt[:40]


class SubscriptionActivationSerializer(serializers.Serializer):
    """Serializer for activating a new subscription or updating existing one"""
    plan_id = serializers.IntegerField()
    
    def validate_plan_id(self, value):
        try:
            plan = SubscriptionPlan.objects.get(id=value, is_active=True)
            return value
        except SubscriptionPlan.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive subscription plan.")
    
    @transaction.atomic
    def create(self, validated_data):
        """Create Razorpay order for subscription activation or update"""
        doctor = self.context['doctor']
        plan = SubscriptionPlan.objects.get(id=validated_data['plan_id'])
        
        # Check if doctor already has subscription - handle as update instead of error
        has_existing_subscription = hasattr(doctor, 'subscription')
        
        if has_existing_subscription:
            current_subscription = doctor.subscription
            
            # If same plan and active, return error
            if current_subscription.is_active and current_subscription.plan.id == plan.id:
                raise serializers.ValidationError("You already have this subscription plan active.")
            
            # Log the subscription change
            logger.info(f"Updating existing subscription {current_subscription.id} for doctor {doctor.id}")
        else:
            current_subscription = None
        
        try:
            # Create Razorpay client
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            
            # Generate short receipt that fits within 40 characters
            timestamp = int(timezone.now().timestamp())
            receipt = generate_short_receipt("sub", doctor.id, timestamp)
            
            # Create Razorpay order
            order_data = {
                'amount': int(plan.price * 100),  # Amount in paise
                'currency': 'INR',
                'receipt': receipt,
                'notes': {
                    'doctor_id': str(doctor.id),
                    'plan_id': str(plan.id),
                    'type': 'subscription_activation' if not has_existing_subscription else 'subscription_change',
                    'timestamp': str(timestamp),
                    'previous_plan_id': str(current_subscription.plan.id) if has_existing_subscription else None
                }
            }
            
            razorpay_order = client.order.create(order_data)
            logger.info(f"Razorpay order created: {razorpay_order['id']} for doctor {doctor.id}")
            
        except razorpay.errors.BadRequestError as e:
            logger.error(f"Razorpay BadRequest error: {str(e)}")
            raise serializers.ValidationError(f"Payment gateway error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating Razorpay order: {str(e)}")
            raise serializers.ValidationError("Failed to create payment order. Please try again.")
        
        # Create or update subscription record
        if has_existing_subscription:
            # Update existing subscription
            subscription = current_subscription
            subscription.plan = plan
            subscription.start_date = timezone.now()
            subscription.end_date = None  # Will be calculated on save
            subscription.amount_paid = plan.price
            subscription.status = 'active'
            subscription.payment_status = 'pending'
            subscription.razorpay_order_id = razorpay_order['id']
            subscription.razorpay_payment_id = None
            subscription.razorpay_signature = None
            subscription.paid_at = None
            subscription.save()
        else:
            # Create new subscription record
            subscription = DoctorSubscription.objects.create(
                doctor=doctor,
                plan=plan,
                start_date=timezone.now(),
                amount_paid=plan.price,
                status='active',
                payment_status='pending',
                razorpay_order_id=razorpay_order['id']
            )
        
        return {
            'subscription': subscription,
            'razorpay_order': razorpay_order,
            'plan': plan,
            'was_update': has_existing_subscription
        }
  
class SubscriptionUpdateSerializer(serializers.Serializer):
    """Serializer for updating/upgrading subscription plan"""
    new_plan_id = serializers.IntegerField()
    
    def validate_new_plan_id(self, value):
        try:
            plan = SubscriptionPlan.objects.get(id=value, is_active=True)
            return value
        except SubscriptionPlan.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive subscription plan.")
    
    def validate(self, attrs):
        doctor = self.context['doctor']
        
        # Check if doctor has active subscription
        if not hasattr(doctor, 'subscription') or not doctor.subscription.is_active:
            raise serializers.ValidationError("No active subscription found to update.")
        
        # Check if trying to update to same plan
        if doctor.subscription.plan.id == attrs['new_plan_id']:
            raise serializers.ValidationError("Cannot update to the same plan.")
        
        return attrs
    
    def calculate_upgrade_price(self, old_plan, new_plan, remaining_days):
        """Calculate the upgrade price based on remaining subscription value"""
        if remaining_days <= 0:
            return new_plan.price
        
        # Calculate remaining value of current plan (pro-rated)
        daily_rate = old_plan.price / Decimal(str(old_plan.duration_days))
        value_remaining = daily_rate * Decimal(str(remaining_days))
        
        # Calculate upgrade price (difference between new plan and remaining value)
        upgrade_price = new_plan.price - value_remaining
        
        # Ensure upgrade price is not negative and round properly
        upgrade_price = max(Decimal('0.00'), upgrade_price)
        return upgrade_price.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    @transaction.atomic
    def create(self, validated_data):
        """Create Razorpay order for subscription update"""
        doctor = self.context['doctor']
        subscription = doctor.subscription
        old_plan = subscription.plan
        new_plan = SubscriptionPlan.objects.get(id=validated_data['new_plan_id'])
        
        # Calculate remaining days and upgrade price
        remaining_days = max(0, (subscription.end_date - timezone.now()).days)
        upgrade_price = self.calculate_upgrade_price(old_plan, new_plan, remaining_days)
        
        # If upgrade price is very small, directly update subscription
        if upgrade_price < Decimal('1.00'):
            # Update current subscription directly
            subscription.plan = new_plan
            subscription.start_date = timezone.now()
            subscription.end_date = None  # Will be calculated on save
            subscription.amount_paid = new_plan.price
            subscription.status = 'active'
            subscription.payment_status = 'completed'  # No payment required
            subscription.save()
            
            logger.info(f"Direct upgrade completed for doctor {doctor.id}: {old_plan.name} -> {new_plan.name}")
            
            return {
                'subscription': subscription,
                'upgrade_price': upgrade_price,
                'direct_upgrade': True,
                'plan': new_plan
            }
        
        try:
            # Create Razorpay order for upgrade payment
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            
            timestamp = int(timezone.now().timestamp())
            receipt = f"upg_{doctor.id}_{timestamp}"[:40]  # Ensure max 40 chars
            
            order_data = {
                'amount': int(upgrade_price * 100),  # Amount in paise
                'currency': 'INR',
                'receipt': receipt,
                'notes': {
                    'doctor_id': str(doctor.id),
                    'old_plan_id': str(old_plan.id),
                    'new_plan_id': str(new_plan.id),
                    'type': 'subscription_upgrade',
                    'upgrade_price': str(upgrade_price),
                    'remaining_days': str(remaining_days)
                }
            }
            
            razorpay_order = client.order.create(order_data)
            logger.info(f"Razorpay upgrade order created: {razorpay_order['id']} for doctor {doctor.id}")
            
        except Exception as e:
            logger.error(f"Error creating upgrade order: {str(e)}")
            raise serializers.ValidationError("Failed to create upgrade order. Please try again.")
        
        return {
            'subscription': subscription,
            'razorpay_order': razorpay_order,
            'upgrade_price': upgrade_price,
            'old_plan': old_plan,
            'new_plan': new_plan,
            'remaining_days': remaining_days,
            'direct_upgrade': False
        }


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

class CurrentSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for current subscription details"""
    plan = SubscriptionPlanSerializer(read_only=True)
    days_remaining = serializers.SerializerMethodField()
    usage_stats = serializers.SerializerMethodField()
    
    class Meta:
        model = DoctorSubscription
        fields = [
            'id', 'plan', 'status', 'payment_status',
            'start_date', 'end_date', 'days_remaining',
            'amount_paid', 'is_active', 'paid_at', 'cancelled_at',
            'usage_stats'
        ]
    
    def to_representation(self, instance):
        """Override to add debugging"""
        print(f"DEBUG: Serializing DoctorSubscription ID: {instance.id}")
        return super().to_representation(instance)
    
    def get_days_remaining(self, obj):
        """Calculate days remaining"""
        if obj.is_active and obj.end_date:
            days = (obj.end_date - timezone.now()).days
            return max(0, days)
        return 0
    
    def get_usage_stats(self, obj):
        """Get usage statistics"""
        if not obj.is_active:
            return None
        return getattr(obj.doctor, 'get_usage_stats', lambda: {})() 

class SubscriptionHistorySerializer(serializers.ModelSerializer):
    """Serializer for subscription history"""
    plan_name = serializers.CharField(source='plan.get_name_display', read_only=True)
    can_generate_invoice = serializers.SerializerMethodField()
    
    class Meta:
        model = DoctorSubscription
        fields = [
            'id', 'plan_name', 'status', 'payment_status',
            'start_date', 'end_date', 'amount_paid', 'paid_at',
            'cancelled_at', 'can_generate_invoice'
        ]
    
    def get_can_generate_invoice(self, obj):
        return obj.payment_status == 'completed'

# serializers.py
from rest_framework import serializers
from django.db.models import Sum, Avg ,Count
from django.utils import timezone
from datetime import datetime, timedelta

class RecentAppointmentSerializer(serializers.Serializer):
    """Serializer for recent appointments in dashboard"""
    id = serializers.IntegerField()
    patient_name = serializers.CharField()
    date = serializers.DateField()
    time = serializers.TimeField(allow_null=True)
    status = serializers.CharField()
    fee = serializers.DecimalField(max_digits=10, decimal_places=2)

class RecentReviewSerializer(serializers.Serializer):
    """Serializer for recent reviews in dashboard"""
    id = serializers.IntegerField()
    patient_name = serializers.CharField()
    rating = serializers.IntegerField()
    comment = serializers.CharField()
    created_at = serializers.DateTimeField()

class MonthlyRevenueSerializer(serializers.Serializer):
    """Serializer for monthly revenue trend data"""
    month = serializers.CharField()
    month_name = serializers.CharField()
    revenue = serializers.DecimalField(max_digits=10, decimal_places=2)
    debits = serializers.DecimalField(max_digits=10, decimal_places=2)
    net_earnings = serializers.DecimalField(max_digits=10, decimal_places=2)
    appointments = serializers.IntegerField()

class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    # Appointments
    total_appointments = serializers.IntegerField()
    completed_appointments = serializers.IntegerField()
    pending_appointments = serializers.IntegerField()
    cancelled_appointments = serializers.IntegerField()
    today_appointments = serializers.IntegerField()
    this_month_appointments = serializers.IntegerField()
    
    # Revenue (Legacy - keeping for backward compatibility)
    total_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)
    this_month_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)
    last_month_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)
    revenue_growth_percentage = serializers.DecimalField(max_digits=5, decimal_places=2)
    
    # New Earnings Fields
    net_earnings = serializers.DecimalField(max_digits=10, decimal_places=2)
    this_month_net_earnings = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_credits = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_credits_count = serializers.IntegerField()
    total_debits = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_debits_count = serializers.IntegerField()
    
    # Reviews
    average_rating = serializers.DecimalField(max_digits=3, decimal_places=2)
    total_reviews = serializers.IntegerField()
    
    # Other metrics
    completion_rate = serializers.DecimalField(max_digits=5, decimal_places=2)

class DoctorDashboardSerializer(serializers.Serializer):
    """Main serializer for doctor dashboard response"""
    stats = DashboardStatsSerializer()
    recent_appointments = RecentAppointmentSerializer(many=True)
    recent_reviews = RecentReviewSerializer(many=True)
    monthly_revenue_trend = MonthlyRevenueSerializer(many=True)

# Updated DashboardDataService method for monthly revenue trend
class DashboardDataService:
    """Service class to handle dashboard data calculations"""
    
    def __init__(self, doctor):
        self.doctor = doctor

    def get_filtered_appointments(self, date_from=None, date_to=None):
        """Get appointments with optional date filters"""
        appointments_qs = self.doctor.appointments.all()
        
        if date_from:
            try:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                appointments_qs = appointments_qs.filter(appointment_date__gte=date_from)
            except ValueError:
                pass
                
        if date_to:
            try:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                appointments_qs = appointments_qs.filter(appointment_date__lte=date_to)
            except ValueError:
                pass
                
        return appointments_qs

    def get_filtered_earnings(self, date_from=None, date_to=None):
        """Get earnings with optional date filters based on appointment dates"""
        earnings_qs = self.doctor.earnings.all()
        
        if date_from:
            try:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                earnings_qs = earnings_qs.filter(appointment__appointment_date__gte=date_from)
            except ValueError:
                pass
                
        if date_to:
            try:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                earnings_qs = earnings_qs.filter(appointment__appointment_date__lte=date_to)
            except ValueError:
                pass
                
        return earnings_qs

    def calculate_stats(self, appointments_qs):
        """Calculate dashboard statistics"""
        now = timezone.now()
        today = now.date()
        this_month_start = today.replace(day=1)
        last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
        
        # Appointment counts
        total_appointments = appointments_qs.count()
        completed_appointments = appointments_qs.filter(status__in=['completed', 'confirmed']).count()
        pending_appointments = appointments_qs.filter(status='pending').count()
        cancelled_appointments = appointments_qs.filter(status='cancelled').count()
        today_appointments = appointments_qs.filter(appointment_date=today).count()
        this_month_appointments = appointments_qs.filter(appointment_date__gte=this_month_start).count()
        
        # Revenue & earnings (DoctorEarning model)
        credits = self.doctor.earnings.filter(type='credit').aggregate(
            total=Sum('amount'),
            count=Count('id')
        )
        debits = self.doctor.earnings.filter(type='debit').aggregate(
            total=Sum('amount'),
            count=Count('id')
        )
        
        total_credits = credits['total'] or 0
        total_debits = debits['total'] or 0
        net_earnings = total_credits - total_debits
        
        # Monthly earnings
        this_month_credits = self.doctor.earnings.filter(
            type='credit',
            appointment__appointment_date__gte=this_month_start
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        this_month_debits = self.doctor.earnings.filter(
            type='debit',
            appointment__appointment_date__gte=this_month_start
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        this_month_net_earnings = this_month_credits - this_month_debits
        
        # Revenue growth
        this_month_revenue = this_month_credits
        last_month_revenue = self.doctor.earnings.filter(
            type='credit',
            appointment__appointment_date__gte=last_month_start,
            appointment__appointment_date__lt=this_month_start
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        revenue_growth = (
            ((this_month_revenue - last_month_revenue) / last_month_revenue) * 100
            if last_month_revenue > 0 else 0
        )
        
        # Rating & reviews
        avg_rating = self.doctor.reviews.filter(
            status='approved'
        ).aggregate(avg=Avg('rating'))['avg'] or 0
        
        total_reviews = self.doctor.reviews.filter(status='approved').count()
        
        # Completion rate
        completion_rate = (
            (completed_appointments / total_appointments * 100)
            if total_appointments > 0 else 0
        )
        
        return {
            # Appointments
            'total_appointments': total_appointments,
            'completed_appointments': completed_appointments,
            'pending_appointments': pending_appointments,
            'cancelled_appointments': cancelled_appointments,
            'today_appointments': today_appointments,
            'this_month_appointments': this_month_appointments,
            
            # Revenue (Legacy fields)
            'total_revenue': total_credits,  # For backward compatibility
            'this_month_revenue': this_month_revenue,
            'last_month_revenue': last_month_revenue,
            'revenue_growth_percentage': round(revenue_growth, 2),
            
            # New Earnings fields
            'net_earnings': net_earnings,
            'this_month_net_earnings': this_month_net_earnings,
            'total_credits': total_credits,
            'total_credits_count': credits['count'] or 0,
            'total_debits': total_debits,
            'total_debits_count': debits['count'] or 0,
            
            # Reviews
            'average_rating': round(float(avg_rating), 2) if avg_rating else 0,
            'total_reviews': total_reviews,
            
            # Other metrics
            'completion_rate': round(completion_rate, 2),
        }

    def get_recent_appointments(self, limit=5):
        """Get recent appointments data"""
        recent = self.doctor.appointments.select_related(
            'patient__user'
        ).order_by('-appointment_date', '-slot_time')[:limit]
        
        return [{
            'id': apt.id,
            'patient_name': (
                apt.patient.user.get_full_name() 
                if apt.patient.user.get_full_name() 
                else apt.patient.user.username
            ),
            'date': apt.appointment_date,
            'time': apt.slot_time,
            'status': apt.status,
            'fee': apt.total_fee
        } for apt in recent]

    def get_recent_reviews(self, limit=5):
        """Get recent reviews data"""
        recent = self.doctor.reviews.filter(
            status='approved'
        ).select_related(
            'patient__user'
        ).order_by('-created_at')[:limit]
        
        return [{
            'id': review.id,
            'patient_name': (
                review.patient.user.get_full_name() 
                if review.patient.user.get_full_name() 
                else review.patient.user.username
            ),
            'rating': review.rating,
            'comment': (
                review.description[:100] + '...' 
                if len(review.description) > 100 
                else review.description
            ),
            'created_at': review.created_at
        } for review in recent]

    def get_monthly_revenue_trend(self, months=6):
        """Get monthly revenue trend data from earnings"""
        end_date = timezone.now().date()
        start_date = end_date.replace(day=1) - timedelta(days=(months-1)*30)
        
        monthly_data = []
        current_date = start_date
        
        while current_date <= end_date:
            month_start = current_date.replace(day=1)
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            
            # Revenue from credit earnings
            revenue = self.doctor.earnings.filter(
                type='credit',
                appointment__appointment_date__gte=month_start,
                appointment__appointment_date__lt=next_month
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            # Debits for the month
            debits = self.doctor.earnings.filter(
                type='debit',
                appointment__appointment_date__gte=month_start,
                appointment__appointment_date__lt=next_month
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            # Net earnings
            net_earnings = revenue - debits
            
            # Appointments count
            appointments_count = self.doctor.appointments.filter(
                appointment_date__gte=month_start,
                appointment_date__lt=next_month
            ).count()
            
            monthly_data.append({
                'month': month_start.strftime('%Y-%m'),
                'month_name': month_start.strftime('%B %Y'),
                'revenue': revenue,
                'debits': debits,
                'net_earnings': net_earnings,
                'appointments': appointments_count
            })
            
            current_date = next_month
            
        return monthly_data

    def debug_earnings_breakdown(self):
        """Debug method to see detailed earnings breakdown"""
        now = timezone.now()
        today = now.date()
        this_month_start = today.replace(day=1)
        
        # This month's credits
        this_month_credits = self.doctor.earnings.filter(
            type='credit',
            appointment__appointment_date__gte=this_month_start
        )
        
        # This month's debits
        this_month_debits = self.doctor.earnings.filter(
            type='debit',
            appointment__appointment_date__gte=this_month_start
        )
        
        print("=== EARNINGS BREAKDOWN DEBUG ===")
        print(f"Month: {this_month_start.strftime('%B %Y')}")
        print("\n--- CREDITS (Revenue) ---")
        total_credits = 0
        for credit in this_month_credits:
            print(f"ID: {credit.id}, Amount: {credit.amount}, Date: {credit.appointment.appointment_date}, Remarks: {credit.remarks}")
            total_credits += credit.amount
        print(f"Total Credits: {total_credits}")
        
        print("\n--- DEBITS (Deductions) ---")
        total_debits = 0
        for debit in this_month_debits:
            print(f"ID: {debit.id}, Amount: {debit.amount}, Date: {debit.appointment.appointment_date}, Remarks: {debit.remarks}")
            total_debits += debit.amount
        print(f"Total Debits: {total_debits}")
        
        print(f"\n--- SUMMARY ---")
        print(f"Revenue (Credits): ₹{total_credits}")
        print(f"Deductions (Debits): ₹{total_debits}")
        print(f"Net Earnings: ₹{total_credits - total_debits}")
        
        return {
            'credits': total_credits,
            'debits': total_debits,
            'net_earnings': total_credits - total_debits,
            'credit_details': list(this_month_credits.values('id', 'amount', 'remarks', 'appointment__appointment_date')),
            'debit_details': list(this_month_debits.values('id', 'amount', 'remarks', 'appointment__appointment_date'))
        }


class DoctorReportPDFService:
    """Service class to generate PDF reports for doctor dashboard"""
    
    def __init__(self, doctor, start_date=None, end_date=None):
        self.doctor = doctor
        self.start_date = self._parse_date(start_date) if start_date else None
        self.end_date = self._parse_date(end_date) if end_date else None
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        # Calculate available width for tables
        self.doc_width = A4[0] - 100  # Subtracting left and right margins
    
    def _parse_date(self, date_string):
        """Parse date string to date object"""
        try:
            return datetime.strptime(date_string, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return None
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        # Only add styles that don't already exist
        style_names = [style.name for style in self.styles.byName.values()]
        
        if 'CustomTitle' not in style_names:
            self.styles.add(ParagraphStyle(
                name='CustomTitle',
                parent=self.styles['Heading1'],
                fontSize=16,
                spaceAfter=20,
                alignment=TA_CENTER,
                textColor=colors.darkblue,
                fontName='Helvetica-Bold'
            ))
        
        if 'SectionHeader' not in style_names:
            self.styles.add(ParagraphStyle(
                name='SectionHeader',
                parent=self.styles['Heading2'],
                fontSize=12,
                spaceAfter=10,
                spaceBefore=15,
                textColor=colors.darkblue,
                leftIndent=0,
                fontName='Helvetica-Bold'
            ))
        
        if 'CustomNormal' not in style_names:
            self.styles.add(ParagraphStyle(
                name='CustomNormal',
                parent=self.styles['Normal'],
                fontSize=9,
                spaceAfter=4,
                fontName='Helvetica'
            ))
        
        if 'TableText' not in style_names:
            self.styles.add(ParagraphStyle(
                name='TableText',
                parent=self.styles['Normal'],
                fontSize=8,
                fontName='Helvetica'
            ))
    
    def _get_filtered_appointments(self):
        """Get appointments within date range"""
        appointments_qs = self.doctor.appointments.all()
        
        if self.start_date:
            appointments_qs = appointments_qs.filter(appointment_date__gte=self.start_date)
        
        if self.end_date:
            appointments_qs = appointments_qs.filter(appointment_date__lte=self.end_date)
        
        return appointments_qs.select_related('patient__user')
    
    def _get_filtered_earnings(self):
        """Get earnings within date range"""
        earnings_qs = self.doctor.earnings.all()
        
        if self.start_date:
            earnings_qs = earnings_qs.filter(appointment__appointment_date__gte=self.start_date)
        
        if self.end_date:
            earnings_qs = earnings_qs.filter(appointment__appointment_date__lte=self.end_date)
        
        return earnings_qs.select_related('appointment__patient__user')
    
    def _calculate_stats(self, appointments_qs, earnings_qs):
        """Calculate report statistics"""
        # Appointment stats
        total_appointments = appointments_qs.count()
        completed_appointments = appointments_qs.filter(status__in=['completed', 'confirmed']).count()
        pending_appointments = appointments_qs.filter(status='pending').count()
        cancelled_appointments = appointments_qs.filter(status='cancelled').count()
        
        # Earnings stats
        credits = earnings_qs.filter(type='credit').aggregate(
            total=Sum('amount'),
            count=Count('id')
        )
        debits = earnings_qs.filter(type='debit').aggregate(
            total=Sum('amount'),
            count=Count('id')
        )
        
        total_credits = credits['total'] or 0
        total_debits = debits['total'] or 0
        net_earnings = total_credits - total_debits
        
        return {
            'appointments': {
                'total': total_appointments,
                'completed': completed_appointments,
                'pending': pending_appointments,
                'cancelled': cancelled_appointments
            },
            'earnings': {
                'total_credits': total_credits,
                'total_debits': total_debits,
                'net_earnings': net_earnings,
                'credits_count': credits['count'] or 0,
                'debits_count': debits['count'] or 0
            }
        }
    
    def _format_currency(self, amount):
        """Format currency with Rupee symbol - using Rs for better PDF compatibility"""
        if amount is None:
            return "Rs. 0.00"
        try:
            # Convert to float first to handle any string or decimal types
            amount_float = float(amount)
            return f"Rs. {amount_float:,.2f}"
        except (ValueError, TypeError):
            return "Rs. 0.00"
    
    def _format_date(self, date_obj):
        """Format date to DD-MM-YYYY"""
        if not date_obj:
            return "N/A"
        return date_obj.strftime("%d-%m-%Y")
    
    def _format_time(self, time_obj):
        """Format time to HH:MM"""
        if not time_obj:
            return "N/A"
        return time_obj.strftime("%H:%M")
    
    def _create_header_footer(self, canvas, doc):
        """Create header and footer for each page with fixed positioning"""
        canvas.saveState()
        
        # Get page dimensions
        page_width, page_height = A4
        
        # Header - Fixed positioning from top of page
        header_y_start = page_height - 40  # Start 40 points from top
        
        canvas.setFont('Helvetica-Bold', 14)
        canvas.setFillColor(colors.darkblue)
        
        # Get doctor's full name and handle long names
        doctor_name = self.doctor.user.get_full_name()
        if len(doctor_name) > 30:
            doctor_name = doctor_name[:27] + "..."
        canvas.drawString(50, header_y_start, f"Dr. {doctor_name}")
        
        canvas.setFont('Helvetica', 9)
        canvas.setFillColor(colors.black)
        canvas.drawString(50, header_y_start - 15, f"Specialization: {getattr(self.doctor, 'specialization', 'Not specified')}")
        
        # Handle long email addresses
        email = self.doctor.user.email
        if len(email) > 40:
            email = email[:37] + "..."
        canvas.drawString(50, header_y_start - 28, f"Email: {email}")
        
        # Header line
        canvas.setStrokeColor(colors.darkblue)
        canvas.setLineWidth(1)
        canvas.line(50, header_y_start - 38, page_width - 50, header_y_start - 38)
        
        # Footer - Fixed positioning from bottom of page
        footer_y_start = 50  # Start 50 points from bottom
        
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(50, footer_y_start - 5, f"Generated on: {timezone.now().strftime('%d-%m-%Y %H:%M')}")
        canvas.drawRightString(page_width - 50, footer_y_start - 5, f"Page {canvas.getPageNumber()}")
        
        # Footer line
        canvas.setStrokeColor(colors.grey)
        canvas.setLineWidth(0.5)
        canvas.line(50, footer_y_start + 10, page_width - 50, footer_y_start + 10)
        
        canvas.restoreState()
    
    def _create_appointments_table(self, appointments):
        """Create appointments table with better formatting"""
        if not appointments:
            return [Paragraph("No appointments found in the specified date range.", self.styles['CustomNormal'])]
        
        # Table headers
        headers = ['Date', 'Patient', 'Time', 'Status', 'Fee']
        data = [headers]
        
        # Table data
        for apt in appointments:
            patient_name = (
                apt.patient.user.get_full_name() 
                if apt.patient.user.get_full_name() 
                else apt.patient.user.username
            )
            # Truncate long names
            if len(patient_name) > 18:
                patient_name = patient_name[:15] + "..."
            
            data.append([
                self._format_date(apt.appointment_date),
                patient_name,
                self._format_time(apt.slot_time),
                apt.status.title(),
                self._format_currency(apt.total_fee)
            ])
        
        # Calculate column widths to fit page - optimized for better layout
        col_widths = [
            self.doc_width * 0.18,  # Date
            self.doc_width * 0.32,  # Patient - increased width
            self.doc_width * 0.15,  # Time
            self.doc_width * 0.18,  # Status
            self.doc_width * 0.17   # Fee
        ]
        
        # Create table
        table = Table(data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            # Body styling
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#f8f9fa')]),
            # Prevent awkward breaks
            ('KEEPWITHIN', (0, 0), (-1, -1), 1)
        ]))
        
        # Force manual table splitting for ANY table with more than 5 data rows
        if len(data) > 6:  # More than 5 data rows (plus header)
            tables = []
            chunk_size = 5  # Only 5 data rows per chunk to ensure it fits on one page
            first_chunk = True
            
            for i in range(1, len(data), chunk_size):
                chunk_data = [headers] + data[i:i+chunk_size]
                chunk_table = Table(chunk_data, colWidths=col_widths, repeatRows=1)
                chunk_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#f8f9fa')])
                ]))
                
                if not first_chunk:
                    tables.append(PageBreak())
                    tables.append(Paragraph("Appointments Details - Continued", self.styles['SectionHeader']))
                
                tables.append(chunk_table)
                tables.append(Spacer(1, 10))
                first_chunk = False
            
            return tables
        
        return [table]
    
    def _create_earnings_tables(self, earnings):
        """Create earnings tables (credits and debits) with better formatting"""
        tables = []
        
        # Credits table
        credits = earnings.filter(type='credit')
        if credits.exists():
            tables.append(Paragraph("Credits (Revenue)", self.styles['SectionHeader']))
            
            headers = ['Date', 'Patient', 'Amount', 'Remarks']
            data = [headers]
            
            for earning in credits:
                patient_name = (
                    earning.appointment.patient.user.get_full_name() 
                    if earning.appointment.patient.user.get_full_name() 
                    else earning.appointment.patient.user.username
                )
                if len(patient_name) > 20:
                    patient_name = patient_name[:17] + "..."
                
                remarks = earning.remarks or 'Payment received'
                if len(remarks) > 40:
                    remarks = remarks[:37] + "..."
                
                data.append([
                    self._format_date(earning.appointment.appointment_date),
                    patient_name,
                    self._format_currency(earning.amount),
                    remarks
                ])
            
            col_widths = [
                self.doc_width * 0.18,  # Date
                self.doc_width * 0.22,  # Patient
                self.doc_width * 0.18,  # Amount
                self.doc_width * 0.42   # Remarks - increased width
            ]
            
            # Always split tables manually - even small ones for consistency
            chunk_size = 5  # 5 data rows per chunk to ensure it fits on one page
            first_chunk = True
            
            for i in range(1, len(data), chunk_size):
                chunk_data = [headers] + data[i:i+chunk_size]
                chunk_table = Table(chunk_data, colWidths=col_widths, repeatRows=1)
                chunk_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.green),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#f0f8f0')])
                ]))
                
                if not first_chunk:
                    tables.append(PageBreak())
                    tables.append(Paragraph("Credits (Revenue) - Continued", self.styles['SectionHeader']))
                
                tables.append(chunk_table)
                tables.append(Spacer(1, 10))
                first_chunk = False
            
            tables.append(Spacer(1, 15))
        
        # Debits table
        debits = earnings.filter(type='debit')
        if debits.exists():
            tables.append(Paragraph("Debits (Deductions)", self.styles['SectionHeader']))
            
            headers = ['Date', 'Patient', 'Amount', 'Reason']
            data = [headers]
            
            for earning in debits:
                patient_name = (
                    earning.appointment.patient.user.get_full_name() 
                    if earning.appointment.patient.user.get_full_name() 
                    else earning.appointment.patient.user.username
                )
                if len(patient_name) > 20:
                    patient_name = patient_name[:17] + "..."
                
                reason = earning.remarks or 'Deduction'
                if len(reason) > 40:
                    reason = reason[:37] + "..."
                
                data.append([
                    self._format_date(earning.appointment.appointment_date),
                    patient_name,
                    self._format_currency(earning.amount),
                    reason
                ])
            
            col_widths = [
                self.doc_width * 0.18,  # Date
                self.doc_width * 0.22,  # Patient
                self.doc_width * 0.18,  # Amount
                self.doc_width * 0.42   # Reason - increased width
            ]
            
            # Always split tables manually - even small ones for consistency
            chunk_size = 5  # 5 data rows per chunk to ensure it fits on one page
            first_chunk = True
            
            for i in range(1, len(data), chunk_size):
                chunk_data = [headers] + data[i:i+chunk_size]
                chunk_table = Table(chunk_data, colWidths=col_widths, repeatRows=1)
                chunk_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.red),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#fff0f0')])
                ]))
                
                if not first_chunk:
                    tables.append(PageBreak())
                    tables.append(Paragraph("Debits (Deductions) - Continued", self.styles['SectionHeader']))
                
                tables.append(chunk_table)
                tables.append(Spacer(1, 10))
                first_chunk = False
        
        return tables
    
    def generate_pdf(self):
        """Generate the complete PDF report"""
        buffer = io.BytesIO()
        
        # Create document with better margins - increased top margin to avoid header overlap
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=50,
            leftMargin=50,
            topMargin=120,  # Increased from 90 to 120 to accommodate header
            bottomMargin=80   # Increased from 60 to 80 to accommodate footer
        )
        
        # Get data
        appointments = self._get_filtered_appointments()
        earnings = self._get_filtered_earnings()
        stats = self._calculate_stats(appointments, earnings)
        
        # Build document content
        story = []
        
        # Title
        date_range = ""
        if self.start_date and self.end_date:
            date_range = f" ({self._format_date(self.start_date)} to {self._format_date(self.end_date)})"
        elif self.start_date:
            date_range = f" (From {self._format_date(self.start_date)})"
        elif self.end_date:
            date_range = f" (Until {self._format_date(self.end_date)})"
        
        story.append(Paragraph(f"Doctor Dashboard Report{date_range}", self.styles['CustomTitle']))
        story.append(Spacer(1, 20))
        
        # Summary section
        story.append(Paragraph("Summary", self.styles['SectionHeader']))
        
        summary_data = [
            ['Metric', 'Count/Amount'],
            ['Total Appointments', str(stats['appointments']['total'])],
            ['Completed Appointments', str(stats['appointments']['completed'])],
            ['Pending Appointments', str(stats['appointments']['pending'])],
            ['Cancelled Appointments', str(stats['appointments']['cancelled'])],
            ['Total Credits', self._format_currency(stats['earnings']['total_credits'])],
            ['Total Debits', self._format_currency(stats['earnings']['total_debits'])],
            ['Net Earnings', self._format_currency(stats['earnings']['net_earnings'])]
        ]
        
        summary_table = Table(summary_data, colWidths=[self.doc_width * 0.6, self.doc_width * 0.4])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#f8f9fa')])
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 20))
        
        # Appointments section
        story.append(Paragraph("Appointments Details", self.styles['SectionHeader']))
        appointments_table = self._create_appointments_table(appointments.order_by('-appointment_date'))
        story.extend(appointments_table)
        story.append(Spacer(1, 20))
        
        # Earnings section
        story.append(Paragraph("Earnings Details", self.styles['SectionHeader']))
        earnings_tables = self._create_earnings_tables(earnings.order_by('-appointment__appointment_date'))
        story.extend(earnings_tables)
        
        # Build PDF
        doc.build(story, onFirstPage=self._create_header_footer, onLaterPages=self._create_header_footer)
        
        buffer.seek(0)
        return buffer