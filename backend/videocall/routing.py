# video_call/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/call/(?P<user_id>\w+)/$', consumers.VideoCallConsumer.as_asgi()),
]