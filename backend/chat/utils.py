# import redis
# from django.conf import settings
# import json
# import logging

# logger = logging.getLogger(__name__)

# class RedisManager:
#     def __init__(self):
#         self.redis_client = redis.from_url(settings.REDIS_URL)
    
#     async def add_user_to_conversation(self, conversation_id, user_id):
#         """Add user to conversation's online users set"""
#         key = f"conversation:{conversation_id}:online_users"
#         self.redis_client.sadd(key, user_id)
#         self.redis_client.expire(key, 86400)  # 24 hours
    
#     async def remove_user_from_conversation(self, conversation_id, user_id):
#         """Remove user from conversation's online users set"""
#         key = f"conversation:{conversation_id}:online_users"
#         self.redis_client.srem(key, user_id)
    
#     async def get_online_users_in_conversation(self, conversation_id):
#         """Get list of online users in conversation"""
#         key = f"conversation:{conversation_id}:online_users"
#         user_ids = self.redis_client.smembers(key)
#         return [int(user_id) for user_id in user_ids]
    
#     async def set_user_typing(self, conversation_id, user_id, is_typing=True):
#         """Set user typing status with expiration"""
#         key = f"conversation:{conversation_id}:typing:{user_id}"
#         if is_typing:
#             self.redis_client.setex(key, 10, json.dumps({'typing': True}))  # 10 seconds
#         else:
#             self.redis_client.delete(key)
    
#     async def get_typing_users(self, conversation_id):
#         """Get users currently typing in conversation"""
#         pattern = f"conversation:{conversation_id}:typing:*"
#         keys = self.redis_client.keys(pattern)
#         typing_users = []
#         for key in keys:
#             user_id = key.decode().split(':')[-1]
#             if self.redis_client.get(key):
#                 typing_users.append(int(user_id))
#         return typing_users


from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from .models import Notification
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


def create_and_send_notification(user_id, message, notification_type='message', related_object_id=None, sender_id=None):
    """
    Create a notification and send it via WebSocket
    
    Args:
        user_id: ID of the user to receive notification
        message: Notification message
        notification_type: Type of notification ('message', 'appointment', etc.)
        related_object_id: ID of related object (appointment, etc.)
        sender_id: ID of sender user (optional)
    
    Returns:
        notification object if successful, None if failed
    """
    try:
        # Get user
        user = User.objects.get(id=user_id)
        print(f'user is like {user}')
        
        # Get sender if provided
        sender = None
        if sender_id:
            try:
                sender = User.objects.get(id=sender_id)
            except User.DoesNotExist:
                logger.warning(f"Sender with ID {sender_id} not found")
        
        # Create notification
        notification = user.notifications.create(
            message=message,
            type=notification_type,
            related_object_id=related_object_id,
            sender=sender
        )
        print('notifications is settled')
        
        # Send via WebSocket
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}",
                {
                    "type": "notification",
                    "data": {
                        "id": str(notification.id),  # Convert UUID to string
                        "type": notification.type,
                        "message": notification.message,
                        "related_object_id": notification.related_object_id,
                        "created_at": notification.created_at.isoformat(),
                        "is_read": notification.is_read,
                        "read_at": notification.read_at.isoformat() if notification.read_at else None,
                        "sender": {
                            "id": str(sender.id),  # ← Convert UUID to string
                            "username": sender.username
                        } if sender else None
                    }
                }
            )
        
        logger.info(f"Notification created and sent to user {user_id}")
        return notification
        
    except User.DoesNotExist:
        logger.error(f"User with ID {user_id} not found")
        return None
    except Exception as e:
        logger.error(f"Failed to create notification: {str(e)}")
        return None