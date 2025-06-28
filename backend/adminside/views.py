# Django REST framework core imports
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed

# Simple JWT authentication views and tools
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken

# Project-specific serializers and models
from adminside.serializers import AdminLoginSerializer
from patients.serializers import UserProfileSerializer, UserStatusSerializer 
from doctor.models import User  # Custom User model

from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone

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
            queryset = User.objects.filter(role='patient').select_related('patient_profile')
            
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

# class PatientStatsView(APIView):
'''dashboard'''
#     """Separate view for patient statistics"""
#     permission_classes = [permissions.IsAuthenticated]
    
#     def get(self, request):
#         """Get patient statistics"""
#         try:
#             stats = {
#                 'total_patients': User.objects.filter(role='patient').count(),
#                 'active_patients': User.objects.filter(role='patient', is_active=True).count(),
#                 'inactive_patients': User.objects.filter(role='patient', is_active=False).count(),
#                 'new_patients_this_month': User.objects.filter(
#                     role='patient',
#                     date_joined__month=timezone.now().month,
#                     date_joined__year=timezone.now().year
#                 ).count(),
#             }
            
#             return Response(stats, status=status.HTTP_200_OK)
            
#         except Exception as e:
#             return Response(
#                 {'error': 'An error occurred while fetching statistics', 'details': str(e)},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             )