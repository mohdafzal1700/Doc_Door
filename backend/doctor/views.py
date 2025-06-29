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
from django.shortcuts import get_object_or_404
from .serializers import DoctorProfileSerializer,DoctorEducationSerializer,DoctorCertificationSerializer,DoctorProofSerializer,VerificationStatusSerializer
from .models import Doctor,DoctorEducation,DoctorProof,DoctorCertification
import logging
from rest_framework.views import APIView
from doctor.serializers import CustomDoctorTokenObtainPairSerializer
# Create your views here.
logger = logging.getLogger(__name__)

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verification_status_view(request):
    """Get current verification status for the user"""
    try:
        doctor = Doctor.objects.get(user=request.user)
        serializer = VerificationStatusSerializer(doctor)
        return Response({
            'status': 'success',
            'data': serializer.data
        })
    except Doctor.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Doctor profile not found'
        }, status=status.HTTP_404_NOT_FOUND)