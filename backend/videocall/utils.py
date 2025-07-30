
from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from .models import CallRecord, ActiveCall
import hashlib
import time
import hmac
import base64

def get_webrtc_config():
    """Get WebRTC configuration including STUN/TURN servers"""
    return settings.WEBRTC_CONFIG

def is_user_online(user_id):
    """Check if a user is currently online"""
    # This is a simplified check - you might want to implement
    # a more sophisticated presence system
    return ActiveCall.objects.filter(
        models.Q(call_record__caller_id=user_id) | 
        models.Q(call_record__callee_id=user_id)
    ).exists()

# def get_user_call_history(user_id, limit=10):
#     """Get recent call history for a user"""
#     return CallRecord.objects.filter(
#         models.Q(caller_id=user_id) | models.Q(callee_id=user_id)
#     ).order_by('-started_at')[:limit]

def validate_call_participants(caller_id, callee_id):
    """Validate that both users exist and can participate in a call"""
    try:
        caller = User.objects.get(id=caller_id)
        callee = User.objects.get(id=callee_id)
        
        if caller_id == callee_id:
            return False, "Cannot call yourself"
        
        # Check if either user is already in a call
        active_calls = ActiveCall.objects.filter(
            models.Q(call_record__caller_id=caller_id) |
            models.Q(call_record__callee_id=caller_id) |
            models.Q(call_record__caller_id=callee_id) |
            models.Q(call_record__callee_id=callee_id)
        )
        
        if active_calls.exists():
            return False, "One or both users are already in a call"
        
        return True, "Valid"
        
    except User.DoesNotExist:
        return False, "One or both users do not exist"
    

# def get_turn_credentials(username=None):
#     """Generate TURN server credentials if using dynamic credentials"""
#     if not hasattr(settings, 'TURN_SECRET') or not settings.TURN_SECRET:
#         return None
    
#     # Generate temporary credentials for TURN server
#     if not username:
#         username = f"user_{int(time.time())}"
    
#     # TTL for credentials (24 hours)
#     ttl = 24 * 3600
#     timestamp = int(time.time()) + ttl
#     turn_username = f"{timestamp}:{username}"
    
#     # Generate password using HMAC
#     turn_password = base64.b64encode(
#         hmac.new(
#             settings.TURN_SECRET.encode(),
#             turn_username.encode(),
#             hashlib.sha1
#         ).digest()
#     ).decode()
    
#     return {
#         'username': turn_username,
#         'password': turn_password,
#         'ttl': ttl
#     }

def cleanup_expired_calls():
    """Clean up calls that have been active for too long without proper closure"""
    from django.utils import timezone
    from datetime import timedelta
    
    # Remove active calls older than 2 hours
    cutoff_time = timezone.now() - timedelta(hours=2)
    expired_calls = ActiveCall.objects.filter(created_at__lt=cutoff_time)
    
    for call in expired_calls:
        # Update call record status
        call.call_record.status = 'ended'
        call.call_record.ended_at = timezone.now()
        call.call_record.save()
        
        # Delete active call record
        call.delete()

# def get_call_statistics(user_id):
#     """Get call statistics for a user"""
#     user_calls = CallRecord.objects.filter(
#         models.Q(caller_id=user_id) | models.Q(callee_id=user_id)
#     )
    
#     stats = {
#         'total_calls': user_calls.count(),
#         'outgoing_calls': user_calls.filter(caller_id=user_id).count(),
#         'incoming_calls': user_calls.filter(callee_id=user_id).count(),
#         'answered_calls': user_calls.filter(status='answered').count(),
#         'missed_calls': user_calls.filter(
#             callee_id=user_id, 
#             status__in=['missed', 'rejected']
#         ).count(),
#         'total_call_duration': sum([
#             call.duration.total_seconds() if call.duration else 0 
#             for call in user_calls.filter(status='ended')
#         ])
#     }
    
#     return stats