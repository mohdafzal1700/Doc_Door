# video_call/models.py
from django.db import models
from doctor.models import User
from django.utils import timezone

class CallRecord(models.Model):
    CALL_STATUS_CHOICES = [
        ('initiated', 'Initiated'),
        ('ringing', 'Ringing'),
        ('answered', 'Answered'),
        ('ended', 'Ended'),
        ('missed', 'Missed'),
        ('rejected', 'Rejected'),
    ]
    
    caller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='outgoing_calls')
    callee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incoming_calls')
    status = models.CharField(max_length=20, choices=CALL_STATUS_CHOICES, default='initiated')
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)
    
    class Meta:
        ordering = ['-started_at']
    
    def __str__(self):
        return f"Call from {self.caller} to {self.callee} - {self.status}"
    
    def save(self, *args, **kwargs):
        if self.ended_at and self.started_at:
            self.duration = self.ended_at - self.started_at
        super().save(*args, **kwargs)

class ActiveCall(models.Model):
    """Track currently active calls"""
    call_record = models.OneToOneField(CallRecord, on_delete=models.CASCADE)
    caller_channel = models.CharField(max_length=255)
    callee_channel = models.CharField(max_length=255, null=True, blank=True)
    room_name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"Active call: {self.room_name}"