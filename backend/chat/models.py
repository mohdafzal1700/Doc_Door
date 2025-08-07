from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()

class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participants = models.ManyToManyField(User, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Conversation {self.id}"

    @property
    def last_message(self):
        return self.messages.filter(is_deleted=False).order_by('-created_at').first()

from  cloudinary.models  import CloudinaryField


class Message(models.Model):
    STATUS_CHOICES = (
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('seen', 'Seen'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    content = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='sent')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    
    file =CloudinaryField('file',blank=True,null=True)
    file_name=models.CharField(max_length=255,blank=True,null=True)
    file_size=models.BigIntegerField(blank=255,null=True)
    file_type=models.CharField(max_length=50,choices=[('image', 'Image'), ('video', 'Video'), 
    ('document', 'Document'), ('audio', 'Audio')
], blank=True, null=True)
    mime_type=models.CharField(max_length=230,blank=True,null=True)
    
    
    @property
    def is_file_message(self):
        return bool(self.file)
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Message from {self.sender} to {self.receiver}"

    def save(self, *args, **kwargs):
        # Auto-update status based on is_read
        if self.is_read and self.status != 'seen':
            self.status = 'seen'
            if not self.read_at:
                self.read_at = timezone.now()
        super().save(*args, **kwargs)



class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('message', 'Message'),
        ('appointment', 'Appointment'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES,default='message')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    related_object_id = models.CharField(max_length=255, null=True, blank=True)  # For linking to messages, appointments, etc.
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_notifications', null=True, blank=True)
    
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Notification for {self.user}: {self.message[:50]}..."