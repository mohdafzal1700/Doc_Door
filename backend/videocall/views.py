# video_call/views.py
from rest_framework import status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from .models import CallRecord, ActiveCall
from .serializers import CallRecordSerializer,ActiveCallSerializer,UserSerializer
from .utils import (
    get_webrtc_config,
    validate_call_participants,
    is_user_online,
    # get_turn_credentials,
    cleanup_expired_calls
)


class VideoCallViewSet(ViewSet):
    """
    ViewSet for video call operations
    Alternative approach using a single ViewSet
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def users(self, request):
        """Get available users for calling"""
        cleanup_expired_calls()
        search_query = request.GET.get('search', '').strip()
        users_qs = User.objects.exclude(id=request.user.id)
        
        if search_query:
            users_qs = users_qs.filter(
                Q(username__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query)
            )
        
        users = users_qs[:20]
        user_data = []
        
        for user in users:
            serializer = UserSerializer(user)
            user_info = serializer.data
            user_info['online'] = is_user_online(user.id)
            user_data.append(user_info)
        
        return Response({'users': user_data})
    
    @action(detail=False, methods=['post'])
    def validate_call(self, request):
        """Validate if a call can be made"""
        callee_id = request.data.get('callee_id')
        
        if not callee_id:
            return Response({
                'valid': False,
                'message': 'Callee ID required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            callee_id = int(callee_id)
        except (ValueError, TypeError):
            return Response({
                'valid': False,
                'message': 'Invalid callee ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        valid, message = validate_call_participants(request.user.id, callee_id)
        
        response_data = {
            'valid': valid,
            'message': message
        }
        
        if valid:
            try:
                callee = User.objects.get(id=callee_id)
                callee_serializer = UserSerializer(callee)
                response_data['callee_info'] = callee_serializer.data
                response_data['callee_info']['online'] = is_user_online(callee.id)
            except User.DoesNotExist:
                pass
        
        return Response(response_data)
    
    @action(detail=True, methods=['get'], url_path='user-status')
    def user_status(self, request, pk=None):
        """Get online status of a specific user"""
        try:
            user = User.objects.get(id=pk)
            serializer = UserSerializer(user)
            user_data = serializer.data
            user_data['online'] = is_user_online(user.id)
            return Response(user_data)
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'], url_path='end-call')
    def end_call(self, request, pk=None):
        """Manually end a call"""
        try:
            call_record = CallRecord.objects.select_related('caller', 'callee').get(
                id=pk,
                status__in=['initiated', 'ringing', 'answered']
            )
            
            if call_record.caller != request.user and call_record.callee != request.user:
                return Response({
                    'error': 'You are not authorized to end this call'
                }, status=status.HTTP_403_FORBIDDEN)
            
            call_record.status = 'ended'
            call_record.ended_at = timezone.now()
            call_record.save()
            
            try:
                active_call = ActiveCall.objects.get(call_record=call_record)
                active_call.delete()
            except ActiveCall.DoesNotExist:
                pass
            
            return Response({
                'success': True,
                'message': 'Call ended successfully'
            })
            
        except CallRecord.DoesNotExist:
            return Response({
                'error': 'Call not found or already ended'
            }, status=status.HTTP_404_NOT_FOUND)
            
    
    @action(detail=False, methods=['get'], url_path='webrtc-config')
    def webrtc_config(self, request):
        """Get WebRTC configuration"""
        config = get_webrtc_config().copy()
        
        # turn_creds = get_turn_credentials(request.user.username)
        # if turn_creds:
        #     from django.conf import settings
        #     if hasattr(settings, 'TURN_SERVER_URL'):
        #         config['iceServers'].append({
        #             'urls': settings.TURN_SERVER_URL,
        #             'username': turn_creds['username'],
        #             'credential': turn_creds['password']
        #         })
        
        return Response(config)
    
    @action(detail=False, methods=['get'], url_path='active-calls')
    def active_calls(self, request):
        """Get currently active calls for the user"""
        active_calls = ActiveCall.objects.filter(
            Q(call_record__caller=request.user) | 
            Q(call_record__callee=request.user)
        ).select_related('call_record__caller', 'call_record__callee')
        
        serializer = ActiveCallSerializer(active_calls, many=True, context={'request': request})
        return Response({'active_calls': serializer.data})