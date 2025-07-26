from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from .models import Conversation, Message, Notification
from .serializers import ConversationSerializer,NotificationSerializer,MessageSerializer
import uuid

User = get_user_model()

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for user search and user-related operations"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = User.objects.all().exclude(id=self.request.user.id)  # Exclude current user
        search = self.request.query_params.get('search', None)
        
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )
        
        return queryset[:10]  # Limit to 10 results
    
    def list(self, request):
        """Handle GET /api/chat/users/ - search users"""
        queryset = self.get_queryset()
        
        # Simple serialization - adjust fields as needed
        users_data = []
        for user in queryset:
            users_data.append({
                'id': str(user.id),  # Convert UUID to string
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'full_name': user.get_full_name(),
                'is_online': getattr(user, 'is_online', False),  # if you have this field
            })
        
        return Response(users_data)
    
    @action(detail=False, methods=['get'])
    def online_users(self, request):
        """Get list of online users"""
        online_users = User.objects.filter(is_online=True).exclude(id=request.user.id)
        
        users_data = []
        for user in online_users:
            users_data.append({
                'id': str(user.id),  # Convert UUID to string
                'username': user.username,
                'full_name': user.get_full_name(),
                'is_online': True,
            })
        
        return Response(users_data)

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Conversation.objects.filter(
            participants=self.request.user
        ).prefetch_related('participants', 'messages').distinct()
    
    def create(self, request):
        """Create a conversation with participants"""
        try:
            # Handle both single participant_id and list of participants
            participant_ids = request.data.get('participants', [])
            participant_id = request.data.get('participant_id')
            
            # If single participant_id is provided, convert to list
            if participant_id and not participant_ids:
                participant_ids = [participant_id]
            
            if not participant_ids:
                return Response(
                    {'error': 'At least one participant is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Convert string UUIDs to UUID objects and validate
            validated_participant_ids = []
            for pid in participant_ids:
                try:
                    if isinstance(pid, str):
                        validated_participant_ids.append(uuid.UUID(pid))
                    else:
                        validated_participant_ids.append(pid)
                except (ValueError, TypeError):
                    return Response(
                        {'error': f'Invalid participant ID format: {pid}'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Add current user to participants if not already included
            current_user_id = request.user.id
            if current_user_id not in validated_participant_ids:
                validated_participant_ids.append(current_user_id)
            
            # Validate that all participants exist
            existing_users = User.objects.filter(id__in=validated_participant_ids)
            if existing_users.count() != len(validated_participant_ids):
                return Response(
                    {'error': 'One or more participants do not exist'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if conversation with these exact participants already exists (for 2-person chats)
            if len(validated_participant_ids) == 2:
                existing_conversation = Conversation.objects.filter(
                    participants__in=validated_participant_ids
                ).annotate(
                    participant_count=Count('participants')
                ).filter(participant_count=2)
                
                # Further filter to ensure exact match
                for pid in validated_participant_ids:
                    existing_conversation = existing_conversation.filter(participants=pid)
                
                existing_conversation = existing_conversation.first()
                
                if existing_conversation:
                    serializer = self.get_serializer(existing_conversation)
                    return Response(serializer.data, status=status.HTTP_200_OK)
            
            # Create new conversation
            conversation = Conversation.objects.create()
            conversation.participants.set(validated_participant_ids)
            
            serializer = self.get_serializer(conversation)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Failed to create conversation: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages for a conversation"""
        try:
            conversation = self.get_object()
            
            # Verify user is participant
            if not conversation.participants.filter(id=request.user.id).exists():
                return Response(
                    {'error': 'You are not a participant in this conversation'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            messages = conversation.messages.filter(is_deleted=False).order_by('-created_at')
            
            # Pagination
            page = self.paginate_queryset(messages)
            if page is not None:
                serializer = MessageSerializer(page, many=True, context={'request': request})
                return self.get_paginated_response(serializer.data)
            
            serializer = MessageSerializer(messages, many=True, context={'request': request})
            return Response(serializer.data)
            
        except Exception as e:
            return Response(
                {'error': f'Failed to get messages: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def mark_all_read(self, request, pk=None):
        """Mark all messages in conversation as read"""
        try:
            conversation = self.get_object()
            
            # Verify user is participant
            if not conversation.participants.filter(id=request.user.id).exists():
                return Response(
                    {'error': 'You are not a participant in this conversation'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            updated_count = conversation.messages.filter(
                receiver=request.user,
                status__in=['sent', 'delivered']
            ).update(status='seen')
            
            return Response({
                'status': 'Messages marked as read',
                'updated_count': updated_count
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to mark messages as read: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Message.objects.filter(
            Q(sender=self.request.user) | Q(receiver=self.request.user)
        ).filter(is_deleted=False).order_by('-created_at')
    
    def create(self, request):
        """Create a new message"""
        try:
            serializer = self.get_serializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                # Verify conversation exists and user is participant
                conversation_id = serializer.validated_data.get('conversation')
                if conversation_id:
                    try:
                        conversation = Conversation.objects.get(id=conversation_id.id)
                        if not conversation.participants.filter(id=request.user.id).exists():
                            return Response(
                                {'error': 'You are not a participant in this conversation'}, 
                                status=status.HTTP_403_FORBIDDEN
                            )
                    except Conversation.DoesNotExist:
                        return Response(
                            {'error': 'Conversation does not exist'}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                message = serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response(
                {'error': f'Failed to create message: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return self.request.user.notifications.all().order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a specific notification as read"""
        try:
            notification = self.get_object()
            
            # Verify notification belongs to current user
            if notification.user != request.user:
                return Response(
                    {'error': 'You can only mark your own notifications as read'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            notification.is_read = True
            notification.save()
            
            return Response({'status': 'Notification marked as read'})
            
        except Exception as e:
            return Response(
                {'error': f'Failed to mark notification as read: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        try:
            updated_count = request.user.notifications.filter(is_read=False).update(is_read=True)
            
            return Response({
                'status': 'All notifications marked as read',
                'updated_count': updated_count
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to mark all notifications as read: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )