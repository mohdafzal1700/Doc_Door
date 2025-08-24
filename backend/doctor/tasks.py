# doctor/tasks.py
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_otp_email_task(self, user_id, otp):
    """
    Celery task to send OTP email asynchronously
    """
    try:
        # Import User model inside the task to avoid AppRegistryNotReady error
        User = get_user_model()
        
        # Get user from database
        user = User.objects.get(id=user_id)
                
        # Prepare email message
        message = f""" Hello {user.first_name or user.username},

*Your Doc_door Verification Code*

Your One-Time Password (OTP) is: {otp}

Please note: This OTP will expire in **1 minute** for security reasons.

If you didn't request this, please ignore this email or contact support immediately.

—

Thanks & Regards,
Doc_door Team
Your Trusted Healthcare Partner
"""
                
        # Remove markdown formatting for plain text email
        message = message.replace("**", "").replace("*", "")
                
        # Send email
        result = send_mail(
            subject='🔐 Your Verification Code',
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False
        )
                
        logger.info(f"OTP email sent successfully to {user.email}")
        return f"Email sent to {user.email}"
            
    except Exception as e:
        # Import User here as well for the DoesNotExist exception
        User = get_user_model()
        
        if isinstance(e, User.DoesNotExist):
            logger.error(f"User with ID {user_id} not found")
            raise
            
        logger.error(f"Failed to send OTP email to user {user_id}: {str(e)}")
                
        # Retry the task
        try:
            raise self.retry(countdown=60, exc=e)
        except self.MaxRetriesExceededError:
            logger.error(f"Max retries exceeded for sending email to user {user_id}")
            raise

@shared_task
def send_general_email_task(subject, message, recipient_list, from_email=None):
    """
    General purpose email sending task
    """
    try:
        if from_email is None:
            from_email = settings.DEFAULT_FROM_EMAIL
                    
        result = send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False
        )
                
        logger.info(f"Email sent successfully to {recipient_list}")
        return f"Email sent to {recipient_list}"
            
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise