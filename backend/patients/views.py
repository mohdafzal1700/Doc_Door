from datetime import timedelta
from io import BytesIO
import logging

from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q


from math import radians, cos, sin, asin, sqrt
from datetime import datetime

from django.http import Http404
from django.db import transaction

# REST Framework
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import AuthenticationFailed



import traceback


from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError


import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError


from PIL import Image


from doctor.models import User, EmailOTP, Patient, Address, Medical_Record,Appointment,Payment,Schedules,Doctor,PatientLocation,DoctorLocation
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
    
)

# Logger setup
logger = logging.getLogger(__name__)




class CustomTokenObtainPairView(TokenObtainPairView):
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
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        try:
            logger.info("Token refresh attempt")
            logger.info(f"Request cookies: {list(request.COOKIES.keys())}")
            
            refresh_token = request.COOKIES.get("refresh_token")
            if not refresh_token:
                logger.warning("No refresh token found in cookies")
                return Response(
                    {"success": False, "message": "Refresh token not found in cookies"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # logger.info(f"Refresh token found: {refresh_token[:50]}...")
                
            # Create a mutable copy of request.data
            request_data = request.data.copy()
            request_data["refresh"] = refresh_token
            request._mutable = True
            request.data.update(request_data)
            
            response = super().post(request, *args, **kwargs)
            
            if response.status_code != 200:
                logger.warning(f"Token refresh failed: {response.data}")
                return Response(
                    {"success": False, "message": "Refresh token expired or invalid"},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            token = response.data
            access_token = token["access"]
            
            # logger.info(f"New access token generated: {access_token[:50]}...")
            
            res = Response(status=status.HTTP_200_OK)
            res.data = {"success": True, "message": "Access token refreshed"}

            res.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=False,  # Set to True in production
                samesite="Lax",
                path='/',
                max_age=3600
            )

            logger.info(" Access token cookie updated")
            return res
            
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {"success": False, "message": f"Token refresh failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )



class RegisterUserView(generics.CreateAPIView):
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
    permission_classes = [permissions.IsAuthenticated]
    
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
                samesite="None"
            )
            
            res.delete_cookie(
                key="refresh_token", 
                path='/',
                samesite="None"
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
            logger.info(" Request User:", request.user)
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

from rest_framework.parsers import MultiPartParser, FormParser
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
            
            # Cloudinary URLs have format: .../image/upload/v{version}/{public_id}.{format}
            if '/image/upload/' in cloudinary_url:
                parts = cloudinary_url.split('/image/upload/')
                if len(parts) > 1:
                    # Get everything after /image/upload/v{version}/
                    after_upload = parts[1]
                    # Remove version if present (v1234567890/)
                    if after_upload.startswith('v') and '/' in after_upload:
                        after_upload = after_upload.split('/', 1)[1]
                    # Remove file extension
                    public_id = after_upload.rsplit('.', 1)[0]
                    return public_id
            return None
        except Exception as e:
            logger.warning(f"Failed to extract public_id from URL: {e}")
            return None

    def _update_user_profile(self, user, url):
        """Update user profile with new picture URL"""
        try:
            # Update user.profile_url if it exists
            if hasattr(user, 'profile_url'):
                user.profile_url = url
                user.save()
            logger.debug(f"Updated user profile URL for user: {user.id}")
        except Exception as e:
            logger.warning(f"Failed to update user profile URL: {e}")
            
            
class PatientDoctorView(APIView):
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
            
            # Only show active AND approved doctors to patients
            queryset = User.objects.filter(
                role='doctor',
                is_active=True,
                doctor_profile__verification_status='approved'  # Added this crucial filter
            ).select_related('doctor_profile').prefetch_related(
                'doctor_profile__educations',
                'doctor_profile__certifications'
            )
            
            # Optional filtering by specialization
            specialization = request.GET.get('specialization', '')
            if specialization:
                queryset = queryset.filter(doctor_profile__specialization__icontains=specialization)
            
            # Optional filtering by location/city
            location = request.GET.get('location', '')
            if location:
                queryset = queryset.filter(doctor_profile__location__icontains=location)
            
            # Optional search by name or clinic
            search = request.GET.get('search', '')
            if search:
                queryset = queryset.filter(
                    Q(first_name__icontains=search) |
                    Q(last_name__icontains=search) |
                    Q(doctor_profile__clinic_name__icontains=search)
                )
            
            # Optional ordering
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
            
            
            
            # Check if user has patient profile
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
                
                
                # Check if there are any medical records in the system
                total_records = Medical_Record.objects.count()
                
                # List all medical records for debugging
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
            appointment.status = 'cancelled'
            appointment.save()
            logger.info(f"Appointment {appointment_id} cancelled")
            
            return Response({
                'success': True,
                'message': 'Appointment cancelled successfully'
            }, status=status.HTTP_200_OK)
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
    """Doctor schedules with time slot availability - Alternative approach"""
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

class PaymentView(APIView):
    """Payment processing for appointments"""
    permission_classes = [IsAuthenticated]

    def post(self, request, appointment_id):
        try:
            appointment = get_object_or_404(
                Appointment,
                id=appointment_id,
                patient__user=request.user
            )

            # Get or create payment record
            payment, created = Payment.objects.get_or_create(
                appointment=appointment,
                defaults={
                    'amount': appointment.total_fee,
                    'method': request.data.get('method', 'card'),
                    'status': 'pending'
                }
            )

            # Update payment details
            payment.method = request.data.get('method', payment.method)
            payment.status = request.data.get('status', 'success')
            payment.remarks = request.data.get('remarks', '')

            if payment.status == 'success':
                payment.paid_at = timezone.now()
                appointment.is_paid = True
                appointment.status = 'confirmed'
                appointment.save()

            payment.save()

            serializer = PaymentSerializer(payment)
            return Response({
                'message': 'Payment processed successfully',
                'payment': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': 'Payment processing failed',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            




# Set up logger
logger = logging.getLogger(__name__)

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
        logger.debug("="*50)
        logger.debug("UpdatePatientLocationView.create() called")
        logger.debug(f"User: {request.user.id} ({request.user.username})")
        logger.debug(f"Request data: {request.data}")
        
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
    """GET /search/nearby-doctors/ - Find nearby doctors based on patient location"""
    serializer_class = DoctorLocationSerializer
    permission_classes = [IsAuthenticated]
    
    def calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance between two coordinates using Haversine formula"""
        try:
            lat1, lng1, lat2, lng2 = map(radians, [float(lat1), float(lng1), float(lat2), float(lng2)])
            dlng = lng2 - lng1
            dlat = lat2 - lat1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
            c = 2 * asin(sqrt(a))
            r = 6371  # Earth's radius in km
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
            
            
            try:
                doctor_locations = DoctorLocation.objects.filter(
                    doctor__user__is_active=True  # Filter by user's active status
                ).select_related('doctor', 'doctor__user')
                
                
                
            except Exception as query_error:
                logger.error(f"Error in doctor query: {str(query_error)}")
                # Fallback to even simpler query
                doctor_locations = DoctorLocation.objects.select_related(
                    'doctor', 'doctor__user'
                )
            
            logger.debug(f"Found {doctor_locations.count()} total doctor locations")
            
            # Calculate distances and filter by radius
            nearby_locations = []
            for location in doctor_locations:
                try:
                    # Skip if doctor or user is None
                    if not location.doctor or not location.doctor.user:
                        continue
                    
                    # Skip if user is not active
                    if not location.doctor.user.is_active:
                        continue
                        
                    distance = self.calculate_distance(
                        patient_lat, patient_lng,
                        location.latitude, location.longitude
                    )
                    
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
            
                
                
