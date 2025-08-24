
import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Conversation, Message, Notification
from django.utils import timezone
import logging
import traceback
from .utils import create_and_send_notification

logger = logging.getLogger(__name__)
User = get_user_model()

def safe_json_dumps(data):
    """JSON encoder that handles UUID objects and other non-serializable types"""
    def convert(obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        elif hasattr(obj, 'isoformat'):  # Handle datetime objects
            return obj.isoformat()
        elif hasattr(obj, '__str__'):  # Handle other objects with string representation
            return str(obj)
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    try:
        result = json.dumps(data, default=convert)
        return result
    except Exception as e:
        raise

class ChatConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.conversation_id = None
        self.conversation_group_name = None
        self.user = None
        self.is_disconnected = False

    async def connect(self):
        """Enhanced connection with comprehensive debugging"""
        try:
            conversation_id_str = self.scope['url_route']['kwargs']['conversation_id']
            
            # Validate UUID format
            try:
                self.conversation_id = uuid.UUID(conversation_id_str)
            except ValueError as ve:
                logger.error(f"Invalid conversation ID format: {conversation_id_str} - {ve}")
                await self.close(code=4000)
                return

            self.conversation_group_name = f'chat_{str(self.conversation_id)}'
            self.user = self.scope['user']

            # Authentication check
            if not self.user or self.user.is_anonymous:
                logger.error("Anonymous user - rejecting connection")
                await self.close(code=4001)
                return

            can_access = await self.can_access_conversation()
            if not can_access:
                logger.error(f"User {self.user.username} cannot access conversation {self.conversation_id}")
                await self.close(code=4003)
                return

            await self.channel_layer.group_add(
                self.conversation_group_name,
                self.channel_name
            )

            await self.accept()
            logger.info(f"User @{self.user.username} connected to conversation {str(self.conversation_id)}")

            # Prepare confirmation data with detailed logging
            confirmation_data = {
                'type': 'connection_established',
                'message': f'Connected to conversation {str(self.conversation_id)}',
                'conversation_id': str(self.conversation_id),
                'user': {
                    'id': str(self.user.id),
                    'username': self.user.username,
                }
            }

            try:
                json_data = safe_json_dumps(confirmation_data)
                await self.send(text_data=json_data)
            except Exception as json_error:
                raise

            await self.notify_user_status('online')

        except Exception as e:
            logger.error(f"Connection error: {e}")
            await self.close(code=1011)

    async def disconnect(self, close_code):
        """Clean disconnect with detailed debugging"""
        # Prevent duplicate disconnect operations
        if self.is_disconnected:
            return
        self.is_disconnected = True

        try:
            if self.conversation_group_name:
                await self.channel_layer.group_discard(
                    self.conversation_group_name,
                    self.channel_name
                )
            else:
                logger.error(f"No group name to leave")

            # Step 2: Notify user status
            if self.user and not self.user.is_anonymous:
                await self.notify_user_status('offline')

            logger.info(f"User @{self.user.username} disconnected from conversation {str(self.conversation_id)}")

        except Exception as e:
            logger.error(f"Error during disconnect: {e}")

    async def receive(self, text_data):
        """Handle incoming messages with comprehensive debugging"""
        try:
            # Step 1: Authentication check
            if not self.user or self.user.is_anonymous:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'Authentication required'
                }))
                return

            try:
                data = json.loads(text_data)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON received from {self.user.username}: {e}")
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'Invalid JSON format'
                }))
                return

            # Step 3: Extract message type
            message_type = data.get('type')
            logger.info(f"Received message type: {message_type} from user: {self.user.username}")

            if message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type in ['typing', 'typing_indicator']:
                await self.handle_typing(data)
            elif message_type == 'connection_test':
                await self.handle_connection_test(data)
            elif message_type == 'edit_message':
                await self.handle_edit_message(data)
            elif message_type == 'delete_message':
                await self.handle_delete_message(data)
            elif message_type == 'file_uploaded':
                await self.handle_file_uploaded(data)
            else:
                logger.warning(f"Unknown message type: {message_type} from user: {self.user.username}")
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                }))

        except Exception as e:
            logger.error(f"Error processing message from {self.user.username if self.user else 'unknown'}: {e}")
            await self.send(text_data=safe_json_dumps({
                'type': 'error',
                'message': 'Failed to process message'
            }))

    
    async def handle_connection_test(self, data):
        """Handle connection test messages with detailed debugging"""
        print(f"\n HANDLING CONNECTION TEST")
        try:
            logger.info(f"Connection test received from user: {self.user.username}")
            response_data = {
                'type': 'connection_confirmed',
                'message': 'Connection test successful',
                'timestamp': timezone.now().isoformat(),
                'user_id': str(self.user.id),
                'conversation_id': str(self.conversation_id)
            }
            json_response = safe_json_dumps(response_data)
            await self.send(text_data=json_response)
            logger.info(f"Connection test response sent to user: {self.user.username}")
        except Exception as e:
            logger.error(f"Error handling connection test: {e}")
            await self.send(text_data=safe_json_dumps({
                'type': 'error',
                'message': 'Connection test failed'
            }))

    async def handle_chat_message(self, data):
        """Process chat messages with enhanced debugging"""
        try:
        
            message_content = data.get('message', '').strip()
            receiver_id = data.get('receiver_id')
            temp_id = data.get('temp_id')
            sender_id_from_client = data.get('sender_id')  # For debugging only

            if not message_content:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'Message content cannot be empty',
                    'temp_id': temp_id
                }))
                return

            if not receiver_id:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'receiver_id is required',
                    'temp_id': temp_id
                }))
                return

            try:
                receiver_uuid = uuid.UUID(str(receiver_id))
            except ValueError as ve:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': f'Invalid receiver_id format: {receiver_id}',
                    'temp_id': temp_id
                }))
                return

            logger.info(f"Creating message from {self.user.username} to {receiver_id} in conversation {self.conversation_id}")

            # Save message to database
            message = await self.create_message(message_content, receiver_uuid)
            if not message:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'Failed to create message - invalid receiver or conversation',
                    'temp_id': temp_id
                }))
                return

            message_data = {
                'id': str(message.id),
                'conversation_id': str(message.conversation.id),
                'sender': {
                    'id': str(message.sender.id),
                    'username': message.sender.username,
                    'full_name': getattr(message.sender, 'full_name', message.sender.username),
                },
                'receiver': {
                    'id': str(message.receiver.id),
                    'username': message.receiver.username,
                    'full_name': getattr(message.receiver, 'full_name', message.receiver.username),
                } if message.receiver else None,
                'content': message.content,
                'created_at': message.created_at.isoformat(),
                'is_read': False,
                'temp_id': temp_id,
            }

            try:
                confirmation = {
                    'type': 'message_sent',
                    'message': message_data
                }
                json_confirmation = safe_json_dumps(confirmation)
                await self.send(text_data=json_confirmation)
            except Exception as conf_error:
                raise

            try:
                await self.channel_layer.group_send(
                    self.conversation_group_name,
                    {
                        'type': 'chat_message',
                        'message': message_data
                    }
                )
            
            except Exception as broadcast_error:
                raise

            await self.send_message_notifications(message)
            logger.info(f"Message successfully created and sent by {self.user.username}")

        except Exception as e:
            logger.error(f"Error handling chat message: {e}")
            await self.send(text_data=safe_json_dumps({
                'type': 'error',
                'message': 'Failed to send message',
                'temp_id': data.get('temp_id')
            }))
            
            
    async def send_message_notifications(self, message):
        """Send notification to the message receiver (one-on-one chat)"""
        try:
        
            # Create notification message
            notification_message = f"New message from {message.sender.username}: {message.content[:50]}{'...' if len(message.content) > 50 else ''}"
            
            # Send notification to the receiver only
            notification = await self.create_notification_async(
                user_id=str(message.receiver.id),
                message=notification_message,
                notification_type='message',
                related_object_id=str(message.id),
                sender_id=str(message.sender.id)
            )
            
            if notification:
                logger.info(f"Message notification sent to {message.receiver.username} for message {message.id}")
            else:
                logger.error(f"Failed to send notification for message {message.id}")
            
        except Exception as e:
            logger.error(f"Error in send_message_notifications: {e}")
        
        
    @database_sync_to_async
    def create_notification_async(self, user_id, message, notification_type='message', related_object_id=None, sender_id=None):
        """Async wrapper for create_and_send_notification"""
        try:
            # Call your sync notification function
            notification = create_and_send_notification(
                user_id=user_id,
                message=message,
                notification_type=notification_type,
                related_object_id=related_object_id,
                sender_id=sender_id
            )
            return notification
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return None
        

    async def notify_user_status(self, status):
        """Notify other users about status change with detailed debugging"""
        try:
            status_data = {
                'type': 'user_status_changed',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'status': status,
            }
            await self.channel_layer.group_send(
                self.conversation_group_name,
                status_data
            )
            logger.info(f"User @{self.user.username} status changed to {status}")
        except Exception as e:
            logger.error(f"Error notifying user status: {e}")


    # Database operations with extensive debugging
    @database_sync_to_async
    def can_access_conversation(self):
        """Check if user can access this conversation with detailed debugging"""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            participant_ids = list(conversation.participants.values_list('id', flat=True))
            has_access = conversation.participants.filter(id=self.user.id).exists()
            logger.info(f"Access check for {self.user.username} to conversation {self.conversation_id}: {has_access}")
            return has_access
        except Conversation.DoesNotExist:
            logger.error(f"Conversation {self.conversation_id} does not exist")
            return False
        except Exception as e:
            logger.error(f"Error checking conversation access: {e}")
            return False


    async def handle_file_uploaded(self, data):
        """Handle file upload notification from API"""
        message_id = data.get('message_id')
        if not message_id:
            return

        try:
            # Get the message with file data
            message = await self.get_file_message(message_id)
            if not message:
                return

            # Broadcast file message to group
            await self.channel_layer.group_send(
                self.conversation_group_name,
                {
                    'type': 'file_message',
                    'message': message
                }
            )
        except Exception as e:
            logger.error(f"Error handling file upload: {e}")


    @database_sync_to_async
    def get_file_message(self, message_id):
        """Get file message data"""
        try:
            message = Message.objects.select_related(
                'sender', 'receiver', 'conversation'
            ).get(id=message_id)
            return {
                'id': str(message.id),
                'conversation_id': str(message.conversation.id),
                'sender': {
                    'id': str(message.sender.id),
                    'username': message.sender.username,
                },
                'receiver': {
                    'id': str(message.receiver.id),
                    'username': message.receiver.username,
                } if message.receiver else None,
                'content': message.content,
                'file_url': message.file.url if message.file else None,
                'file_name': message.file_name,
                'file_type': message.file_type,
                'file_size': message.file_size,
                'mime_type': message.mime_type,
                'created_at': message.created_at.isoformat(),
                'is_file_message': message.is_file_message,
                'is_read': message.is_read
            }
        except Message.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error getting file message: {e}")
            return None


    # Add this WebSocket event handler
    async def file_message(self, event):
        """Send file message to WebSocket"""
        try:
            message_data = event['message']
            response = {
                'type': 'file_message',
                'message': message_data
            }
            json_response = safe_json_dumps(response)
            await self.send(text_data=json_response)
        except Exception as e:
            logger.error(f"Error sending file message: {e}")


    @database_sync_to_async
    def create_message(self, content, receiver_id):
        """Create a new message in the database with extensive debugging"""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            receiver = User.objects.get(id=receiver_id)

            sender_is_participant = conversation.participants.filter(id=self.user.id).exists()
            if not sender_is_participant:
                logger.error(f"Sender {self.user.id} is not a participant in conversation {self.conversation_id}")
                return None

            receiver_is_participant = conversation.participants.filter(id=receiver_id).exists()
            if not receiver_is_participant:
                logger.error(f"Receiver {receiver_id} is not a participant in conversation {self.conversation_id}")
                return None

            message = Message.objects.create(
                conversation=conversation,
                sender=self.user,
                receiver=receiver,
                content=content
            )
            logger.info(f"Message created successfully: {message.id}")
            return message

        except Conversation.DoesNotExist:
            logger.error(f"Conversation {self.conversation_id} does not exist")
            return None
        except User.DoesNotExist:
            logger.error(f"User {receiver_id} does not exist")
            return None
        except Exception as e:
            logger.error(f"Error creating message: {e}")
            return None


    async def chat_message(self, event):
        """Send chat message to WebSocket with debugging"""
        try:
            message_data = event['message']
            response = {
                'type': 'chat_message',
                'message': message_data
            }
            json_response = safe_json_dumps(response)
            await self.send(text_data=json_response)
        except Exception as e:
            logger.error(f"Error sending chat message: {e}")


    async def user_status_changed(self, event):
        """Send user status change with debugging"""
        try:
            # Don't send status to the user who changed status
            event_user_id = event['user_id']
            current_user_id = str(self.user.id)
            if event_user_id != current_user_id:
                status_response = {
                    'type': 'user_status_changed',
                    'user_id': event['user_id'],
                    'username': event['username'],
                    'status': event['status'],
                }
                json_response = safe_json_dumps(status_response)
                await self.send(text_data=json_response)
        except Exception as e:
            logger.error(f"Error sending user status change: {e}")


    # Handler methods with debugging
    async def handle_typing(self, data):
        """Handle typing indicators with debugging"""
        try:
            is_typing = data.get('is_typing', False)
            print(f"    Is typing: {is_typing}")
            print(f"   User: {self.user.username} (ID: {self.user.id})")

            typing_data = {
                'type': 'typing_indicator',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'is_typing': is_typing,
            }
            await self.channel_layer.group_send(
                self.conversation_group_name,
                typing_data
            )
            
        except Exception as e:
            logger.error(f"Error handling typing indicator: {e}")

    
    async def handle_edit_message(self, data):
        """Handle message editing with proper confirmation"""
        try:
            message_id = data.get('message_id')
            new_content = data.get('content', '').strip()

            if not message_id:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'message_id is required'
                }))
                return

            if not new_content:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'Content cannot be empty'
                }))
                return

            message_data = await self.update_message_with_data(message_id, new_content)
            if not message_data:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'Failed to update message - not found or unauthorized'
                }))
                return
            await self.channel_layer.group_send(
                self.conversation_group_name,
                {
                    'type': 'message_edited',
                    'message': message_data
                }
            )
            logger.info(f"Message {message_id} edited successfully by {self.user.username}")
            
        except Exception as e:
            logger.error(f"Error handling edit message: {e}")
            await self.send(text_data=safe_json_dumps({
                'type': 'error',
                'message': 'Failed to edit message'
            }))

    async def handle_delete_message(self, data):
        """Handle message deletion with proper confirmation"""
        try:
            message_id = data.get('message_id')
            
            if not message_id:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'message_id is required'
                }))
                return

            deleted_message_data = await self.delete_message_with_data(message_id)
            if not deleted_message_data:
                await self.send(text_data=safe_json_dumps({
                    'type': 'error',
                    'message': 'Failed to delete message - not found or unauthorized'
                }))
                return

            await self.channel_layer.group_send(
                self.conversation_group_name,
                {
                    'type': 'message_deleted',
                    'message_id': deleted_message_data['message_id'],  # Use the correct key
                    'deleted_by': deleted_message_data.get('deleted_by'),
                    'deleted_at': deleted_message_data.get('deleted_at'),
                    'conversation_id': deleted_message_data.get('conversation_id')
                }
            )
            logger.info(f"Message {message_id} deleted successfully by {self.user.username}")
            
        except Exception as e:
            logger.error(f"Error handling delete message: {e}")
            await self.send(text_data=safe_json_dumps({
                'type': 'error',
                'message': 'Failed to delete message'
            }))


    async def message_edited(self, event):
        """Handle message_edited events from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'message_edited',
            'message': event['message'],
            'message_id': event.get('message_id'),
            'edited_by': event.get('edited_by'),
            'timestamp': event.get('timestamp')
        }))


    async def message_deleted(self, event):
        """Handle message_deleted events from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message_id': event['message_id'],  
            'deleted_by': event.get('deleted_by'),
            'timestamp': event.get('deleted_at')  
        }))


    @database_sync_to_async
    def update_message_with_data(self, message_id, new_content):
        """Update message content and return formatted data"""
        try:
            # Get the message with related fields prefetched
            message = Message.objects.select_related(
                'sender', 'receiver', 'conversation'
            ).get(
                id=message_id,
                sender=self.user, 
                conversation=self.conversation_id
            )
            message.content = new_content
            if hasattr(message, 'updated_at'):
                message.updated_at = timezone.now()
            message.save()
            
            message_data = {
                'id': str(message.id),
                'conversation_id': str(message.conversation.id),
                'sender': {
                    'id': str(message.sender.id),
                    'username': message.sender.username,
                    'full_name': getattr(message.sender, 'full_name', message.sender.username),
                },
                'receiver': {
                    'id': str(message.receiver.id),
                    'username': message.receiver.username,
                    'full_name': getattr(message.receiver, 'full_name', message.receiver.username),
                } if message.receiver else None,
                'content': message.content,
                'created_at': message.created_at.isoformat(),
                'edited': True,
                'edited_at': message.updated_at.isoformat() if hasattr(message, 'updated_at') else timezone.now().isoformat(),
                'is_read': getattr(message, 'is_read', False),
            }
            return message_data

        except Message.DoesNotExist:
            logger.error(f"Message {message_id} not found or user {self.user.id} not authorized")
            return None
        except Exception as e:
            logger.error(f"Error updating message: {e}")
            return None


    @database_sync_to_async
    def delete_message_with_data(self, message_id):
        """Delete message and return delete data with enhanced debugging"""
        try:
            
            actual_message_id = message_id
            if message_id.startswith('file_') and '_' in message_id:
                actual_message_id = message_id.split('_')[-1]

            user_messages = Message.objects.filter(
                sender=self.user,
                conversation=self.conversation_id
            ).values_list('id', 'content', 'created_at')
            
            # for msg_id, content, created_at in user_messages:
            #     print(f"      - {msg_id}: '{content[:50]}...' at {created_at}")

            # Now try to find the specific message
            try:
                message = Message.objects.select_related('sender', 'conversation').get(
                    id=actual_message_id,
                    sender=self.user,
                    conversation=self.conversation_id
                )
                
            except Message.DoesNotExist:
                logger.error(f"    Message not found with exact match, checking alternatives...")

                try:
                    msg_different_sender = Message.objects.get(id=actual_message_id)
                except Message.DoesNotExist:
                    logger.error(f"    Message doesn't exist in database at all")
                try:
                    msg_different_conv = Message.objects.filter(id=actual_message_id).first()
                    if msg_different_conv:
                        logger.error(f"     Message exists but in conversation: {msg_different_conv.conversation.id} (not {self.conversation_id})")
                except Exception as e:
                    logger.error(f"    Error checking different conversation: {e}")
                raise Message.DoesNotExist("Message not found after detailed search")

            delete_data = {
                'message_id': message_id,  # Return original ID
                'conversation_id': str(message.conversation.id),
                'deleted_by': str(message.sender.id),
                'deleted_at': timezone.now().isoformat()
            }

            message.delete()
            return delete_data

        except Message.DoesNotExist:
            logger.error(f"Message {message_id} not found or user {self.user.id} not authorized")
            return None
        except Exception as e:
            logger.error(f"Error deleting message: {e}")
            return None


    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket with debugging"""
        try:
            event_user_id = event['user_id']
            current_user_id = str(self.user.id)
            if event_user_id != current_user_id:
                typing_response = {
                    'type': 'typing_indicator',
                    'user_id': event['user_id'],
                    'username': event['username'],
                    'is_typing': event['is_typing'],
                }
                json_response = safe_json_dumps(typing_response)
                await self.send(text_data=json_response)
        except Exception as e:
            logger.error(f"Error sending typing indicator: {e}")



# NOTIFICATION CONSUMER 

class UserConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print(f"🔗 UserConsumer connect attempt")
        
        try:
            
            self.user = self.scope['user']
            
            # Authentication check
            if not self.user or self.user.is_anonymous:
                logger.info(" User not authenticated")
                await self.close(code=4001)
                return
            
            
            self.user_group_name = f'user_{self.user.id}'
            await self.channel_layer.group_add(self.user_group_name, self.channel_name)
            await self.accept()
            
            
            
            # Send unread notifications on connect
            await self.send_unread_notifications()
            
        except Exception as e:
            logger.info(f" Connection error: {e}")
            logger.info(f" Full error: {traceback.format_exc()}")
            await self.close(code=4000)

    async def disconnect(self, close_code):
        
        if hasattr(self, "user") and self.user and not getattr(self.user, "is_anonymous", True):
            username = getattr(self.user, "username", "Unknown")
        else:
            username = "Unknown"

        
        if hasattr(self, "user_group_name"):
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming notification messages"""
        logger.info(f"\n UserConsumer received message from {self.user.username}: {text_data}")
        # logger.info(f"📩 Message received: {text_data }")
        try:
            data = json.loads(text_data)
            event_type = data.get('type')
            
            if event_type == 'mark_read':
                notification_id = data.get('notification_id')
            
                success = await self.mark_notification_read(notification_id)
                
                # Send response back to client
                response = {
                    'type': 'mark_read_response',
                    'success': success,
                    'notification_id': notification_id,
                    'timestamp': timezone.now().isoformat()
                }
                await self.send(text_data=json.dumps(response))
                
            elif event_type == 'mark_all_read':
                
                count = await self.mark_all_notifications_read()
                
                # Send response back to client
                response = {
                    'type': 'mark_all_read_response',
                    'success': True,
                    'updated_count': count,
                    'timestamp': timezone.now().isoformat()
                }
                await self.send(text_data=json.dumps(response))
                
            else:
                
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown event type: {event_type}'
                }))

        except json.JSONDecodeError as e:
            logger.info(f" Invalid JSON from {self.user.username}: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f" Error processing notification request: {e}")
            logger.error(f" Full error: {traceback.format_exc()}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Server error: {str(e)}'
            }))

    async def notification(self, event):
        """Send notification to WebSocket"""
        try:
            # Handle the notification data structure from your utils
            notification_data = {
                'type': 'notification',
                'data': event.get('data', event.get('notification', {}))
            }
            await self.send(text_data=json.dumps(notification_data))
            logger.info(f" Sent notification to {self.user.username}")
        except Exception as e:
            print(f" Error sending notification: {e}")

    

    @database_sync_to_async
    def get_unread_notifications(self):
        """Get unread notifications for user"""
        try:
            notifications = list(self.user.notifications.filter(is_read=False).order_by('-created_at')[:20])
            
            # Convert to serializable format
            formatted_notifications = []
            for notif in notifications:
                formatted_notifications.append({
                    'id': str(notif.id),
                    'type': notif.type,
                    'message': notif.message,
                    'created_at': notif.created_at.isoformat(),
                    'is_read': notif.is_read,
                    'related_object_id': notif.related_object_id,
                    'sender': {
                        'id': str(notif.sender.id),
                        'username': notif.sender.username
                    } if notif.sender else None
                })
            

            return formatted_notifications
            
        except Exception as e:
            logger.error(f" Error getting unread notifications: {e}")
            return []

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        """Mark single notification as read"""
        
        try:
            if not notification_id:
                logger.error(" No notification_id provided")
                return False

            # Update the notification
            updated = self.user.notifications.filter(
                id=notification_id,
                is_read=False
            ).update(is_read=True, read_at=timezone.now())
            
            success = updated > 0
            
            return success
            
        except Exception as e:
            logger.error(f" Database error marking notification as read: {e}")
            return False

    @database_sync_to_async
    def mark_all_notifications_read(self):
        """Mark all notifications as read"""
       
        try:
            # Update all unread notifications
            updated = self.user.notifications.filter(is_read=False).update(
                is_read=True,
                read_at=timezone.now()
            )
            
            return updated
        except Exception as e:
            logger.error(f" Database error marking all notifications as read: {e}")
            return 0

    async def send_unread_notifications(self):
        """Send unread notifications when user connects"""
        try:
            notifications = await self.get_unread_notifications()
            
            response = {
                'type': 'unread_notifications',
                'notifications': notifications,
                'count': len(notifications)
            }
            
            await self.send(text_data=json.dumps(response))
            
            
        except Exception as e:
            logger.error(f" Error sending unread notifications: {e}")
            logger.error(f" Full error: {traceback.format_exc()}")