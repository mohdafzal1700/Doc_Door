from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.utils import timezone
import re
from doctor.models import User,EmailOTP,Patient,Address
from patients.utils import send_otp_email
from django.contrib.auth.password_validation import validate_password
import random
import string
from django.core.mail import send_mail
from django.conf import settings
import logging
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from django.core.exceptions import ValidationError as DjangoValidationError

logger = logging.getLogger(__name__)


from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework import serializers

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
            
            logger.info(f"✅ User saved: {user.id} - {user.email}")

        
            EmailOTP.objects.filter(user=user).delete()
            logger.info(f"Cleared any existing OTP records for {user.email}")


            logger.info(f"🔄 Sending OTP to {user.email}...")
            success, result = send_otp_email(user)
            
            if success:
                logger.info(f"✅ OTP sent successfully to {user.email}")
                logger.info(f"Registration OTP sent to {user.email}")
            else:
            
                logger.error(f"Registration OTP failed for {user.email}: {result}")
                # Don't fail registration if OTP sending fails - user can resend
                print("⚠️ User created but OTP sending failed - user can use resend OTP")

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

        print(f"🔍 Verifying OTP for {email}: {otp}")

        try:
            user = User.objects.get(email=email)
            print(f"✅ User found: {user.email}")
            
            try:
                email_otp = EmailOTP.objects.get(user=user)
                print(f"✅ OTP record found for {user.email}")
                print(f"🔐 Stored OTP: {email_otp.otp}, Provided OTP: {otp}")
                
                if email_otp.is_expired():
                    print(f"⏰ OTP expired for {user.email}")
                    raise serializers.ValidationError("OTP has expired. Please request a new one.")

                if email_otp.otp != otp:
                    print(f"❌ OTP mismatch for {user.email}")
                    raise serializers.ValidationError("Invalid OTP.")
                    
                print(f"✅ OTP verification successful for {user.email}")

            except EmailOTP.DoesNotExist:
                print(f"❌ No OTP record found for {user.email}")
                raise serializers.ValidationError("No OTP found for this account. Please request a new one.")

        except User.DoesNotExist:
            print(f"❌ User not found: {email}")
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

        print(f"🔄 Resending OTP to {email}")
        
        # Delete any existing OTP records to avoid confusion
        EmailOTP.objects.filter(user=user).delete()
        print(f"🧹 Cleared existing OTP records for {email}")

        success, result = send_otp_email(user)
        if not success:
            print(f"❌ Failed to resend OTP to {email}: {result}")
            raise serializers.ValidationError(f"Failed to send OTP email: {result}")

        print(f"✅ OTP resent successfully to {email}")
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

        # ✅ Send OTP using the utility function
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
        print(f"DEBUG - Validating password: {value}")
        try:
            email = self.initial_data.get('email')
            user = None
            if email:
                try:
                    user = User.objects.get(email=email)
                    print(f"DEBUG - Found user for password validation: {user.email}")
                except User.DoesNotExist:
                    print("DEBUG - User not found for password validation")
                    pass
            
            validate_password(value, user=user)
            print(f"DEBUG - Password validation passed")
        except DjangoValidationError as e:
            print(f"DEBUG - Password validation failed: {e.messages}")
            raise serializers.ValidationError(list(e.messages))
        
        return value

    def validate(self, data):
        print(f"DEBUG - Full data validation: {data}")
        
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirm_password')

        # Check if passwords match
        if password != confirm_password:
            print("DEBUG - Passwords don't match")
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })

        # Just verify user exists (OTP already verified in previous step)
        try:
            user = User.objects.get(email=email)
            print(f"DEBUG - Found user: {user.email}")
        except User.DoesNotExist:
            print("DEBUG - User not found")
            raise serializers.ValidationError({
                'email': 'User not found.'
            })

        print("DEBUG - All validation passed")
        return data

    def save(self, **kwargs):
        email = self.validated_data['email']
        password = self.validated_data['password']
        user = User.objects.get(email=email)

        print(f"DEBUG - Saving password for user: {user.email}")
        
        user.set_password(password)
        user.save()

        print("DEBUG - Password saved successfully")
        return user

    

# class EmailOTPVerifySerializer(serializers.Serializer):
#     email = serializers.EmailField()
#     otp = serializers.CharField(max_length=6)

#     def validate(self, data):
#         email = data.get('email')
#         otp = data.get('otp')

#         try:
#             user = User.objects.get(email=email)
#             email_otp = EmailOTP.objects.get(user=user)

#             if email_otp.is_expired():
#                 raise serializers.ValidationError("OTP has expired. Please request a new one.")

#             if email_otp.otp != otp:
#                 raise serializers.ValidationError("Invalid OTP.")

#         except User.DoesNotExist:
#             raise serializers.ValidationError("User not found.")
#         except EmailOTP.DoesNotExist:
#             raise serializers.ValidationError("No OTP found for this account. Please request a new one.")

#         return data


# class ResendOTPSerializer(serializers.Serializer):
#     email = serializers.EmailField()

#     def validate_email(self, value):
#         if not value:
#             raise serializers.ValidationError("Email is required.")

#         try:
#             user = User.objects.get(email=value)
#             if user.is_active:
#                 raise serializers.ValidationError("User is already verified.")
#             return value
#         except User.DoesNotExist:
#             raise serializers.ValidationError("User with this email does not exist.")

#     def save(self, **kwargs):
#         email = self.validated_data.get('email')
#         user = User.objects.get(email=email)

#         success, result = send_otp_email(user)
#         if not success:
#             raise serializers.ValidationError(f"Failed to send OTP email: {result}")

#         # Optionally, you can return the OTP here for testing purposes (remove in production)
#         return user



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
        read_only_fields = ['id', 'role', 'is_active']

    # === Computed Field Methods ===

    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.email or obj.username

    def get_member_since(self, obj):
        """Get the date when user joined - using date_joined from AbstractBaseUser"""
        # AbstractBaseUser provides date_joined by default
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
            # For Cloudinary fields, you can access the URL directly
            return patient.profile_picture.url
        return None

    def get_has_profile_picture(self, obj):
        patient = getattr(obj, "patient_profile", None)
        return bool(patient and patient.profile_picture)

    # === Validation Methods ===

    def validate_email(self, value):
        user = self.instance
        if user and User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

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
    
# ===== 2. ADDRESS SERIALIZER =====
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
    
    
