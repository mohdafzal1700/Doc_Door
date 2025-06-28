from django.urls import path
from .views import (
    AdminLoginView,
    AdminTokenRefreshView,
    AdminLogoutView,
    PatientManagementView,
    
)

urlpatterns = [
    path('admins/login/', AdminLoginView.as_view(), name='admin-login'),
    path('admins/token/refresh/', AdminTokenRefreshView.as_view(), name='admin-token-refresh'),
    path('admins/logout/', AdminLogoutView.as_view(), name='admin-logout'),
    path('admins/patient-management/', PatientManagementView.as_view(), name='patient-list'),
    path('admins/patient-management/<uuid:pk>/', PatientManagementView.as_view(), name='patient-detail'),
    path('admins/patient-management/<uuid:pk>/toggle/', PatientManagementView.as_view(), name='patient-toggle'),
    
]