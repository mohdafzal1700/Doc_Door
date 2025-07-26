import jwt
import logging
from urllib.parse import parse_qs
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)
User = get_user_model()

@database_sync_to_async
def get_user_by_id(user_id):
    """Get user from database by ID"""
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    """
    JWT Authentication middleware for WebSocket connections.
    
    Token can be passed in:
    1. Query parameter: ?token=your_jwt_token
    2. Subprotocol: Sec-WebSocket-Protocol header
    """
    
    async def __call__(self, scope, receive, send):
        # Only process WebSocket connections
        if scope["type"] != "websocket":
            return await super().__call__(scope, receive, send)
        
        # Extract token from query parameters or headers
        token = await self.get_token_from_scope(scope)
        
        if token:
            user = await self.get_user_from_token(token)
            scope["user"] = user
            logger.info(f"WebSocket authenticated user: {user}")
        else:
            scope["user"] = AnonymousUser()
            logger.warning("No JWT token provided for WebSocket connection")
        
        return await super().__call__(scope, receive, send)
    
    async def get_token_from_scope(self, scope):
        """Extract JWT token from WebSocket scope"""
        # Method 1: Get from query parameters (?token=...)
        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        
        if "token" in query_params:
            return query_params["token"][0]
        
        # Method 2: Get from subprotocols (Sec-WebSocket-Protocol header)
        subprotocols = scope.get("subprotocols", [])
        for protocol in subprotocols:
            if protocol.startswith("access_token."):
                return protocol.replace("access_token.", "")
        
        # Method 3: Get from headers (if passed as custom header)
        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization", b"").decode()
        
        if auth_header.startswith("Bearer "):
            return auth_header[7:]  # Remove 'Bearer ' prefix
        
        return None
    
    async def get_user_from_token(self, token):
        """Decode JWT token and return user"""
        try:
            # Decode the JWT token
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,  # or your JWT_SECRET_KEY
                algorithms=["HS256"]
            )
            
            # Extract user ID from payload
            user_id = payload.get("user_id")
            if not user_id:
                logger.error("No user_id in JWT token payload")
                return AnonymousUser()
            
            # Get user from database
            user = await get_user_by_id(user_id)
            return user
            
        except jwt.ExpiredSignatureError:
            logger.error("JWT token has expired")
            return AnonymousUser()
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid JWT token: {e}")
            return AnonymousUser()
        except Exception as e:
            logger.error(f"Error decoding JWT token: {e}")
            return AnonymousUser()