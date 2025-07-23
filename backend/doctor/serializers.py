from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from .models import User, Doctor, DoctorEducation, DoctorCertification, DoctorProof,Service,Schedules,DoctorLocation
from datetime import datetime, timedelta
from django.utils import timezone
from datetime import datetime,date
import hashlib
import logging
import razorpay
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from rest_framework import serializers
import logging
from django.db import transaction
from doctor.models  import SubscriptionPlan,DoctorSubscription,SubscriptionUpgrade
from adminside.serializers import SubscriptionPlanSerializer
from django.conf import settings
import razorpay
from decimal import Decimal, ROUND_HALF_UP


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
            print("DEBUG: User model saved")

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
                        'gender': None,
                        'date_of_birth': None,
                        'verification_status': 'incomplete',
                    }
                )
                
                # Update doctor profile fields
                for attr, value in doctor_data.items():
                    old_value = getattr(doctor_profile, attr, 'NOT_FOUND')
                    setattr(doctor_profile, attr, value)
                    print(f"🔄 DEBUG: doctor.{attr}: {old_value} -> {value}")
                
                doctor_profile.updated_at = timezone.now()
                doctor_profile.save()
                print("DEBUG: Doctor profile saved")
                
                # Check if profile is complete and update accordingly
                if self._is_profile_complete(doctor_profile):
                    doctor_profile.is_profile_setup_done = True
                    doctor_profile.save()
                    print("DEBUG: Profile marked as complete")
                else:
                    print("DEBUG: Profile still incomplete")
                    
            except Exception as e:
                print(f"DEBUG: Error updating doctor profile: {str(e)}")
                raise serializers.ValidationError(f"Error updating doctor profile: {str(e)}")
        else:
            print(f"DEBUG: Not updating doctor profile. Role: {instance.role}, doctor_data: {bool(doctor_data)}")

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
    # User fields for proof context
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
        
        
class doctorStatusSerializer(serializers.Serializer):
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


    def update(self, instance, validated_data):
        action = validated_data.get('action')  # 'approve' or 'reject'
        admin_comments = validated_data.get('admin_comments', '')
        
        # Get the doctor profile
        doctor_profile = instance.doctor_profile
        
        if action == 'approve':
            doctor_profile.verification_status = 'approved'
        elif action == 'reject':
            doctor_profile.verification_status = 'rejected'
            # You might want to store rejection reason
            doctor_profile.rejection_reason = admin_comments
        
        doctor_profile.save()
        
        # Update user's is_active status if needed
        if action == 'approve':
            instance.is_active = True
            instance.save(update_fields=['is_active'])
        
        return instance

class DoctorApplicationDetailSerializer(serializers.ModelSerializer):
    """Complete doctor application details using your existing serializers"""
    
    # 1. DOCTOR PROFILE - Reuse your existing DoctorProfileSerializer logic
    doctor_profile = serializers.SerializerMethodField()
    
    # 2. EDUCATION - Reuse your existing DoctorEducationSerializer
    doctor_educations = serializers.SerializerMethodField()
    
    # 3. CERTIFICATIONS - Reuse your existing DoctorCertificationSerializer  
    doctor_certifications = serializers.SerializerMethodField()
    
    # 4. LICENSE/PROOF - Reuse your existing DoctorProofSerializer
    doctor_proof = serializers.SerializerMethodField()
    
    # Verification status summary
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
        from django.utils import timezone
        
        # Get the doctor profile
        doctor = instance.doctor_profile
        action = validated_data['action']
        admin_comment = validated_data.get('admin_comment', '')
        
        # Update verification status
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
        
        # Log the action
        print(f" APPROVAL ACTION: {action.upper()} for Doctor {doctor.id}")
        print(f"Admin Comment: {admin_comment}")
        
        return instance
    
class ServiceSerializer(serializers.ModelSerializer):
    """Serializer for Service model"""
    total_fee = serializers.SerializerMethodField()
    
    class Meta:
        model = Service
        fields = [
            'id', 'service_name', 'service_mode', 'service_fee', 
            'description', 'is_active', 'created_at', 'updated_at','total_fee'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at','total_fee']

    def validate_service_name(self, value):
        """Validate service name"""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError("Service name must be at least 2 characters long.")
        return value.strip()

    def validate_service_fee(self, value):
        """Validate service fee"""
        if value < 0:
            raise serializers.ValidationError("Service fee cannot be negative.")
        return value

    def validate_description(self, value):
        """Validate description"""
        if not value or len(value.strip()) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters long.")
        return value.strip()

    def validate_service_mode(self, value):
        """Validate service mode"""
        valid_modes = ['online', 'offline']
        if value not in valid_modes:
            raise serializers.ValidationError(f"Service mode must be one of {valid_modes}")
        return value
    
    def get_total_fee(self, obj):
        """Calculate total fee (service fee + doctor consultation fee)"""
        doctor_fee = obj.doctor.consultation_fee or 0
        service_fee = obj.service_fee or 0
        return float(doctor_fee) + float(service_fee)

    def validate(self, data):
        """Add subscription validation to service creation"""
        logger.debug("Starting service validation")
        logger.debug(f"Input data: {data}")
        
        # Get the doctor from the request context (set during view processing)
        request = self.context.get('request')
        logger.debug(f"Request object: {request}")
        logger.debug(f"Request user: {getattr(request, 'user', None) if request else None}")
        
        if request and hasattr(request.user, 'doctor_profile'):
            doctor = request.user.doctor_profile
            logger.debug(f"Doctor profile found: {doctor}")
            logger.debug(f"Doctor ID: {getattr(doctor, 'id', None)}")
            
            service_mode = data.get('service_mode', 'online')
            logger.debug(f"Service mode: {service_mode}")
            
            # Check if doctor can create this type of service
            can_create = doctor.can_create_service(service_mode)
            logger.debug(f"Can create service ({service_mode}): {can_create}")
            
            if not can_create:
                current_plan = doctor.get_current_plan()
                logger.debug(f"Current plan: {current_plan}")
                
                if not current_plan:
                    logger.warning(f"No active subscription for doctor {doctor.id}")
                    raise serializers.ValidationError({
                        'subscription': 'Active subscription required to create services.',
                        'redirect_to': 'subscription_plans'
                    })
                else:
                    usage_stats = doctor.get_usage_stats()
                    logger.warning(f"Service limit reached for doctor {doctor.id}")
                    logger.debug(f"Usage stats: {usage_stats}")
                    logger.debug(f"Plan details: {current_plan}")
                    
                    raise serializers.ValidationError({
                        'service_limit': f'Cannot create {service_mode} service. Plan limit reached.',
                        'current_usage': usage_stats,
                        'redirect_to': 'subscription_upgrade'
                    })
        else:
            logger.warning("No doctor profile found in request context")
            logger.debug(f"Request exists: {request is not None}")
            if request:
                logger.debug(f"User authenticated: {getattr(request.user, 'is_authenticated', False)}")
                logger.debug(f"User has doctor_profile attr: {hasattr(request.user, 'doctor_profile')}")
        
        logger.debug("Validation completed successfully")
        return data


class SchedulesSerializer(serializers.ModelSerializer):
    """Serializer for Schedules model with doctor and service details"""
    
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
    
    class Meta:
        model = Schedules
        fields = [
            'id', 'doctor', 'service', 'mode', 'date', 'start_time', 'end_time',
            'slot_duration', 'break_start_time', 'break_end_time', 'total_slots',
            'booked_slots', 'max_patients_per_slot', 'is_active', 'created_at', 'updated_at',
            # Doctor fields (read-only for context)
            'doctor_first_name', 'doctor_last_name', 'doctor_phone', 'doctor_email', 'doctor_name',
            # Service fields (read-only for context)
            'service_name', 'service_mode', 'service_fee', 'service_description', 'available_services',
            # Calculated fields
            'available_slots', 'is_fully_booked', 'working_hours', 'break_duration'
        ]
        read_only_fields = [
            'id', 'doctor', 'created_at', 'updated_at', 'doctor_first_name', 'doctor_last_name',
            'doctor_phone', 'doctor_email', 'doctor_name', 'service_name', 'service_mode',
            'service_fee', 'service_description', 'available_slots', 'is_fully_booked',
            'working_hours', 'break_duration', 'available_services', 
        ]

    def get_doctor_name(self, obj):
        """Get full doctor name"""
        if obj.doctor and obj.doctor.user:
            return f"{obj.doctor.user.first_name} {obj.doctor.user.last_name}".strip()
        return None
    
    def get_available_services(self, obj):
        """Get all services available to this doctor"""
        if obj.doctor:
            services = obj.doctor.service_set.filter(is_active=True)
            return ServiceSerializer(services, many=True).data
        return []

    def get_available_slots(self, obj):
        """Get available slots"""
        return obj.get_available_slots()

    def get_is_fully_booked(self, obj):
        """Check if schedule is fully booked"""
        return obj.is_fully_booked()

    def get_working_hours(self, obj):
        """Get working hours"""
        return obj.get_working_hours()

    def get_break_duration(self, obj):
        """Get break duration in minutes"""
        return obj.get_break_duration()

    def validate_date(self, value):
        """Validate date is not in the past"""
        if value < timezone.now().date():
            raise serializers.ValidationError("Schedule date cannot be in the past.")
        return value

    def validate_slot_duration(self, value):
        """Validate slot duration"""
        if value <= timedelta(0):
            raise serializers.ValidationError("Slot duration must be positive.")
        return value

    def validate_max_patients_per_slot(self, value):
        """Validate max patients per slot"""
        if value <= 0:
            raise serializers.ValidationError("Maximum patients per slot must be at least 1.")
        return value

    def validate_booked_slots(self, value):
        """Validate booked slots"""
        if value < 0:
            raise serializers.ValidationError("Booked slots cannot be negative.")
        return value

    def validate_total_slots(self, value):
        """Validate total slots"""
        if value < 0:
            raise serializers.ValidationError("Total slots cannot be negative.")
        return value

    def validate(self, data):
        """Cross-field validation"""
        errors = {}
        
        # Validate basic time logic
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        if start_time and end_time:
            if start_time >= end_time:
                errors['end_time'] = "End time must be after start time."
        
        # Validate break times
        break_start_time = data.get('break_start_time')
        break_end_time = data.get('break_end_time')
        
        if break_start_time and break_end_time:
            # Break end must be after break start
            if break_start_time >= break_end_time:
                errors['break_end_time'] = "Break end time must be after break start time."
            
            # Break must be within schedule time
            if start_time and end_time:
                if break_start_time < start_time:
                    errors['break_start_time'] = "Break start time must be within schedule hours."
                if break_end_time > end_time:
                    errors['break_end_time'] = "Break end time must be within schedule hours."
        
        # Validate if only one break time is provided
        if bool(break_start_time) != bool(break_end_time):
            if not break_start_time:
                errors['break_start_time'] = "Break start time is required when break end time is provided."
            if not break_end_time:
                errors['break_end_time'] = "Break end time is required when break start time is provided."
        
        # Validate booked slots don't exceed total slots
        booked_slots = data.get('booked_slots', 0)
        total_slots = data.get('total_slots', 0)
        
        if booked_slots > total_slots:
            errors['booked_slots'] = "Booked slots cannot exceed total slots."
        
        # Validate service mode matches schedule mode (if both are provided)
        service = data.get('service')
        mode = data.get('mode')
        
        request = self.context.get('request')
        if request and hasattr(request.user, 'doctor_profile'):
            doctor = request.user.doctor_profile
            schedule_date = data.get('date')
            
            # Check if doctor can create schedule
            if not doctor.can_create_schedule(schedule_date):
                plan = doctor.get_current_plan()
                if not plan:
                    errors['subscription'] = 'Active subscription required to create schedules.'
                else:
                    usage_stats = doctor.get_usage_stats()
                    if usage_stats['daily_schedules']['used'] >= usage_stats['daily_schedules']['limit']:
                        errors['schedule_limit'] = 'Daily schedule limit reached for your plan.'
                    elif usage_stats['monthly_schedules']['used'] >= usage_stats['monthly_schedules']['limit']:
                        errors['schedule_limit'] = 'Monthly schedule limit reached for your plan.'
                    
                    errors['current_usage'] = usage_stats
                    errors['redirect_to'] = 'subscription_upgrade'
        
        
        
        
        if errors:
            raise serializers.ValidationError(errors)
        
        return data

    def create(self, validated_data):
        """Override create to handle auto-calculation of total slots"""
        instance = super().create(validated_data)
        
        # Auto-calculate total slots if not provided but other fields are available
        if (not instance.total_slots and 
            instance.start_time and instance.end_time and instance.slot_duration):
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
        """Override update to handle auto-calculation of total slots"""
        instance = super().update(instance, validated_data)
        
        # Recalculate total slots if time-related fields are updated
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
