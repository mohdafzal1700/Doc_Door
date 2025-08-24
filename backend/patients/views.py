from datetime import timedelta, datetime
from io import BytesIO
import logging
import os
import hmac
import hashlib
import traceback
from decimal import Decimal
from math import radians, cos, sin, asin, sqrt, degrees

from PIL import Image
import razorpay
import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import Http404
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError
from django.db import transaction, models
from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.contrib.auth import get_user_model

# REST Framework
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

# Google Auth
from google.oauth2 import id_token
from google.auth.transport import requests

# Project utils
from patients.utils import DoctorEarning, DoctorEarningsManager
from .utils import handle_appointment_cancellation, PatientWalletManager
from chat.utils import create_and_send_notification

# Models
from doctor.models import (
    User,
    EmailOTP,
    Patient,
    Address,
    Medical_Record,
    Appointment,
    Payment,
    Schedules,
    Doctor,
    PatientLocation,
    DoctorLocation,
    PatientWallet,
    PatientTransaction,
    DoctorReview,
)

# Serializers
from doctor.serializers import DoctorProfileSerializer

from patients.serializers import (
    ProfilePictureSerializer,
    CustomTokenObtainPairSerializer,
    ScheduleDetailSerializer,
    AddressSerializer,
    AddressListSerializer,
    CustomUserCreateSerializer,
    EmailOTPVerifySerializer,
    ResendOTPSerializer,
    ResetPasswordSerializer,
    ForgotPasswordSerializer,
    VerifyForgotPasswordOTPSerializer,
    UserProfileSerializer,
    AppointmentSerializer,
    MedicalRecordSerializer,
    BookingDoctorDetailSerializer,
    PaymentSerializer,
    PatientLocationSerializer,
    DoctorLocationSerializer,
    PatientLocationUpdateSerializer,
    PatientWalletSerializer,
    PatientTransactionSerializer,
    PaymentInitiationSerializer,
    PaymentVerificationSerializer,
    PatientReviewCreateSerializer,
    DoctorReviewSerializer,
)
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

# Logger setup
logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    """Token Verification & User"""
    
    permission_classes = [permissions.AllowAny]
    serializer_class = CustomTokenObtainPairSerializer
            
    def post(self, request, *args, **kwargs):
        try:
            email = request.data.get('email')
            password = request.data.get('password')
            user_type = request.data.get('userType')
            
            logger.info(f"Login attempt - Email: {email}, UserType: {user_type}")
                        
            # Check if user exists
            if not User.objects.filter(email=email).exists():
                logger.warning(f"No user found with email: {email}")
                return Response(
                    {"success": False, "message": "No account found with this email address"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get the user
            user = User.objects.get(email=email)
            logger.info(f"User found - Role: {user.role}, ID: {user.id}")
            
            # Validate that this is a patient login
            if user.role != 'patient':
                logger.warning(f"Role mismatch - Expected: patient, Got: {user.role}")
                return Response(
                    {"success": False, "message": f"This login is only for patients. Your account is registered as {user.role}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                                            
            response = super().post(request, *args, **kwargs)
            
            # Check if login was successful
            if response.status_code != 200:
                logger.error(f"JWT authentication failed: {response.data}")
                return Response(
                    {"success": False, "message": "Invalid email or password"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            token = response.data
            access_token = token['access']
            refresh_token = token["refresh"]
            logger.info("Tokens generated successfully")                        
            res = Response(status=status.HTTP_200_OK)
                        
            res.data = {
                "success": True,
                "message": "Patient login successful",
                "access_token": access_token,      
                "refresh_token": refresh_token,    
                "userDetails": {
                    "id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                    "phone_number": user.phone_number
                }
            }
            
            res.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=False,  
                samesite="Lax",  
                path='/',
                max_age=3600  
            )

            res.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=False,  
                samesite="Lax",  
                path='/',
                max_age=86400  
            )
            
            logger.info("Cookies set successfully")
            return res
                
        except AuthenticationFailed as e:
            logger.error(f" Authentication failed: {str(e)}")
            return Response(
                {"success": False, "message": "Invalid email or password"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.error(f"Authentication failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {"success": False, "message": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
            
class CustomTokenRefreshView(TokenRefreshView):
    """Cookie-based Token Refresh View"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        try:
            logger.info(" Token refresh attempt")
            logger.info(f"Request cookies: {list(request.COOKIES.keys())}")
            
            # Get refresh token from cookies
            refresh_token = request.COOKIES.get("refresh_token")
            if not refresh_token:
                logger.warning(" No refresh token found in cookies")
                return Response(
                    {"success": False, "message": "Refresh token not found in cookies"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            try:
                
                serializer = TokenRefreshSerializer(data={'refresh': refresh_token})
                if serializer.is_valid():
                    # Generate new tokens
                    validated_data = serializer.validated_data
                    access_token = str(validated_data['access'])
                    
                    # Check if new refresh token is provided
                    new_refresh_token = validated_data.get('refresh')
                    if new_refresh_token:
                        new_refresh_token = str(new_refresh_token)
                    
                    logger.info(" Token refresh successful")
                    
                    # Create response
                    response = Response({
                        "success": True, 
                        "message": "Access token refreshed successfully"
                    }, status=status.HTTP_200_OK)
                    
                    # Set new access token cookie
                    response.set_cookie(
                        key="access_token",
                        value=access_token,
                        httponly=True,
                        secure=False,  # Set to True in production with HTTPS
                        samesite="Lax",
                        path="/",
                        max_age=60 * 15  # 15 minutes
                    )
                    
                    # Set new refresh token cookie if provided
                    if new_refresh_token:
                        response.set_cookie(
                            key="refresh_token", 
                            value=new_refresh_token,
                            httponly=True,
                            secure=False,  # Set to True in production
                            samesite="Lax", 
                            path="/",
                            max_age=7 * 24 * 60 * 60  # 7 days
                        )
                        logger.info("🔁 Refresh token cookie updated")
                    
                    return response
                    
                else:
                    logger.warning(f" Token refresh validation failed: {serializer.errors}")
                    return Response(
                        {"success": False, "message": "Invalid refresh token"},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                    
            except Exception as token_error:
                logger.error(f" Token processing error: {str(token_error)}")
                return Response(
                    {"success": False, "message": "Token refresh failed"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
        except Exception as e:
            logger.error(f" Token refresh error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {"success": False, "message": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RegisterUserView(generics.CreateAPIView):
    """ User Registration """
    
    serializer_class = CustomUserCreateSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'success': True,
                'message': 'Registration successful. Please check your email for verification code.',
                'email': user.email,
                'role':user.role
            }, status=status.HTTP_201_CREATED)

        
        logger.warning(f"Registration error: {serializer.errors}")
        
        return Response({
            'success': False,
            'message': 'Registration failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)



class EmailOTPVerifyView(generics.GenericAPIView):
    """Verify Email OTP"""
    
    serializer_class = EmailOTPVerifySerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = get_object_or_404(User, email=email)

            # Mark user as active (verified)
            user.is_active = True
            user.save()

            # Delete the OTP record since it's verified
            EmailOTP.objects.filter(user=user).delete()

            return Response({
                'message': 'Email verified successfully. You can now login.',
                'status': {
                    'is_active': user.is_active,
                    'email': email
                }
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    
class ResendOTPView(generics.GenericAPIView):
    """ If the user did not get OTP try  Resent OTP """
    
    serializer_class = ResendOTPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'success': True,
                'message': 'OTP has been resent to your email.',
                'email': user.email
            }, status=status.HTTP_200_OK)

        return Response({
            'success': False,
            'message': 'Failed to resend OTP.',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
class ForgotPasswordView(generics.GenericAPIView):
    """Using when Forgot password"""
    
    serializer_class = ForgotPasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'OTP sent to your email address.'
            }, status=status.HTTP_200_OK)

        return Response({
            'success': False,
            'message': 'Failed to send OTP.',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
class VerifyForgotPasswordOTPView(generics.GenericAPIView):
    """Verify and complete ForgetPassword"""
    
    serializer_class = VerifyForgotPasswordOTPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            
            return Response({
                'success': True,
                'message': 'OTP verified. You can now reset your password.'
            }, status=status.HTTP_200_OK)

        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(generics.GenericAPIView):
    """Verify and complete password"""
    
    serializer_class = ResetPasswordSerializer

    def post(self, request, *args, **kwargs):
        logger.info(f"Reset password request data: {request.data}")
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            try:
            
                serializer.save()
                return Response({
                    'success': True,
                    'message': 'Password reset successful. You can now log in with your new password.'
                }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error saving password reset: {str(e)}")
                
                return Response({
                    'success': False,
                    'message': f'An error occurred while resetting password: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.error(f"Password reset validation errors: {serializer.errors}")
        
        return Response({
            'success': False,
            'errors': serializer.errors,
            'message': 'Please check your input and try again.'
        }, status=status.HTTP_400_BAD_REQUEST)
        
class CustomLogoutView(APIView):
    """Custom logout and blacklisting the Refresh token"""
    
    permission_classes = [permissions.AllowAny]  #IsAuthenticated
    
    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh_token')
            
            if refresh_token:
                try:
                    # Blacklist the refresh token
                    token = RefreshToken(refresh_token)
                    token.blacklist()
                except TokenError as e:
                    # Token might already be blacklisted or invalid
                    pass
            
            # Create response
            res = Response(
                {"success": True, "message": "Logout successful"},
                status=status.HTTP_200_OK
            )
            
            # Clear cookies
            res.delete_cookie(
                key="access_token",
                path='/',
                samesite="Lax"  # Changed from "None" to "Lax"
            )
            
            res.delete_cookie(
                key="refresh_token", 
                path='/',
                samesite="Lax"  # Changed from "None" to "Lax"
            )
            
            return res
            
        except Exception as e:
            return Response(
                {"success": False, "message": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        
class UserProfileView(APIView):
    """Handle user profile and patient data operations"""
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            logger.info(f"Request User:, {request.user}")
            serializer = UserProfileSerializer(request.user)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to fetch profile',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    def patch(self, request):
        """Update user profile data"""
        try:
            serializer = UserProfileSerializer(
                request.user, 
                data=request.data, 
                partial=True
            )
            
            if serializer.is_valid():
                updated_user = serializer.save()
                response_serializer = UserProfileSerializer(updated_user)
                return Response({
                    'success': True,
                    'message': 'Profile updated successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'field_errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to update profile',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AddressManagementView(APIView):
    """Handle user address operations"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all user addresses"""
        try:
            addresses = request.user.addresses.filter(is_delete=False).order_by('-is_primary', 'address_type')
            serializer = AddressListSerializer(addresses, many=True)
            
            # Get primary address separately
            primary_address = addresses.filter(is_primary=True).first()
            primary_data = AddressListSerializer(primary_address).data if primary_address else None
            
            return Response({
                'success': True,
                'data': {
                    'addresses': serializer.data,
                    'primary_address': primary_data,
                    'total_count': addresses.count()
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Failed to fetch addresses',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """Create a new address"""
        try:
            # Handle primary address logic
            if request.data.get('is_primary', False):
                Address.objects.filter(
                    user=request.user, 
                    is_primary=True, 
                    is_delete=False
                ).update(is_primary=False)
            
            serializer = AddressSerializer(
                data=request.data, 
                context={'user': request.user}
            )
            
            if serializer.is_valid():
                address = serializer.save(user=request.user)
                return Response({
                    'success': True,
                    'message': 'Address created successfully',
                    'data': AddressSerializer(address).data
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'field_errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Failed to create address',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def patch(self, request, address_id):
        """Update an existing address"""
        try:
            address = Address.objects.get(
                id=address_id, 
                user=request.user, 
                is_delete=False
            )
            
            # Handle primary address logic
            if request.data.get('is_primary', False):
                Address.objects.filter(
                    user=request.user, 
                    is_primary=True, 
                    is_delete=False
                ).exclude(id=address_id).update(is_primary=False)
            
            serializer = AddressSerializer(
                address, 
                data=request.data, 
                partial=True,
                context={'user': request.user}
            )
            
            if serializer.is_valid():
                updated_address = serializer.save()
                return Response({
                    'success': True,
                    'message': 'Address updated successfully',
                    'data': AddressSerializer(updated_address).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'field_errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except Address.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Address not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Failed to update address',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, address_id):
        """Soft delete an address"""
        try:
            address = Address.objects.get(
                id=address_id, 
                user=request.user, 
                is_delete=False
            )
            
            address.is_delete = True
            address.is_primary = False
            address.save()
            
            return Response({
                'success': True,
                'message': 'Address deleted successfully'
            }, status=status.HTTP_200_OK)
        
        except Address.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Address not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Failed to delete address',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProfilePictureView(APIView):
    """Handle profile picture operations"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser] 

    def get(self, request):
        """Get current profile picture info"""
        try:
            user = request.user
            logger.info(f"Fetching profile picture for user: {user.id}")
            profile_picture_url = self._get_profile_picture_url(user)

            return Response({
                'success': True,
                'data': {
                    'profile_picture_url': profile_picture_url,
                    'has_profile_picture': bool(profile_picture_url),
                    'upload_date': user.updated_at if hasattr(user, 'updated_at') else None
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to get profile picture: {e}", exc_info=True)
            return Response({
                'success': False,
                'message': 'Failed to get profile picture info',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, user_id=None):
        """Upload profile picture"""
        try:
            logger.info("Received profile picture upload request")
            serializer = ProfilePictureSerializer(data=request.data)

            if not serializer.is_valid():
                logger.warning(f"Invalid profile picture data: {serializer.errors}")
                return Response({
                    'success': False,
                    'field_errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            file = serializer.validated_data['profile_picture']
            user = request.user
            logger.debug(f"Uploading profile picture for user: {user.id}")

            self._delete_old_picture(user)
            upload_result = self._upload_picture(file, user)

            if not upload_result['success']:
                logger.error(f"Upload failed: {upload_result.get('error')}")
                return Response(upload_result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            self._update_user_profile(user, upload_result['url'])

            logger.info(f"Profile picture uploaded successfully for user: {user.id}")
            return Response({
                'success': True,
                'message': 'Profile picture uploaded successfully',
                'data': {
                    'profile_picture_url': upload_result['url'],
                    'has_profile_picture': True,
                    'upload_date': timezone.now().isoformat()
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Exception during upload: {e}", exc_info=True)
            return Response({
                'success': False,
                'message': 'Failed to upload profile picture',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Delete profile picture"""
        try:
            user = request.user
            logger.info(f"Deleting profile picture for user: {user.id}")

            self._delete_old_picture(user)
            user.profile_url = None
            user.save()

            if hasattr(user, 'patient_profile') and user.patient_profile:
                user.patient_profile.profile_picture = None
                user.patient_profile.save()

            logger.info(f"Profile picture deleted for user: {user.id}")
            return Response({
                'success': True,
                'message': 'Profile picture deleted successfully',
                'data': {
                    'profile_picture_url': None,
                    'has_profile_picture': False
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to delete profile picture: {e}", exc_info=True)
            return Response({
                'success': False,
                'message': 'Failed to delete profile picture',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _get_profile_picture_url(self, user):
        """Get profile picture URL"""
        logger.debug("Resolving profile picture URL")
        if hasattr(user, 'profile_url') and user.profile_url:
            return user.profile_url
        if hasattr(user, 'patient_profile') and user.patient_profile and user.patient_profile.profile_picture:
            return str(user.patient_profile.profile_picture)
        return None

    def _delete_old_picture(self, user):
        """Delete old profile picture"""
        logger.debug("Deleting old profile picture if exists")
        try:
            # Delete from user.profile_url (if exists)
            if hasattr(user, 'profile_url') and user.profile_url:
                public_id = self._extract_public_id(user.profile_url)
                if public_id:
                    try:
                        cloudinary.uploader.destroy(public_id)
                        logger.info(f"Deleted Cloudinary image: {public_id}")
                    except CloudinaryError as e:
                        logger.warning(f"Cloudinary deletion failed: {e}")
            
            # Delete from patient_profile.profile_picture (CloudinaryField)
            if (hasattr(user, 'patient_profile') and user.patient_profile and 
                user.patient_profile.profile_picture):
                try:
                    # Extract public_id from CloudinaryField URL
                    public_id = self._extract_public_id(str(user.patient_profile.profile_picture))
                    if public_id:
                        cloudinary.uploader.destroy(public_id)
                        logger.info(f"Deleted Cloudinary image from patient profile: {public_id}")
                except Exception as e:
                    logger.warning(f"Failed to delete CloudinaryField picture: {e}")
        except Exception as e:
            logger.warning(f"Error during old picture deletion: {e}")

    def _upload_picture(self, file, user):
        """Upload picture - Always use Cloudinary for CloudinaryField"""
        try:
            # Since we're using CloudinaryField, always upload to Cloudinary
            if not (hasattr(cloudinary.config(), 'cloud_name') and cloudinary.config().cloud_name):
                logger.error("Cloudinary not configured but CloudinaryField requires it")
                return {
                    'success': False,
                    'message': 'Image upload service not configured',
                    'error': 'Cloudinary configuration missing'
                }
            
            logger.info("Uploading to Cloudinary")
            return self._upload_to_cloudinary(file, user)
            
        except Exception as e:
            logger.error(f"Upload failed: {e}", exc_info=True)
            return {
                'success': False,
                'message': 'Failed to upload image',
                'error': str(e)
            }

    def _upload_to_cloudinary(self, file, user):
        """Upload to Cloudinary and save to CloudinaryField"""
        try:
            # Process the image before uploading
            image = Image.open(file)
            image = image.convert('RGB')
            
            # Save processed image to BytesIO
            output = BytesIO()
            image.save(output, format='JPEG', quality=85)
            output.seek(0)
            
            # Upload to Cloudinary
            upload_result = cloudinary.uploader.upload(
                output,
                folder="profile_pictures",
                public_id=f"user_{user.id}_{int(timezone.now().timestamp())}",
                overwrite=True,
                resource_type="image",
                transformation=[
                    {'width': 400, 'height': 400, 'crop': 'fill'},
                    {'quality': 'auto:good'},
                    {'format': 'jpg'}
                ]
            )
            
            # Get or create patient profile
            patient_profile, created = Patient.objects.get_or_create(user=user)
            
            # Save Cloudinary URL to CloudinaryField
            patient_profile.profile_picture = upload_result['secure_url']
            patient_profile.save()
            
            logger.info(f"Cloudinary upload successful for user: {user.id}")
            return {
                'success': True,
                'url': upload_result['secure_url']
            }
            
        except CloudinaryError as e:
            logger.error(f"Cloudinary upload failed: {e}")
            return {
                'success': False,
                'message': 'Failed to upload to Cloudinary',
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"Unexpected error during upload: {e}")
            return {
                'success': False,
                'message': 'Unexpected error during upload',
                'error': str(e)
            }

    def _extract_public_id(self, cloudinary_url):
        """Extract public_id from Cloudinary URL"""
        try:
            if not cloudinary_url:
                return None
            
            
            if '/image/upload/' in cloudinary_url:
                parts = cloudinary_url.split('/image/upload/')
                if len(parts) > 1:
                    
                    after_upload = parts[1]
                    
                    if after_upload.startswith('v') and '/' in after_upload:
                        after_upload = after_upload.split('/', 1)[1]
                    
                    public_id = after_upload.rsplit('.', 1)[0]
                    return public_id
            return None
        except Exception as e:
            logger.warning(f"Failed to extract public_id from URL: {e}")
            return None

    def _update_user_profile(self, user, url):
        """Update user profile with new picture URL"""
        try:
            
            if hasattr(user, 'profile_url'):
                user.profile_url = url
                user.save()
            logger.debug(f"Updated user profile URL for user: {user.id}")
        except Exception as e:
            logger.warning(f"Failed to update user profile URL: {e}")
            
            
class PatientDoctorView(APIView):
    """Provide the All Approved and Active doctors in patient side"""
    
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self, pk):
        logger.debug(f"Patient fetching doctor object with ID: {pk}")
        return get_object_or_404(User, pk=pk, role='doctor', is_active=True, doctor_profile__verification_status='approved')
    
    def get(self, request, pk=None):
        try:
            if pk:
                logger.info(f"Patient viewing specific doctor with ID: {pk}")
                user = self.get_object(pk)
                serialized_data = self.serializer_class(user)
                return Response(serialized_data.data, status=status.HTTP_200_OK)
            
            logger.info('Patient viewing all available doctors')
            
            
            queryset = User.objects.filter(
                role='doctor',
                is_active=True,
                doctor_profile__verification_status='approved'  # Added this crucial filter
            ).select_related('doctor_profile').prefetch_related(
                'doctor_profile__educations',
                'doctor_profile__certifications'
            )
            
            
            specialization = request.GET.get('specialization', '')
            if specialization:
                queryset = queryset.filter(doctor_profile__specialization__icontains=specialization)
            
            
            location = request.GET.get('location', '')
            if location:
                queryset = queryset.filter(doctor_profile__location__icontains=location)
            
        
            search = request.GET.get('search', '')
            if search:
                queryset = queryset.filter(
                    Q(first_name__icontains=search) |
                    Q(last_name__icontains=search) |
                    Q(doctor_profile__clinic_name__icontains=search)
                )
            
            
            ordering = request.GET.get('ordering', 'first_name')
            if ordering in ['first_name', 'last_name', 'doctor_profile__experience', '-doctor_profile__experience']:
                queryset = queryset.order_by(ordering)
            
            logger.debug(f"Available approved doctors count: {queryset.count()}")
            
            # Serialize the queryset for all doctors
            serialized_data = self.serializer_class(queryset, many=True)
            return Response(serialized_data.data, status=status.HTTP_200_OK)
        
        except ValueError as e:
            logger.warning(f"Invalid parameter value: {str(e)}")
            return Response({
                'error': 'Invalid parameter value',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.error(f"Error fetching doctors for patient: {str(e)}", exc_info=True)
            return Response({
                'error': 'An error occurred while fetching doctors',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            

class MedicalRecordManagementView(APIView):
    """
    Medical record management for patient portal
    Patient can only access their own medical record
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get medical record for the authenticated patient"""
        try:
            # Enhanced logging for debugging
            logger.info(f"Medical record request started for user: {request.user.id}")
            logger.info(f"User email: {request.user.email}")
            logger.info(f"User type: {type(request.user)}")
            
            try:
                patient = request.user.patient_profile
                logger.info(f"Patient profile found: {patient.id}")
                
            except Patient.DoesNotExist:
                logger.error(f"Patient profile not found for user {request.user.id}")
                
                # Check if there are any patient profiles in the system
                total_patients = Patient.objects.count()
                
                # Check if this user has any related patient profiles
                try:
                    related_patients = Patient.objects.filter(user=request.user)
                    
                    for rp in related_patients:
                        logger.info(f"   - Patient: {rp.id}, User: {rp.user}")
                except Exception as e:
                    logger.error(f" Error checking related patients: {e}")
                
                return Response({
                    'success': False,
                    'message': 'Patient profile not found',
                    'debug_info': {
                        'user_id': str(request.user.id),
                        'user_email': request.user.email,
                        'total_patients': Patient.objects.count()
                    }
                }, status=status.HTTP_404_NOT_FOUND)
            
            except AttributeError as e:
                logger.error(f" AttributeError accessing patient_profile: {str(e)}")
            
                return Response({
                    'success': False,
                    'message': 'Error accessing patient profile',
                    'debug_info': {
                        'error': str(e),
                        'user_fields': [f.name for f in request.user._meta.fields],
                        'related_objects': [rel.get_accessor_name() for rel in request.user._meta.related_objects]
                    }
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Try to get medical record
            try:
                medical_record = Medical_Record.objects.get(patient=patient)
                logger.info(f"Medical record found: {medical_record.id}")
                
                serializer = MedicalRecordSerializer(medical_record)
                logger.info(f"Medical record serialized successfully")
            
                return Response({
                    'success': True,
                    'data': serializer.data
                }, status=status.HTTP_200_OK)

            except Medical_Record.DoesNotExist:
                logger.info(f" Medical record not found for patient {patient.id}")
                
                total_records = Medical_Record.objects.count()
                
                all_records = Medical_Record.objects.all()[:5]  # Limit to first 5
            
                for record in all_records:
                    logger.info(f"   - Record ID: {record.id}, Patient: {record.patient.id}")
                
                return Response({
                    'success': False,
                    'message': 'Medical record not found',
                    'debug_info': {
                        'patient_id': str(patient.id),
                        'total_medical_records': total_records
                    }
                }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.error(f" Unexpected error in medical record view: {str(e)}")
            logger.error(f" Error type: {type(e)}")
            logger.error(f" Error args: {e.args}")
            
            import traceback
            traceback.print_exc()
            
            return Response({
                'success': False,
                'message': 'Failed to retrieve medical record',
                'error': str(e),
                'debug_info': {
                    'error_type': str(type(e)),
                    'user_id': str(request.user.id) if hasattr(request, 'user') else 'N/A'
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    def post(self, request):
        """Create medical record for the authenticated patient"""
        try:
            with transaction.atomic():
                # Get the patient profile for the logged-in user
                try:
                    patient = request.user.patient_profile
                except Patient.DoesNotExist:
                    return Response({
                        'success': False,
                        'message': 'Patient profile not found'
                    }, status=status.HTTP_404_NOT_FOUND)

                # Check if patient already has a medical record
                if Medical_Record.objects.filter(patient=patient).exists():
                    return Response({
                        'success': False,
                        'message': 'You already have a medical record'
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Prepare data with patient
                data = request.data.copy()
                data['patient'] = patient.id

                serializer = MedicalRecordSerializer(data=data)

                if serializer.is_valid():
                    medical_record = serializer.save()
                    logger.info(f"Medical record created for patient {patient.name}")

                    return Response({
                        'success': True,
                        'message': 'Medical record created successfully',
                        'data': MedicalRecordSerializer(medical_record).data
                    }, status=status.HTTP_201_CREATED)
                else:
                    return Response({
                        'success': False,
                        'field_errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)

        except ValidationError as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating medical record for user {request.user.id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to create medical record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        """Update medical record for the authenticated patient"""
        try:
            with transaction.atomic():
                # Get the patient profile for the logged-in user
                try:
                    patient = request.user.patient_profile
                except Patient.DoesNotExist:
                    return Response({
                        'success': False,
                        'message': 'Patient profile not found'
                    }, status=status.HTTP_404_NOT_FOUND)

                # Get medical record
                try:
                    medical_record = Medical_Record.objects.get(patient=patient)
                except Medical_Record.DoesNotExist:
                    return Response({
                        'success': False,
                        'message': 'Medical record not found'
                    }, status=status.HTTP_404_NOT_FOUND)

                serializer = MedicalRecordSerializer(
                    medical_record,
                    data=request.data,
                    partial=True
                )

                if serializer.is_valid():
                    updated_record = serializer.save()
                    logger.info(f"Medical record updated for patient {patient.name}")

                    return Response({
                        'success': True,
                        'message': 'Medical record updated successfully',
                        'data': MedicalRecordSerializer(updated_record).data
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        'success': False,
                        'field_errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)

        except ValidationError as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating medical record for user {request.user.id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to update medical record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Delete medical record for the authenticated patient"""
        try:
            # Get the patient profile for the logged-in user
            try:
                patient = request.user.patient_profile
            except Patient.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Patient profile not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Get medical record
            try:
                medical_record = Medical_Record.objects.get(patient=patient)
            except Medical_Record.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Medical record not found'
                }, status=status.HTTP_404_NOT_FOUND)

            patient_name = patient.name
            medical_record.delete()
            logger.info(f"Medical record deleted for patient {patient_name}")

            return Response({
                'success': True,
                'message': 'Medical record deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error deleting medical record for user {request.user.id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to delete medical record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    
class AppointmentManagementView(APIView):
    """
    Comprehensive appointment management for patient portal
    Handles CRUD operations for patient appointments
    """
    permission_classes = [IsAuthenticated]

    def get_patient_profile(self, user):
        """Get patient profile with proper error handling"""
        try:
            return user.patient_profile
        except AttributeError:
            # Try alternative attribute name
            try:
                return user.patient
            except AttributeError:
                return None
        except Exception:
            return None

    def get(self, request):
        """Get all appointments for the authenticated patient"""
        patient = self.get_patient_profile(request.user)
        if not patient:
            return Response({
                'success': False,
                'message': 'Patient profile not found'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            appointments = Appointment.objects.filter(
                patient=patient
            ).select_related('doctor__user', 'service', 'schedule').order_by('-created_at')
            
            serializer = AppointmentSerializer(appointments, many=True)
            
            return Response({
                'success': True,
                'data': serializer.data,
                'count': appointments.count()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error getting appointments for user {request.user.id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to retrieve appointments'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Create new appointment for the authenticated patient"""
        patient = self.get_patient_profile(request.user)
        if not patient:
            return Response({
                'success': False,
                'message': 'Patient profile not found'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                # Prepare data
                data = request.data.copy()
                data['patient'] = patient.id

                # Debug logging
                logger.info(f"Creating appointment with data: {data}")

                # Validate and create appointment
                serializer = AppointmentSerializer(data=data)
                if serializer.is_valid():
                    appointment = serializer.save()
                    
                    # Create payment record if fee exists
                    if appointment.total_fee > 0:
                        Payment.objects.create(
                            appointment=appointment,
                            amount=appointment.total_fee,
                            method='pending',
                            status='pending'
                        )
                    
                    logger.info(f"Appointment created successfully for patient {patient.user.email}")
                    return Response({
                        'success': True,
                        'message': 'Appointment booked successfully',
                        'data': AppointmentSerializer(appointment).data
                    }, status=status.HTTP_201_CREATED)
                else:
                    # Log validation errors for debugging
                    logger.error(f"Validation errors: {serializer.errors}")
                    return Response({
                        'success': False,
                        'message': 'Validation failed',
                        'field_errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Error creating appointment for user {request.user.id}: {str(e)}")
            return Response({
                'success': False,
                'message': f'Failed to book appointment: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AppointmentDetailView(APIView):
    """
    Individual appointment management
    Handles get, update, and cancel operations
    """
    permission_classes = [IsAuthenticated]

    def get_appointment(self, user, appointment_id):
        """Get appointment with proper authorization"""
        try:
            patient = user.patient_profile
        except AttributeError:
            try:
                patient = user.patient
            except AttributeError:
                return None
        
        try:
            return Appointment.objects.get(id=appointment_id, patient=patient)
        except Appointment.DoesNotExist:
            return None

    def get(self, request, appointment_id):
        """Get specific appointment details"""
        appointment = self.get_appointment(request.user, appointment_id)
        if not appointment:
            return Response({
                'success': False,
                'message': 'Appointment not found'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            serializer = AppointmentSerializer(appointment)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error getting appointment {appointment_id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to retrieve appointment'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, appointment_id):
        """Update appointment details"""
        appointment = self.get_appointment(request.user, appointment_id)
        if not appointment:
            return Response({
                'success': False,
                'message': 'Appointment not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if appointment can be updated
        if appointment.status in ['cancelled', 'completed']:
            return Response({
                'success': False,
                'message': 'Cannot update cancelled or completed appointments'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                serializer = AppointmentSerializer(
                    appointment, 
                    data=request.data, 
                    partial=True
                )
                
                if serializer.is_valid():
                    updated_appointment = serializer.save()
                    logger.info(f"Appointment {appointment_id} updated")
                    
                    return Response({
                        'success': True,
                        'message': 'Appointment updated successfully',
                        'data': AppointmentSerializer(updated_appointment).data
                    }, status=status.HTTP_200_OK)
                else:
                    logger.error(f"Update validation errors: {serializer.errors}")
                    return Response({
                        'success': False,
                        'message': 'Validation failed',
                        'field_errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Error updating appointment {appointment_id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to update appointment'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, appointment_id):
        """Cancel appointment"""
        appointment = self.get_appointment(request.user, appointment_id)
        if not appointment:
            return Response({
                'success': False,
                'message': 'Appointment not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if appointment can be cancelled
        if appointment.status in ['cancelled', 'completed']:
            return Response({
                'success': False,
                'message': 'Cannot cancel this appointment'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get refund amount (assuming you have consultation_fee field)
            refund_amount = appointment.total_fee
            
            # Handle appointment cancellation with wallet transfer
            success, message = handle_appointment_cancellation(appointment, refund_amount)
            
            if success:
                # Update appointment status
                appointment.status = 'cancelled'
                appointment.save()
                logger.info(f"Appointment {appointment_id} cancelled and wallet credited")
                
                return Response({
                    'success': True,
                    'message': f'Appointment cancelled successfully. {message}'
                }, status=status.HTTP_200_OK)
            else:
                logger.error(f"Failed to process wallet transfer for appointment {appointment_id}: {message}")
                return Response({
                    'success': False,
                    'message': f'Appointment cancellation failed: {message}'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error cancelling appointment {appointment_id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to cancel appointment'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DoctorBookingDetailView(APIView):
    """Doctor details for booking page"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
    
        try:
            doctor = get_object_or_404(
                User,
                pk=pk,
                role='doctor',
                is_active=True,
                doctor_profile__verification_status='approved'
            )
        
            serializer = BookingDoctorDetailSerializer(doctor)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': 'Doctor not found or not available',
                'details': str(e)
            }, status=status.HTTP_404_NOT_FOUND)


class DoctorSchedulesView(APIView):
    """Doctor schedules with time slot availability"""
    
    permission_classes = [IsAuthenticated]

    def get(self, request, doctor_id):
        try:
            # Validate required parameters
            date = request.GET.get('date')
            if not date:
                return Response({
                    'error': 'Date parameter is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                date_obj = datetime.strptime(date, '%Y-%m-%d').date()
            except ValueError:
                return Response({
                    'error': 'Invalid date format. Use YYYY-MM-DD'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Direct Doctor query approach - More efficient
            doctor = get_object_or_404(
                Doctor,
                user__id=doctor_id,
                user__role='doctor',
                user__is_active=True,
                verification_status='approved'
            )

            # Build query filters
            mode = request.GET.get('mode', 'online')
            service_id = request.GET.get('service_id')
            
            schedules_query = Schedules.objects.filter(
                doctor=doctor,
                date=date_obj,
                mode=mode,
                is_active=True
            ).select_related('service')

            if service_id:
                schedules_query = schedules_query.filter(service_id=service_id)

            schedules = schedules_query.all()

            serializer = ScheduleDetailSerializer(schedules, many=True)
            return Response({
                'schedules': serializer.data,
                'date': date,
                'mode': mode,
                'doctor_id': doctor_id
            }, status=status.HTTP_200_OK)

        except Exception as e:
            # Add more detailed error logging
            import traceback
            
            traceback.print_exc()
            return Response({
                'error': 'Failed to fetch schedules',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpdatePatientLocationView(generics.CreateAPIView):
    """POST /patients/location/update/"""
    
    serializer_class = PatientLocationUpdateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_patient(self):
        """Get the patient instance for the authenticated user"""
        logger.debug(f"Getting patient for user: {self.request.user.id}")
        try:
            patient = self.request.user.patient_profile
            logger.debug(f"Patient found: {patient.id}")
            return patient
        except Exception as e:
            logger.error(f"Error getting patient: {str(e)}")
            raise
    
    def perform_create(self, serializer):
        logger.debug("Starting perform_create")
        patient = self.get_patient()
        
        try:
            with transaction.atomic():
                # Get existing location
                existing_location = PatientLocation.objects.filter(patient=patient).first()
                
                if existing_location:
                    logger.debug(f"Found existing location for patient {patient.id}, updating it")
                    # Update existing location instead of creating new one
                    for field, value in serializer.validated_data.items():
                        setattr(existing_location, field, value)
                    existing_location.save()
                    self._updated_location = existing_location
                    logger.debug(f"Updated existing location with ID: {existing_location.id}")
                else:
                    # Create new location
                    logger.debug(f"Creating new location with data: {serializer.validated_data}")
                    new_location = serializer.save(patient=patient)
                    logger.debug(f"New location created with ID: {new_location.id}")
                    self._updated_location = new_location
                
        except Exception as e:
            logger.error(f"Error in perform_create: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def create(self, request, *args, **kwargs):
        """Override create to provide custom response messages"""
        # logger.debug("="*50)
        # logger.debug("UpdatePatientLocationView.create() called")
        # logger.debug(f"User: {request.user.id} ({request.user.username})")
        # logger.debug(f"Request data: {request.data}")
        
        try:
            # Check if user is authenticated
            if not request.user.is_authenticated:
                logger.error("User is not authenticated")
                return Response({
                    'message': 'Authentication required.',
                    'data': None
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            # Check if user has patient profile
            try:
                patient = request.user.patient_profile
                logger.debug(f"Patient profile found: {patient.id}")
            except Exception as e:
                logger.error(f"No patient profile found: {str(e)}")
                return Response({
                    'message': 'Patient profile not found for this user.',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Validate serializer
            logger.debug("Validating serializer data...")
            serializer = self.get_serializer(data=request.data)
            
            if not serializer.is_valid():
                logger.error(f"Serializer validation failed: {serializer.errors}")
                return Response({
                    'message': 'Invalid data provided.',
                    'data': None,
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.debug(f"Serializer validated. Clean data: {serializer.validated_data}")
            
            # Perform the create logic
            logger.debug("Calling perform_create...")
            self.perform_create(serializer)
            
            # Get the location data for response
            logger.debug("Preparing response data...")
            location_data = PatientLocationSerializer(self._updated_location).data
            logger.debug(f"Location data prepared: {location_data}")
            
            response_data = {
                'message': 'Location updated successfully.',
                'data': location_data
            }
            
            logger.debug(f"Success! Returning response: {response_data}")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except ValidationError as e:
            logger.error(f"Validation error: {str(e)}")
            return Response({
                'message': 'Validation error occurred.',
                'data': None,
                'errors': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Unexpected error in create(): {str(e)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return Response({
                'message': 'An unexpected error occurred.',
                'data': None,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CurrentPatientLocationView(generics.RetrieveAPIView):
    """GET /patients/location/current/"""
    serializer_class = PatientLocationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        logger.debug("Getting current location object")
        try:
            patient = self.request.user.patient_profile
            logger.debug(f"Patient found: {patient.id}")
        except Exception as e:
            logger.error(f"Patient profile not found: {str(e)}")
            raise Http404("Patient profile not found for this user")
        
        location = PatientLocation.objects.filter(patient=patient).first()
        
        if not location:
            logger.warning(f"No location found for patient {patient.id}")
            raise Http404("No location found for this patient")
        
        logger.debug(f"Location found: {location.id}")
        return location
    
    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to provide custom response format"""
        logger.debug("="*50)
        logger.debug("CurrentPatientLocationView.retrieve() called")
        logger.debug(f"User: {request.user.id} ({request.user.username})")
        
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            
            response_data = {
                'message': 'Current location retrieved successfully.',
                'data': serializer.data
            }
            
            logger.debug(f"Success! Returning: {response_data}")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Http404 as e:
            logger.warning(f"404 error: {str(e)}")
            return Response({
                'message': str(e),
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
            
        except Exception as e:
            logger.error(f"Unexpected error in retrieve(): {str(e)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return Response({
                'message': 'An unexpected error occurred.',
                'data': None,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
class SearchNearbyDoctorsView(generics.ListAPIView):
    """Find NearBy doctors using bounding box filtering +
    Haversine distance calculation"""
    
    serializer_class = DoctorLocationSerializer
    permission_classes = [IsAuthenticated]

    def get_bounding_box(self, lat, lng, radius_km):
        """Calculate bounding box coordinates for initial filtering"""
        R = 6371  # Earth radius in km
        delta_lat = radius_km / R
        delta_lng = radius_km / (R * cos(radians(lat)))
        return {
            'min_lat': lat - degrees(delta_lat),
            'max_lat': lat + degrees(delta_lat),
            'min_lng': lng - degrees(delta_lng),
            'max_lng': lng + degrees(delta_lng)
        }

    def calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance between two coordinates using Haversine formula"""
        try:
            lat1, lng1, lat2, lng2 = map(radians, [float(lat1), float(lng1), float(lat2), float(lng2)])
            dlng = lng2 - lng1
            dlat = lat2 - lat1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
            c = 2 * asin(sqrt(a))
            r = 6371  
            return c * r
        except (ValueError, TypeError) as e:
            logger.error(f"Error in distance calculation: {str(e)}")
            return float('inf')

    def list(self, request, *args, **kwargs):
        logger.debug("SearchNearbyDoctorsView.list() called")
        logger.debug(f"User: {request.user.id} ({request.user.username})")
        
        try:
            # Get patient's current location
            try:
                patient = request.user.patient_profile
                patient_location = PatientLocation.objects.filter(patient=patient).first()
                if not patient_location:
                    logger.warning(f"No location found for patient {patient.id}")
                    return Response({
                        'message': 'Please update your location first to find nearby doctors.',
                        'data': [],
                        'count': 0
                    }, status=status.HTTP_400_BAD_REQUEST)

                patient_lat = float(patient_location.latitude)
                patient_lng = float(patient_location.longitude)
                logger.debug(f"Patient location: {patient_lat}, {patient_lng}")
                
            except Patient.DoesNotExist:
                logger.error("Patient profile not found")
                return Response({
                    'message': 'Patient profile not found.',
                    'data': [],
                    'count': 0
                }, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                logger.error(f"Error getting patient location: {str(e)}")
                return Response({
                    'message': 'Unable to get your location. Please update your location first.',
                    'data': [],
                    'count': 0,
                    'error': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get radius parameter
            try:
                radius = float(request.GET.get('radius', 10))
                if radius <= 0:
                    radius = 10
            except (ValueError, TypeError):
                radius = 10

            logger.debug(f"Searching within {radius}km radius")

            # Calculate bounding box for initial filtering
            bounding_box = self.get_bounding_box(patient_lat, patient_lng, radius)
            logger.debug(f"Bounding box: {bounding_box}")

            try:
                # Pre-filter doctors using bounding box to reduce database load
                doctor_locations = DoctorLocation.objects.filter(
                    doctor__user__is_active=True,  # Filter by user's active status
                    latitude__gte=bounding_box['min_lat'],
                    latitude__lte=bounding_box['max_lat'],
                    longitude__gte=bounding_box['min_lng'],
                    longitude__lte=bounding_box['max_lng']
                ).select_related('doctor', 'doctor__user')
                
                logger.debug(f"Bounding box pre-filtering found {doctor_locations.count()} potential doctors")
                
            except Exception as query_error:
                logger.error(f"Error in doctor query: {str(query_error)}")
                # Fallback to simpler query without bounding box
                doctor_locations = DoctorLocation.objects.filter(
                    doctor__user__is_active=True
                ).select_related('doctor', 'doctor__user')

            # Calculate exact distances for pre-filtered doctors and apply radius filter
            nearby_locations = []
            distance_calculations = 0
            
            for location in doctor_locations:
                try:
                    # Skip if doctor or user is None
                    if not location.doctor or not location.doctor.user:
                        continue

                    # Skip if user is not active (double-check)
                    if not location.doctor.user.is_active:
                        continue

                    # Calculate exact distance using Haversine formula
                    distance = self.calculate_distance(
                        patient_lat, patient_lng,
                        location.latitude, location.longitude
                    )
                    distance_calculations += 1

                    # Apply exact radius filter
                    if distance <= radius:
                        location.distance = round(distance, 2)
                        nearby_locations.append(location)
                        logger.debug(f"Doctor {location.doctor.user.username} - {distance:.2f}km away")
                    else:
                        logger.debug(f"Doctor {location.doctor.user.username} - {distance:.2f}km away (outside radius)")

                except Exception as e:
                    logger.error(f"Error calculating distance for doctor {location.id}: {str(e)}")
                    continue

            # Sort by distance
            nearby_locations.sort(key=lambda x: getattr(x, 'distance', float('inf')))

            logger.debug(f"Performed {distance_calculations} distance calculations")
            logger.debug(f"Found {len(nearby_locations)} doctors within {radius}km")

            # Serialize the data
            serializer = self.get_serializer(nearby_locations, many=True)
            
            response_data = {
                'message': f'Found {len(nearby_locations)} doctors within {radius}km of your location.',
                'count': len(nearby_locations),
                'radius': radius,
                'patient_location': {
                    'latitude': patient_lat,
                    'longitude': patient_lng
                },
                'performance_info': {
                    'bounding_box_candidates': doctor_locations.count(),
                    'distance_calculations_performed': distance_calculations,
                    'final_results': len(nearby_locations)
                },
                'data': serializer.data
            }

            logger.debug(f"Success! Returning {len(nearby_locations)} nearby doctors")
            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Unexpected error in SearchNearbyDoctorsView: {str(e)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return Response({
                'message': 'An unexpected error occurred while searching for nearby doctors.',
                'data': [],
                'count': 0,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PaymentInitiationView(APIView):
    """Initiate payment for confirmed appointment - supports both wallet and razorpay"""
    permission_classes = [IsAuthenticated]

    def post(self, request, appointment_id):
        """Create payment order based on selected method"""
        try:
            # Get appointment and verify ownership
            appointment = get_object_or_404(
                Appointment, 
                id=appointment_id, 
                patient__user=request.user
            )

            # Check if appointment is confirmed and unpaid
            if appointment.status != 'confirmed':
                return Response({
                    'success': False,
                    'message': 'Appointment must be confirmed before payment'
                }, status=status.HTTP_400_BAD_REQUEST)

            if appointment.is_paid:
                return Response({
                    'success': False,
                    'message': 'Payment already completed for this appointment'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate input with better error handling
            serializer = PaymentInitiationSerializer(data=request.data)
            if not serializer.is_valid():
                # Log the validation errors for debugging
                logger.error(f"Payment initiation validation failed: {serializer.errors}")
                return Response({
                    'success': False,
                    'message': 'Invalid payment data',
                    'field_errors': serializer.errors,
                    'received_data': request.data  # Add this for debugging
                }, status=status.HTTP_400_BAD_REQUEST)

            payment_method = serializer.validated_data['method']

            # Validate payment method
            if payment_method not in ['wallet', 'razorpay']:
                return Response({
                    'success': False,
                    'message': f'Invalid payment method: {payment_method}. Must be "wallet" or "razorpay"'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get or create payment record
            payment, created = Payment.objects.get_or_create(
                appointment=appointment,
                defaults={
                    'amount': appointment.total_fee,
                    'method': payment_method,
                    'status': 'pending'
                }
            )

            # Update method if payment exists but method changed
            if not created and payment.method != payment_method:
                payment.method = payment_method
                payment.status = 'pending'
                payment.failure_reason = None
                payment.save()

            # Handle wallet payment
            if payment_method == 'wallet':
                return self._process_wallet_payment(payment, appointment)

            # Handle Razorpay payment
            elif payment_method == 'razorpay':
                return self._process_razorpay_payment(payment, appointment)

        except Exception as e:
            logger.error(f"Error initiating payment for appointment {appointment_id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to initiate payment',
                'error': str(e)  # Include error for debugging
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _process_wallet_payment(self, payment, appointment):
        """Process immediate wallet payment"""
        try:
            with transaction.atomic():
                # Get or create wallet first
                wallet, _ = PatientWallet.objects.get_or_create(
                    patient=appointment.patient,
                    defaults={'balance': Decimal('0.00')}
                )

                # Check wallet balance
                if wallet.balance < payment.amount:
                    payment.status = 'failed'
                    payment.failure_reason = f"Insufficient wallet balance. Available: ₹{wallet.balance}, Required: ₹{payment.amount}"
                    payment.save()
                    
                    return Response({
                        'success': False,
                        'message': f"Insufficient wallet balance. Available: ₹{wallet.balance}, Required: ₹{payment.amount}",
                        'wallet_balance': float(wallet.balance),
                        'required_amount': float(payment.amount)
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Deduct amount from wallet using existing PatientWalletManager
                wallet_transaction = PatientWalletManager.add_debit(
                    patient=appointment.patient,
                    appointment=appointment,
                    amount=payment.amount,
                    remarks=f"Payment for appointment with Dr. {appointment.doctor.user.get_full_name()}"
                )

                if not wallet_transaction:
                    payment.status = 'failed'
                    payment.failure_reason = "Wallet transaction failed"
                    payment.save()
                    
                    return Response({
                        'success': False,
                        'message': 'Wallet transaction failed. Please try again.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Update payment status
                payment.status = 'success'
                payment.paid_at = timezone.now()
                payment.save()

                # Update appointment
                appointment.is_paid = True
                appointment.save()

                # Add credit to doctor
                doctor_earning = DoctorEarningsManager.add_credit(
                    doctor=appointment.doctor,
                    appointment=appointment,
                    amount=payment.amount,
                    remarks=f"Wallet payment from {appointment.patient.user.get_full_name()}"
                )

                # Send notifications
                self._send_payment_notifications(appointment, payment)

                return Response({
                    'success': True,
                    'message': 'Wallet payment completed successfully',
                    'data': {
                        'payment_id': payment.id,
                        'method': 'wallet',
                        'amount': float(payment.amount),
                        'paid_at': payment.paid_at.isoformat(),
                        'wallet_transaction_id': wallet_transaction.id,
                        'doctor_credit_added': doctor_earning is not None,
                        'remaining_balance': float(wallet.balance - payment.amount)
                    }
                }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Wallet payment error: {str(e)}")
            return Response({
                'success': False,
                'message': 'Wallet payment failed',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _process_razorpay_payment(self, payment, appointment):
        """Process Razorpay payment initiation"""
        try:
            # Create Razorpay order
            order = payment.create_razorpay_order()
            if not order:
                return Response({
                    'success': False,
                    'message': 'Failed to create payment order'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({
                'success': True,
                'message': 'Razorpay payment initiated successfully',
                'data': {
                    'key': settings.RAZORPAY_KEY_ID,
                    'payment_id': payment.id,
                    'razorpay_order_id': order['id'],
                    'order_id': order['id'],
                    'amount': int(payment.amount * 100),  # Amount in paise
                    'currency': 'INR',
                    'method': 'razorpay',
                    'appointment': {
                        'id': appointment.id,
                        'doctor_name': f"{appointment.doctor.user.first_name} {appointment.doctor.user.last_name}",
                        'appointment_date': appointment.appointment_date.isoformat(),
                        'slot_time': appointment.slot_time.strftime('%H:%M'),
                        'service': appointment.service.service_name if appointment.service else None
                    }
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Razorpay payment initiation error: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to initiate Razorpay payment',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _send_payment_notifications(self, appointment, payment):
        """Send notifications after successful payment"""
        try:
            # Patient notification
            create_and_send_notification(
                user_id=appointment.patient.user.id,
                message=f"Payment successful! Your appointment with Dr. {appointment.doctor.user.get_full_name()} on {appointment.appointment_date.strftime('%B %d, %Y')} at {appointment.slot_time.strftime('%I:%M %p')} is confirmed.",
                notification_type='appointment',
                related_object_id=str(appointment.id),
                sender_id=None
            )

            # Doctor notification
            create_and_send_notification(
                user_id=appointment.doctor.user.id,
                message=f"New appointment confirmed! {appointment.patient.user.get_full_name()} has paid ₹{payment.amount} for appointment on {appointment.appointment_date.strftime('%B %d, %Y')} at {appointment.slot_time.strftime('%I:%M %p')}.",
                notification_type='appointment',
                related_object_id=str(appointment.id),
                sender_id=appointment.patient.user.id
            )
        except Exception as e:
            logger.error(f"Error sending notifications: {str(e)}")


class PaymentVerificationView(APIView):
    """Verify and complete Razorpay payment"""
    permission_classes = [IsAuthenticated]

    def post(self, request, appointment_id):
        """Verify Razorpay payment signature and update payment status"""
        try:
            # Get appointment and verify ownership
            appointment = get_object_or_404(
                Appointment,
                id=appointment_id,
                patient__user=request.user
            )

            # Get payment record
            try:
                payment = Payment.objects.get(appointment=appointment)
            except Payment.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Payment record not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Only verify Razorpay payments
            if payment.method != 'razorpay':
                return Response({
                    'success': False,
                    'message': 'Payment verification only applicable for Razorpay payments'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate payment data
            serializer = PaymentVerificationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'success': False,
                    'message': 'Invalid payment verification data',
                    'field_errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            # Verify order ID match
            if payment.razorpay_order_id != serializer.validated_data['razorpay_order_id']:
                return Response({
                    'success': False,
                    'message': 'Order ID mismatch'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Verify Razorpay signature
            if not self._verify_razorpay_signature(serializer.validated_data):
                payment.status = 'failed'
                payment.failure_reason = 'Invalid payment signature'
                payment.save()
                return Response({
                    'success': False,
                    'message': 'Payment verification failed'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Complete payment
            with transaction.atomic():
                # Update payment record
                payment.razorpay_payment_id = serializer.validated_data['razorpay_payment_id']
                payment.razorpay_signature = serializer.validated_data['razorpay_signature']
                payment.status = 'success'
                payment.paid_at = timezone.now()
                payment.save()

                # Add credit to doctor
                doctor_earning = DoctorEarningsManager.add_credit(
                    doctor=appointment.doctor,
                    appointment=appointment,
                    amount=payment.amount,
                    remarks=f"Razorpay payment from {appointment.patient.user.get_full_name()}"
                )

                # Update appointment
                appointment.is_paid = True
                appointment.save()

                # Send notifications
                self._send_payment_notifications(appointment, payment)

            return Response({
                'success': True,
                'message': 'Payment verified and completed successfully',
                'data': {
                    'payment_id': payment.id,
                    'method': 'razorpay',
                    'amount': float(payment.amount),
                    'paid_at': payment.paid_at.isoformat(),
                    'appointment_status': appointment.status,
                    'doctor_credit_added': doctor_earning is not None
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error verifying payment for appointment {appointment_id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Payment verification failed',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _verify_razorpay_signature(self, payment_data):
        """Verify Razorpay payment signature"""
        try:
            # Create signature string
            signature_string = f"{payment_data['razorpay_order_id']}|{payment_data['razorpay_payment_id']}"
            
            # Generate signature
            generated_signature = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
                signature_string.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(generated_signature, payment_data['razorpay_signature'])
        except Exception as e:
            logger.error(f"Error verifying Razorpay signature: {str(e)}")
            return False

    def _send_payment_notifications(self, appointment, payment):
        """Send notifications after successful payment"""
        try:
            # Patient notification
            create_and_send_notification(
                user_id=appointment.patient.user.id,
                message=f"Payment successful! Your appointment with Dr. {appointment.doctor.user.get_full_name()} on {appointment.appointment_date.strftime('%B %d, %Y')} at {appointment.slot_time.strftime('%I:%M %p')} is confirmed.",
                notification_type='appointment',
                related_object_id=str(appointment.id),
                sender_id=None
            )

            # Doctor notification
            create_and_send_notification(
                user_id=appointment.doctor.user.id,
                message=f"New appointment confirmed! {appointment.patient.user.get_full_name()} has paid ₹{payment.amount} for appointment on {appointment.appointment_date.strftime('%B %d, %Y')} at {appointment.slot_time.strftime('%I:%M %p')}.",
                notification_type='appointment',
                related_object_id=str(appointment.id),
                sender_id=appointment.patient.user.id
            )
        except Exception as e:
            logger.error(f"Error sending notifications: {str(e)}")


class Wallet(APIView):
    """Get wallet balance and details"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Get or create wallet for the patient
            patient = request.user.patient_profile  # or however you access the patient profile
            wallet, created = PatientWallet.objects.get_or_create(
                patient=patient,
                defaults={'balance': Decimal('0.00')}
            )
            
            return Response({
                'success': True,
                'data': {
                    'balance': float(wallet.balance),
                    'currency': 'INR',
                    'last_updated': wallet.updated_at.isoformat() if hasattr(wallet, 'updated_at') else None
                }
            })
        except Exception as e:
            logger.error(f"Error fetching wallet: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to fetch wallet',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            

class PaymentStatusView(APIView):
    """Check payment status for an appointment"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, appointment_id):
        """Get payment status for appointment"""
        try:
            appointment = get_object_or_404(
                Appointment,
                id=appointment_id,
                patient__user=request.user
            )
            
            try:
                payment = Payment.objects.get(appointment=appointment)
                serializer = PaymentSerializer(payment)
                
                return Response({
                    'success': True,
                    'data': serializer.data
                }, status=status.HTTP_200_OK)
                
            except Payment.DoesNotExist:
                return Response({
                    'success': True,
                    'data': {
                        'status': 'not_initiated',
                        'message': 'Payment not yet initiated'
                    }
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Error getting payment status for appointment {appointment_id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to get payment status'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            

class PatientReviewCreateView(APIView):
    """Patient submits a new review"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        
        
        # Check if user is a patient by role
        if request.user.role != 'patient':
            return Response({
                'success': False,
                'message': 'Only patients can submit reviews.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get patient object
        patient = None
        try:
            patient = Patient.objects.get(user=request.user)
            print(f"Found patient: {patient}")
        except Patient.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Patient profile not found. Please contact support.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Validate that the doctor exists before creating serializer
        doctor_user_id = request.data.get('doctor')
        if doctor_user_id:
            try:
                from doctor.models import Doctor
                doctor = Doctor.objects.get(user__id=doctor_user_id)
                # Replace the user ID with doctor ID in request data
                request.data['doctor'] = doctor.id
            except Doctor.DoesNotExist:
                return Response({
                    'success': False,
                    'message': f'Doctor with ID {doctor_user_id} not found.',
                    'errors': {'doctor': ['Doctor not found']}
                }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            serializer = PatientReviewCreateSerializer(
                data=request.data,
                context={'request': request, 'patient': patient}
            )
            
            print(f"Serializer validation errors: {serializer.errors if not serializer.is_valid() else 'None'}")
            
            if serializer.is_valid():
                review = serializer.save(
                    patient=patient,
                    status='pending'
                )
                
                response_serializer = DoctorReviewSerializer(review)
                return Response({
                    'success': True,
                    'message': 'Review submitted successfully and is pending approval',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'success': False,
                'message': 'Invalid data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Error creating review: {str(e)}")
            print(f"Exception in review creation: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': f'Failed to submit review: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
class DoctorReviewsListView(APIView):
    """List all approved reviews for a specific doctor"""
    
    def get(self, request, doctor_id):
        try:
            
            doctor = None
            
            try:
                # Try getting doctor by doctor ID first
                doctor = Doctor.objects.get(id=doctor_id)
                actual_doctor_id = doctor.id
                logger.info(f"Found doctor by doctor ID: {doctor.id}")
            except Doctor.DoesNotExist:
                # If not found, try getting doctor by user ID
                try:
                    doctor = Doctor.objects.get(user__id=doctor_id)
                    actual_doctor_id = doctor.id
                    logger.info(f"Found doctor by user ID: {doctor_id}, doctor ID: {doctor.id}")
                except Doctor.DoesNotExist:
                    logger.error(f"No doctor found with ID or User ID: {doctor_id}")
                    return Response({
                        'success': False,
                        'message': 'Doctor not found'
                    }, status=status.HTTP_404_NOT_FOUND)
            
            # Now get reviews using the actual doctor ID
            queryset = DoctorReview.objects.filter(
                doctor_id=actual_doctor_id,
                status='approved'
            ).select_related(
                'patient__user', 'doctor__user', 'appointment', 'reviewed_by'
            ).order_by('-created_at')
            
            logger.info(f"Found {queryset.count()} approved reviews for doctor {actual_doctor_id}")
            
            serializer = DoctorReviewSerializer(queryset, many=True)
            
            # Calculate average rating
            total_reviews = queryset.count()
            if total_reviews > 0:
                avg_rating = queryset.aggregate(
                    avg_rating=models.Avg('rating')
                )['avg_rating']
                avg_rating = round(avg_rating, 1) if avg_rating else 0
            else:
                avg_rating = 0
            
            return Response({
                'success': True,
                'data': serializer.data,
                'total_reviews': total_reviews,
                'average_rating': avg_rating,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error listing doctor reviews: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return Response({
                'success': False,
                'message': 'Failed to retrieve reviews',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
class PatientReviewDeleteView(APIView):
    """Delete a review (only if still pending)"""
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, review_id):
        if not hasattr(request.user, 'patient'):
            return Response({
                'success': False,
                'message': 'Only patients can delete reviews'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            review = DoctorReview.objects.get(
                id=review_id,
                patient=request.user.patient
            )
            
            if review.status != 'pending':
                return Response({
                    'success': False,
                    'message': 'You can only delete pending reviews'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            review.delete()
            
            return Response({
                'success': True,
                'message': 'Review deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except DoctorReview.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Review not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error deleting review {review_id}: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to delete review'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
class Wallet(APIView):
    """Showing the Patient wallet  """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            
            wallet = request.user.patient_profile.wallet
            result = PatientWalletSerializer(wallet)
            return Response({
                'success': True,  
                'data': result.data
            })
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Failed to fetch wallet',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class Transaction(APIView):
    """Showing the Patient Transaction details"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            transaction = request.user.patient_profile.transactions.all()
            serializer = PatientTransactionSerializer(transaction, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            })
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Failed to fetch transactions',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
@method_decorator(csrf_exempt, name='dispatch')
class GoogleLoginView(APIView):
    """Google Authentication with Cookie Support"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            # Extract data from request
            id_token_str = request.data.get('id_token') or request.data.get('credential')
            role = request.data.get('role', 'patient')
            logger.info(f"Received Google login request with role: {role}")

            # Validate required fields
            if not id_token_str:
                return Response(
                    {'error': 'Missing id_token or credential'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if role not in ['patient', 'doctor']:
                return Response(
                    {'error': 'Role must be either "patient" or "doctor"'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Verify Google ID token
            try:
                google_client_id = getattr(settings, 'GOOGLE_OAUTH2_CLIENT_ID', None)
                if not google_client_id:
                    logger.error('GOOGLE_OAUTH2_CLIENT_ID not configured in settings')
                    return Response(
                        {'error': 'Google OAuth2 not configured'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

                idinfo = id_token.verify_oauth2_token(
                    id_token_str, requests.Request(), google_client_id
                )
            except ValueError as e:
                logger.error(f'Invalid Google ID token: {str(e)}')
                return Response(
                    {'error': 'Invalid token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Extract user information from token
            email = idinfo.get('email')
            if not email:
                return Response(
                    {'error': 'Email not found in token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')
            name = idinfo.get('name', f'{first_name} {last_name}'.strip())

            
            try:
                user = User.objects.get(email=email)
                created = False
                logger.info(f"Existing user found: {email}, current role: {getattr(user, 'role', 'None')}")

                
                if not user.is_active:
                    user.is_active = True
                    user.save()
                    logger.info(f'Activated user account for Google login: {email}')

                
                existing_role = getattr(user, 'role', None)
                if existing_role and existing_role != role:
                    logger.warning(f"Role conflict for {email}: existing={existing_role}, requested={role}")
                    return Response(
                        {'error': f'Already registered as {existing_role}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                
                if not existing_role or existing_role != role:
                    logger.info(f"Updating user role for {email} from {existing_role} to {role}")
                    user.role = role
                    user.save()
                    logger.info(f"User role updated to: {user.role}")

            except User.DoesNotExist:
                
                logger.info(f"Creating new user {email} with role: {role}")
                user = User.objects.create_user(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    username=email,
                    is_active=True  # Explicitly set to True
                )
                created = True

                
                user.role = role
                user.save()  # Make sure to save after setting role
                logger.info(f"New user created with role: {user.role}")

            # VERIFY the role is actually set correctly
            user.refresh_from_db()  # Refresh from database to ensure we have latest data
            final_role = getattr(user, 'role', None)
            logger.debug(f"Final user role after save for {email}: {final_role}")
            
            if final_role != role:
                logger.error(f"Role not saved correctly for {email}! Expected: {role}, Got: {final_role}")
                # Force set the role again
                user.role = role
                user.save()
                user.refresh_from_db()
                logger.info(f"After forced save, role is: {getattr(user, 'role', None)}")

            # Create doctor profile if user is a doctor and doesn't have one
            if role == 'doctor':
                if not hasattr(user, 'doctor_profile') or not user.doctor_profile:
                    logger.info(f"Creating doctor profile for {email}")
                    

            
            try:
                from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
                OutstandingToken.objects.filter(user=user).delete()
                logger.info(f'Cleared existing tokens for user: {email}')
            except ImportError:
                # Token blacklist not installed
                pass
            except Exception as e:
                logger.warning(f'Could not clear existing tokens for {email}: {e}')

            # Generate NEW JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            logger.info(f'Generated fresh tokens for user: {email}')
            logger.debug(f"User active status: {user.is_active}, ID: {user.id}, Role: {getattr(user, 'role', 'None')}")

            
            user_data = {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'name': user.first_name or name,
                'role': getattr(user, 'role', role),  # Use the actual role from user object
                'is_active': user.is_active,
                'is_new_user': created
            }

            
            if role == 'doctor':
                try:
                    if hasattr(user, 'doctor_profile') and user.doctor_profile:
                        doctor_profile = user.doctor_profile
                        user_data['doctor_profile'] = {
                            'verification_status': getattr(doctor_profile, 'verification_status', 'incomplete'),
                            'is_profile_setup_done': getattr(doctor_profile, 'is_profile_setup_done', False),
                            'is_education_done': getattr(doctor_profile, 'is_education_done', False),
                            'is_certification_done': getattr(doctor_profile, 'is_certification_done', False),
                            'is_license_done': getattr(doctor_profile, 'is_license_done', False),
                        }
                    else:
                        user_data['doctor_profile'] = {
                            'verification_status': 'incomplete',
                            'is_profile_setup_done': False,
                            'is_education_done': False,
                            'is_certification_done': False,
                            'is_license_done': False,
                        }
                except Exception as profile_error:
                    logger.error(f'Error fetching doctor profile for {email}: {profile_error}')
                    user_data['doctor_profile'] = {
                        'verification_status': 'incomplete',
                        'is_profile_setup_done': False,
                        'is_education_done': False,
                        'is_certification_done': False,
                        'is_license_done': False,
                    }

            # Debug log the final user data
            logger.debug(f"Returning user data for {email}: {user_data}")

            # Consistent response structure
            response_data = {
                'message': 'Google authentication successful',
                'user': user_data,
                'access': str(access_token),
                'refresh': str(refresh),
                'success': True
            }

            # Create response
            response = Response(response_data, status=status.HTTP_200_OK)

            # CLEAR OLD COOKIES FIRST
            self.clear_auth_cookies(response)

            # Set NEW HTTP-only cookies
            self.set_auth_cookies(response, access_token, refresh)

            logger.info(f'Successful Google OAuth login for user: {email} as {role}')
            return response

        except Exception as e:
            logger.error(f'Unexpected error in GoogleLoginView: {str(e)}', exc_info=True)
            return Response(
                {'error': 'An unexpected error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def clear_auth_cookies(self, response):
        """Clear existing auth cookies"""
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        logger.debug("Cleared old auth cookies")

    def set_auth_cookies(self, response, access_token, refresh_token):
        """Set secure HTTP-only cookies for authentication"""
        # Set access token cookie (shorter expiry)
        response.set_cookie(
            key='access_token',
            value=str(access_token),
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite='Lax',
            path='/',
            max_age=60 * 15  # 15 minutes (shorter for security)
        )

        # Set refresh token cookie (longer expiry)
        response.set_cookie(
            key='refresh_token',
            value=str(refresh_token),
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite='Lax',
            path='/',
            max_age=7 * 24 * 60 * 60  # 7 days
        )

        logger.debug(f"New access token cookie set: {str(access_token)[:20]}...")
        logger.debug(f"New refresh token cookie set: {str(refresh_token)[:20]}...")