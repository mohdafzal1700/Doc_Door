# asgi.py
import os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
import chat.routing
from chat.middleware import JWTAuthMiddleware  # Import your middleware

# Choose one of the middleware options:
# JWTAuthMiddleware - allows connections, sets user or AnonymousUser
# JWTAuthRequiredMiddleware - rejects unauthenticated connections

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(  # Add JWT authentication middleware
            URLRouter(
                chat.routing.websocket_urlpatterns
            )
        )
    ),
})