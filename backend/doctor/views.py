# Standard library imports
import logging
from decimal import Decimal
from datetime import datetime, date, timedelta

# Django imports
from django.shortcuts import render, get_object_or_404
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from django.db import transaction
from django.db.models import Q


from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
from reportlab.lib.units import inch

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
# DRF imports
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView, UpdateAPIView
from rest_framework.exceptions import (
    AuthenticationFailed, NotFound, ValidationError
)
from rest_framework_simplejwt.views import TokenObtainPairView

from django.conf import settings
import razorpay

# App-specific imports
from .models import (
    Doctor, DoctorEducation, DoctorCertification, DoctorProof,
    Schedules, Service, DoctorLocation, Appointment,SubscriptionPlan,SubscriptionUpgrade,
    DoctorSubscription
)
from .serializers import (
    DoctorProfileSerializer, DoctorEducationSerializer,
    DoctorCertificationSerializer, DoctorProofSerializer,
    VerificationStatusSerializer, SchedulesSerializer,
    ServiceSerializer, DoctorLocationSerializer,
    DoctorLocationUpdateSerializer,SubscriptionActivationSerializer,SubscriptionUpdateSerializer,
    PaymentVerificationSerializer,CurrentSubscriptionSerializer,SubscriptionHistorySerializer
)

from adminside.serializers import SubscriptionPlanSerializer
from doctor.serializers import CustomDoctorTokenObtainPairSerializer
from patients.serializers import AppointmentSerializer

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
        logger.info(f"Service creation request initiated by user: {request.user.id}")
        
        try:
            logger.info(f"Checking user role for user {request.user.id}")
            
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                logger.warning(f"Access denied - User {request.user.id} is not a doctor. Role: {getattr(request.user, 'role', 'None')}")
                return Response({
                    'success': False,
                    'message': 'Access denied. Only doctors can create services.',
                }, status=status.HTTP_403_FORBIDDEN)
            
            logger.info(f"User {request.user.id} verified as doctor")
            
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            if created:
                logger.debug(f"New doctor profile created for user {request.user.id}")
            else:
                logger.debug(f"Existing doctor profile found for user {request.user.id}")
            
        
            service_mode = request.data.get('service_mode', 'online')
            logger.debug(f"Checking subscription limits for service_mode: {service_mode}")
            
            if not doctor.can_create_service(service_mode):
                logger.debug(f"Doctor {doctor.id} cannot create {service_mode} service - checking subscription status")
                
                plan = doctor.get_current_plan()
                
                if not plan:
                    logger.debug(f"Doctor {doctor.id} has no active subscription plan")
                    
                    return Response({
                        'success': False,
                        'message': 'Active subscription required to create services.',
                        'error_type': 'subscription_required',
                        
                    }, status=status.HTTP_402_PAYMENT_REQUIRED)
                else:
                    usage_stats = doctor.get_usage_stats()
                    logger.debug(f"Doctor {doctor.id} has reached plan limits. Plan: {plan.name if hasattr(plan, 'name') else plan}, Usage: {usage_stats}")
                    
                    return Response({
                        'success': False,
                        'message': f'Cannot create {service_mode} service. Plan limit reached.',
                        'error_type': 'limit_reached',
                        'current_usage': usage_stats,
                    
                    }, status=status.HTTP_403_FORBIDDEN)
            
            logger.debug(f"Subscription check passed for doctor {doctor.id} - proceeding with service creation")
            
            # PASS CONTEXT TO SERIALIZER:
            logger.debug(f"Initializing ServiceSerializer with data: {request.data}")
            serializer = ServiceSerializer(data=request.data, context={'request': request})
            
            if serializer.is_valid():
                logger.debug(f"Service data validation successful for doctor {doctor.id}")
                service = serializer.save(doctor=doctor)
                logger.debug(f"Service {service.id} created successfully by doctor {doctor.id}")
                
                return Response({
                    'success': True,
                    'message': 'Service created successfully.',
                    'data': serializer.data
                }, status=status.HTTP_201_CREATED)
            else:
                logger.debug(f"Service data validation failed for doctor {doctor.id}. Errors: {serializer.errors}")
                return Response({
                    'success': False,
                    'message': 'Invalid data provided.',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Unexpected error during service creation for user {request.user.id}: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'message': 'An unexpected error occurred while creating the service.',
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
            if service.schedules.exists():
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
        logger.info("Received data:", request.data)
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
            
            # ADD THIS SUBSCRIPTION CHECK:
            if not doctor.can_create_schedule():
                plan = doctor.get_current_plan()
                if not plan:
                    return Response({
                        'success': False,
                        'message': 'Active subscription required to create schedules.',
                        'error_type': 'subscription_required',
                        'redirect_to': '/subscription/plans/'
                    }, status=status.HTTP_402_PAYMENT_REQUIRED)
                else:
                    usage_stats = doctor.get_usage_stats()
                    return Response({
                        'success': False,
                        'message': 'Schedule creation limit reached for your plan.',
                        'error_type': 'limit_reached',
                        'current_usage': usage_stats,
                        'redirect_to': '/subscription/upgrade/'
                    }, status=status.HTTP_403_FORBIDDEN)
            
            # PASS CONTEXT TO SERIALIZER:
            serializer = SchedulesSerializer(data=request.data, context={'request': request})
            
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
            
            # # Check if schedule has bookings (if you have booking model)
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


class DoctorAppointmentDashboardView(APIView):
    """
    Main dashboard view with appointment statistics and overview
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Ensure user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response(
                    {'error': 'Only doctors can access this dashboard'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get doctor instance
            try:
                doctor = request.user.doctor_profile
            except AttributeError:
                return Response(
                    {'error': 'Doctor profile not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get all appointments for statistics
            all_appointments = Appointment.objects.filter(doctor=doctor)
            
            # Calculate statistics
            today = date.today()
            
            # Total counts by status
            total_appointments = all_appointments.count()
            pending_count = all_appointments.filter(status='pending').count()
            confirmed_count = all_appointments.filter(status='confirmed').count()
            completed_count = all_appointments.filter(status='completed').count()
            cancelled_count = all_appointments.filter(status='cancelled').count()
            
            # Today's appointments
            today_appointments = all_appointments.filter(appointment_date=today)
            today_total = today_appointments.count()
            today_pending = today_appointments.filter(status='pending').count()
            today_confirmed = today_appointments.filter(status='confirmed').count()
            today_completed = today_appointments.filter(status='completed').count()
            
            # Upcoming appointments (from tomorrow onwards)
            tomorrow = today + timedelta(days=1)
            upcoming_appointments = all_appointments.filter(
                appointment_date__gte=tomorrow,
                status__in=['pending', 'confirmed']
            ).count()
            
            # This week's appointments
            week_end = today + timedelta(days=7)
            this_week_appointments = all_appointments.filter(
                appointment_date__gte=today,
                appointment_date__lt=week_end
            ).count()
            
            # Recent appointments (last 7 days)
            week_ago = today - timedelta(days=7)
            recent_appointments = all_appointments.filter(
                appointment_date__gte=week_ago,
                appointment_date__lt=today
            ).count()
            
            # Mode-wise statistics
            online_appointments = all_appointments.filter(mode='online').count()
            offline_appointments = all_appointments.filter(mode='offline').count()
            
            dashboard_data = {
                'overview': {
                    'total_appointments': total_appointments,
                    'pending': pending_count,
                    'confirmed': confirmed_count,
                    'completed': completed_count,
                    'cancelled': cancelled_count,
                    'online_appointments': online_appointments,
                    'offline_appointments': offline_appointments,
                },
                'today': {
                    'total': today_total,
                    'pending': today_pending,
                    'confirmed': today_confirmed,
                    'completed': today_completed,
                },
                'upcoming': {
                    'total_upcoming': upcoming_appointments,
                    'this_week': this_week_appointments,
                },
                'recent': {
                    'last_week': recent_appointments,
                }
            }
            
            return Response(dashboard_data)
            
        except Exception as e:
            logger.error(f"Error in DoctorAppointmentDashboardView: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to fetch dashboard data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DoctorAppointmentsListView(ListAPIView):
    """
    List all appointments for the doctor with basic filtering
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            # Ensure user is a doctor
            if not hasattr(self.request.user, 'role') or self.request.user.role != 'doctor':
                return Appointment.objects.none()
            
            # Get doctor instance
            try:
                doctor = self.request.user.doctor_profile
            except AttributeError:
                return Appointment.objects.none()
            
            # Base queryset
            queryset = Appointment.objects.filter(doctor=doctor).select_related(
                'patient__user', 'doctor__user', 'service', 'schedule'
            ).order_by('-appointment_date', '-slot_time')
            
            # Simple filters (let frontend handle complex filtering)
            status_filter = self.request.query_params.get('status')
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            mode_filter = self.request.query_params.get('mode')
            if mode_filter:
                queryset = queryset.filter(mode=mode_filter)
            
            return queryset
            
        except Exception as e:
            logger.error(f"Error in DoctorAppointmentsListView: {str(e)}", exc_info=True)
            return Appointment.objects.none()


class PendingAppointmentsView(ListAPIView):
    """
    List only pending appointments that need doctor's approval
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            # Ensure user is a doctor
            if not hasattr(self.request.user, 'role') or self.request.user.role != 'doctor':
                return Appointment.objects.none()
            
            # Get doctor instance
            try:
                doctor = self.request.user.doctor_profile
            except AttributeError:
                return Appointment.objects.none()
            
            # Only pending appointments
            return Appointment.objects.filter(
                doctor=doctor,
                status='pending'
            ).select_related(
                'patient__user', 'doctor__user', 'service', 'schedule'
            ).order_by('appointment_date', 'slot_time')
            
        except Exception as e:
            logger.error(f"Error in PendingAppointmentsView: {str(e)}", exc_info=True)
            return Appointment.objects.none()


class TodayAppointmentsView(ListAPIView):
    """
    Get today's appointments for the doctor
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            # Ensure user is a doctor
            if not hasattr(self.request.user, 'role') or self.request.user.role != 'doctor':
                return Appointment.objects.none()
            
            # Get doctor instance
            try:
                doctor = self.request.user.doctor_profile
            except AttributeError:
                return Appointment.objects.none()
            
            # Today's appointments
            today = date.today()
            return Appointment.objects.filter(
                doctor=doctor,
                appointment_date=today
            ).select_related(
                'patient__user', 'doctor__user', 'service', 'schedule'
            ).order_by('slot_time')
            
        except Exception as e:
            logger.error(f"Error in TodayAppointmentsView: {str(e)}", exc_info=True)
            return Appointment.objects.none()


class UpcomingAppointmentsView(ListAPIView):
    """
    Get upcoming appointments (from tomorrow onwards)
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            # Ensure user is a doctor
            if not hasattr(self.request.user, 'role') or self.request.user.role != 'doctor':
                return Appointment.objects.none()
            
            # Get doctor instance
            try:
                doctor = self.request.user.doctor_profile
            except AttributeError:
                return Appointment.objects.none()
            
            # Upcoming appointments
            tomorrow = date.today() + timedelta(days=1)
            return Appointment.objects.filter(
                doctor=doctor,
                appointment_date__gte=tomorrow,
                status__in=['pending', 'confirmed']
            ).select_related(
                'patient__user', 'doctor__user', 'service', 'schedule'
            ).order_by('appointment_date', 'slot_time')
            
        except Exception as e:
            logger.error(f"Error in UpcomingAppointmentsView: {str(e)}", exc_info=True)
            return Appointment.objects.none()


class AppointmentDetailView(APIView):
    """
    Get detailed information about a specific appointment
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, appointment_id):
        try:
            # Ensure user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response(
                    {'error': 'Only doctors can view appointment details'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get doctor instance
            try:
                doctor = request.user.doctor_profile
            except AttributeError:
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
            
            serializer = AppointmentSerializer(appointment)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error in AppointmentDetailView: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to fetch appointment details'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class HandleAppointmentRequestView(APIView):
    """
    Handle individual appointment request (approve/reject)
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, appointment_id):
        try:
            # Ensure user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response(
                    {'error': 'Only doctors can handle appointment requests'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get doctor instance
            try:
                doctor = request.user.doctor_profile
            except AttributeError:
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
            
            # Only allow actions on pending appointments
            if appointment.status != 'pending':
                return Response(
                    {'error': 'Can only handle pending appointment requests'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get action
            action = request.data.get('action')  # 'approve' or 'reject'
            reason = request.data.get('reason', '')
            
            if action not in ['approve', 'reject']:
                return Response(
                    {'error': 'Action must be either "approve" or "reject"'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check for time conflicts when approving
            if action == 'approve':
                conflicting_appointment = Appointment.objects.filter(
                    doctor=doctor,
                    appointment_date=appointment.appointment_date,
                    slot_time=appointment.slot_time,
                    status='confirmed'
                ).exclude(id=appointment.id).first()
                
                if conflicting_appointment:
                    return Response(
                        {
                            'error': 'Time slot conflict detected',
                            'message': f'You already have a confirmed appointment at {appointment.appointment_date} {appointment.slot_time}'
                        },
                        status=status.HTTP_409_CONFLICT
                    )
            
            # Update appointment status
            new_status = 'confirmed' if action == 'approve' else 'cancelled'
            appointment.status = new_status
            
            # Add action note
            doctor_name = doctor.user.get_full_name() if doctor.user else 'Doctor'
            action_note = f"[{timezone.now().strftime('%Y-%m-%d %H:%M')}] Request {action}d by Dr. {doctor_name}"
            if reason:
                action_note += f" - Reason: {reason}"
            
            if appointment.notes:
                appointment.notes += f"\n{action_note}"
            else:
                appointment.notes = action_note
            
            appointment.save()
            
            message = f"Appointment request {action}d successfully"
            if action == 'approve':
                message += f" and confirmed for {appointment.appointment_date} at {appointment.slot_time}"
            
            serializer = AppointmentSerializer(appointment)
            return Response({
                'message': message,
                'appointment': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error in HandleAppointmentRequestView: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to process appointment request'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UpdateAppointmentStatusView(APIView):
    """
    Update appointment status (complete, cancel, etc.)
    """
    permission_classes = [IsAuthenticated]
    
    def put(self, request, appointment_id):
        try:
            # Ensure user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response(
                    {'error': 'Only doctors can update appointment status'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get doctor instance
            try:
                doctor = request.user.doctor_profile
            except AttributeError:
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
            
            # Get new status
            new_status = request.data.get('status')
            notes = request.data.get('notes', '')
            
            # Validate status
            valid_statuses = ['pending', 'confirmed', 'cancelled', 'completed']
            if new_status not in valid_statuses:
                return Response(
                    {'error': f'Invalid status. Must be one of: {valid_statuses}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Define allowed transitions
            current_status = appointment.status
            allowed_transitions = {
                'pending': ['confirmed', 'cancelled'],
                'confirmed': ['completed', 'cancelled'],
                'cancelled': [],  # Cannot change from cancelled
                'completed': []   # Cannot change from completed
            }
            
            if new_status not in allowed_transitions.get(current_status, []):
                return Response(
                    {
                        'error': f'Cannot change status from {current_status} to {new_status}',
                        'allowed_transitions': allowed_transitions.get(current_status, [])
                    },
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
            
            appointment.save()
            
            serializer = AppointmentSerializer(appointment)
            return Response({
                'message': f'Appointment status updated to {new_status}',
                'appointment': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error in UpdateAppointmentStatusView: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to update appointment status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RescheduleAppointmentView(APIView):
    """
    Reschedule an appointment to a new date/time
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, appointment_id):
        try:
            # Ensure user is a doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response(
                    {'error': 'Only doctors can reschedule appointments'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get doctor instance
            try:
                doctor = request.user.doctor_profile
            except AttributeError:
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
            
            # Parse new date and time
            try:
                new_date = datetime.strptime(new_date, '%Y-%m-%d').date()
                if isinstance(new_time, str):
                    new_time = datetime.strptime(new_time, '%H:%M').time()
            except ValueError as e:
                return Response(
                    {'error': f'Invalid date/time format: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
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
            
        except Exception as e:
            logger.error(f"Error in RescheduleAppointmentView: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Unable to reschedule appointment'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
class SubscriptionStatusView(APIView):
    """Get subscription status and usage statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current subscription status and usage"""
        try:
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Only doctors can check subscription status.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            has_subscription = doctor.has_subscription()
            plan = doctor.get_current_plan()
            usage_stats = doctor.get_usage_stats() if has_subscription else None
            
            # Fix the field name mismatches here
            return Response({
                'success': True,
                'data': {
                    'has_subscription': has_subscription,
                    'plan': {
                        'name': plan.name if plan else None,
                        'max_services': plan.max_services if plan else 0,
                        'max_daily_schedules': plan.max_schedules_per_day if plan else 0,  # Fixed field name
                        'max_monthly_schedules': plan.max_schedules_per_month if plan else 0,  # Fixed field name
                        'can_create_online_services': plan.can_create_online_service if plan else False,  # Fixed field name
                        'can_create_offline_services': plan.can_create_offline_service if plan else False  # Fixed field name
                    } if plan else None,
                    'usage_stats': usage_stats,
                    'subscription_end_date': doctor.subscription.end_date if has_subscription else None
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in subscription status: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'message': 'Failed to fetch subscription status',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class SubscriptionPlanListView(generics.ListAPIView):
    """
    List all active subscription plans
    GET /api/subscriptions/
    """
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by('price')
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Override to add custom response format"""
        try:
            response = super().list(request, *args, **kwargs)
            
            # Add metadata to response
            response.data = {
                'success': True,
                'count': len(response.data),
                'results': response.data
            }
            
            logger.info(f"Retrieved {len(response.data)} subscription plans")
            return response
        except Exception as e:
            logger.error(f"Error retrieving subscription plans: {str(e)}")
            return Response(
                {'success': False, 'error': 'Failed to retrieve subscription plans'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SubscriptionPlanDetailView(generics.RetrieveAPIView):
    """
    Retrieve a specific subscription plan by ID
    GET /api/subscriptions/{id}/
    """
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def retrieve(self, request, *args, **kwargs):
        """Override to add custom response format and error handling"""
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            
            logger.info(f"Retrieved subscription plan: {instance.name} (ID: {instance.id})")
            
            return Response({
                'success': True,
                'data': serializer.data
            })
            
        except SubscriptionPlan.DoesNotExist:
            logger.warning(f"Subscription plan not found with ID: {kwargs.get('id')}")
            return Response(
                {'success': False, 'error': 'Subscription plan not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error retrieving subscription plan: {str(e)}")
            return Response(
                {'success': False, 'error': 'Failed to retrieve subscription plan'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            



class SubscriptionActivationView(APIView):
    """Activate a new subscription for doctor"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Create Razorpay order for subscription activation"""
        try:
            # Check if user is doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Only doctors can activate subscriptions.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            serializer = SubscriptionActivationSerializer(
                data=request.data,
                context={'doctor': doctor}
            )
            
            if serializer.is_valid():
                result = serializer.save()
                
                message = 'Razorpay order created successfully'
                if result.get('was_update'):
                    message = 'Subscription plan updated - Razorpay order created for payment'
                
                return Response({
                    'success': True,
                    'message': message,
                    'data': {
                        'order_id': result['razorpay_order']['id'],
                        'amount': result['razorpay_order']['amount'],
                        'currency': result['razorpay_order']['currency'],
                        'key': settings.RAZORPAY_KEY_ID,
                        'plan': {
                            'id': result['plan'].id,
                            'name': result['plan'].get_name_display(),
                            'price': str(result['plan'].price),
                            'duration_days': result['plan'].duration_days
                        },
                        'was_update': result.get('was_update', False)
                    }
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'success': False,
                'message': 'Invalid data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Error in subscription activation: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to create subscription order',
                'error': str(e) if settings.DEBUG else 'Internal server error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class PaymentVerificationView(APIView):
    """Verify Razorpay payment and activate/update subscription"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        """Verify payment and activate subscription"""
        try:
            # Check if user is doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Only doctors can verify payments.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            serializer = PaymentVerificationSerializer(data=request.data)
            
            if serializer.is_valid():
                razorpay_order_id = serializer.validated_data['razorpay_order_id']
                
                # Check if this is a subscription activation or upgrade
                try:
                    subscription = DoctorSubscription.objects.get(
                        doctor=doctor,
                        razorpay_order_id=razorpay_order_id
                    )
                except DoctorSubscription.DoesNotExist:
                    # Check if it's an upgrade
                    try:
                        upgrade_record = SubscriptionUpgrade.objects.get(
                            subscription__doctor=doctor,
                            razorpay_order_id=razorpay_order_id,
                            status=SubscriptionUpgrade.STATUS_PENDING
                        )
                        return self._handle_upgrade_verification(upgrade_record, serializer.validated_data)
                    except SubscriptionUpgrade.DoesNotExist:
                        return Response({
                            'success': False,
                            'message': 'Order not found for this doctor.'
                        }, status=status.HTTP_404_NOT_FOUND)
                
                # Handle subscription activation
                return self._handle_activation_verification(subscription, serializer.validated_data)
            
            return Response({
                'success': False,
                'message': 'Invalid payment data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Error in payment verification: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to verify payment',
                'error': str(e) if settings.DEBUG else 'Internal server error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _handle_activation_verification(self, subscription, payment_data):
        """Handle subscription activation after payment verification"""
        now = timezone.now()
        
        # Update subscription after successful payment
        subscription.status = DoctorSubscription.STATUS_ACTIVE
        subscription.payment_status = DoctorSubscription.PAYMENT_COMPLETED
        subscription.paid_at = now
        subscription.razorpay_signature = payment_data['razorpay_signature']
        subscription.razorpay_payment_id = payment_data['razorpay_payment_id']
        
        # Ensure proper end date calculation
        if not subscription.end_date:
            subscription.end_date = subscription.start_date + timedelta(
                days=subscription.plan.duration_days
            )
        
        subscription.save()
        
        logger.info(f"Subscription activated for doctor {subscription.doctor.id}: {subscription.plan.name}")
        
        return Response({
            'success': True,
            'message': 'Payment verified and subscription activated successfully',
            'data': {
                'subscription_status': subscription.status,
                'plan': {
                    'id': subscription.plan.id,
                    'name': subscription.plan.get_name_display(),
                    'price': str(subscription.plan.price)
                },
                'start_date': subscription.start_date.isoformat(),
                'end_date': subscription.end_date.isoformat(),
                'days_remaining': subscription.days_remaining
            }
        }, status=status.HTTP_200_OK)
    
    def _handle_upgrade_verification(self, upgrade_record, payment_data):
        """Handle subscription upgrade after payment verification"""
        now = timezone.now()
        subscription = upgrade_record.subscription
        
        # Update subscription with new plan
        subscription.previous_plan = subscription.plan
        subscription.plan = upgrade_record.new_plan
        subscription.end_date = subscription.start_date + timedelta(
            days=upgrade_record.new_plan.duration_days
        )
        subscription.razorpay_payment_id = payment_data['razorpay_payment_id']
        subscription.razorpay_signature = payment_data['razorpay_signature']
        subscription.save()
        
        # Update upgrade record
        upgrade_record.status = SubscriptionUpgrade.STATUS_COMPLETED
        upgrade_record.completed_at = now
        upgrade_record.save()
        
        logger.info(f"Subscription upgraded for doctor {subscription.doctor.id}: {upgrade_record.old_plan.name} -> {upgrade_record.new_plan.name}")
        
        return Response({
            'success': True,
            'message': 'Payment verified and subscription upgraded successfully',
            'data': {
                'subscription_status': subscription.status,
                'old_plan': upgrade_record.old_plan.get_name_display(),
                'new_plan': {
                    'id': subscription.plan.id,
                    'name': subscription.plan.get_name_display(),
                    'price': str(subscription.plan.price)
                },
                'upgrade_price': str(upgrade_record.upgrade_price),
                'end_date': subscription.end_date.isoformat(),
                'days_remaining': subscription.days_remaining
            }
        }, status=status.HTTP_200_OK)


class SubscriptionCancellationView(APIView):
    """Cancel doctor's subscription"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        """Cancel active subscription"""
        try:
            # Check if user is doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Only doctors can cancel subscriptions.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Check if doctor has active subscription
            if not hasattr(doctor, 'subscription') or not doctor.subscription.is_active:
                return Response({
                    'success': False,
                    'message': 'No active subscription found to cancel.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            subscription = doctor.subscription
            subscription.status = DoctorSubscription.STATUS_CANCELLED
            subscription.cancelled_at = timezone.now()
            subscription.save()
            
            logger.info(f"Subscription cancelled for doctor {doctor.id}")
            
            return Response({
                'success': True,
                'message': 'Subscription cancelled successfully',
                'data': {
                    'cancelled_at': subscription.cancelled_at.isoformat(),
                    'plan': subscription.plan.get_name_display()
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in subscription cancellation: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to cancel subscription',
                'error': str(e) if settings.DEBUG else 'Internal server error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CurrentSubscriptionView(APIView):
    """Get current subscription details for the doctor"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current subscription details"""
        try:
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Only doctors can check subscription details.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Check if doctor has subscription
            if not hasattr(doctor, 'subscription'):
                return Response({
                    'success': True,
                    'message': 'No subscription found',
                    'data': {
                        'has_subscription': False,
                        'subscription': None
                    }
                }, status=status.HTTP_200_OK)
            
            subscription = doctor.subscription
            serializer = CurrentSubscriptionSerializer(subscription)
            
            return Response({
                'success': True,
                'data': {
                    'has_subscription': True,
                    'subscription': serializer.data
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in current subscription view: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to fetch subscription details',
                'error': str(e) if settings.DEBUG else 'Internal server error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SubscriptionHistoryView(APIView):
    """Get subscription history for doctor"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get subscription history"""
        try:
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Only doctors can check subscription history.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Get all subscriptions for this doctor
            subscriptions = DoctorSubscription.objects.filter(
                doctor=doctor
            ).order_by('-start_date')
            
            serializer = SubscriptionHistorySerializer(subscriptions, many=True)
            
            return Response({
                'success': True,
                'data': {
                    'total_subscriptions': subscriptions.count(),
                    'subscriptions': serializer.data
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in subscription history: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to fetch subscription history',
                'error': str(e) if settings.DEBUG else 'Internal server error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SubscriptionUpdateView(APIView):
    """Update/upgrade doctor's subscription plan"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Create Razorpay order for subscription upgrade"""
        try:
            # Check if user is doctor
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Only doctors can update subscriptions.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # Check if doctor has active subscription
            if not hasattr(doctor, 'subscription') or not doctor.subscription.is_active:
                return Response({
                    'success': False,
                    'message': 'No active subscription found to upgrade.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = SubscriptionUpdateSerializer(
                data=request.data,
                context={'doctor': doctor}
            )
            
            if serializer.is_valid():
                result = serializer.save()
                
                if result.get('direct_upgrade'):
                    # Serialize the updated subscription data
                    subscription_serializer = CurrentSubscriptionSerializer(result['subscription'])
                    
                    return Response({
                        'success': True,
                        'message': 'Subscription upgraded successfully (no payment required)',
                        'data': {
                            'direct_upgrade': True,
                            'upgrade_price': str(result['upgrade_price']),
                            'subscription': subscription_serializer.data,
                            'new_plan': {
                                'id': result['plan'].id,
                                'name': result['plan'].get_name_display(),
                                'price': str(result['plan'].price)
                            }
                        }
                    }, status=status.HTTP_200_OK)
                
                return Response({
                    'success': True,
                    'message': 'Upgrade order created successfully',
                    'data': {
                        'order_id': result['razorpay_order']['id'],
                        'amount': result['razorpay_order']['amount'],
                        'currency': result['razorpay_order']['currency'],
                        'key': settings.RAZORPAY_KEY_ID,
                        'upgrade_price': str(result['upgrade_price']),
                        'remaining_days': result['remaining_days'],
                        'old_plan': {
                            'id': result['old_plan'].id,
                            'name': result['old_plan'].get_name_display(),
                            'price': str(result['old_plan'].price)
                        },
                        'new_plan': {
                            'id': result['new_plan'].id,
                            'name': result['new_plan'].get_name_display(),
                            'price': str(result['new_plan'].price)
                        }
                    }
                }, status=status.HTTP_201_CREATED)
            
            return Response({
                'success': False,
                'message': 'Invalid data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Error in subscription update: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to create upgrade order',
                'error': str(e) if settings.DEBUG else 'Internal server error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
 
class SubscriptionInvoiceView(APIView):
    """Generate and retrieve subscription invoices"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, subscription_id=None):
        """Get invoice for subscription"""
        try:
            if not hasattr(request.user, 'role') or request.user.role != 'doctor':
                return Response({
                    'success': False,
                    'message': 'Only doctors can access invoices.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            doctor, created = Doctor.objects.get_or_create(user=request.user)
            
            # If subscription_id is provided, get that specific subscription
            if subscription_id:
                try:
                    subscription = DoctorSubscription.objects.get(
                        id=subscription_id, 
                        doctor=doctor
                    )
                except DoctorSubscription.DoesNotExist:
                    return Response({
                        'success': False,
                        'message': 'Subscription not found.'
                    }, status=status.HTTP_404_NOT_FOUND)
            else:
                # Get current subscription
                if not hasattr(doctor, 'subscription'):
                    return Response({
                        'success': False,
                        'message': 'No subscription found.'
                    }, status=status.HTTP_404_NOT_FOUND)
                subscription = doctor.subscription
            
            # Check if subscription is paid
            if subscription.payment_status != 'completed':
                return Response({
                    'success': False,
                    'message': 'Invoice not available for unpaid subscription.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate invoice data
            invoice_data = self._generate_invoice_data(subscription)
            
            return Response({
                'success': True,
                'data': invoice_data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating invoice: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to generate invoice',
                'error': str(e) if settings.DEBUG else 'Internal server error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _generate_invoice_data(self, subscription):
        """Generate invoice data for subscription"""
        from datetime import datetime
        
        # Calculate tax (18% GST for India)
        base_amount = subscription.amount_paid
        tax_rate = Decimal('0.18')  # 18% GST
        tax_amount = (base_amount * tax_rate).quantize(Decimal('0.01'))
        total_amount = base_amount + tax_amount
        
        # Generate invoice number
        invoice_number = f"INV-{subscription.id}-{subscription.start_date.strftime('%Y%m%d')}"
        
        invoice_data = {
            'invoice_number': invoice_number,
            'invoice_date': subscription.paid_at.isoformat() if subscription.paid_at else subscription.start_date.isoformat(),
            'due_date': subscription.start_date.isoformat(),
            'status': 'paid',
            'customer_details': {
                'name': f"Dr. {subscription.doctor.user.first_name} {subscription.doctor.user.last_name}",
                'email': subscription.doctor.user.email,
                'phone': getattr(subscription.doctor, 'phone', 'N/A'),
                'address': getattr(subscription.doctor, 'address', 'N/A')
            },
            'subscription_details': {
                'plan_name': subscription.plan.get_name_display(),
                'start_date': subscription.start_date.isoformat(),
                'end_date': subscription.end_date.isoformat() if subscription.end_date else None,
                'duration_days': subscription.plan.duration_days
            },
            'payment_details': {
                'razorpay_order_id': subscription.razorpay_order_id,
                'razorpay_payment_id': subscription.razorpay_payment_id,
                'payment_method': 'Razorpay',
                'paid_at': subscription.paid_at.isoformat() if subscription.paid_at else None
            },
            'billing_details': {
                'base_amount': str(base_amount),
                'tax_rate': str(tax_rate * 100) + '%',
                'tax_amount': str(tax_amount),
                'total_amount': str(total_amount),
                'currency': 'INR'
            },
            'line_items': [
                {
                    'description': f"{subscription.plan.get_name_display()} Subscription",
                    'quantity': 1,
                    'rate': str(base_amount),
                    'amount': str(base_amount)
                }
            ]
        }
        
        return invoice_data
    
    
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import datetime, timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
import logging
from .serializers import (
    DoctorDashboardSerializer, 
    DashboardDataService
)
import logging
from django.utils import timezone
from datetime import timedelta, datetime
from django.db.models import Sum, Avg, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

logger = logging.getLogger(__name__)

class DoctorDashboardView(APIView):
    """
    Doctor Dashboard with stats and reports
    GET: Returns dashboard data including stats, recent appointments, reviews, and revenue trends
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DoctorDashboardSerializer

    def get(self, request):
        # Enhanced debugging
        print(f"🔍 Request user: {request.user}")
        print(f"🔍 Is authenticated: {request.user.is_authenticated}")
        print(f"🔍 User ID: {getattr(request.user, 'id', 'No ID')}")
        print(f"🔍 User role: {getattr(request.user, 'role', 'No role')}")

        # Check if user is authenticated first
        if not request.user.is_authenticated:
            print("❌ User is not authenticated")
            return Response({
                'success': False,
                'message': 'Authentication required'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Enhanced doctor profile checking
        try:
            # Method 1: Direct access
            print(f"🔍 Has doctor_profile attribute: {hasattr(request.user, 'doctor_profile')}")
            
            if hasattr(request.user, 'doctor_profile'):
                try:
                    doctor_profile = request.user.doctor_profile
                    print(f"🔍 Doctor profile accessed: {doctor_profile}")
                except Exception as e:
                    print(f"❌ Error accessing doctor_profile: {e}")
                    doctor_profile = None
            else:
                doctor_profile = None

            # Method 2: Database query to double-check
            from django.contrib.auth import get_user_model
            from .models import Doctor  # Import your Doctor model
            
            User = get_user_model()
            
            # Check if Doctor profile exists in database
            doctor_exists = Doctor.objects.filter(user=request.user).exists()
            print(f"🔍 Doctor exists in DB: {doctor_exists}")
            
            if doctor_exists:
                doctor_from_db = Doctor.objects.get(user=request.user)
                print(f"🔍 Doctor from DB: {doctor_from_db}")
                doctor_profile = doctor_from_db
            
            # Method 3: Check user role
            if hasattr(request.user, 'role'):
                print(f"🔍 User role is: {request.user.role}")
                if request.user.role != 'doctor':
                    return Response({
                        'success': False,
                        'message': f'Access denied. User role is "{request.user.role}", but "doctor" role is required.'
                    }, status=status.HTTP_403_FORBIDDEN)

            # If no doctor profile found
            if not doctor_profile:
                print(f"❌ No doctor profile found for user {request.user.username}")
                
                # Helpful error message with next steps
                error_message = (
                    f"Doctor profile not found for user {request.user.username}. "
                    f"Please complete your doctor profile setup first."
                )
                
                return Response({
                    'success': False,
                    'message': error_message,
                    'debug_info': {
                        'user_id': str(request.user.id),
                        'user_role': getattr(request.user, 'role', 'unknown'),
                        'doctor_exists_in_db': doctor_exists,
                        'has_doctor_profile_attr': hasattr(request.user, 'doctor_profile')
                    }
                }, status=status.HTTP_403_FORBIDDEN)

        except Exception as e:
            print(f"❌ Error in doctor profile checking: {str(e)}")
            import traceback
            print(f"❌ Full traceback: {traceback.format_exc()}")
            
            return Response({
                'success': False,
                'message': f'Error checking doctor profile: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            # Use the found doctor profile
            doctor = doctor_profile
            print(f"✅ Using doctor: {doctor}")

            # Get query parameters for date filtering
            date_from = request.query_params.get('date_from')
            date_to = request.query_params.get('date_to')
            print(f"🔍 Date filters: from={date_from}, to={date_to}")

            # Initialize data service
            data_service = DashboardDataService(doctor)
            debug_info = data_service.debug_earnings_breakdown()
            print(debug_info)

            # Get filtered appointments
            appointments_qs = data_service.get_filtered_appointments(date_from, date_to)
            print(f"🔍 Filtered appointments count: {appointments_qs.count()}")

            # Prepare dashboard data
            dashboard_data = {
                'stats': data_service.calculate_stats(appointments_qs),
                'recent_appointments': data_service.get_recent_appointments(),
                'recent_reviews': data_service.get_recent_reviews(),
                'monthly_revenue_trend': data_service.get_monthly_revenue_trend()
            }

            print(f"🔍 Dashboard data keys: {dashboard_data.keys()}")

            # Serialize the data for output
            serializer = self.serializer_class(dashboard_data)
            
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"❌ Error in dashboard data processing: {str(e)}")
            print(f"❌ Error type: {type(e)}")
            import traceback
            print(f"❌ Full traceback: {traceback.format_exc()}")
            
            logger.error(f"Error in doctor dashboard: {str(e)}")
            return Response({
                'success': False,
                'message': f'Failed to load dashboard data: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)