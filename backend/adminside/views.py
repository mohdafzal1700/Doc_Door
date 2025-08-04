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
    """
    Admin appointment list view - GET method for listing all appointments
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get list of all appointments with filtering and pagination"""
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
            search = request.query_params.get('search')  # Search by patient/doctor name

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
            if search:
                queryset = queryset.filter(
                    Q(patient__user__first_name__icontains=search) |
                    Q(patient__user__last_name__icontains=search) |
                    Q(doctor__user__first_name__icontains=search) |
                    Q(doctor__user__last_name__icontains=search)
                )

            # Pagination
            page = request.query_params.get('page', 1)
            page_size = request.query_params.get('page_size', 20)
            
            try:
                page = int(page)
                page_size = int(page_size)
                page_size = min(page_size, 100)  # Max 100 items per page
            except ValueError:
                page = 1
                page_size = 20

            paginator = Paginator(queryset, page_size)
            
            try:
                appointments_page = paginator.page(page)
            except PageNotAnInteger:
                appointments_page = paginator.page(1)
            except EmptyPage:
                appointments_page = paginator.page(paginator.num_pages)

            # Serialize data
            serializer = AppointmentSerializer(appointments_page, many=True)
            
            # Get summary statistics
            total_appointments = queryset.count()
            status_counts = queryset.values('status').annotate(count=Count('status'))
            
            return Response({
                'success': True,
                'data': serializer.data,
                'pagination': {
                    'current_page': appointments_page.number,
                    'total_pages': paginator.num_pages,
                    'total_count': paginator.count,
                    'has_next': appointments_page.has_next(),
                    'has_previous': appointments_page.has_previous(),
                },
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