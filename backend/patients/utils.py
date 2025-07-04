# Simplified utils.py for debugging email issues
import random
import string
from django.core.mail import send_mail
from django.utils import timezone
from django.conf import settings
from doctor.models import EmailOTP, User
import logging

logger = logging.getLogger(__name__)

def send_otp_email(user):
    try:
        # Generate OTP
        otp = ''.join(random.choices(string.digits, k=4))
        
        # Save OTP to database
        EmailOTP.objects.update_or_create(
            user=user,
            defaults={'otp': otp, 'created_at': timezone.now()}
        )
        
        # Debug: Print OTP (remove in production)
        logger.info(f"OTP for {user.email}: {otp}")
        message = f"""
            Hello {user.first_name or user.username},

            🔐 *Your Doc_door Verification Code*

            Your One-Time Password (OTP) is: **{otp}**

            🕒 Please note:
            This OTP will expire in **1 minute** for security reasons.

            If you didn’t request this, please ignore this email or contact support immediately.

            —
            Thanks & Regards,  
            🩺 Doc_door Team  
            Your Trusted Healthcare Partner
            """
        message = message.replace("**", "")
        
        # Try sending email
        result = send_mail(
            subject='🔐 Your Verification Code',
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False
        )
        
        logger.info(f"Email sent successfully!")
        return True, otp
        
    except Exception as e:
        logger.error(f"Email failed: {e}")
        return False, str(e)

# Quick email test function
def test_email_connection():
    """Test if email configuration works"""
    try:
        from django.core.mail import get_connection
        connection = get_connection()
        connection.open()
        connection.close()
        logger.info("Email connection successful!")
        return True
    except Exception as e:
        logger.error(f"Email connection failed: {e}")
        return False

# Test with a simple email
def send_test_email():
    """Send a simple test email"""
    try:
        send_mail(
            'Test Email',
            'This is a test email.',
            settings.DEFAULT_FROM_EMAIL,
            ['your-test-email@gmail.com'],  # Replace with your email
            fail_silently=False,
        )
        logger.info("Test email sent!")
        return True
    except Exception as e:
        logger.error(f"Test email failed: {e}")
        return False

# Network connectivity test
def test_smtp_connectivity():
    """Test SMTP server connectivity"""
    import socket
    
    smtp_servers = [
        ('smtp.gmail.com', 587),
        ('smtp.gmail.com', 465),
        ('smtp.gmail.com', 25),
    ]
    
    for host, port in smtp_servers:
        try:
            print(f"Testing {host}:{port}...")
            sock = socket.create_connection((host, port), timeout=10)
            sock.close()
            print(f"{host}:{port} - Connection successful!")
            return True, host, port
        except Exception as e:
            print(f"{host}:{port} - {e}")
    
    return False, None, None

# Test different email configurations
def test_email_configs():
    """Test different email backend configurations"""
    from django.core.mail import get_connection
    
    configs = [
        {
            'EMAIL_HOST': 'smtp.gmail.com',
            'EMAIL_PORT': 587,
            'EMAIL_USE_TLS': True,
            'EMAIL_USE_SSL': False,
        },
        {
            'EMAIL_HOST': 'smtp.gmail.com', 
            'EMAIL_PORT': 465,
            'EMAIL_USE_TLS': False,
            'EMAIL_USE_SSL': True,
        }
    ]
    
    for i, config in enumerate(configs, 1):
        print(f"\n🔧 Testing Configuration {i}:")
        for key, value in config.items():
            print(f"   {key}: {value}")
        
        try:
            connection = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=config['EMAIL_HOST'],
                port=config['EMAIL_PORT'],
                username=settings.EMAIL_HOST_USER,
                password=settings.EMAIL_HOST_PASSWORD,
                use_tls=config['EMAIL_USE_TLS'],
                use_ssl=config['EMAIL_USE_SSL'],
            )
            connection.open()
            connection.close()
            print(f"Configuration {i} works!")
            return config
        except Exception as e:
            print(f"Configuration {i} failed: {e}")
    
    return None