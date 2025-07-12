from django.shortcuts import render
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework import status
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from .serializers import DoctorProfileSerializer,DoctorEducationSerializer,DoctorCertificationSerializer,DoctorProofSerializer,VerificationStatusSerializer,SchedulesSerializer,ServiceSerializer
from .models import Doctor,DoctorEducation,DoctorProof,DoctorCertification,Schedules,Service
import logging
from rest_framework.views import APIView
from doctor.serializers import CustomDoctorTokenObtainPairSerializer
# Create your views here.
logger = logging.getLogger(__name__)
from .models import DoctorLocation
from .serializers import DoctorLocationSerializer, DoctorLocationUpdateSerializer


from rest_framework.generics import ListAPIView, UpdateAPIView
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
from datetime import datetime, date
from .models import Appointment, Doctor
from patients.serializers import AppointmentSerializer

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
import logging

logger = logging.getLogger(__name__)



class DoctorLoginView(TokenObtainPairView):
    """
    Custom login view specifically for doctors
    """
    serializer_class = CustomDoctorTokenObtainPairSerializer
    permission_classes= [AllowAny]
        
    def post(self, request, *args, **kwargs):
        try:
            logger.info(f"Doctor login attempt with data: {request.data.keys()}")
                        
            # Call parent post method which will handle validation through serializer
            response = super().post(request, *args, **kwargs)
                        
            # If successful, set cookies and modify response
            if response.status_code == 200:
                try:
                    token_data = response.data
                    access_token = token_data['access']
                    refresh_token = token_data['refresh']
                    user_data = token_data.get('user', {})
                    
                    logger.info("Doctor tokens generated successfully")
                    
                    # Create new response with cookies
                    res = Response(status=status.HTTP_200_OK)
                    
                    res.data = {
                        'success': True,
                        'message': 'Doctor login successful',
                        'access_token': access_token,
                        'refresh_token': refresh_token,
                        'userDetails': {
                            'id': user_data.get('id'),
                            'email': user_data.get('email'),
                            'first_name': user_data.get('first_name', ''),
                            'last_name': user_data.get('last_name', ''),
                            'role': user_data.get('role', 'doctor'),
                            'is_active': user_data.get('is_active', True),
                            'doctor_profile': user_data.get('doctor_profile')
                        }
                    }
                    
                    # Set cookies for token refresh
                    res.set_cookie(
                        key="access_token",
                        value=access_token,
                        httponly=True,
                        secure=False,  # Set to True in production
                        samesite="Lax",
                        path='/',
                        max_age=3600  # 1 hour
                    )

                    res.set_cookie(
                        key="refresh_token",
                        value=refresh_token,
                        httponly=True,
                        secure=False,  # Set to True in production
                        samesite="Lax",
                        path='/',
                        max_age=86400  # 24 hours
                    )
                    
                    logger.info(f"Doctor login successful for: {user_data.get('email')}")
                    logger.info("Doctor cookies set successfully")
                    return res
                                    
                except Exception as token_error:
                    logger.error(f"Error in token processing: {str(token_error)}")
                    return Response(
                        {'success': False, 'error': 'Error processing login tokens'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            else:
                # Return the error from serializer validation
                logger.warning(f"Doctor authentication failed: {response.data}")
                return Response(
                    {'success': False, 'error': response.data.get('detail', 'Authentication failed')},
                    status=response.status_code
                )
                    
        except AuthenticationFailed as e:
            logger.warning(f"Doctor authentication failed: {str(e)}")
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"Unexpected error in doctor login: {str(e)}", exc_info=True)
            return Response(
                {'success': False, 'error': 'An error occurred during login'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
            
            

class DoctorProfileView(APIView):
    """Handle doctor profile operations"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        """Get doctor profile data"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            serializer = DoctorProfileSerializer(request.user)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to fetch doctor profile',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        """Update doctor profile data"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            serializer = DoctorProfileSerializer(
                request.user, 
                data=request.data, 
                partial=True
            )
            
            if serializer.is_valid():
                updated_user = serializer.save()
                response_serializer = DoctorProfileSerializer(updated_user)
                return Response({
                    'success': True,
                    'message': 'Doctor profile updated successfully',
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
                'message': 'Failed to update doctor profile',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DoctorEducationView(APIView):
    """Handle doctor education operations"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        """Get doctor education list"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get or create doctor profile
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Get all education records for this doctor
            education_records = DoctorEducation.objects.filter(doctor=doctor)
            serializer = DoctorEducationSerializer(education_records, many=True)
            
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to fetch education records',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Create new education record"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get or create doctor profile
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            serializer = DoctorEducationSerializer(data=request.data)
            
            if serializer.is_valid():
                # Save with the doctor instance
                education_record = serializer.save(doctor=doctor)
                
                # Return the created record
                response_serializer = DoctorEducationSerializer(education_record)
                
                return Response({
                    'success': True,
                    'message': 'Education record added successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
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
                'message': 'Failed to create education record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        """Update education record"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get education record ID from request data
            education_id = request.data.get('id')
            if not education_id:
                return Response({
                    'success': False,
                    'message': 'Education record ID is required for update'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get doctor profile
            doctor = get_object_or_404(Doctor, user=request.user)
            
            # Get specific education record
            education_record = get_object_or_404(
                DoctorEducation, 
                id=education_id, 
                doctor=doctor
            )
            
            serializer = DoctorEducationSerializer(
                education_record,
                data=request.data,
                partial=True
            )
            
            if serializer.is_valid():
                updated_record = serializer.save()
                response_serializer = DoctorEducationSerializer(updated_record)
                
                return Response({
                    'success': True,
                    'message': 'Education record updated successfully',
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
                'message': 'Failed to update education record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Delete education record"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get education record ID from request data
            education_id = request.data.get('id')
            if not education_id:
                return Response({
                    'success': False,
                    'message': 'Education record ID is required for deletion'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get doctor profile
            doctor = get_object_or_404(Doctor, user=request.user)
            
            # Get and delete specific education record
            education_record = get_object_or_404(
                DoctorEducation, 
                id=education_id, 
                doctor=doctor
            )
            
            education_record.delete()
            
            return Response({
                'success': True,
                'message': 'Education record deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to delete education record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DoctorCertificationView(APIView):
    """Handle doctor certification operations"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        """Get doctor certification list"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get or create doctor profile
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Get all certification records for this doctor
            certification_records = DoctorCertification.objects.filter(doctor=doctor)
            serializer = DoctorCertificationSerializer(certification_records, many=True)
            
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to fetch certification records',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Create new certification record"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get or create doctor profile
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            serializer = DoctorCertificationSerializer(data=request.data)
            
            if serializer.is_valid():
                # Save with the doctor instance
                certification_record = serializer.save(doctor=doctor)
                
                # Return the created record
                response_serializer = DoctorCertificationSerializer(certification_record)
                
                return Response({
                    'success': True,
                    'message': 'Certification record added successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
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
                'message': 'Failed to create certification record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        """Update certification record"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get certification record ID from request data
            certification_id = request.data.get('id')
            if not certification_id:
                return Response({
                    'success': False,
                    'message': 'Certification record ID is required for update'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get doctor profile
            doctor = get_object_or_404(Doctor, user=request.user)
            
            # Get specific certification record
            certification_record = get_object_or_404(
                DoctorCertification, 
                id=certification_id, 
                doctor=doctor
            )
            
            serializer = DoctorCertificationSerializer(
                certification_record,
                data=request.data,
                partial=True
            )
            
            if serializer.is_valid():
                updated_record = serializer.save()
                response_serializer = DoctorCertificationSerializer(updated_record)
                
                return Response({
                    'success': True,
                    'message': 'Certification record updated successfully',
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
                'message': 'Failed to update certification record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Delete certification record"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get certification record ID from request data
            certification_id = request.data.get('id')
            if not certification_id:
                return Response({
                    'success': False,
                    'message': 'Certification record ID is required for deletion'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get doctor profile
            doctor = get_object_or_404(Doctor, user=request.user)
            
            # Get and delete specific certification record
            certification_record = get_object_or_404(
                DoctorCertification, 
                id=certification_id, 
                doctor=doctor
            )
            
            certification_record.delete()
            
            return Response({
                'success': True,
                'message': 'Certification record deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to delete certification record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class LicenseUploadView(APIView):
    
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        try:
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor',
                }, status=status.HTTP_403_FORBIDDEN)
                
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Since there should be only one DoctorProof per doctor, get it directly
            try:
                license_record = DoctorProof.objects.get(doctor=doctor)
                serializer = DoctorProofSerializer(license_record)
                return Response({
                    'success': True,
                    'data': serializer.data
                }, status=status.HTTP_200_OK)
            except DoctorProof.DoesNotExist:
                return Response({
                    'success': True,
                    'data': None,
                    'message': 'No license record found'
                }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to fetch license records',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        try:
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor'
                }, status=status.HTTP_403_FORBIDDEN)
                
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Check if a DoctorProof already exists for this doctor
            try:
                existing_license = DoctorProof.objects.get(doctor=doctor)
                # Update existing record
                serializer = DoctorProofSerializer(existing_license, data=request.data, partial=True)
                
                if serializer.is_valid():
                    license_record = serializer.save()
                    response_serializer = DoctorProofSerializer(license_record)
                    
                    return Response({
                        'success': True,
                        'message': 'License record updated successfully',
                        'data': response_serializer.data
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        'success': False,
                        'field_errors': serializer.errors,
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
            except DoctorProof.DoesNotExist:
                # Create new record
                serializer = DoctorProofSerializer(data=request.data)
                
                if serializer.is_valid():
                    license_record = serializer.save(doctor=doctor)
                    response_serializer = DoctorProofSerializer(license_record)
                    
                    return Response({
                        'success': True,
                        'message': 'License record created successfully',
                        'data': response_serializer.data
                    }, status=status.HTTP_201_CREATED)
                else:
                    return Response({
                        'success': False,
                        'field_errors': serializer.errors,
                    }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to process license record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        """Update license record"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get doctor profile
            doctor = get_object_or_404(Doctor, user=request.user)
            
            # Get the license record for this doctor
            license_record = get_object_or_404(DoctorProof, doctor=doctor)
            
            serializer = DoctorProofSerializer(
                license_record,
                data=request.data,
                partial=True
            )
            
            if serializer.is_valid():
                updated_record = serializer.save()
                response_serializer = DoctorProofSerializer(updated_record)
                
                return Response({
                    'success': True,
                    'message': 'License record updated successfully',
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
                'message': 'Failed to update license record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Delete license record"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get doctor profile
            doctor = get_object_or_404(Doctor, user=request.user)
            
            # Get and delete the license record
            license_record = get_object_or_404(DoctorProof, doctor=doctor)
            license_record.delete()
            
            return Response({
                'success': True,
                'message': 'License record deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to delete license record',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DoctorVerificationStatusView(APIView):
    """Handle doctor verification status checks"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Check and return current verification status"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get doctor profile
            try:
                doctor = Doctor.objects.get(user=request.user)
            except Doctor.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Doctor profile not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Force check verification completion
            current_status = doctor.check_verification_completion()
            
            
            doctor.refresh_from_db()
            
            # Get rejection reasons - check multiple possible sources
            rejection_reasons = []
            if doctor.verification_status == 'rejected':
            
                if doctor.admin_comment:
                    # If admin_comment contains multiple reasons separated by newlines or semicolons
                    if '\n' in doctor.admin_comment:
                        rejection_reasons = [reason.strip() for reason in doctor.admin_comment.split('\n') if reason.strip()]
                    elif ';' in doctor.admin_comment:
                        rejection_reasons = [reason.strip() for reason in doctor.admin_comment.split(';') if reason.strip()]
                    else:
                        rejection_reasons = [doctor.admin_comment.strip()]
                else:
                    # Default rejection reasons if no admin comment found
                    rejection_reasons = [
                        "Please review and update your submitted documents",
                        "Additional verification required"
                    ]
                # Default rejection reasons if none found
                
            
            return Response({
                'success': True,
                'data': {
                    'verification_status': doctor.verification_status,
                    'is_profile_setup_done': doctor.is_profile_setup_done,
                    'is_education_done': doctor.is_education_done,
                    'is_certification_done': doctor.is_certification_done,
                    'is_license_done': doctor.is_license_done,
                    'rejection_reasons': rejection_reasons,
                    'admin_comment': doctor.admin_comment 
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to check verification status',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Force refresh verification status"""
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. User is not a doctor.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get doctor profile
            try:
                doctor = Doctor.objects.get(user=request.user)
            except Doctor.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Doctor profile not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Force recheck all completion statuses
            doctor.check_profile_completion()
            doctor.check_education_completion()
            doctor.check_certification_completion()
            doctor.check_license_completion()
            
            # Check overall verification
            current_status = doctor.check_verification_completion()
            
            # Get updated doctor data
            doctor.refresh_from_db()
            
            # Get rejection reasons for refresh response too
            rejection_reasons = []
            if doctor.verification_status == 'rejected':
                if doctor.admin_comment:
                    # If admin_comment contains multiple reasons separated by newlines or semicolons
                    if '\n' in doctor.admin_comment:
                        rejection_reasons = [reason.strip() for reason in doctor.admin_comment.split('\n') if reason.strip()]
                    elif ';' in doctor.admin_comment:
                        rejection_reasons = [reason.strip() for reason in doctor.admin_comment.split(';') if reason.strip()]
                    else:
                        rejection_reasons = [doctor.admin_comment.strip()]
                else:
                    # Default rejection reasons if no admin comment found
                    rejection_reasons = [
                        "Please review and update your submitted documents",
                        "Additional verification required"
                    ]
            
            return Response({
                'success': True,
                'message': 'Verification status refreshed successfully',
                'data': {
                    'verification_status': doctor.verification_status,
                    'is_profile_setup_done': doctor.is_profile_setup_done,
                    'is_education_done': doctor.is_education_done,
                    'is_certification_done': doctor.is_certification_done,
                    'is_license_done': doctor.is_license_done,
                    'rejection_reasons': rejection_reasons,
                    'admin_comment': doctor.admin_comment 
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to refresh verification status',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            

class ServiceView(APIView):
    """Handle service operations with doctor-specific filtering"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        """Get service list filtered by user role"""
        try:
            # Check user role and filter accordingly
            if hasattr(request.user, 'role') and request.user.role == 'doctor':
                # Get the Doctor instance for this user
                doctor = get_object_or_404(Doctor, user=request.user)
                # Now filter using the Doctor instance
                services = Service.objects.filter(doctor=doctor).order_by('service_name')
            else:
                # Admin or other roles see all services
                services = Service.objects.all().select_related('doctor').order_by('service_name')
            
            serializer = ServiceSerializer(services, many=True)
            
            return Response({
                'success': True,
                'data': serializer.data,
                'count': services.count()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to fetch services',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    def post(self, request):
        """Create new service (only doctors can create)"""
        try:
            # Check if user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. Only doctors can create services.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get or create doctor profile
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            serializer = ServiceSerializer(data=request.data)
            
            if serializer.is_valid():
                # Auto-assign the doctor to the service
                service = serializer.save(doctor=doctor)
                response_serializer = ServiceSerializer(service)
                
                return Response({
                    'success': True,
                    'message': 'Service created successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
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
                'message': 'Failed to create service',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        """Update service (only own services)"""
        try:
            service_id = request.data.get('id')
            if not service_id:
                return Response({
                    'success': False,
                    'message': 'Service ID is required for update'
                }, status=status.HTTP_400_BAD_REQUEST)

            service = get_object_or_404(Service, id=service_id)
            
            # Check if user has permission to update this service
            if hasattr(request.user, 'role') and request.user.role == 'doctor':
                doctor = get_object_or_404(Doctor, user=request.user)
                if service.doctor != doctor:
                    return Response({
                        'success': False,
                        'message': 'You can only update your own services.'
                    }, status=status.HTTP_403_FORBIDDEN)
            
            serializer = ServiceSerializer(
                service,
                data=request.data,
                partial=True
            )
            
            if serializer.is_valid():
                updated_service = serializer.save()
                response_serializer = ServiceSerializer(updated_service)
                
                return Response({
                    'success': True,
                    'message': 'Service updated successfully',
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
                'message': 'Failed to update service',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Delete service (only own services)"""
        try:
            service_id = request.data.get('id')
            if not service_id:
                return Response({
                    'success': False,
                    'message': 'Service ID is required for deletion'
                }, status=status.HTTP_400_BAD_REQUEST)

            service = get_object_or_404(Service, id=service_id)
            
            # Check if user has permission to delete this service
            if hasattr(request.user, 'role') and request.user.role == 'doctor':
                doctor = get_object_or_404(Doctor, user=request.user)
                if service.doctor != doctor:
                    return Response({
                        'success': False,
                        'message': 'You can only delete your own services.'
                    }, status=status.HTTP_403_FORBIDDEN)
            
            # Check if service has associated schedules
            if service.schedules_set.exists():
                return Response({
                    'success': False,
                    'message': 'Cannot delete service with existing schedules. Please delete schedules first.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            service.delete()
            
            return Response({
                'success': True,
                'message': 'Service deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to delete service',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ScheduleView(APIView):
    """Handle schedule operations with doctor-specific filtering"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        """Get schedule list filtered by user role"""
        try:
            # Check user role and filter accordingly
            if hasattr(request.user, 'role') and request.user.role == 'doctor':
                # Doctor sees only their schedules
                try:
                    doctor = Doctor.objects.get(user=request.user)
                    schedules = Schedules.objects.filter(doctor=doctor).select_related('doctor', 'service')
                except Doctor.DoesNotExist:
                    # If doctor profile doesn't exist, return empty list
                    schedules = Schedules.objects.none()
            else:
                # Admin or other roles see all schedules
                schedules = Schedules.objects.select_related('doctor', 'service').all()
            
            schedules = schedules.order_by('date', 'start_time')
            
            serializer = SchedulesSerializer(schedules, many=True)
            
            return Response({
                'success': True,
                'data': serializer.data,
                'count': schedules.count()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to fetch schedules',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Create new schedule (only doctors can create)"""
        print("Received data:", request.data)
        try:
            # Check if user has doctor role
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Access denied. Only doctors can create schedules.',
                }, status=status.HTTP_403_FORBIDDEN)

            # Get or create doctor profile
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Validate that the service belongs to this doctor
            service_id = request.data.get('service')
            if service_id:
                try:
                    service = Service.objects.get(id=service_id, doctor=doctor)
                except Service.DoesNotExist:
                    return Response({
                        'success': False,
                        'message': 'You can only create schedules for your own services.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = SchedulesSerializer(data=request.data)
            
            if serializer.is_valid():
                # Auto-assign the doctor to the schedule
                schedule = serializer.save(doctor=doctor)
                response_serializer = SchedulesSerializer(schedule)
                
                return Response({
                    'success': True,
                    'message': 'Schedule created successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
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
                'message': 'Failed to create schedule',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request,schedule_id=None):
        """Update schedule (only own schedules)"""
        try:
            if not schedule_id:
                schedule_id = request.data.get('id')
            
            if not schedule_id:
                return Response({
                    'success': False,
                    'message': 'Schedule ID is required for update'
                }, status=status.HTTP_400_BAD_REQUEST)

            schedule = get_object_or_404(
                Schedules.objects.select_related('doctor', 'service'), 
                id=schedule_id
            )
            
            # Check if user has permission to update this schedule
            if hasattr(request.user, 'role') and request.user.role == 'doctor':
                doctor = get_object_or_404(Doctor, user=request.user)
                if schedule.doctor != doctor:
                    return Response({
                        'success': False,
                        'message': 'You can only update your own schedules.'
                    }, status=status.HTTP_403_FORBIDDEN)
                
                # If service is being updated, validate it belongs to this doctor
                service_id = request.data.get('service')
                if service_id and service_id != schedule.service.id:
                    try:
                        service = Service.objects.get(id=service_id, doctor=doctor)
                    except Service.DoesNotExist:
                        return Response({
                            'success': False,
                            'message': 'You can only assign your own services to schedules.'
                        }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = SchedulesSerializer(
                schedule,
                data=request.data,
                partial=True
            )
            
            if serializer.is_valid():
                updated_schedule = serializer.save()
                response_serializer = SchedulesSerializer(updated_schedule)
                
                return Response({
                    'success': True,
                    'message': 'Schedule updated successfully',
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
                'message': 'Failed to update schedule',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request,schedule_id=None):
        """Delete schedule (only own schedules)"""
        try:
            if not schedule_id:
                schedule_id = request.data.get('id')
            
            if not schedule_id:
                return Response({
                    'success': False,
                    'message': 'Schedule ID is required for deletion'
                }, status=status.HTTP_400_BAD_REQUEST)

            schedule = get_object_or_404(Schedules, id=schedule_id)
            
            # Check if user has permission to delete this schedule
            if hasattr(request.user, 'role') and request.user.role == 'doctor':
                doctor = get_object_or_404(Doctor, user=request.user)
                if schedule.doctor != doctor:
                    return Response({
                        'success': False,
                        'message': 'You can only delete your own schedules.'
                    }, status=status.HTTP_403_FORBIDDEN)
            
            # Check if schedule has bookings (if you have booking model)
            # if schedule.bookings.exists():
            #     return Response({
            #         'success': False,
            #         'message': 'Cannot delete schedule with existing bookings.'
            #     }, status=status.HTTP_400_BAD_REQUEST)
            
            schedule.delete()
            
            return Response({
                'success': True,
                'message': 'Schedule deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': 'Failed to delete schedule',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import logging
from decimal import Decimal

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q

# Configure logger
logger = logging.getLogger(__name__)

# Custom exception for better error handling


class DoctorLocationCreateView(generics.CreateAPIView):
    """Add new doctor location"""
    serializer_class = DoctorLocationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_doctor(self):
        """Get the doctor instance for the authenticated user"""
        try:
            logger.debug(f"Getting doctor for user: {self.request.user.id}")
            if not hasattr(self.request.user, 'doctor_profile'):
                logger.error(f"User {self.request.user.id} does not have a doctor profile")
                raise ValidationError("User is not associated with a doctor profile")
            return self.request.user.doctor_profile
        except AttributeError as e:
            logger.error(f"AttributeError getting doctor for user {self.request.user.id}: {str(e)}")
            raise ValidationError("User is not associated with a doctor profile")
        except Exception as e:
            logger.error(f"Unexpected error getting doctor for user {self.request.user.id}: {str(e)}")
            raise ValidationError("Error retrieving doctor profile")
    
    def perform_create(self, serializer):
        """Create or update doctor location with proper debugging"""
        try:
            doctor = self.get_doctor()
            location_data = serializer.validated_data
            
            logger.info(f"Creating/updating location for doctor {doctor.id}: {location_data}")
            
            # Validate required fields
            if not location_data.get('latitude') or not location_data.get('longitude'):
                logger.error(f"Missing latitude/longitude in location data: {location_data}")
                raise ValidationError("Latitude and longitude are required")
            
            with transaction.atomic():
                # Check if location with same coordinates already exists (within tolerance)
                tolerance = Decimal('0.0001')
                lat = Decimal(str(location_data.get('latitude')))
                lng = Decimal(str(location_data.get('longitude')))
                
                logger.debug(f"Checking for existing location near lat: {lat}, lng: {lng} with tolerance: {tolerance}")
                
                existing_location = DoctorLocation.objects.filter(
                    doctor=doctor,
                    latitude__range=(lat - tolerance, lat + tolerance),
                    longitude__range=(lng - tolerance, lng + tolerance),
                    is_active=True
                ).first()
                
                if existing_location:
                    logger.info(f"Found existing location {existing_location.id} for doctor {doctor.id}")
                    
                    # Update existing location instead of creating duplicate
                    if location_data.get('is_current', False):
                        logger.debug(f"Setting location {existing_location.id} as current")
                        DoctorLocation.objects.filter(
                            doctor=doctor, 
                            is_current=True
                        ).update(is_current=False)
                    
                    # Update the existing location
                    for field, value in location_data.items():
                        old_value = getattr(existing_location, field, None)
                        setattr(existing_location, field, value)
                        logger.debug(f"Updated {field}: {old_value} -> {value}")
                    
                    existing_location.save()
                    logger.info(f"Successfully updated existing location {existing_location.id}")
                    return existing_location
                else:
                    logger.info(f"Creating new location for doctor {doctor.id}")
                    
                    # Handle is_current field for new locations
                    if location_data.get('is_current', False):
                        logger.debug(f"Setting new location as current for doctor {doctor.id}")
                        DoctorLocation.objects.filter(
                            doctor=doctor, 
                            is_current=True
                        ).update(is_current=False)
                    
                    # Create new location
                    new_location = serializer.save(doctor=doctor)
                    logger.info(f"Successfully created new location {new_location.id} for doctor {doctor.id}")
                    return new_location
                    
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error in perform_create for doctor location: {str(e)}", exc_info=True)
            raise ValidationError("Failed to create/update doctor location")


class DoctorLocationListView(generics.ListAPIView):
    """List all doctor locations"""
    serializer_class = DoctorLocationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get queryset with proper error handling"""
        try:
            logger.debug(f"Getting locations for user: {self.request.user.id}")
            
            # Make sure the user has a doctor profile
            if not hasattr(self.request.user, 'doctor_profile'):
                logger.error(f"User {self.request.user.id} does not have a doctor profile")
                return DoctorLocation.objects.none()
            
            queryset = DoctorLocation.objects.filter(
                doctor=self.request.user.doctor_profile,
                is_active=True
            ).order_by('-created_at')
            
            logger.debug(f"Found {queryset.count()} locations for doctor {self.request.user.doctor_profile.id}")
            return queryset
            
        except Exception as e:
            logger.error(f"Error in get_queryset: {str(e)}", exc_info=True)
            return DoctorLocation.objects.none()
    
    def list(self, request, *args, **kwargs):
        """List locations with comprehensive error handling"""
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            
            logger.info(f"Retrieved {len(serializer.data)} locations for user {request.user.id}")
            
            return Response({
                'count': len(serializer.data),
                'results': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error in list method for user {request.user.id}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve locations', 'detail': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DoctorLocationUpdateView(generics.UpdateAPIView):
    """Update doctor location"""
    serializer_class = DoctorLocationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_doctor(self):
        """Get the doctor instance for the authenticated user"""
        try:
            logger.debug(f"Getting doctor for update operation, user: {self.request.user.id}")
            if not hasattr(self.request.user, 'doctor_profile'):
                logger.error(f"User {self.request.user.id} does not have a doctor profile")
                raise ValidationError("User is not associated with a doctor profile")
            return self.request.user.doctor_profile
        except AttributeError as e:
            logger.error(f"AttributeError getting doctor for user {self.request.user.id}: {str(e)}")
            raise ValidationError("User is not associated with a doctor profile")
    
    def get_queryset(self):
        """Get queryset for update operations"""
        try:
            doctor = self.get_doctor()
            queryset = DoctorLocation.objects.filter(
                doctor=doctor,
                is_active=True
            )
            logger.debug(f"Update queryset contains {queryset.count()} locations for doctor {doctor.id}")
            return queryset
        except Exception as e:
            logger.error(f"Error getting queryset for update: {str(e)}", exc_info=True)
            return DoctorLocation.objects.none()
    
    def get_object(self):
        """Get object with proper error handling"""
        try:
            obj = super().get_object()
            logger.debug(f"Retrieved location {obj.id} for update")
            return obj
        except ObjectDoesNotExist:
            logger.error(f"Location not found for update, user: {self.request.user.id}")
            raise NotFound("Location not found")
        except Exception as e:
            logger.error(f"Error getting object for update: {str(e)}", exc_info=True)
            raise ValidationError("Error retrieving location")
    
    def perform_update(self, serializer):
        """Update location with proper debugging"""
        try:
            doctor = self.get_doctor()
            location_data = serializer.validated_data
            current_location = self.get_object()
            
            logger.info(f"Updating location {current_location.id} for doctor {doctor.id}: {location_data}")
            
            with transaction.atomic():
                # If setting this location as current, unset others
                if location_data.get('is_current', False):
                    logger.debug(f"Setting location {current_location.id} as current")
                    updated_count = DoctorLocation.objects.filter(
                        doctor=doctor, 
                        is_current=True
                    ).exclude(id=current_location.id).update(is_current=False)
                    logger.debug(f"Set {updated_count} other locations as not current")
                
                serializer.save()
                logger.info(f"Successfully updated location {current_location.id}")
                
        except Exception as e:
            logger.error(f"Error in perform_update: {str(e)}", exc_info=True)
            raise ValidationError("Failed to update location")


class DoctorLocationUpdateCurrentView(generics.CreateAPIView):
    """Update doctor's current location - similar to patient location update"""
    serializer_class = DoctorLocationUpdateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_doctor(self):
        """Get the doctor instance for the authenticated user"""
        try:
            logger.debug(f"Getting doctor for current location update, user: {self.request.user.id}")
            if not hasattr(self.request.user, 'doctor_profile'):
                logger.error(f"User {self.request.user.id} does not have a doctor profile")
                raise ValidationError("User is not associated with a doctor profile")
            return self.request.user.doctor_profile
        except AttributeError as e:
            logger.error(f"AttributeError getting doctor for user {self.request.user.id}: {str(e)}")
            raise ValidationError("User is not associated with a doctor profile")
    
    def create(self, request, *args, **kwargs):
        """Create or update current location with comprehensive error handling"""
        try:
            doctor = self.get_doctor()
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            location_data = serializer.validated_data
            logger.info(f"Updating current location for doctor {doctor.id}: {location_data}")
            
            # Validate required fields
            if not location_data.get('latitude') or not location_data.get('longitude'):
                logger.error(f"Missing latitude/longitude in current location data: {location_data}")
                raise ValidationError("Latitude and longitude are required")
            
            with transaction.atomic():
                # Check if location with same coordinates already exists (within tolerance)
                tolerance = Decimal('0.0001')
                lat = Decimal(str(location_data.get('latitude')))
                lng = Decimal(str(location_data.get('longitude')))
                
                logger.debug(f"Checking for existing current location near lat: {lat}, lng: {lng}")
                
                existing_location = DoctorLocation.objects.filter(
                    doctor=doctor,
                    latitude__range=(lat - tolerance, lat + tolerance),
                    longitude__range=(lng - tolerance, lng + tolerance),
                    is_active=True
                ).first()
                
                if existing_location:
                    logger.info(f"Found existing location {existing_location.id}, updating as current")
                    
                    # Update existing location to current and update other fields
                    DoctorLocation.objects.filter(
                        doctor=doctor, 
                        is_current=True
                    ).update(is_current=False)
                    
                    # Update the existing location
                    for field, value in location_data.items():
                        old_value = getattr(existing_location, field, None)
                        setattr(existing_location, field, value)
                        logger.debug(f"Updated {field}: {old_value} -> {value}")
                    
                    existing_location.is_current = True
                    existing_location.save()
                    
                    logger.info(f"Successfully updated existing location {existing_location.id} as current")
                    
                    # Return serialized data
                    return Response(
                        DoctorLocationSerializer(existing_location).data,
                        status=status.HTTP_200_OK
                    )
                else:
                    logger.info(f"Creating new current location for doctor {doctor.id}")
                    
                    # Set all existing locations to not current
                    updated_count = DoctorLocation.objects.filter(
                        doctor=doctor, 
                        is_current=True
                    ).update(is_current=False)
                    logger.debug(f"Set {updated_count} existing locations as not current")
                    
                    # Create new location as current
                    location_data['is_current'] = True
                    location = DoctorLocation.objects.create(
                        doctor=doctor,
                        **location_data
                    )
                    
                    logger.info(f"Successfully created new current location {location.id}")
                    
                    return Response(
                        DoctorLocationSerializer(location).data,
                        status=status.HTTP_201_CREATED
                    )
                    
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error in create current location for doctor: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to update current location', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DoctorLocationDeleteView(generics.DestroyAPIView):
    """Delete doctor location (soft delete by setting is_active=False)"""
    serializer_class = DoctorLocationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_doctor(self):
        """Get the doctor instance for the authenticated user"""
        try:
            logger.debug(f"Getting doctor for delete operation, user: {self.request.user.id}")
            if not hasattr(self.request.user, 'doctor_profile'):
                logger.error(f"User {self.request.user.id} does not have a doctor profile")
                raise ValidationError("User is not associated with a doctor profile")
            return self.request.user.doctor_profile
        except AttributeError as e:
            logger.error(f"AttributeError getting doctor for user {self.request.user.id}: {str(e)}")
            raise ValidationError("User is not associated with a doctor profile")
    
    def get_queryset(self):
        """Get queryset for delete operations"""
        try:
            doctor = self.get_doctor()
            queryset = DoctorLocation.objects.filter(
                doctor=doctor,
                is_active=True
            )
            logger.debug(f"Delete queryset contains {queryset.count()} locations for doctor {doctor.id}")
            return queryset
        except Exception as e:
            logger.error(f"Error getting queryset for delete: {str(e)}", exc_info=True)
            return DoctorLocation.objects.none()
    
    def get_object(self):
        """Get object with proper error handling"""
        try:
            obj = super().get_object()
            logger.debug(f"Retrieved location {obj.id} for delete")
            return obj
        except ObjectDoesNotExist:
            logger.error(f"Location not found for delete, user: {self.request.user.id}")
            raise NotFound("Location not found")
        except Exception as e:
            logger.error(f"Error getting object for delete: {str(e)}", exc_info=True)
            raise ValidationError("Error retrieving location")
    
    def perform_destroy(self, instance):
        """Soft delete with proper debugging and current location handling"""
        try:
            doctor = self.get_doctor()
            logger.info(f"Soft deleting location {instance.id} for doctor {doctor.id}")
            
            was_current = instance.is_current
            
            with transaction.atomic():
                # Soft delete by setting is_active=False
                instance.is_active = False
                instance.is_current = False
                instance.save()
                
                logger.info(f"Successfully soft deleted location {instance.id}")
                
                # If this was the current location, set another location as current if available
                if was_current:
                    logger.debug(f"Deleted location was current, finding replacement")
                    
                    if not DoctorLocation.objects.filter(doctor=doctor, is_current=True, is_active=True).exists():
                        # Set the most recently updated active location as current
                        next_location = DoctorLocation.objects.filter(
                            doctor=doctor,
                            is_active=True
                        ).order_by('-updated_at').first()
                        
                        if next_location:
                            next_location.is_current = True
                            next_location.save()
                            logger.info(f"Set location {next_location.id} as new current location")
                        else:
                            logger.info(f"No active locations remaining for doctor {doctor.id}")
                            
        except Exception as e:
            logger.error(f"Error in perform_destroy: {str(e)}", exc_info=True)
            raise ValidationError("Failed to delete location")


class DoctorCurrentLocationView(generics.ListAPIView):
    """Get doctor's current location"""
    serializer_class = DoctorLocationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_doctor(self):
        """Get the doctor instance for the authenticated user"""
        try:
            logger.debug(f"Getting doctor for current location view, user: {self.request.user.id}")
            if not hasattr(self.request.user, 'doctor_profile'):
                logger.error(f"User {self.request.user.id} does not have a doctor profile")
                raise ValidationError("User is not associated with a doctor profile")
            return self.request.user.doctor_profile
        except AttributeError as e:
            logger.error(f"AttributeError getting doctor for user {self.request.user.id}: {str(e)}")
            raise ValidationError("User is not associated with a doctor profile")
    
    def get_queryset(self):
        """Get current location queryset"""
        try:
            doctor = self.get_doctor()
            queryset = DoctorLocation.objects.filter(
                doctor=doctor,
                is_current=True,
                is_active=True
            )
            logger.debug(f"Current location queryset contains {queryset.count()} locations for doctor {doctor.id}")
            return queryset
        except Exception as e:
            logger.error(f"Error getting current location queryset: {str(e)}", exc_info=True)
            return DoctorLocation.objects.none()
    
    def list(self, request, *args, **kwargs):
        """List current location with proper error handling"""
        try:
            queryset = self.get_queryset()
            
            if not queryset.exists():
                logger.info(f"No current location found for user {request.user.id}")
                return Response(
                    {"message": "No current location set"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = self.get_serializer(queryset, many=True)
            logger.info(f"Retrieved current location for user {request.user.id}")
            
            return Response(serializer.data)
            
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error in current location list: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve current location', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Additional utility functions for debugging
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def debug_doctor_locations(request):
    """Debug endpoint to check doctor locations status"""
    try:
        if not hasattr(request.user, 'doctor_profile'):
            return Response(
                {"error": "User is not associated with a doctor profile"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        doctor = request.user.doctor_profile
        locations = DoctorLocation.objects.filter(doctor=doctor).order_by('-created_at')
        
        debug_info = {
            'doctor_id': doctor.id,
            'total_locations': locations.count(),
            'active_locations': locations.filter(is_active=True).count(),
            'current_locations': locations.filter(is_current=True, is_active=True).count(),
            'locations': [
                {
                    'id': loc.id,
                    'latitude': loc.latitude,
                    'longitude': loc.longitude,
                    'is_current': loc.is_current,
                    'is_active': loc.is_active,
                    'created_at': loc.created_at,
                    'updated_at': loc.updated_at
                }
                for loc in locations
            ]
        }
        
        logger.info(f"Debug info for doctor {doctor.id}: {debug_info}")
        return Response(debug_info)
        
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Debug endpoint failed', 'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
        
        
# views.py - Doctor Appointment Management Views (Enhanced with Request Handling)

import logging
from datetime import datetime, date, timedelta
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated



class DoctorAppointmentsView(ListAPIView):
    """
    List all appointments for the logged-in doctor
    Supports filtering by status, date, and search
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            # Debug: Log user info
            logger.info(f"DoctorAppointmentsView - User: {self.request.user.id}, Has role: {hasattr(self.request.user, 'role')}")
            
            # Ensure user is a doctor
            if not hasattr(self.request.user, 'role') or self.request.user.role != 'doctor':
                logger.warning(f"Access denied - User {self.request.user.id} role: {getattr(self.request.user, 'role', 'No role')}")
                return Appointment.objects.none()
            
            # Get doctor instance - Updated to use doctor_profile
            try:
                doctor = self.request.user.doctor_profile
                logger.info(f"Doctor profile found: {doctor.id}")
            except AttributeError:
                logger.error(f"Doctor profile not found for user {self.request.user.id}")
                # Debug: Check what attributes the user has
                user_attrs = [attr for attr in dir(self.request.user) if not attr.startswith('_')]
                logger.debug(f"User attributes: {user_attrs}")
                return Appointment.objects.none()
            
            # Base queryset - appointments for this doctor
            queryset = Appointment.objects.filter(doctor=doctor).select_related(
                'patient__user', 'doctor__user', 'service', 'schedule'
            ).order_by('-appointment_date', '-slot_time')
            
            logger.info(f"Base queryset count: {queryset.count()}")
            
            # Debug: Log query parameters
            query_params = dict(self.request.query_params)
            logger.debug(f"Query parameters: {query_params}")
            
            # Filter by status
            status_filter = self.request.query_params.get('status', None)
            if status_filter:
                original_count = queryset.count()
                queryset = queryset.filter(status=status_filter)
                logger.debug(f"Status filter '{status_filter}': {original_count} -> {queryset.count()}")
            
            # Filter by date
            date_filter = self.request.query_params.get('date', None)
            if date_filter:
                try:
                    filter_date = datetime.strptime(date_filter, '%Y-%m-%d').date()
                    original_count = queryset.count()
                    queryset = queryset.filter(appointment_date=filter_date)
                    logger.debug(f"Date filter '{date_filter}': {original_count} -> {queryset.count()}")
                except ValueError:
                    logger.warning(f"Invalid date format in filter: {date_filter}")
            
            # Filter by date range
            date_from = self.request.query_params.get('date_from', None)
            date_to = self.request.query_params.get('date_to', None)
            
            if date_from:
                try:
                    from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                    original_count = queryset.count()
                    queryset = queryset.filter(appointment_date__gte=from_date)
                    logger.debug(f"Date from filter '{date_from}': {original_count} -> {queryset.count()}")
                except ValueError:
                    logger.warning(f"Invalid date_from format: {date_from}")
            
            if date_to:
                try:
                    to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
                    original_count = queryset.count()
                    queryset = queryset.filter(appointment_date__lte=to_date)
                    logger.debug(f"Date to filter '{date_to}': {original_count} -> {queryset.count()}")
                except ValueError:
                    logger.warning(f"Invalid date_to format: {date_to}")
            
            # Search by patient name or email
            search = self.request.query_params.get('search', None)
            if search:
                original_count = queryset.count()
                queryset = queryset.filter(
                    Q(patient__user__first_name__icontains=search) |
                    Q(patient__user__last_name__icontains=search) |
                    Q(patient__user__email__icontains=search)
                )
                logger.debug(f"Search filter '{search}': {original_count} -> {queryset.count()}")
            
            logger.info(f"Final queryset count: {queryset.count()}")
            return queryset
            
        except Exception as e:
            logger.error(f"Error in DoctorAppointmentsView.get_queryset: {str(e)}", exc_info=True)
            return Appointment.objects.none()
    
    def list(self, request, *args, **kwargs):
        """Override list to add summary statistics"""
        try:
            logger.info(f"DoctorAppointmentsView.list called by user {request.user.id}")
            queryset = self.get_queryset()
            
            # Debug: Check if queryset is empty
            if not queryset.exists():
                logger.warning("No appointments found for this doctor")
            
            # Calculate statistics
            total_appointments = queryset.count()
            pending_count = queryset.filter(status='pending').count()
            confirmed_count = queryset.filter(status='confirmed').count()
            completed_count = queryset.filter(status='completed').count()
            cancelled_count = queryset.filter(status='cancelled').count()
            
            # Today's appointments
            today = date.today()
            today_appointments = queryset.filter(appointment_date=today).count()
            
            # Debug: Log statistics
            stats = {
                'total': total_appointments,
                'pending': pending_count,
                'confirmed': confirmed_count,
                'completed': completed_count,
                'cancelled': cancelled_count,
                'today': today_appointments
            }
            logger.debug(f"Appointment statistics: {stats}")
            
            # Get paginated results
            page = self.paginate_queryset(queryset)
            if page is not None:
                logger.debug(f"Using pagination, page size: {len(page)}")
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response({
                    'results': serializer.data,
                    'statistics': stats
                })
            
            serializer = self.get_serializer(queryset, many=True)
            logger.info(f"Returning {len(serializer.data)} appointments")
            return Response({
                'results': serializer.data,
                'statistics': stats
            })
            
        except Exception as e:
            logger.error(f"Error in DoctorAppointmentsView.list: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to fetch appointments', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PendingAppointmentRequestsView(ListAPIView):
    """
    List all pending appointment requests for the logged-in doctor
    These are new appointments that need doctor's approval
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            logger.info(f"PendingAppointmentRequestsView - User: {self.request.user.id}")
            
            # Ensure user is a doctor
            if not hasattr(self.request.user, 'role') or self.request.user.role != 'doctor':
                logger.warning(f"Non-doctor user {self.request.user.id} trying to access pending appointments")
                return Appointment.objects.none()
            
            # Get doctor instance - Updated to use doctor_profile
            try:
                doctor = self.request.user.doctor_profile
                logger.info(f"Doctor profile found: {doctor.id}")
            except AttributeError:
                logger.error(f"Doctor profile not found for user {self.request.user.id}")
                return Appointment.objects.none()
            
            # Only pending appointments (new requests)
            queryset = Appointment.objects.filter(
                doctor=doctor,
                status='pending'
            ).select_related(
                'patient__user', 'doctor__user', 'service', 'schedule'
            ).order_by('appointment_date', 'slot_time')
            
            logger.info(f"Pending appointments count: {queryset.count()}")
            return queryset
            
        except Exception as e:
            logger.error(f"Error in PendingAppointmentRequestsView.get_queryset: {str(e)}", exc_info=True)
            return Appointment.objects.none()
    
    def list(self, request, *args, **kwargs):
        """Override to add count of pending requests"""
        try:
            logger.info(f"PendingAppointmentRequestsView.list called by user {request.user.id}")
            queryset = self.get_queryset()
            
            # Count by urgency/date
            today = date.today()
            urgent_count = queryset.filter(appointment_date=today).count()
            
            # Calculate this week's appointments
            this_week_count = queryset.filter(
                appointment_date__gte=today,
                appointment_date__lt=today + timedelta(days=7)
            ).count()
            
            # Debug: Log summary stats
            summary = {
                'total_pending': queryset.count(),
                'urgent_today': urgent_count,
                'this_week': this_week_count
            }
            logger.debug(f"Pending appointments summary: {summary}")
            
            # Get paginated results
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response({
                    'results': serializer.data,
                    'summary': summary
                })
            
            serializer = self.get_serializer(queryset, many=True)
            logger.info(f"Returning {len(serializer.data)} pending appointments")
            return Response({
                'results': serializer.data,
                'summary': summary
            })
            
        except Exception as e:
            logger.error(f"Error in PendingAppointmentRequestsView.list: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to fetch pending appointment requests', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AppointmentRequestActionView(APIView):
    """
    Handle appointment request actions (approve/reject)
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, appointment_id):
        try:
            logger.info(f"AppointmentRequestActionView - User: {request.user.id}, Appointment: {appointment_id}")
            
            # Ensure user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                logger.warning(f"Non-doctor user {request.user.id} trying to handle appointment request")
                return Response(
                    {'error': 'Only doctors can handle appointment requests'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get doctor instance - Updated to use doctor_profile
            try:
                doctor = request.user.doctor_profile
                logger.info(f"Doctor profile found: {doctor.id}")
            except AttributeError:
                logger.error(f"Doctor profile not found for user {request.user.id}")
                return Response(
                    {'error': 'Doctor profile not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get appointment
            appointment = get_object_or_404(
                Appointment, 
                id=appointment_id, 
                doctor=doctor
            )
            
            logger.info(f"Appointment found: {appointment.id}, Status: {appointment.status}")
            
            # Only allow actions on pending appointments
            if appointment.status != 'pending':
                logger.warning(f"Trying to handle non-pending appointment {appointment.id}, status: {appointment.status}")
                return Response(
                    {'error': 'Can only handle pending appointment requests'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get action and reason
            action = request.data.get('action')  # 'approve' or 'reject'
            reason = request.data.get('reason', '')
            
            logger.info(f"Action: {action}, Reason: {reason}")
            
            if action not in ['approve', 'reject']:
                logger.warning(f"Invalid action: {action}")
                return Response(
                    {'error': 'Action must be either "approve" or "reject"'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check for time conflicts when approving
            if action == 'approve':
                # Check if this time slot is already confirmed for another appointment
                conflicting_appointment = Appointment.objects.filter(
                    doctor=doctor,
                    appointment_date=appointment.appointment_date,
                    slot_time=appointment.slot_time,
                    status='confirmed'
                ).exclude(id=appointment.id).first()
                
                if conflicting_appointment:
                    logger.warning(f"Time conflict detected for appointment {appointment.id}")
                    return Response(
                        {
                            'error': 'Time slot conflict detected',
                            'message': f'You already have a confirmed appointment at {appointment.appointment_date} {appointment.slot_time}',
                            'conflicting_appointment_id': conflicting_appointment.id
                        },
                        status=status.HTTP_409_CONFLICT
                    )
                else:
                    logger.info(f"No time conflicts found for appointment {appointment.id}")
            
            # Update appointment status
            new_status = 'confirmed' if action == 'approve' else 'cancelled'
            appointment.status = new_status
            
            # Add action note
            doctor_name = doctor.user.get_full_name() if doctor.user else 'Unknown Doctor'
            action_note = f"[{timezone.now().strftime('%Y-%m-%d %H:%M')}] Request {action}d by Dr. {doctor_name}"
            if reason:
                action_note += f" - Reason: {reason}"
            
            if appointment.notes:
                appointment.notes += f"\n{action_note}"
            else:
                appointment.notes = action_note
            
            appointment.save()
            logger.info(f"Appointment {appointment.id} status updated to {new_status}")
            
            # Prepare response message
            if action == 'approve':
                message = f"Appointment request approved and confirmed for {appointment.appointment_date} at {appointment.slot_time}"
            else:
                message = f"Appointment request rejected"
            
            serializer = AppointmentSerializer(appointment)
            return Response({
                'message': message,
                'appointment': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error in AppointmentRequestActionView.post: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to process appointment request', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UpdateAppointmentStatusView(APIView):
    """
    Update appointment status (confirm, complete, cancel)
    Only the assigned doctor can update their appointments
    """
    permission_classes = [IsAuthenticated]
    
    def put(self, request, appointment_id):
        try:
            logger.info(f"UpdateAppointmentStatusView - User: {request.user.id}, Appointment: {appointment_id}")
            
            # Ensure user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                logger.warning(f"Non-doctor user {request.user.id} trying to update appointment status")
                return Response(
                    {'error': 'Only doctors can update appointment status'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get doctor instance - Updated to use doctor_profile
            try:
                doctor = request.user.doctor_profile
                logger.info(f"Doctor profile found: {doctor.id}")
            except AttributeError:
                logger.error(f"Doctor profile not found for user {request.user.id}")
                return Response(
                    {'error': 'Doctor profile not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get appointment
            appointment = get_object_or_404(
                Appointment, 
                id=appointment_id, 
                doctor=doctor
            )
            
            logger.info(f"Appointment found: {appointment.id}, Current status: {appointment.status}")
            
            # Get new status from request
            new_status = request.data.get('status')
            notes = request.data.get('notes', '')
            
            logger.info(f"Requested status change to: {new_status}")
            
            # Validate status
            valid_statuses = ['pending', 'confirmed', 'cancelled', 'completed']
            if new_status not in valid_statuses:
                logger.warning(f"Invalid status: {new_status}")
                return Response(
                    {'error': f'Invalid status. Must be one of: {valid_statuses}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Business logic for status transitions
            current_status = appointment.status
            
            # Define allowed transitions
            allowed_transitions = {
                'pending': ['confirmed', 'cancelled'],
                'confirmed': ['completed', 'cancelled'],
                'cancelled': [],  # Cannot change from cancelled
                'completed': []   # Cannot change from completed
            }
            
            if new_status not in allowed_transitions.get(current_status, []):
                logger.warning(f"Invalid transition from {current_status} to {new_status}")
                return Response(
                    {
                        'error': f'Cannot change status from {current_status} to {new_status}',
                        'allowed_transitions': allowed_transitions.get(current_status, [])
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Additional validation for completing appointments
            if new_status == 'completed':
                # Check if appointment date/time has passed
                if appointment.appointment_date and appointment.slot_time:
                    appointment_datetime = datetime.combine(
                        appointment.appointment_date, 
                        appointment.slot_time
                    )
                    appointment_datetime = timezone.make_aware(appointment_datetime)
                    
                    logger.debug(f"Appointment datetime: {appointment_datetime}, Current time: {timezone.now()}")
                    
                    if appointment_datetime > timezone.now():
                        logger.warning(f"Trying to complete future appointment {appointment.id}")
                        return Response(
                            {'error': 'Cannot complete future appointments'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
            
            # Update appointment
            appointment.status = new_status
            if notes:
                timestamp = timezone.now().strftime('%Y-%m-%d %H:%M')
                note_text = f"[{timestamp}] {notes}"
                if appointment.notes:
                    appointment.notes += f"\n{note_text}"
                else:
                    appointment.notes = note_text
                logger.debug(f"Added note: {note_text}")
            
            appointment.save()
            logger.info(f"Appointment {appointment.id} status updated from {current_status} to {new_status}")
            
            # Serialize and return updated appointment
            serializer = AppointmentSerializer(appointment)
            return Response({
                'message': f'Appointment status updated to {new_status}',
                'appointment': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error in UpdateAppointmentStatusView.put: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to update appointment status', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DoctorAppointmentDetailView(APIView):
    """
    Get detailed information about a specific appointment
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, appointment_id):
        try:
            logger.info(f"DoctorAppointmentDetailView - User: {request.user.id}, Appointment: {appointment_id}")
            
            # Ensure user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                logger.warning(f"Non-doctor user {request.user.id} trying to view appointment details")
                return Response(
                    {'error': 'Only doctors can view appointment details'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get doctor instance - Updated to use doctor_profile
            try:
                doctor = request.user.doctor_profile
                logger.info(f"Doctor profile found: {doctor.id}")
            except AttributeError:
                logger.error(f"Doctor profile not found for user {request.user.id}")
                return Response(
                    {'error': 'Doctor profile not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get appointment
            appointment = get_object_or_404(
                Appointment, 
                id=appointment_id, 
                doctor=doctor
            )
            
            logger.info(f"Appointment found: {appointment.id}, Status: {appointment.status}")
            
            serializer = AppointmentSerializer(appointment)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error in DoctorAppointmentDetailView.get: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to fetch appointment details', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Additional utility function for debugging
def debug_user_permissions(user):
    """Helper function to debug user permissions and attributes"""
    debug_info = {
        'user_id': user.id,
        'username': user.username,
        'is_authenticated': user.is_authenticated,
        'has_role': hasattr(user, 'role'),
        'role': getattr(user, 'role', None),
        'has_doctor_profile': hasattr(user, 'doctor_profile'),
        'user_type': type(user).__name__,
        'user_attributes': [attr for attr in dir(user) if not attr.startswith('_')]
    }
    
    try:
        if hasattr(user, 'doctor_profile'):
            debug_info['doctor_profile_id'] = user.doctor_profile.id
    except AttributeError:
        debug_info['doctor_profile_error'] = 'AttributeError when accessing doctor_profile'
    
    logger.debug(f"User debug info: {debug_info}")
    return debug_info


            
class DoctorTodayAppointmentsView(ListAPIView):
    """
    Get today's appointments for the logged-in doctor
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Ensure user is a doctor
        if self.request.user.role != 'doctor':
            return Appointment.objects.none()
        
        # Get doctor instance
        try:
            doctor = Doctor.objects.get(user=self.request.user)
        except Doctor.DoesNotExist:
            return Appointment.objects.none()
        
        # Today's appointments
        today = date.today()
        return Appointment.objects.filter(
            doctor=doctor,
            appointment_date=today
        ).select_related(
            'patient__user', 'doctor__user', 'service', 'schedule'
        ).order_by('slot_time')


class DoctorUpcomingAppointmentsView(ListAPIView):
    """
    Get upcoming appointments for the logged-in doctor
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Ensure user is a doctor
        if self.request.user.role != 'doctor':
            return Appointment.objects.none()
        
        # Get doctor instance
        try:
            doctor = Doctor.objects.get(user=self.request.user)
        except Doctor.DoesNotExist:
            return Appointment.objects.none()
        
        # Upcoming appointments (today and future)
        today = date.today()
        return Appointment.objects.filter(
            doctor=doctor,
            appointment_date__gte=today,
            status__in=['pending', 'confirmed']
        ).select_related(
            'patient__user', 'doctor__user', 'service', 'schedule'
        ).order_by('appointment_date', 'slot_time')


class RescheduleAppointmentView(APIView):
    """
    Reschedule an appointment (doctor side)
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, appointment_id):
        # Ensure user is a doctor
        if request.user.role != 'doctor':
            return Response(
                {'error': 'Only doctors can reschedule appointments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get doctor instance
        try:
            doctor = Doctor.objects.get(user=request.user)
        except Doctor.DoesNotExist:
            return Response(
                {'error': 'Doctor profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get appointment
        appointment = get_object_or_404(
            Appointment, 
            id=appointment_id, 
            doctor=doctor
        )
        
        # Check if appointment can be rescheduled
        if appointment.status not in ['pending', 'confirmed']:
            return Response(
                {'error': 'Cannot reschedule cancelled or completed appointments'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get new date and time
        new_date = request.data.get('appointment_date')
        new_time = request.data.get('slot_time')
        reason = request.data.get('reason', '')
        
        if not new_date or not new_time:
            return Response(
                {'error': 'Both new date and time are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Parse new date
            new_date = datetime.strptime(new_date, '%Y-%m-%d').date()
            
            # Parse new time
            if isinstance(new_time, str):
                if 'AM' in new_time.upper() or 'PM' in new_time.upper():
                    new_time = datetime.strptime(new_time, '%I:%M %p').time()
                else:
                    new_time = datetime.strptime(new_time, '%H:%M').time()
            
            # Validate new datetime is in the future
            new_datetime = datetime.combine(new_date, new_time)
            new_datetime = timezone.make_aware(new_datetime)
            
            if new_datetime <= timezone.now():
                return Response(
                    {'error': 'New appointment time must be in the future'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check for conflicts
            existing = Appointment.objects.filter(
                doctor=doctor,
                appointment_date=new_date,
                slot_time=new_time,
                status__in=['pending', 'confirmed']
            ).exclude(id=appointment.id)
            
            if existing.exists():
                return Response(
                    {'error': 'The selected time slot is already booked'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update appointment
            old_date = appointment.appointment_date
            old_time = appointment.slot_time
            
            appointment.appointment_date = new_date
            appointment.slot_time = new_time
            
            # Add reschedule note
            reschedule_note = f"[{timezone.now().strftime('%Y-%m-%d %H:%M')}] Rescheduled from {old_date} {old_time} to {new_date} {new_time}"
            if reason:
                reschedule_note += f" - Reason: {reason}"
            
            if appointment.notes:
                appointment.notes += f"\n{reschedule_note}"
            else:
                appointment.notes = reschedule_note
            
            appointment.save()
            
            serializer = AppointmentSerializer(appointment)
            return Response({
                'message': 'Appointment rescheduled successfully',
                'appointment': serializer.data
            })
            
        except ValueError as e:
            return Response(
                {'error': f'Invalid date/time format: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error rescheduling appointment: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            

class BulkAppointmentRequestActionView(APIView):
    """
    Handle multiple appointment requests at once
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Ensure user is a doctor
        if request.user.role != 'doctor':
            return Response(
                {'error': 'Only doctors can handle appointment requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get doctor instance
        try:
            doctor = Doctor.objects.get(user=request.user)
        except Doctor.DoesNotExist:
            return Response(
                {'error': 'Doctor profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get bulk actions data
        actions = request.data.get('actions', [])
        # Expected format: [{'appointment_id': 1, 'action': 'approve', 'reason': 'optional'}, ...]
        
        if not actions:
            return Response(
                {'error': 'No actions provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = []
        conflicts = []
        
        for action_data in actions:
            appointment_id = action_data.get('appointment_id')
            action = action_data.get('action')
            reason = action_data.get('reason', '')
            
            try:
                appointment = Appointment.objects.get(
                    id=appointment_id, 
                    doctor=doctor,
                    status='pending'
                )
                
                # Check for conflicts if approving
                if action == 'approve':
                    conflicting = Appointment.objects.filter(
                        doctor=doctor,
                        appointment_date=appointment.appointment_date,
                        slot_time=appointment.slot_time,
                        status='confirmed'
                    ).exclude(id=appointment.id).exists()
                    
                    if conflicting:
                        conflicts.append({
                            'appointment_id': appointment_id,
                            'error': 'Time slot conflict',
                            'date': str(appointment.appointment_date),
                            'time': str(appointment.slot_time)
                        })
                        continue
                
                # Update appointment
                new_status = 'confirmed' if action == 'approve' else 'cancelled'
                appointment.status = new_status
                
                # Add note
                action_note = f"[{timezone.now().strftime('%Y-%m-%d %H:%M')}] Request {action}d by Dr. {doctor.user.get_full_name()}"
                if reason:
                    action_note += f" - Reason: {reason}"
                
                if appointment.notes:
                    appointment.notes += f"\n{action_note}"
                else:
                    appointment.notes = action_note
                
                appointment.save()
                
                results.append({
                    'appointment_id': appointment_id,
                    'action': action,
                    'status': 'success',
                    'new_status': new_status
                })
                
            except Appointment.DoesNotExist:
                results.append({
                    'appointment_id': appointment_id,
                    'action': action,
                    'status': 'error',
                    'error': 'Appointment not found or not pending'
                })
        
        return Response({
            'message': f'Processed {len(results)} appointment requests',
            'results': results,
            'conflicts': conflicts,
            'summary': {
                'total_processed': len(results),
                'successful': len([r for r in results if r['status'] == 'success']),
                'failed': len([r for r in results if r['status'] == 'error']),
                'conflicts': len(conflicts)
            }
        })
