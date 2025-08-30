	
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({
        "status": "healthy", 
        "message": "DocDoor API is running"
    })

urlpatterns = [
    path('', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('patients.urls')),
    path('api/doctor/', include('doctor.urls')), 
    path('api/chat/', include('chat.urls')),
    path('api/video-call/', include('videocall.urls')),
    path('api/', include('adminside.urls')), 
]
