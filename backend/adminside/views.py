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

from doctor.models import DoctorReview
from patients.serializers import DoctorReviewSerializer, AdminReviewModerationSerializer
from django.db.models import Avg
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone



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
            
            


from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth, TruncWeek, TruncDay
from django.utils import timezone
from datetime import datetime, timedelta
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import io

from doctor.models import User, Doctor, Patient, DoctorSubscription, SubscriptionPlan
from .serializers import AdminDashboardSerializer, AdminDashboardSerializer,AdminRevenueSerializer, AdminUsersSerializer,PendingVerificationsSerializer
    
    
    


class AdminDashboardView(APIView):
    """
    Simple admin dashboard with key metrics
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.role == 'admin':
            return Response({'error': 'Admin access required'}, 
                        status=status.HTTP_403_FORBIDDEN)
        
        # Get date filters
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        else:
            start_date = timezone.now().date() - timedelta(days=30)
            
        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        else:
            end_date = timezone.now().date()

        # Revenue from subscriptions only
        total_revenue = DoctorSubscription.objects.filter(
            payment_status='completed'
        ).aggregate(total=Sum('amount_paid'))['total'] or 0
        
        period_revenue = DoctorSubscription.objects.filter(
            payment_status='completed',
            paid_at__date__gte=start_date,
            paid_at__date__lte=end_date
        ).aggregate(total=Sum('amount_paid'))['total'] or 0
        
        active_subscriptions = DoctorSubscription.objects.filter(
            status='active'
        ).count()

        # User counts with date filtering
        total_doctors = Doctor.objects.count()
        total_patients = Patient.objects.count()
        
        # Filtered counts
        period_doctors = Doctor.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        ).count()
        
        period_patients = Patient.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        ).count()

        # Verification stats
        verified_doctors = Doctor.objects.filter(verification_status='approved').count()
        pending_doctors = Doctor.objects.filter(verification_status='pending_approval').count()
        
        # Monthly revenue trend
        monthly_revenue = DoctorSubscription.objects.filter(
            payment_status='completed',
            paid_at__isnull=False
        ).annotate(
            month=TruncMonth('paid_at')
        ).values('month').annotate(
            revenue=Sum('amount_paid'),
            count=Count('id')
        ).order_by('month')[:6]  # Last 6 months
        
        # Subscription plan breakdown
        plan_breakdown = SubscriptionPlan.objects.annotate(
            subscription_count=Count('doctorsubscription', 
                                   filter=Q(doctorsubscription__status='active')),
            total_revenue=Sum('doctorsubscription__amount_paid',
                            filter=Q(doctorsubscription__payment_status='completed'))
        ).order_by('-total_revenue')

        data = {
            'revenue': {
                'total_revenue': float(total_revenue),
                'period_revenue': float(period_revenue),
                'active_subscriptions': active_subscriptions,
                'monthly_trends': [
                    {
                        'month': item['month'].strftime('%Y-%m'),
                        'revenue': float(item['revenue']),
                        'subscriptions': item['count']
                    } for item in monthly_revenue
                ],
                'plan_breakdown': [
                    {
                        'plan_name': plan.get_name_display(),
                        'price': float(plan.price),
                        'active_subscriptions': plan.subscription_count,
                        'total_revenue': float(plan.total_revenue or 0)
                    } for plan in plan_breakdown
                ]
            },
            'users': {
                'total_doctors': total_doctors,
                'total_patients': total_patients,
                'period_doctors': period_doctors,
                'period_patients': period_patients,
                'verified_doctors': verified_doctors,
                'pending_doctors': pending_doctors
            },
            'date_range': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d')
            }
        }
        
        serializer = AdminDashboardSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminRevenueView(APIView):
    """
    Detailed subscription revenue analytics
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.role == 'admin':
            return Response({'error': 'Admin access required'}, 
                          status=status.HTTP_403_FORBIDDEN)

        # Daily revenue for last 30 days
        daily_revenue = DoctorSubscription.objects.filter(
            payment_status='completed',
            paid_at__date__gte=timezone.now().date() - timedelta(days=30)
        ).annotate(
            day=TruncDay('paid_at')
        ).values('day').annotate(
            revenue=Sum('amount_paid'),
            count=Count('id')
        ).order_by('day')

        # Payment status breakdown
        payment_stats = DoctorSubscription.objects.values('payment_status').annotate(
            count=Count('id'),
            total_amount=Sum('amount_paid')
        ).order_by('-count')

        # Subscription status
        subscription_stats = DoctorSubscription.objects.values('status').annotate(
            count=Count('id')
        ).order_by('-count')

        data = {
            'daily_revenue': [
                {
                    'date': item['day'].strftime('%Y-%m-%d'),
                    'revenue': float(item['revenue']),
                    'subscriptions': item['count']
                } for item in daily_revenue
            ],
            'payment_breakdown': [
                {
                    'status': item['payment_status'],
                    'count': item['count'],
                    'amount': float(item['total_amount'] or 0)
                } for item in payment_stats
            ],
            'subscription_breakdown': [
                {
                    'status': item['status'],
                    'count': item['count']
                } for item in subscription_stats
            ]
        }

        serializer = AdminRevenueSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminUsersView(APIView):
    """
    User analytics with filtering
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.role == 'admin':
            return Response({'error': 'Admin access required'}, 
                          status=status.HTTP_403_FORBIDDEN)

        # Get filters
        user_type = request.GET.get('user_type', 'all')  # 'doctor', 'patient', 'all'
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        # Base queries
        doctor_query = Doctor.objects.all()
        patient_query = Patient.objects.all()
        
        # Apply date filters
        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            doctor_query = doctor_query.filter(created_at__date__gte=start_date)
            patient_query = patient_query.filter(created_at__date__gte=start_date)
            
        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            doctor_query = doctor_query.filter(created_at__date__lte=end_date)
            patient_query = patient_query.filter(created_at__date__lte=end_date)

        # Doctor stats
        doctor_stats = {
            'total': doctor_query.count(),
            'verified': doctor_query.filter(verification_status='approved').count(),
            'pending': doctor_query.filter(verification_status='pending_approval').count(),
            'rejected': doctor_query.filter(verification_status='rejected').count(),
            'with_subscription': doctor_query.filter(subscription__status='active').count()
        }

        # Patient stats
        patient_stats = {
            'total': patient_query.count(),
        }

        # Monthly growth
        doctor_growth = Doctor.objects.annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')[:12]

        patient_growth = Patient.objects.annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')[:12]

        # Top specializations
        specializations = Doctor.objects.exclude(
            specialization__isnull=True
        ).values('specialization').annotate(
            count=Count('id')
        ).order_by('-count')[:10]

        data = {
            'doctor_stats': doctor_stats,
            'patient_stats': patient_stats,
            'growth_trends': {
                'doctors': [
                    {
                        'month': item['month'].strftime('%Y-%m'),
                        'count': item['count']
                    } for item in doctor_growth
                ],
                'patients': [
                    {
                        'month': item['month'].strftime('%Y-%m'),
                        'count': item['count']
                    } for item in patient_growth
                ]
            },
            'specializations': [
                {
                    'specialization': item['specialization'],
                    'count': item['count']
                } for item in specializations
            ]
        }

        serializer = AdminUsersSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PendingVerificationsView(APIView):
    """
    Get pending doctor verifications
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.role == 'admin':
            return Response({'error': 'Admin access required'}, 
                          status=status.HTTP_403_FORBIDDEN)

        pending_doctors = Doctor.objects.filter(
            verification_status='pending_approval'
        ).select_related('user').order_by('created_at')

        data = {
            'pending_verifications': [
                {
                    'id': str(doctor.id),
                    'name': doctor.full_name,
                    'email': doctor.user.email if doctor.user else '',
                    'specialization': doctor.get_specialization_display() if doctor.specialization else '',
                    'experience': doctor.experience,
                    'license_number': doctor.license_number,
                    'clinic_name': doctor.clinic_name,
                    'location': doctor.location,
                    'submitted_date': doctor.created_at.date(),
                    'profile_complete': doctor.is_profile_setup_done,
                    'education_complete': doctor.is_education_done,
                    'certification_complete': doctor.is_certification_done,
                    'license_complete': doctor.is_license_done
                } for doctor in pending_doctors
            ],
            'total_pending': pending_doctors.count()
        }

        serializer = PendingVerificationsSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """
        Approve/Reject doctor verification
        """
        if not request.user.role == 'admin':
            return Response({'error': 'Admin access required'}, 
                          status=status.HTTP_403_FORBIDDEN)

        doctor_id = request.data.get('doctor_id')
        action = request.data.get('action')  # 'approve' or 'reject'
        comment = request.data.get('comment', '')

        if not doctor_id or not action:
            return Response({'error': 'doctor_id and action are required'}, 
                          status=status.HTTP_400_BAD_REQUEST)

        try:
            doctor = Doctor.objects.get(id=doctor_id)
            
            if action == 'approve':
                doctor.verification_status = 'approved'
            elif action == 'reject':
                doctor.verification_status = 'rejected'
            else:
                return Response({'error': 'Invalid action'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            doctor.admin_comment = comment
            doctor.save()

            return Response({
                'message': f'Doctor {action}d successfully',
                'doctor_id': str(doctor_id),
                'new_status': doctor.verification_status
            }, status=status.HTTP_200_OK)

        except Doctor.DoesNotExist:
            return Response({'error': 'Doctor not found'}, 
                          status=status.HTTP_404_NOT_FOUND)

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Sum, Q, Avg
from django.db.models.functions import TruncMonth, TruncWeek, TruncDay
from django.utils import timezone
from datetime import datetime, timedelta
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
import io

from doctor.models import User, Doctor, Patient, DoctorSubscription, SubscriptionPlan

class AdminReportPDFView(APIView):
    """
    Enhanced PDF report generator for admin dashboard
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if not request.user.role == 'admin':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get date filters
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        else:
            start_date = timezone.now().date() - timedelta(days=30)
            
        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        else:
            end_date = timezone.now().date()
        
        # Create PDF response
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="admin_comprehensive_report_{timezone.now().strftime("%Y%m%d_%H%M")}.pdf"'
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, 
                              topMargin=72, bottomMargin=18)
        
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1,  # Center alignment
            textColor=colors.HexColor('#1f2937')
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=12,
            textColor=colors.HexColor('#374151'),
            borderWidth=1,
            borderColor=colors.HexColor('#e5e7eb'),
            borderPadding=8,
            backColor=colors.HexColor('#f9fafb')
        )
        
        story = []
        
        # Title and Header
        story.append(Paragraph("Admin Dashboard Report", title_style))
        story.append(Paragraph(f"Generated on: {timezone.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Paragraph(f"Report Period: {start_date.strftime('%B %d, %Y')} - {end_date.strftime('%B %d, %Y')}", styles['Normal']))
        story.append(Spacer(1, 30))
        
        # Executive Summary
        story.append(Paragraph("Executive Summary", heading_style))
        
        # Get summary data
        total_revenue = DoctorSubscription.objects.filter(
            payment_status='completed'
        ).aggregate(total=Sum('amount_paid'))['total'] or 0
        
        period_revenue = DoctorSubscription.objects.filter(
            payment_status='completed',
            paid_at__date__gte=start_date,
            paid_at__date__lte=end_date
        ).aggregate(total=Sum('amount_paid'))['total'] or 0
        
        active_subscriptions = DoctorSubscription.objects.filter(status='active').count()
        total_doctors = Doctor.objects.count()
        verified_doctors = Doctor.objects.filter(verification_status='approved').count()
        total_patients = Patient.objects.count()
        pending_verifications = Doctor.objects.filter(verification_status='pending_approval').count()
        
        summary_data = [
            ['Metric', 'Value', 'Status'],
            ['Total Revenue (All Time)', f"₹{total_revenue:,.2f}", '💰 Revenue'],
            ['Period Revenue', f"₹{period_revenue:,.2f}", f'📊 Last {(end_date - start_date).days} days'],
            ['Active Subscriptions', f"{active_subscriptions:,}", '✅ Currently Active'],
            ['Total Doctors', f"{total_doctors:,}", f'{verified_doctors:,} Verified'],
            ['Total Patients', f"{total_patients:,}", '👥 Registered Users'],
            ['Pending Verifications', f"{pending_verifications:,}", '⏳ Awaiting Review'],
        ]
        
        summary_table = Table(summary_data, colWidths=[2.5*inch, 1.5*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 30))
        
        # Revenue Analysis
        story.append(Paragraph("Revenue Analysis", heading_style))
        
        # Payment status breakdown
        payment_stats = DoctorSubscription.objects.values('payment_status').annotate(
            count=Count('id'),
            total_amount=Sum('amount_paid')
        ).order_by('-count')
        
        revenue_data = [
            ['Payment Status', 'Count', 'Total Amount', 'Average'],
        ]
        
        for stat in payment_stats:
            avg_amount = (stat['total_amount'] or 0) / stat['count'] if stat['count'] > 0 else 0
            revenue_data.append([
                stat['payment_status'].title(),
                f"{stat['count']:,}",
                f"₹{(stat['total_amount'] or 0):,.2f}",
                f"₹{avg_amount:,.2f}"
            ])
        
        revenue_table = Table(revenue_data, colWidths=[2*inch, 1*inch, 1.5*inch, 1.5*inch])
        revenue_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#ecfdf5')]),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        
        story.append(revenue_table)
        story.append(Spacer(1, 20))
        
        # Subscription plans breakdown
        plan_breakdown = SubscriptionPlan.objects.annotate(
            subscription_count=Count('doctorsubscription', filter=Q(doctorsubscription__status='active')),
            total_revenue=Sum('doctorsubscription__amount_paid', 
                            filter=Q(doctorsubscription__payment_status='completed'))
        ).order_by('-total_revenue')
        
        if plan_breakdown.exists():
            plan_data = [
                ['Plan Name', 'Price', 'Active Subscriptions', 'Total Revenue', 'Market Share'],
            ]
            
            total_plan_revenue = sum((plan.total_revenue or 0) for plan in plan_breakdown)
            
            for plan in plan_breakdown:
                market_share = ((plan.total_revenue or 0) / total_plan_revenue * 100) if total_plan_revenue > 0 else 0
                plan_data.append([
                    plan.get_name_display(),
                    f"₹{plan.price:,.2f}",
                    f"{plan.subscription_count:,}",
                    f"₹{(plan.total_revenue or 0):,.2f}",
                    f"{market_share:.1f}%"
                ])
            
            plan_table = Table(plan_data, colWidths=[1.5*inch, 1*inch, 1.2*inch, 1.5*inch, 0.8*inch])
            plan_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#faf5ff')]),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('PADDING', (0, 0), (-1, -1), 6),
            ]))
            
            story.append(Paragraph("Subscription Plans Performance", styles['Heading3']))
            story.append(plan_table)
        
        story.append(PageBreak())
        
        # User Analytics
        story.append(Paragraph("User Analytics", heading_style))
        
        # Doctor statistics by verification status
        doctor_stats = Doctor.objects.values('verification_status').annotate(
            count=Count('id')
        ).order_by('-count')
        
        doctor_data = [
            ['Verification Status', 'Count', 'Percentage'],
        ]
        
        for stat in doctor_stats:
            percentage = (stat['count'] / total_doctors * 100) if total_doctors > 0 else 0
            doctor_data.append([
                stat['verification_status'].replace('_', ' ').title(),
                f"{stat['count']:,}",
                f"{percentage:.1f}%"
            ])
        
        doctor_table = Table(doctor_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch])
        doctor_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fffbeb')]),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        
        story.append(Paragraph("Doctor Verification Status", styles['Heading3']))
        story.append(doctor_table)
        story.append(Spacer(1, 20))
        
        # Top specializations
        specializations = Doctor.objects.exclude(
            specialization__isnull=True
        ).values('specialization').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        if specializations.exists():
            spec_data = [
                ['Specialization', 'Doctor Count', 'Market Share'],
            ]
            
            for spec in specializations:
                market_share = (spec['count'] / total_doctors * 100) if total_doctors > 0 else 0
                spec_data.append([
                    spec['specialization'],
                    f"{spec['count']:,}",
                    f"{market_share:.1f}%"
                ])
            
            spec_table = Table(spec_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
            spec_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#06b6d4')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#ecfeff')]),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('PADDING', (0, 0), (-1, -1), 6),
            ]))
            
            story.append(Paragraph("Top Medical Specializations", styles['Heading3']))
            story.append(spec_table)
        
        story.append(Spacer(1, 30))
        
        # Growth Analysis
        story.append(Paragraph("Growth Analysis", heading_style))
        
        # Monthly growth for the last 6 months
        monthly_doctor_growth = Doctor.objects.filter(
            created_at__date__gte=timezone.now().date() - timedelta(days=180)
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')
        
        monthly_patient_growth = Patient.objects.filter(
            created_at__date__gte=timezone.now().date() - timedelta(days=180)
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')
        
        # Combine growth data
        growth_data = [
            ['Month', 'New Doctors', 'New Patients', 'Total New Users'],
        ]
        
        # Create a dict for easy lookup
        doctor_growth_dict = {item['month']: item['count'] for item in monthly_doctor_growth}
        patient_growth_dict = {item['month']: item['count'] for item in monthly_patient_growth}
        
        # Get all months from both datasets
        all_months = set(doctor_growth_dict.keys()) | set(patient_growth_dict.keys())
        
        for month in sorted(all_months):
            doctor_count = doctor_growth_dict.get(month, 0)
            patient_count = patient_growth_dict.get(month, 0)
            total_count = doctor_count + patient_count
            
            growth_data.append([
                month.strftime('%B %Y'),
                f"{doctor_count:,}",
                f"{patient_count:,}",
                f"{total_count:,}"
            ])
        
        if len(growth_data) > 1:  # More than just headers
            growth_table = Table(growth_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
            growth_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fef2f2')]),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('PADDING', (0, 0), (-1, -1), 6),
            ]))
            
            story.append(Paragraph("Monthly User Growth (Last 6 Months)", styles['Heading3']))
            story.append(growth_table)
        
        # Footer information
        story.append(Spacer(1, 50))
        story.append(Paragraph("Report Notes:", styles['Heading3']))
        story.append(Paragraph("• This report includes data up to the generation date.", styles['Normal']))
        story.append(Paragraph("• Revenue figures include only completed payment transactions.", styles['Normal']))
        story.append(Paragraph("• User statistics reflect current database state.", styles['Normal']))
        story.append(Paragraph("• Growth metrics are calculated based on user registration dates.", styles['Normal']))
        story.append(Spacer(1, 20))
        story.append(Paragraph(f"Generated by: Admin Dashboard System | {timezone.now().strftime('%Y')}", 
                             styles['Normal']))
        
        # Build the PDF
        doc.build(story)
        
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response