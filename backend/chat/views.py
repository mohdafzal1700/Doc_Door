from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from django.utils import timezone
from .models import Conversation, Message, Notification
from .serializers import (
    ConversationSerializer, ConversationCreateSerializer,
    NotificationSerializer, MessageSerializer, UserSerializer
)
import json

import uuid

User = get_user_model()


class ConversationViewSet(viewsets.ModelViewSet):
    """Enhanced ViewSet with better error handling and UUID support"""
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_queryset(self):
        return Conversation.objects.filter(
            participants=self.request.user
        ).prefetch_related('participants', 'messages').distinct()

    def get_serializer_class(self):
        if self.action == 'create':
            return ConversationCreateSerializer
        return ConversationSerializer

    def create(self, request):
        """Enhanced create method with better UUID handling"""
        # Handle different data formats
        data = request.data
        
        # If data comes as a single UUID string, wrap it properly
        if isinstance(data, str):
            try:
                # Try to parse as UUID
                uuid.UUID(data)
                data = {"participant_id": data}
            except ValueError:
                # Try to parse as JSON
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    return Response(
                        {"error": "Invalid data format"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        # Handle case where UUID is passed directly
        elif hasattr(data, 'get') and len(data) == 1:
            # Check if we have a single key that looks like a UUID
            for key, value in data.items():
                try:
                    uuid.UUID(str(value))
                    if key not in ['participant_id', 'participants']:
                        # Assume this is meant to be participant_id
                        data = {"participant_id": value}
                    break
                except ValueError:
                    continue

        print(f"DEBUG - Processed request data: {data}")

        serializer = self.get_serializer(
            data=data, 
            context={'request': request}
        )
        
        if serializer.is_valid():
            try:
                conversation = serializer.save()
                # Return using read serializer
                response_serializer = ConversationSerializer(
                    conversation, 
                    context={'request': request}
                )
                return Response(
                    response_serializer.data, 
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                return Response(
                    {"error": f"Failed to create conversation: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages for a conversation with proper UUID handling"""
        try:
            conversation = self.get_object()
        except Exception as e:
            return Response(
                {'error': 'Conversation not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
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
            serializer = MessageSerializer(
                page, 
                many=True, 
                context={'request': request}
            )
            return self.get_paginated_response(serializer.data)

        serializer = MessageSerializer(
            messages, 
            many=True, 
            context={'request': request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_all_read(self, request, pk=None):
        """Mark all messages in conversation as read"""
        try:
            conversation = self.get_object()
        except Exception as e:
            return Response(
                {'error': 'Conversation not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify user is participant
        if not conversation.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this conversation'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Update messages to mark as read
        updated_count = conversation.messages.filter(
            receiver=request.user,
            is_read=False
        ).update(
            is_read=True,
            read_at=timezone.now(),
            status='seen'
        )

        return Response({
            'status': 'Messages marked as read',
            'updated_count': updated_count
        })

    @action(detail=False, methods=['post'])
    def create_with_user(self, request):
        """Alternative endpoint for creating conversations with a single user"""
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Use the main create method with formatted data
        request.data = {"participant_id": user_id}
        return self.create(request)
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for user search and user-related operations"""
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    
    def get_queryset(self):
        queryset = User.objects.all().exclude(id=self.request.user.id)
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )
        return queryset[:10]
    
    @action(detail=False, methods=['get'])
    def online_users(self, request):
        """Get list of online users"""
        online_users = User.objects.filter(
            is_online=True
        ).exclude(id=request.user.id)
        serializer = self.get_serializer(online_users, many=True)
        return Response(serializer.data)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Message.objects.filter(
            Q(sender=self.request.user) | Q(receiver=self.request.user)
        ).filter(is_deleted=False).order_by('-created_at')
    
    def create(self, request):
        """Create a new message"""
        
        
       
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
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a specific message as read"""
        message = self.get_object()
        
        # Verify user is the receiver  
        if message.receiver != request.user:
            return Response(
                {'error': 'You can only mark your own messages as read'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not message.is_read:
            message.is_read = True
            message.read_at = timezone.now()
            message.status = 'seen'
            message.save()
        
        serializer = self.get_serializer(message)
        return Response(serializer.data)

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return self.request.user.notifications.all().order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a specific notification as read"""
        notification = self.get_object()
        
        # Verify notification belongs to current user
        if notification.user != request.user:
            return Response(
                {'error': 'You can only mark your own notifications as read'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save()
        
        return Response({'status': 'Notification marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        updated_count = request.user.notifications.filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({
            'status': 'All notifications marked as read',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = request.user.notifications.filter(is_read=False).count()
        return Response({'unread_count': count})
