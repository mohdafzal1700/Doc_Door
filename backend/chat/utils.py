import redis
from django.conf import settings
import json
import logging

logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL)
    
    async def add_user_to_conversation(self, conversation_id, user_id):
        """Add user to conversation's online users set"""
        key = f"conversation:{conversation_id}:online_users"
        self.redis_client.sadd(key, user_id)
        self.redis_client.expire(key, 86400)  # 24 hours
    
    async def remove_user_from_conversation(self, conversation_id, user_id):
        """Remove user from conversation's online users set"""
        key = f"conversation:{conversation_id}:online_users"
        self.redis_client.srem(key, user_id)
    
    async def get_online_users_in_conversation(self, conversation_id):
        """Get list of online users in conversation"""
        key = f"conversation:{conversation_id}:online_users"
        user_ids = self.redis_client.smembers(key)
        return [int(user_id) for user_id in user_ids]
    
    async def set_user_typing(self, conversation_id, user_id, is_typing=True):
        """Set user typing status with expiration"""
        key = f"conversation:{conversation_id}:typing:{user_id}"
        if is_typing:
            self.redis_client.setex(key, 10, json.dumps({'typing': True}))  # 10 seconds
        else:
            self.redis_client.delete(key)
    
    async def get_typing_users(self, conversation_id):
        """Get users currently typing in conversation"""
        pattern = f"conversation:{conversation_id}:typing:*"
        keys = self.redis_client.keys(pattern)
        typing_users = []
        for key in keys:
            user_id = key.decode().split(':')[-1]
            if self.redis_client.get(key):
                typing_users.append(int(user_id))
        return typing_users
