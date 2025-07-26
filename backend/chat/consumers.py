import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Conversation, Message
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.conversation_id = None
        self.conversation_group_name = None
        self.user = None

    async def connect(self):
        """Step 1: Basic Connection Setup with JWT Authentication"""
        try:
            # Get conversation ID from URL
            self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
            self.conversation_group_name = f'chat_{self.conversation_id}'
            
            # Get user from scope (set by JWT middleware)
            self.user = self.scope['user']
            
            # Basic validation - check if user is authenticated
            if not self.user or self.user.is_anonymous:
                logger.error("Anonymous user - rejecting connection")
                await self.close(code=4001)  # Authentication error
                return
            
            # Check if user can access this conversation
            can_access = await self.can_access_conversation()
            if not can_access:
                logger.error(f"User {self.user.username} cannot access conversation {self.conversation_id}")
                await self.close(code=4003)  # Authorization error
                return
            
            # Join the conversation group
            await self.channel_layer.group_add(
                self.conversation_group_name,
                self.channel_name
            )
            
            # Accept the connection
            await self.accept()
            logger.info(f"User {self.user.username} connected to conversation {self.conversation_id}")
            
            # Send connection confirmation
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': f'Connected to conversation {self.conversation_id}',
                'user': {
                    'id': self.user.id,
                    'username': self.user.username,
                }
            }))
            
        except Exception as e:
            logger.error(f"Connection error: {e}")
            await self.close()

    async def disconnect(self, close_code):
        """Step 2: Clean Disconnect"""
        if self.conversation_group_name:
            await self.channel_layer.group_discard(
                self.conversation_group_name,
                self.channel_name
            )
        
        if self.user and not isinstance(self.user.AnonymousUser):
            logger.info(f"User {self.user.id} disconnected from conversation {self.conversation_id}")
        else:
            logger.info(f"Anonymous user disconnected from conversation {self.conversation_id}")

    async def receive(self, text_data):
        """Step 3: Handle Incoming Messages"""
        try:
            # Double-check authentication (in case token expired during connection)
            if not self.user or self.user.is_anonymous:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Authentication required'
                }))
                return
            
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
            else:
                logger.warning(f"Unknown message type: {message_type}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                }))
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to process message'
            }))

    async def handle_chat_message(self, data):
        """Step 4: Process Chat Messages with Database Persistence"""
        try:
            message_content = data.get('message', '').strip()
            receiver_id = data.get('receiver_id')
            
            if not message_content:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Message content cannot be empty'
                }))
                return
                
            if not receiver_id:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'receiver_id is required'
                }))
                return
            
            # Save message to database
            message = await self.create_message(message_content, receiver_id)
            if not message:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Failed to create message - invalid receiver or conversation'
                }))
                return
            
            # Send to all users in the conversation
            await self.channel_layer.group_send(
                self.conversation_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': str(message.id),
                        'conversation_id': str(message.conversation.id),
                        'sender': {
                            'id': message.sender.id,
                            'username': message.sender.username,
                        },
                        'receiver': {
                            'id': message.receiver.id,
                            'username': message.receiver.username,
                        } if message.receiver else None,
                        'content': message.content,
                        'created_at': message.created_at.isoformat(),
                    }
                }
            )
            
            logger.info(f"Message created by user {self.user.username} in conversation {self.conversation_id}")
            
        except Exception as e:
            logger.error(f"Error handling chat message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to send message'
            }))

    async def handle_typing(self, data):
        """Step 5: Handle Typing Indicators"""
        try:
            is_typing = data.get('is_typing', False)
            await self.channel_layer.group_send(
                self.conversation_group_name,
                {
                    'type': 'typing_indicator',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'is_typing': is_typing,
                }
            )
        except Exception as e:
            logger.error(f"Error handling typing indicator: {e}")

    # Database operations
    @database_sync_to_async
    def can_access_conversation(self):
        """Check if user can access this conversation"""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            return conversation.participants.filter(id=self.user.id).exists()
        except Conversation.DoesNotExist:
            logger.error(f"Conversation {self.conversation_id} does not exist")
            return False
        except Exception as e:
            logger.error(f"Error checking conversation access: {e}")
            return False

    @database_sync_to_async
    def create_message(self, content, receiver_id):
        """Create a new message in the database"""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            receiver = User.objects.get(id=receiver_id)
            
            # Verify receiver is participant in the conversation
            if not conversation.participants.filter(id=receiver_id).exists():
                logger.error(f"Receiver {receiver_id} is not a participant in conversation {self.conversation_id}")
                return None
            
            # Create the message
            message = Message.objects.create(
                conversation=conversation,
                sender=self.user,
                receiver=receiver,
                content=content
            )
            
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

    # WebSocket event handlers
    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message']
        }))

    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket"""
        # Don't send typing indicator to the sender
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing_indicator',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing'],
            }))