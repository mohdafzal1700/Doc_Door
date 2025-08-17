# Django REST framework core imports
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed

from django.core.paginator import Paginator, PageNotAnInteger, EmptyPage
# Simple JWT authentication views and tools
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import action
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q
from doctor.models import SubscriptionPlan
from .serializers import SubscriptionPlanSerializer


# Project-specific serializers and models
from adminside.serializers import AdminLoginSerializer
from patients.serializers import UserProfileSerializer, UserStatusSerializer,AppointmentSerializer
from doctor.models import User,Appointment  # Custom User model
from doctor.serializers import DoctorProfileSerializer,doctorStatusSerializer, DoctorApplicationListSerializer,DoctorApplicationDetailSerializer,DoctorApprovalActionSerializer
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
import logging
logger = logging.getLogger(__name__)

class AdminLoginView(TokenObtainPairView):
    """Simple admin login view"""
    serializer_class = AdminLoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # Get tokens
            refresh = self.get_serializer().get_token(serializer.user)
            access = refresh.access_token
            
            # Prepare response
            response_data = {
                'success': True,
                'message': 'Login successful',
                'user': {
                    'id': serializer.user.id,
                    'email': serializer.user.email,
                    'first_name': serializer.user.first_name,
                    'last_name': serializer.user.last_name,
                    'is_superuser': serializer.user.is_superuser,
                }
            }
            
            response = Response(response_data, status=status.HTTP_200_OK)
            
            # Set secure cookies
            response.set_cookie(
                'access_token',
                str(access),
                max_age=3600,  # 1 hour
                httponly=True,
                secure=True,
                samesite='None'
            )
            
            response.set_cookie(
                'refresh_token',
                str(refresh),
                max_age=86400,  # 24 hours
                httponly=True,
                secure=True,
                samesite='None'
            )
            
            return response
            
        except AuthenticationFailed as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Login failed'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminTokenRefreshView(APIView):
    """Simple token refresh view"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        try:
            # Get refresh token from cookie
            refresh_token = request.COOKIES.get('refresh_token')
            if not refresh_token:
                return Response({
                    'success': False,
                    'message': 'Refresh token not found'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            # Validate and refresh token
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)
            
            # Set new access token cookie
            response = Response({
                'success': True,
                'message': 'Token refreshed successfully'
            }, status=status.HTTP_200_OK)
            
            response.set_cookie(
                'access_token',
                access_token,
                max_age=3600,  # 1 hour
                httponly=True,
                secure=True,
                samesite='None'
            )
            
            return response
            
        except InvalidToken:
            return Response({
                'success': False,
                'message': 'Invalid or expired refresh token'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Token refresh failed'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminLogoutView(APIView):
    """Simple logout view"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        try:
            response = Response({
                'success': True,
                'message': 'Logged out successfully'
            }, status=status.HTTP_200_OK)
            
            # Clear cookies
            response.delete_cookie('access_token', samesite='None')
            response.delete_cookie('refresh_token', samesite='None')
            
            return response
            
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Logout failed'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
class PatientManagementView(APIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self, pk):
        """Get patient object by ID"""
        logger.debug(f"Fetching patient object with ID: {pk}")
        return get_object_or_404(User, pk=pk, role='patient')
    
    def get(self, request, pk=None):
        """Get all patients or specific patient by ID"""
        try:
            if pk:
                logger.info(f"Getting specific patient with ID: {pk}")
                user = self.get_object(pk)
                serialized_data = self.serializer_class(user)
                return Response(serialized_data.data, status=status.HTTP_200_OK)
            
            logger.info("Getting all patients")
            queryset = User.objects.filter(role='patient').select_related('patient_profile').order_by('-patient_profile__created_at')
            
            search_query = request.GET.get('search', '')
            is_active = request.GET.get('is_active', '')
            logger.debug(f"Search Query: {search_query}, is_active: {is_active}")
            
            if search_query:
                queryset = queryset.filter(
                    Q(first_name__icontains=search_query) |
                    Q(last_name__icontains=search_query) |
                    Q(email__icontains=search_query)
                )
            
            if is_active:
                is_active_bool = is_active.lower() == 'true'
                queryset = queryset.filter(is_active=is_active_bool)
            
            
            logger.debug(f"Final queryset count: {queryset.count()}")
            
            serialized_data = self.serializer_class(queryset, many=True)
            return Response(serialized_data.data, status=status.HTTP_200_OK)
        
        except ValueError as e:
            logger.warning(f"Invalid value error: {str(e)}")
            return Response({'error': 'Invalid parameter value', 'details': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.error(f"Error in GET patient(s): {str(e)}", exc_info=True)
            return Response({'error': 'An error occurred while fetching patients', 'details': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def patch(self, request, pk=None):
        """Update patient profile or toggle status"""
        if not pk:
            logger.warning("PATCH request without patient ID")
            return Response({'error': 'Patient ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            logger.info(f"PATCH update for patient ID: {pk}")
            user = self.get_object(pk)
            
            if 'is_active' in request.data and len(request.data) == 1:
                logger.debug("Toggle is_active status triggered")
                return self.toggle_status(request, user)
            
            logger.debug(f"Updating profile for user: {user}")
            serializer = self.serializer_class(user, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                logger.info(f"User {user.id} profile updated successfully")
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                logger.warning(f"Validation error: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.error(f"Error updating patient profile: {str(e)}", exc_info=True)
            return Response({'error': 'An error occurred while updating patient', 'details': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def toggle_status(self, request, user):
        """Toggle patient active status"""
        logger.debug(f"Toggling is_active status for user: {user.id}")
        serializer = UserStatusSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                serializer.update(user, serializer.validated_data)
                logger.info(f"User {user.id} status changed to: {user.is_active}")
                return Response({
                    'status': 'User status updated successfully',
                    'is_active': user.is_active
                }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error in toggle_status: {str(e)}", exc_info=True)
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            logger.warning(f"Validation error in toggle_status: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class DoctorManagementView(APIView):
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    
    
    def get_object(self, pk):
        logger.debug(f"Fetching doctor object with ID: {pk}")
        return get_object_or_404(User, pk=pk, role='doctor')
    
    
    def get(self,request,pk=None):
        try:
            if pk:
                logger.info(f"Getting specific doctor with ID: {pk}")
                user=self.get_object(pk)
                serialized_data=self.serializer_class(user)
                return Response(serialized_data.data,status=status.HTTP_200_OK)
            
            logger.info('Getting all Doctors')
            
            queryset = User.objects.filter(role='doctor').select_related('doctor_profile').order_by('-doctor_profile__created_at')
            is_active=request.GET.get('is_active','')
            
            
            if is_active:
                is_active_bool= is_active.lower()=='true'
                queryset = queryset.filter(is_active=is_active_bool)
                
            logger.debug(f"Final queryset count: {queryset.count()}")
            
            # Serialize the queryset for all doctors
            serialized_data = self.serializer_class(queryset, many=True)
            return Response(serialized_data.data, status=status.HTTP_200_OK)
        
        except ValueError as e:
            logger.warning(f"Invalid value error: {str(e)}")
            return Response({'error': 'Invalid parameter value', 'details': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.error(f"Error in GET doctor(s): {str(e)}", exc_info=True)
            return Response({'error': 'An error occurred while fetching doctors', 'details': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        
        
    def patch(self,request,pk=None):
        
        if not pk:
            logger.warning('Patch request without doctor ID')
            return Response({'error': 'Doctor ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            logger.info(f"PATCH update for doctor ID: {pk}")
            user = self.get_object(pk)
            
            if 'is_active' in request.data and len(request.data) == 1:
                logger.debug("Toggle is_active status triggered")
                return self.toggle_status(request, user)
            
            logger.debug(f"Updating profile for user: {user}")
            serializer = self.serializer_class(user, data=request.data, partial=True)
            
            
            if serializer.is_valid():
                serializer.save()
                logger.info(f"User {user.id} profile updated successfully")
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                logger.warning(f"Validation error: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
            
        except Exception as e:
            logger.error(f"Error updating doctor profile: {str(e)}", exc_info=True)
            return Response({'error': 'An error occurred while updating doctor', 'details': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    
    def toggle_status(self,request,user):
        
        logger.debug(f'Toggling is_active status for user:{user.id}')
        serializer=doctorStatusSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                serializer.update(user,serializer.validated_data)
                logger.info(f'User {user.id} status changed to:{user.is_active}')
                
                return Response({
                    'status': 'User status updated successfully',
                    'is_active': user.is_active
                }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error in toggle_status: {str(e)}", exc_info=True)
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            logger.warning(f"Validation error in toggle_status: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        
    

class DoctorApplicationListView(generics.ListAPIView):
    """List doctors pending approval - only those who completed 4 steps"""
    
    serializer_class = DoctorApplicationListSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        """Only show doctors with verification_status = 'pending_approval'"""
        return User.objects.filter(
            role='doctor',
            doctor_profile__verification_status='pending_approval',
            doctor_profile__is_profile_setup_done=True,
            doctor_profile__is_education_done=True,
            doctor_profile__is_certification_done=True,
            doctor_profile__is_license_done=True
        ).select_related('doctor_profile').order_by('-doctor_profile__updated_at')


class DoctorApplicationDetailView(generics.RetrieveAPIView):
    """Get complete doctor application details for review"""
    
    serializer_class = DoctorApplicationDetailSerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'id'
    
    def get_queryset(self):
        return User.objects.filter(
            role='doctor'
        ).select_related('doctor_profile').prefetch_related(
            'doctor_profile__educations',
            'doctor_profile__certifications',
            'doctor_profile__proof'
        )

class DoctorApprovalActionView(generics.UpdateAPIView):
    """Simple approve/reject action"""
    
    serializer_class = DoctorApprovalActionSerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'id'
    
    def get_queryset(self):
        return User.objects.filter(
            role='doctor',
            doctor_profile__verification_status='pending_approval'
        ).select_related('doctor_profile')
    
    def update(self, request, *args, **kwargs):
        # Debug logging
        logger.info(f"PATCH request data: {request.data}")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Content type: {request.content_type}")
        
        try:
            instance = self.get_object()
            logger.info(f"Found doctor instance: {instance.id}")
            logger.info(f"Doctor profile status: {instance.doctor_profile.verification_status}")
        except Exception as e:
            logger.error(f"Error getting object: {str(e)}")
            return Response({
                'error': 'Doctor not found or not eligible for approval.',
                'detail': str(e)
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Create serializer with the instance and request data
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        
        # Check if serializer is valid
        if not serializer.is_valid():
            logger.error(f"Serializer validation errors: {serializer.errors}")
            return Response({
                'error': 'Validation failed',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get action for additional validation
        action = request.data.get('action')
        logger.info(f"Action requested: {action}")
        
        # Validate that doctor completed all steps before approval
        doctor = instance.doctor_profile
        if action == 'approve':
            completion_status = {
                'profile_setup': doctor.is_profile_setup_done,
                'education': doctor.is_education_done,
                'certification': doctor.is_certification_done,
                'license': doctor.is_license_done
            }
            
            if not all(completion_status.values()):
                logger.error(f"Doctor hasn't completed all steps: {completion_status}")
                return Response({
                    'error': 'Doctor has not completed all verification steps.',
                    'completion_status': completion_status
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Perform the action of love
        try:
            updated_instance = serializer.save()
            logger.info(f"Successfully processed {action} for doctor {instance.id}")
            
            return Response({
                'success': True,
                'message': f'Doctor application {action}d successfully.',
                'doctor_id': str(instance.id),
                'new_status': updated_instance.doctor_profile.verification_status,
                'is_active': updated_instance.is_active
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error during serializer.save(): {str(e)}")
            return Response({
                'error': 'Failed to process the action.',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def patch(self, request, *args, **kwargs):
        """Override patch to ensure it calls update"""
        return self.update(request, *args, **kwargs)


class SubscriptionPlanListCreateView(generics.ListCreateAPIView):
    """List all subscription plans or create a new one"""
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['name']
    search_fields = ['name']
    ordering = ['price']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'message': 'Subscription plan created successfully',
                    'data': serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            {
                'message': 'Validation failed',
                'errors': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )


class SubscriptionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a subscription plan"""
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'message': 'Subscription plan updated successfully',
                    'data': serializer.data
                }
            )
        return Response(
            {
                'message': 'Validation failed',
                'errors': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(
            {'message': 'Subscription plan deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )
        
class AdminAppointmentListView(APIView):
    """ Admin appointment list view - GET method for listing all appointments """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get list of all appointments with filtering"""
        # Verify user is staff/admin
        if not request.user.is_staff:
            return Response({
                'success': False,
                'message': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            # Base queryset with optimized queries
            queryset = Appointment.objects.select_related(
                'patient__user', 
                'doctor__user', 
                'service', 
                'schedule'
            ).order_by('-created_at')

            # Filtering
            status_filter = request.query_params.get('status')
            doctor_filter = request.query_params.get('doctor')
            patient_filter = request.query_params.get('patient')
            date_from = request.query_params.get('date_from')
            date_to = request.query_params.get('date_to')

            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            if doctor_filter:
                queryset = queryset.filter(doctor_id=doctor_filter)
            
            if patient_filter:
                queryset = queryset.filter(patient_id=patient_filter)
            
            if date_from:
                queryset = queryset.filter(appointment_date__gte=date_from)
            
            if date_to:
                queryset = queryset.filter(appointment_date__lte=date_to)

            # Serialize data
            serializer = AppointmentSerializer(queryset, many=True)

            # Get summary statistics
            total_appointments = queryset.count()
            status_counts = queryset.values('status').annotate(count=Count('status'))

            return Response({
                'success': True,
                'data': serializer.data,
                'summary': {
                    'total_appointments': total_appointments,
                    'status_breakdown': list(status_counts)
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error getting appointments list: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to retrieve appointments'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AdminAppointmentDetailView(APIView):
    """
    Admin appointment detail view - only GET method for viewing appointment details
    """
    permission_classes = [IsAuthenticated]

    def get_appointment(self, appointment_id):
        """Get appointment by ID (admin can access any appointment)"""
        try:
            return Appointment.objects.select_related(
                'patient__user',
                'doctor__user',
                'service',
                'schedule'
            ).get(id=appointment_id)
        except Appointment.DoesNotExist:
            return None

    def get(self, request, appointment_id):
        """Get specific appointment details - Admin version"""
        # Verify user is staff/admin
        if not request.user.is_staff:
            return Response({
                'success': False,
                'message': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)

        appointment = self.get_appointment(appointment_id)
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
            
            
            
            
            
            
            
            
from doctor.models import DoctorReview
from patients.serializers import DoctorReviewSerializer, AdminReviewModerationSerializer
from django.db.models import Avg
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class AdminReviewListView(APIView):
    """Admin view to list all reviews - fixed version"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Debug: Print user information
        print(f"User: {request.user}")
        print(f"is_staff: {request.user.is_staff}")
        print(f"is_superuser: {request.user.is_superuser}")
        print(f"is_authenticated: {request.user.is_authenticated}")
        
        # Check if user has admin access
        has_admin_access = False
        admin_check_details = {
            'is_staff': request.user.is_staff,
            'is_superuser': request.user.is_superuser,
            'user_id': request.user.id,
            'username': request.user.username,
            'email': getattr(request.user, 'email', 'No email'),
        }
        
        # Check for admin profile
        try:
            has_admin_profile = hasattr(request.user, 'admin_profile') and request.user.admin_profile is not None
            admin_check_details['has_admin_profile'] = has_admin_profile
        except:
            has_admin_profile = False
            admin_check_details['has_admin_profile'] = False
        
        # Allow access if user is staff OR superuser OR has admin profile
        if request.user.is_staff or request.user.is_superuser or has_admin_profile:
            has_admin_access = True
        
        if not has_admin_access:
            return Response({
                'success': False,
                'message': 'Admin access required',
                'debug_info': admin_check_details
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Get all reviews with related data
            queryset = DoctorReview.objects.select_related(
                'patient__user', 
                'doctor__user', 
                'appointment',
                'reviewed_by'  # Add this for reviewed_by information
            ).order_by('-created_at')
            
            serializer = DoctorReviewSerializer(queryset, many=True)
            
            # Get summary statistics
            total_reviews = queryset.count()
            pending_count = queryset.filter(status='pending').count()
            approved_count = queryset.filter(status='approved').count()
            rejected_count = queryset.filter(status='rejected').count()
            
            # Calculate average rating for approved reviews only
            avg_rating = queryset.filter(status='approved').aggregate(
                avg_rating=Avg('rating')
            )['avg_rating'] or 0
            
            return Response({
                'success': True,
                'data': serializer.data,
                'summary': {
                    'total_reviews': total_reviews,
                    'pending_count': pending_count,
                    'approved_count': approved_count,
                    'rejected_count': rejected_count,
                    'average_rating': round(float(avg_rating), 2)
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error listing admin reviews: {str(e)}")
            print(f"Error in AdminReviewListView: {str(e)}")  # Debug print
            return Response({
                'success': False,
                'message': 'Failed to retrieve reviews',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminReviewModerationView(APIView):
    """Admin approve/reject review - fixed version"""
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, review_id):
        # Debug: Print user information
        print(f"Moderation request from user: {request.user}")
        print(f"Review ID: {review_id}")
        print(f"Request data: {request.data}")
        
        # Check admin access (same logic as list view)
        has_admin_access = False
        
        try:
            has_admin_profile = hasattr(request.user, 'admin_profile') and request.user.admin_profile is not None
        except:
            has_admin_profile = False
        
        if request.user.is_staff or request.user.is_superuser or has_admin_profile:
            has_admin_access = True
        
        if not has_admin_access:
            return Response({
                'success': False,
                'message': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Get the review
            review = DoctorReview.objects.select_related(
                'patient__user', 
                'doctor__user'
            ).get(id=review_id)
            
            # Check if review is still pending
            if review.status != 'pending':
                return Response({
                    'success': False,
                    'message': f'Review has already been {review.status}. Cannot moderate again.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate the request data
            serializer = AdminReviewModerationSerializer(
                review, 
                data=request.data, 
                partial=True
            )
            
            if serializer.is_valid():
                # Save the review with moderation info
                review = serializer.save(
                    reviewed_by=request.user,
                    reviewed_at=timezone.now()
                )
                
                # Return updated review data
                response_serializer = DoctorReviewSerializer(review)
                action = 'approved' if review.status == 'approved' else 'rejected'
                
                return Response({
                    'success': True,
                    'message': f'Review {action} successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_200_OK)
            
            return Response({
                'success': False,
                'message': 'Invalid data provided',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except DoctorReview.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Review not found'
            }, status=status.HTTP_404_NOT_FOUND)
            
        except Exception as e:
            logger.error(f"Error moderating review {review_id}: {str(e)}")
            print(f"Error in moderation: {str(e)}")  # Debug print
            return Response({
                'success': False,
                'message': 'Failed to moderate review',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            

class AdminDashboardView(APIView):
    """Admin Dashboard with system-wide stats and reports"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check if user is admin/staff
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({
                'success': False,
                'message': 'Only administrators can view this dashboard'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Get date filters (optional)
            date_from = request.query_params.get('date_from')
            date_to = request.query_params.get('date_to')
            
            # Calculate comprehensive stats
            stats = self.calculate_system_stats(date_from, date_to)
            
            # Get recent activities
            recent_users = self.get_recent_users()
            recent_appointments = self.get_recent_appointments()
            pending_reviews = self.get_pending_reviews()
            
            # Get trends and analytics
            user_growth_trend = self.get_user_growth_trend()
            revenue_trend = self.get_platform_revenue_trend()
            appointment_trends = self.get_appointment_trends()
            
            # Top performers
            top_doctors = self.get_top_doctors()
            
            return Response({
                'success': True,
                'data': {
                    'stats': stats,
                    'recent_users': recent_users,
                    'recent_appointments': recent_appointments,
                    'pending_reviews': pending_reviews,
                    'trends': {
                        'user_growth': user_growth_trend,
                        'revenue': revenue_trend,
                        'appointments': appointment_trends,
                    },
                    'top_doctors': top_doctors,
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in admin dashboard: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to load dashboard data'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def calculate_system_stats(self, date_from=None, date_to=None):
        """Calculate system-wide statistics"""
        from .models import Doctor, Patient, Appointment, DoctorReview  # Adjust import path
        
        now = timezone.now()
        today = now.date()
        this_month_start = today.replace(day=1)
        last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
        
        # Date filtering setup
        date_filter = Q()
        if date_from:
            try:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                date_filter &= Q(date__gte=date_from)
            except ValueError:
                pass
        if date_to:
            try:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                date_filter &= Q(date__lte=date_to)
            except ValueError:
                pass
        
        # User Statistics
        total_users = User.objects.count()
        total_doctors = Doctor.objects.count()
        total_patients = Patient.objects.count()
        
        # New users this month
        new_users_this_month = User.objects.filter(date_joined__gte=this_month_start).count()
        new_doctors_this_month = Doctor.objects.filter(user__date_joined__gte=this_month_start).count()
        new_patients_this_month = Patient.objects.filter(user__date_joined__gte=this_month_start).count()
        
        # Active users (users who have appointments in last 30 days)
        active_users = User.objects.filter(
            Q(doctor__appointments__date__gte=today - timedelta(days=30)) |
            Q(patient__appointments__date__gte=today - timedelta(days=30))
        ).distinct().count()
        
        # Appointment Statistics
        all_appointments = Appointment.objects.all()
        if date_filter:
            filtered_appointments = all_appointments.filter(date_filter)
        else:
            filtered_appointments = all_appointments
        
        total_appointments = filtered_appointments.count()
        completed_appointments = filtered_appointments.filter(status='completed').count()
        pending_appointments = filtered_appointments.filter(status='pending').count()
        cancelled_appointments = filtered_appointments.filter(status='cancelled').count()
        
        # Today's appointments
        today_appointments = all_appointments.filter(date=today).count()
        
        # This month's appointments
        this_month_appointments = all_appointments.filter(date__gte=this_month_start).count()
        last_month_appointments = all_appointments.filter(
            date__gte=last_month_start,
            date__lt=this_month_start
        ).count()
        
        # Appointment growth
        appointment_growth = 0
        if last_month_appointments > 0:
            appointment_growth = ((this_month_appointments - last_month_appointments) / last_month_appointments) * 100
        
        # Revenue Statistics
        total_platform_revenue = filtered_appointments.filter(
            status='completed'
        ).aggregate(total=Sum('fee'))['total'] or 0
        
        this_month_revenue = all_appointments.filter(
            status='completed',
            date__gte=this_month_start
        ).aggregate(total=Sum('fee'))['total'] or 0
        
        last_month_revenue = all_appointments.filter(
            status='completed',
            date__gte=last_month_start,
            date__lt=this_month_start
        ).aggregate(total=Sum('fee'))['total'] or 0
        
        # Revenue growth
        revenue_growth = 0
        if last_month_revenue > 0:
            revenue_growth = ((this_month_revenue - last_month_revenue) / last_month_revenue) * 100
        
        # Review Statistics
        total_reviews = DoctorReview.objects.count()
        pending_reviews_count = DoctorReview.objects.filter(status='pending').count()
        approved_reviews = DoctorReview.objects.filter(status='approved').count()
        
        # Average platform rating
        avg_platform_rating = DoctorReview.objects.filter(
            status='approved'
        ).aggregate(avg=Avg('rating'))['avg'] or 0
        
        # System health metrics
        completion_rate = (completed_appointments / total_appointments * 100) if total_appointments > 0 else 0
        cancellation_rate = (cancelled_appointments / total_appointments * 100) if total_appointments > 0 else 0
        
        return {
            # User stats
            'total_users': total_users,
            'total_doctors': total_doctors,
            'total_patients': total_patients,
            'active_users': active_users,
            'new_users_this_month': new_users_this_month,
            'new_doctors_this_month': new_doctors_this_month,
            'new_patients_this_month': new_patients_this_month,
            
            # Appointment stats
            'total_appointments': total_appointments,
            'completed_appointments': completed_appointments,
            'pending_appointments': pending_appointments,
            'cancelled_appointments': cancelled_appointments,
            'today_appointments': today_appointments,
            'this_month_appointments': this_month_appointments,
            'appointment_growth_percentage': round(appointment_growth, 2),
            
            # Revenue stats
            'total_platform_revenue': float(total_platform_revenue),
            'this_month_revenue': float(this_month_revenue),
            'last_month_revenue': float(last_month_revenue),
            'revenue_growth_percentage': round(revenue_growth, 2),
            
            # Review stats
            'total_reviews': total_reviews,
            'pending_reviews': pending_reviews_count,
            'approved_reviews': approved_reviews,
            'average_platform_rating': round(float(avg_platform_rating), 2) if avg_platform_rating else 0,
            
            # Health metrics
            'completion_rate': round(completion_rate, 2),
            'cancellation_rate': round(cancellation_rate, 2),
        }
    
    def get_recent_users(self, limit=10):
        """Get recently registered users"""
        recent = User.objects.select_related(
            'doctor', 'patient'
        ).order_by('-date_joined')[:limit]
        
        return [{
            'id': user.id,
            'username': user.username,
            'full_name': user.get_full_name() or user.username,
            'email': user.email,
            'user_type': 'Doctor' if hasattr(user, 'doctor') else 'Patient' if hasattr(user, 'patient') else 'Admin',
            'date_joined': user.date_joined.strftime('%Y-%m-%d %H:%M'),
            'is_active': user.is_active
        } for user in recent]
    
    def get_recent_appointments(self, limit=10):
        """Get recent appointments across the platform"""
        from .models import Appointment  # Adjust import path
        
        recent = Appointment.objects.select_related(
            'doctor__user', 'patient__user'
        ).order_by('-created_at')[:limit]
        
        return [{
            'id': apt.id,
            'doctor_name': apt.doctor.user.get_full_name() or apt.doctor.user.username,
            'patient_name': apt.patient.user.get_full_name() or apt.patient.user.username,
            'date': apt.date.strftime('%Y-%m-%d'),
            'time': apt.time_slot.strftime('%H:%M') if apt.time_slot else None,
            'status': apt.status,
            'fee': float(apt.fee) if hasattr(apt, 'fee') and apt.fee else 0
        } for apt in recent]
    
    def get_pending_reviews(self, limit=10):
        """Get pending reviews that need admin approval"""
        from .models import DoctorReview  # Adjust import path
        
        pending = DoctorReview.objects.filter(
            status='pending'
        ).select_related(
            'doctor__user', 'patient__user'
        ).order_by('-created_at')[:limit]
        
        return [{
            'id': review.id,
            'doctor_name': review.doctor.user.get_full_name() or review.doctor.user.username,
            'patient_name': review.patient.user.get_full_name() or review.patient.user.username,
            'rating': review.rating,
            'comment': review.comment[:100] + '...' if len(review.comment) > 100 else review.comment,
            'created_at': review.created_at.strftime('%Y-%m-%d %H:%M')
        } for review in pending]
    
    def get_user_growth_trend(self, months=6):
        """Get user growth trend for the last N months"""
        monthly_data = []
        end_date = timezone.now().date()
        
        for i in range(months):
            month_start = (end_date.replace(day=1) - timedelta(days=i*30)).replace(day=1)
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            
            new_users = User.objects.filter(
                date_joined__gte=month_start,
                date_joined__lt=next_month
            ).count()
            
            new_doctors = User.objects.filter(
                doctor__isnull=False,
                date_joined__gte=month_start,
                date_joined__lt=next_month
            ).count()
            
            new_patients = User.objects.filter(
                patient__isnull=False,
                date_joined__gte=month_start,
                date_joined__lt=next_month
            ).count()
            
            monthly_data.append({
                'month': month_start.strftime('%Y-%m'),
                'month_name': month_start.strftime('%B %Y'),
                'new_users': new_users,
                'new_doctors': new_doctors,
                'new_patients': new_patients
            })
        
        return list(reversed(monthly_data))
    
    def get_platform_revenue_trend(self, months=6):
        """Get platform revenue trend"""
        from .models import Appointment  # Adjust import path
        
        monthly_data = []
        end_date = timezone.now().date()
        
        for i in range(months):
            month_start = (end_date.replace(day=1) - timedelta(days=i*30)).replace(day=1)
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            
            revenue = Appointment.objects.filter(
                status='completed',
                date__gte=month_start,
                date__lt=next_month
            ).aggregate(total=Sum('fee'))['total'] or 0
            
            appointments = Appointment.objects.filter(
                status='completed',
                date__gte=month_start,
                date__lt=next_month
            ).count()
            
            monthly_data.append({
                'month': month_start.strftime('%Y-%m'),
                'month_name': month_start.strftime('%B %Y'),
                'revenue': float(revenue),
                'appointments': appointments
            })
        
        return list(reversed(monthly_data))
    
    def get_appointment_trends(self, days=30):
        """Get daily appointment trends for the last N days"""
        daily_data = []
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days-1)
        
        from .models import Appointment  # Adjust import path
        
        current_date = start_date
        while current_date <= end_date:
            appointments = Appointment.objects.filter(date=current_date).count()
            completed = Appointment.objects.filter(date=current_date, status='completed').count()
            
            daily_data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'total_appointments': appointments,
                'completed_appointments': completed
            })
            
            current_date += timedelta(days=1)
        
        return daily_data
    
    def get_top_doctors(self, limit=10):
        """Get top performing doctors by revenue and ratings"""
        from .models import Doctor  # Adjust import path
        
        top_doctors = Doctor.objects.annotate(
            total_appointments=Count('appointments'),
            completed_appointments=Count('appointments', filter=Q(appointments__status='completed')),
            total_revenue=Sum('appointments__fee', filter=Q(appointments__status='completed')),
            avg_rating=Avg('reviews__rating', filter=Q(reviews__status='approved'))
        ).filter(
            total_appointments__gt=0
        ).order_by('-total_revenue')[:limit]
        
        return [{
            'id': doctor.id,
            'name': doctor.user.get_full_name() or doctor.user.username,
            'specialization': getattr(doctor, 'specialization', 'N/A'),
            'total_appointments': doctor.total_appointments or 0,
            'completed_appointments': doctor.completed_appointments or 0,
            'total_revenue': float(doctor.total_revenue or 0),
            'average_rating': round(float(doctor.avg_rating or 0), 2),
            'completion_rate': round((doctor.completed_appointments / doctor.total_appointments * 100), 2) if doctor.total_appointments > 0 else 0
        } for doctor in top_doctors]