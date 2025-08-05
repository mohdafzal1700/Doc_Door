from django.urls import path
from .views import (
    AdminLoginView,
    AdminTokenRefreshView,
    AdminLogoutView,
    PatientManagementView,
    DoctorManagementView,
    DoctorApplicationListView,
    DoctorApplicationDetailView,
    DoctorApprovalActionView,
    SubscriptionPlanListCreateView,
    SubscriptionPlanDetailView,
    AdminAppointmentDetailView,
    AdminAppointmentListView
    
)

urlpatterns = [
    path('admins/login/', AdminLoginView.as_view(), name='admin-login'),
    path('admins/token/refresh/', AdminTokenRefreshView.as_view(), name='admin-token-refresh'),
    path('admins/logout/', AdminLogoutView.as_view(), name='admin-logout'),
    path('admins/patient-management/', PatientManagementView.as_view(), name='patient-list'),
    path('admins/patient-management/<uuid:pk>/', PatientManagementView.as_view(), name='patient-detail'),
    path('admins/patient-management/<uuid:pk>/toggle/', PatientManagementView.as_view(), name='patient-toggle'),
    path('admins/doctor-management/', DoctorManagementView.as_view(), name='doctor-list'),
    path('admins/doctor-management/<uuid:pk>/', DoctorManagementView.as_view(), name='doctor-detail'),
    path('admins/doctor-management/<uuid:pk>/toggle/', DoctorManagementView.as_view(), name='doctor-toggle'),
    path('admins/doctor-applications/', DoctorApplicationListView.as_view(), name='doctor-applications-list'),
    path('admins/doctor-applications/<uuid:id>/', DoctorApplicationDetailView.as_view(), name='doctor-application-detail'),
    path('admins/doctor-applications/<uuid:id>/action/', DoctorApprovalActionView.as_view(), name='doctor-approval-action'),
    path('admins/subscription-plans/',SubscriptionPlanListCreateView.as_view(), name='plan-list-create'),
    path('admins/subscription-plans/<int:pk>/',SubscriptionPlanDetailView.as_view(), name='plan-list-create'),
    
    path('admins/appointments/', AdminAppointmentListView.as_view(), name='admin_appointment_list'),
    
    
    path('admins/appointments/<int:appointment_id>/', AdminAppointmentDetailView.as_view(), name='admin_appointment_detail'),
    
]