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
    
from rest_framework.views import APIView
import mimetypes
import logging
import mimetypes
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
import cloudinary.uploader


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

        messages = conversation.messages.filter(is_deleted=False).order_by('created_at')
        
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
    

    @action(detail=False, methods=['get'], url_path='unread')
    def unread(self, request):
        """Get list of unread notifications"""
        unread_notifications = self.request.user.notifications.filter(
            is_read=False
        ).order_by('-created_at')
        serializer = self.get_serializer(unread_notifications, many=True)
        return Response(serializer.data)
    
    
    @action(detail=False, methods=['get'], url_path='count')
    def count(self, request):
        """Get unread count for badge - alias for unread_count"""
        count = request.user.notifications.filter(is_read=False).count()
        return Response({'count': count, 'unread_count': count})
    
    

# Set up logger
logger = logging.getLogger(__name__)

class FileUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        # Debug: Log incoming request details
        logger.info(f"File upload attempt by user: {request.user.id}")
        logger.info(f"Request data keys: {list(request.data.keys())}")
        logger.info(f"Request FILES keys: {list(request.FILES.keys())}")
        
        # Extract and validate data
        file = request.FILES.get('file')
        conversation_id = request.data.get('conversation_id')
        receiver_id = request.data.get('receiver_id')
        
        # Debug: Log extracted values
        logger.info(f"Extracted - file: {bool(file)}, conversation_id: {conversation_id}, receiver_id: {receiver_id}")
        
        if not file:
            logger.error("No file provided in request")
            return Response({
                'error': 'No file provided'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if not conversation_id:
            logger.error("No conversation_id provided")
            return Response({
                'error': 'conversation_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if not receiver_id:
            logger.error("No receiver_id provided")
            return Response({
                'error': 'receiver_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Debug: Log file details
        logger.info(f"File details - name: {file.name}, size: {file.size}, content_type: {getattr(file, 'content_type', 'unknown')}")
        
        try:
            # Validate conversation exists and user has access
            logger.info(f"Looking up conversation: {conversation_id}")
            conversation = get_object_or_404(Conversation, id=conversation_id)
            
            logger.info(f"Conversation found: {conversation.id}")
            
            # Check user permissions
            if not conversation.participants.filter(id=request.user.id).exists():
                logger.error(f"User {request.user.id} not authorized for conversation {conversation_id}")
                return Response({
                    'error': 'Access denied - you are not a participant in this conversation'
                }, status=status.HTTP_403_FORBIDDEN)
            
            logger.info(f"User {request.user.id} authorized for conversation {conversation_id}")
            
            # Validate receiver exists and is participant
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                receiver = User.objects.get(id=receiver_id)
                logger.info(f"Receiver found: {receiver.id}")
                
                if not conversation.participants.filter(id=receiver_id).exists():
                    logger.error(f"Receiver {receiver_id} not in conversation {conversation_id}")
                    return Response({
                        'error': 'Receiver is not a participant in this conversation'
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
            except User.DoesNotExist:
                logger.error(f"Receiver with id {receiver_id} does not exist")
                return Response({
                    'error': 'Invalid receiver_id'
                }, status=status.HTTP_400_BAD_REQUEST)
                
            cloudinary_response = cloudinary.uploader.upload(
                file,
                resource_type='raw',
                folder='chat_files',
                use_filename=True,
                unique_filename=False
            )

            file_url = cloudinary_response.get('secure_url')
            file_size = cloudinary_response.get('bytes', file.size)
            file_name = cloudinary_response.get('original_filename', file.name)

            
            # Process file type
            mime_type, _ = mimetypes.guess_type(file.name)
            file_type = self.get_file_type(mime_type)
            
            logger.info(f"File type processing - mime_type: {mime_type}, file_type: {file_type}")
            
            # Create message with transaction for safety
            with transaction.atomic():
                logger.info("Creating file message in database")
                
                # Check if your Message model has is_file_message field
                message_data = {
                    'conversation': conversation,
                    'sender': request.user,
                    'receiver_id': receiver_id,
                    'file': file,
                    'file_name': file.name,
                    'file_size': file.size,
                    'file_type': file_type,
                    'mime_type': mime_type,
                    'content': f"Shared a {file_type}: {file.name}",
                }
                
                # Try to add is_file_message field if it exists
                try:
                    from django.core.exceptions import FieldDoesNotExist
                    Message._meta.get_field('is_file_message')
                    message_data['is_file_message'] = True
                    logger.info("Added is_file_message=True to message data")
                except FieldDoesNotExist:
                    logger.info("is_file_message field does not exist on Message model")
                
                message = Message.objects.create(**message_data)
                logger.info(f"Message created successfully with id: {message.id}")
            
            # Send via WebSocket
            try:
                logger.info("Attempting to send file message via WebSocket")
                self.send_file_via_websocket(message)
                logger.info("WebSocket message sent successfully")
            except Exception as ws_error:
                logger.error(f"WebSocket send failed: {str(ws_error)}")
                # Don't fail the request if WebSocket fails
            
            # Prepare response
            response_data = {
                'id': str(message.id),  # Add id field for frontend
                'message_id': str(message.id),
                'url': message.file.url,  # Add url field for frontend  
                'file_url': message.file.url,
                'file_name': message.file_name,
                'file_type': file_type,
                'file_size': file.size,
                'mime_type': mime_type,
                'success': True
            }
            
            logger.info(f"File upload successful - response: {response_data}")
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"File upload failed with error: {str(e)}", exc_info=True)
            return Response({
                'error': f'File upload failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get_file_type(self, mime_type):
        """Determine file type category from MIME type"""
        if not mime_type:
            return 'document'
        
        if mime_type.startswith('image/'):
            return 'image'
        elif mime_type.startswith('video/'):
            return 'video'
        elif mime_type.startswith('audio/'):
            return 'audio'
        elif mime_type == 'application/pdf':
            return 'pdf'
        elif mime_type in ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
            return 'document'
        elif mime_type in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']:
            return 'spreadsheet'
        elif mime_type in ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']:
            return 'archive'
        else:
            return 'document'
    
    def send_file_via_websocket(self, message):
        """Send file message via WebSocket with error handling"""
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            
            channel_layer = get_channel_layer()
            room_group_name = f"chat_{str(message.conversation.id)}"
            
            logger.info(f"Sending WebSocket message to room: {room_group_name}")
            
            # Prepare receiver data safely
            receiver_data = None
            if message.receiver:
                receiver_data = {
                    'id': str(message.receiver.id),
                    'username': message.receiver.username,
                    'full_name': getattr(message.receiver, 'full_name', ''),
                }
            
            ws_message = {
                'type': 'file_message',
                'message': {
                    'id': str(message.id),
                    'conversation_id': str(message.conversation.id),
                    'sender': {
                        'id': str(message.sender.id),
                        'username': message.sender.username,
                        'full_name': getattr(message.sender, 'full_name', ''),
                    },
                    'receiver': receiver_data,
                    'content': message.content,
                    'file_url': message.file.url,
                    'file_name': message.file_name,
                    'file_type': message.file_type,
                    'file_size': message.file_size,
                    'mime_type': message.mime_type,
                    'created_at': message.created_at.isoformat(),
                    
                    'is_read': False
                }
            }
            
            async_to_sync(channel_layer.group_send)(room_group_name, ws_message)
            logger.info("WebSocket message sent successfully")
            
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {str(e)}", exc_info=True)
            raise  # Re-raise to let caller handle