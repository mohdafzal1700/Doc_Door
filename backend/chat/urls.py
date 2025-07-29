from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'conversations', views.ConversationViewSet, basename='conversation')
router.register(r'messages', views.MessageViewSet, basename='message')
router.register(r'notifications', views.NotificationViewSet, basename='notification')
router.register(r'users', views.UserViewSet, basename='user')  # Add this line



urlpatterns = [
    path('', include(router.urls)),
    path('upload/', views.FileUploadView.as_view(), name='file-upload'),
]