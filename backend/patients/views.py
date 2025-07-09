# Django imports
from django.shortcuts import render, get_object_or_404
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
# REST framework core imports
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import AuthenticationFailed
from django.db.models import Q
# JWT (SimpleJWT) imports
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# Project-specific models and serializers
from doctor.models import User, EmailOTP, Patient, Address
from patients.serializers import (
    ProfilePictureSerializer,
    CustomTokenObtainPairSerializer,
    AddressSerializer,
    AddressListSerializer,
    CustomUserCreateSerializer,
    EmailOTPVerifySerializer,
    ResendOTPSerializer,
    ResetPasswordSerializer,
    ForgotPasswordSerializer,
    VerifyForgotPasswordOTPSerializer,
    UserProfileSerializer
)

from doctor.serializers import DoctorProfileSerializer

# Cloudinary imports for image handling
import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError

# Other utilities
from datetime import timedelta
from PIL import Image
from io import BytesIO
import logging

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
        print(f"DEBUG - Request data: {request.data}")
        
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
                print(f"DEBUG - Save error: {str(e)}")
                return Response({
                    'success': False,
                    'message': f'An error occurred while resetting password: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.error(f"Password reset validation errors: {serializer.errors}")
        print(f"DEBUG - Validation errors: {serializer.errors}")
        
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
            print("🔍 Request User:", request.user)
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