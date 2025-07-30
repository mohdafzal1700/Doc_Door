from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VideoCallViewSet

router = DefaultRouter()
router.register(r'video', VideoCallViewSet, basename='video')

urlpatterns = [
    path('', include(router.urls)),
]
