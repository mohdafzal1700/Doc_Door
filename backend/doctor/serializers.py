from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from .models import User, Doctor, DoctorEducation, DoctorCertification, DoctorProof
from datetime import datetime,date,timezone
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from rest_framework import serializers
import logging

import logging
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate

logger = logging.getLogger(__name__)

class CustomDoctorTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remove username field and use email
        if 'username' in self.fields:
            del self.fields['username']
        
        # Add email field explicitly
        self.fields['email'] = serializers.EmailField()
        # Optional: Add userType field if needed for frontend
        self.fields['userType'] = serializers.CharField(required=False)

    def validate(self, attrs):
        try:
            email = attrs.get('email')
            password = attrs.get('password')
            
            logger.info(f"Doctor login validation for email: {email}")
            
            if not email or not password:
                raise AuthenticationFailed('Email and password are required')
            
            # Explicit authentication call
            user = authenticate(
                request=self.context.get('request'), 
                username=email, 
                password=password
            )
            
            if not user:
                logger.warning(f"Authentication failed for email: {email}")
                raise AuthenticationFailed('Invalid email or password')
            
            # Role-based access control - use safe attribute access
            user_role = getattr(user, 'role', None)
            if user_role != 'doctor':
                logger.warning(f"Non-doctor login attempt: {email} (role: {user_role})")
                raise AuthenticationFailed(
                    f'This login is only for doctors. Your account is registered as {user_role or "unknown"}.'
                )
            
            # Account status checks
            if not user.is_active:
                logger.warning(f"Inactive user login attempt: {email}")
                raise AuthenticationFailed(
                    'Your account is not active. Please verify your email.'
                )
            
            # Check if user is blocked (if you have this field)
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
            # Re-raise authentication failed exceptions
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
                # Safe access to doctor profile
                if hasattr(self.user, 'doctor_profile'):
                    doctor_profile = self.user.doctor_profile
                elif hasattr(self.user, 'doctorprofile'):  # Alternative naming
                    doctor_profile = self.user.doctorprofile
            except Exception as profile_error:
                logger.warning(f"Could not access doctor profile for {self.user.email}: {str(profile_error)}")
                doctor_profile = None
            
            # Build doctor profile data safely
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
            
            # Add user data to response - ENSURE ALL UUIDs ARE CONVERTED TO STRINGS
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
        choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')], 
        required=False, allow_null=True, write_only=True
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
            'doctor_first_name', 'doctor_last_name', 'doctor_specialization', 
            'doctor_experience', 'doctor_bio', 'doctor_license_number',
            'doctor_consultation_fee', 'doctor_consultation_mode_online',
            'doctor_consultation_mode_offline', 'doctor_clinic_name', 
            'doctor_location', 'doctor_is_available', 'doctor_verification_status',
            'profile_picture_url', 'has_profile_picture', 'profile_completed',
        ]
        read_only_fields = ['id', 'role', 'is_active']

    # === Computed Field Methods ===

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

    def get_has_profile_picture(self, obj):
        doctor = getattr(obj, "doctor_profile", None)
        return bool(doctor and doctor.profile_picture)

    def get_profile_completed(self, obj):
        doctor = getattr(obj, "doctor_profile", None)
        return getattr(doctor, "is_profile_setup_done", False) if doctor else False

    # === Validation Methods ===

    def validate_email(self, value):
        user = self.instance
        if user and User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate_phone_number(self, value):
        if value:
            import re
            phone_pattern = re.compile(r'^\+?1?\d{9,15}$')
            cleaned = re.sub(r'[\s\-\(\)]', '', value)
            if not phone_pattern.match(cleaned):
                raise serializers.ValidationError("Invalid phone number format. Use format: +1234567890")
        return value

    def validate_years_of_experience(self, value):
        if value is not None and (value < 0 or value > 50):
            raise serializers.ValidationError("Years of experience must be between 0 and 50.")
        return value

    def validate_consultation_fee(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Consultation fee cannot be negative.")
        return value

    def validate(self, data):
        # Validate that at least one consultation mode is selected if provided
        consultation_online = data.get('consultation_mode_online')
        consultation_offline = data.get('consultation_mode_offline')
        
        if consultation_online is not None or consultation_offline is not None:
            if not consultation_online and not consultation_offline:
                raise serializers.ValidationError("At least one consultation mode must be selected")
        
        return data

    # === Update Logic ===

    def update(self, instance, validated_data):
        from django.utils import timezone
        
        print(f"🔍 DEBUG: Received validated_data keys: {list(validated_data.keys())}")
        
        # Extract and separate doctor data
        doctor_data = {}
        user_fields = ['first_name', 'last_name']
        doctor_fields = [
            'department', 'years_of_experience', 'profile_image', 
            'consultation_mode_online', 'consultation_mode_offline',
            'clinic_name', 'location', 'license_number', 'consultation_fee',
            'date_of_birth', 'gender'
        ]
        print(f"🔍 DEBUG: Looking for doctor_fields: {doctor_fields}")
        
        # Extract user fields
        for field in user_fields:
            if field in validated_data:
                doctor_data[field] = validated_data.pop(field)
        
        # Extract doctor fields and map them correctly
        for field in doctor_fields:
            if field in validated_data:
                value = validated_data.pop(field)
                # Add this debug line:
                print(f"🔍 DEBUG: Processing field '{field}' with value: {value} (type: {type(value)})")
                
                if field == 'department':
                    doctor_data['specialization'] = value
                elif field == 'years_of_experience':
                    doctor_data['experience'] = value
                    print(f"🔍 DEBUG: Mapped years_of_experience={value} to experience")
                elif field == 'profile_image':
                    doctor_data['profile_picture'] = value
                else:
                    doctor_data[field] = value

        # Remove sensitive or restricted fields
        restricted_fields = ['password', 'is_staff', 'is_superuser', 'is_active', 'role', 'date_joined', 'last_login']
        for field in restricted_fields:
            validated_data.pop(field, None)

        # Update user fields
        user_updated = False
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            user_updated = True
            print(f"👤 DEBUG: Updated user.{attr} = {value}")
        
        
        # Update user first_name and last_name if provided in doctor_data
        for field in ['first_name', 'last_name']:
            if field in doctor_data:
                setattr(instance, field, doctor_data.pop(field))
                user_updated = True
                print(f"👤 DEBUG: Updated user.{field} from doctor_data")
        
        if user_updated:
            instance.save()
            print("💾 DEBUG: User model saved")

        # Update or create doctor profile (only for doctors)
        if instance.role == 'doctor' and doctor_data:
            print(f"🩺 DEBUG: Updating doctor profile with data: {doctor_data}")
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
                    }
                )
                
                # Update doctor profile fields
                for attr, value in doctor_data.items():
                    old_value = getattr(doctor_profile, attr, 'NOT_FOUND')
                    setattr(doctor_profile, attr, value)
                    print(f"🔄 DEBUG: doctor.{attr}: {old_value} -> {value}")
                
                doctor_profile.updated_at = timezone.now()
                doctor_profile.save()
                print("💾 DEBUG: Doctor profile saved")
                
                # Check if profile is complete and update accordingly
                if self._is_profile_complete(doctor_profile):
                    doctor_profile.is_profile_setup_done = True
                    doctor_profile.save()
                    print("✅ DEBUG: Profile marked as complete")
                else:
                    print("❌ DEBUG: Profile still incomplete")
                    
            except Exception as e:
                print(f"❌ DEBUG: Error updating doctor profile: {str(e)}")
                raise serializers.ValidationError(f"Error updating doctor profile: {str(e)}")
        else:
            print(f"⚠️ DEBUG: Not updating doctor profile. Role: {instance.role}, doctor_data: {bool(doctor_data)}")

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
    
class DoctorEducationSerializer(serializers.ModelSerializer):
    # User fields for education context
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
            'certificate_id',
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
        # Update education completion status - FIXED: call the correct method
        if hasattr(instance, 'doctor'):
            instance.doctor.check_education_completion()
            # Also trigger overall verification check
            instance.doctor.check_verification_completion()
        return instance
    
    def update(self, instance, validated_data):
        """Override update to check completion status"""
        instance = super().update(instance, validated_data)
        # Update education completion status - FIXED: call the correct method
        if hasattr(instance, 'doctor'):
            instance.doctor.check_education_completion()
            # Also trigger overall verification check
            instance.doctor.check_verification_completion()
        return instance

class DoctorCertificationSerializer(serializers.ModelSerializer):
    # User fields for certification context
    first_name = serializers.CharField(source='doctor.user.first_name', read_only=True)
    last_name = serializers.CharField(source='doctor.user.last_name', read_only=True)
    phone_number = serializers.CharField(source='doctor.user.phone_number', read_only=True)
    email = serializers.EmailField(source='doctor.user.email', read_only=True)
    is_active = serializers.BooleanField(source='doctor.user.is_active', read_only=True)
    role = serializers.CharField(source='doctor.user.role', read_only=True)
    
    class Meta:
        model = DoctorCertification
        fields = [
            'id', 'certification_name', 'issued_by', 'year_of_issue',
            'certificate_id', 'certificate_image',
            # User fields (read-only for context)
            'first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role'
        ]
        read_only_fields = ['id', 'first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role']
    
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
            instance.doctor.check_profile_completion()
        return instance
    
    def update(self, instance, validated_data):
        """Override update to check completion status"""
        instance = super().update(instance, validated_data)
        if hasattr(instance, 'doctor'):
            instance.doctor.check_profile_completion()
        return instance


class DoctorProofSerializer(serializers.ModelSerializer):
    # User fields for proof context
    first_name = serializers.CharField(source='doctor.user.first_name', read_only=True)
    last_name = serializers.CharField(source='doctor.user.last_name', read_only=True)
    phone_number = serializers.CharField(source='doctor.user.phone_number', read_only=True)
    email = serializers.EmailField(source='doctor.user.email', read_only=True)
    is_active = serializers.BooleanField(source='doctor.user.is_active', read_only=True)
    role = serializers.CharField(source='doctor.user.role', read_only=True)
    
    class Meta:
        model = DoctorProof
        fields = [
            'medical_license_number', 'license_doc_id',
            'license_proof_image', 'id_proof',
            # User fields (read-only for context)
            'first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role'
        ]
        read_only_fields = ['first_name', 'last_name', 'phone_number', 'email', 'is_active', 'role']
    
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
    # Profile completion status
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


# Comprehensive Doctor Profile Serializer (includes everything)
class CompleteDoctorProfileSerializer(serializers.ModelSerializer):
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