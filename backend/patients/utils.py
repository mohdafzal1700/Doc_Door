# Simplified utils.py for debugging email issues
import random
import string
from django.core.mail import send_mail
from django.utils import timezone
from django.conf import settings
from doctor.models import EmailOTP, User,PatientTransaction,PatientWallet
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


from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import logging
from doctor.models import DoctorEarning,DoctorWallet

logger = logging.getLogger(__name__)


class DoctorEarningsManager:
    """Utility class to manage doctor earnings (credits/debits) and wallet balance"""
    
    @staticmethod
    @transaction.atomic
    def add_credit(doctor, appointment, amount, remarks=None):
        """
        Add credit to doctor's earnings and update wallet balance
        
        Args:
            doctor: Doctor instance
            appointment: Appointment instance
            amount: Decimal amount to credit
            remarks: Optional remarks for the transaction
            
        Returns:
            DoctorEarning instance or None if failed
        """
        try:
            # Check if credit already exists for this appointment
            existing_credit = DoctorEarning.objects.filter(
                doctor=doctor,
                appointment=appointment,
                type='credit'
            ).first()
            
            if existing_credit:
                logger.warning(f"Credit already exists for appointment {appointment.id}")
                return existing_credit
            
            # Get or create wallet
            wallet, created = DoctorWallet.objects.get_or_create(
                doctor=doctor,
                defaults={'balance': Decimal('0.00')}
            )
            
            # Create credit entry
            earning = DoctorEarning.objects.create(
                doctor=doctor,
                appointment=appointment,
                amount=Decimal(str(amount)),
                type='credit',
                remarks=remarks or f"Payment received for appointment on {appointment.appointment_date}"
            )
            
            # Update wallet balance
            wallet.balance += Decimal(str(amount))
            wallet.save()
            
            logger.info(f"Credit added: ₹{amount} to doctor {doctor.id} for appointment {appointment.id}. New balance: ₹{wallet.balance}")
            return earning
            
        except Exception as e:
            logger.error(f"Error adding credit to doctor {doctor.id}: {str(e)}")
            return None
    
    @staticmethod
    @transaction.atomic
    def add_debit(doctor, appointment, amount, remarks=None):
        """
        Add debit to doctor's earnings and update wallet balance
        Used for refunds when appointments are cancelled
        
        Args:
            doctor: Doctor instance
            appointment: Appointment instance
            amount: Decimal amount to debit
            remarks: Optional remarks for the transaction
            
        Returns:
            DoctorEarning instance or None if failed
        """
        try:
            # Get or create wallet
            wallet, created = DoctorWallet.objects.get_or_create(
                doctor=doctor,
                defaults={'balance': Decimal('0.00')}
            )
            
            # Check if wallet has sufficient balance
            if wallet.balance < Decimal(str(amount)):
                logger.error(f"Insufficient balance in doctor {doctor.id} wallet. Required: ₹{amount}, Available: ₹{wallet.balance}")
                return None
            
            # Create debit entry
            earning = DoctorEarning.objects.create(
                doctor=doctor,
                appointment=appointment,
                amount=Decimal(str(amount)),
                type='debit',
                remarks=remarks or f"Refund for cancelled appointment on {appointment.appointment_date}"
            )
            
            # Update wallet balance
            wallet.balance -= Decimal(str(amount))
            wallet.save()
            
            logger.info(f"Debit added: ₹{amount} from doctor {doctor.id} for appointment {appointment.id}. New balance: ₹{wallet.balance}")
            return earning
            
        except Exception as e:
            logger.error(f"Error adding debit to doctor {doctor.id}: {str(e)}")
            return None
    
    
    
class PatientWalletManager:
    """Utility class to manage patient wallet balance and transactions"""
    
    @staticmethod
    @transaction.atomic
    def add_credit(patient, appointment, amount, remarks=None):
        """
        Add credit to patient's wallet balance
        Used for refunds when appointments are cancelled
        
        Args:
            patient: Patient instance
            appointment: Appointment instance
            amount: Decimal amount to credit
            remarks: Optional remarks for the transaction
            
        Returns:
            PatientTransaction instance or None if failed
        """
        try:
            # Check if credit already exists for this appointment
            existing_credit = PatientTransaction.objects.filter(
                patient=patient,
                appointment=appointment,
                type='credit'
            ).first()
            
            if existing_credit:
                logger.warning(f"Credit already exists for patient {patient.id} appointment {appointment.id}")
                return existing_credit

            # Get or create wallet
            wallet, created = PatientWallet.objects.get_or_create(
                patient=patient,
                defaults={'balance': Decimal('0.00')}
            )

            # Create credit transaction
            transaction_obj = PatientTransaction.objects.create(
                patient=patient,
                appointment=appointment,
                amount=Decimal(str(amount)),
                type='credit',
                remarks=remarks or f"Refund for cancelled appointment on {appointment.appointment_date}"
            )

            # Update wallet balance
            wallet.balance += Decimal(str(amount))
            wallet.save()

            logger.info(f"Credit added: ₹{amount} to patient {patient.id} for appointment {appointment.id}. New balance: ₹{wallet.balance}")
            return transaction_obj

        except Exception as e:
            logger.error(f"Error adding credit to patient {patient.id}: {str(e)}")
            return None

    @staticmethod
    @transaction.atomic
    def add_debit(patient, appointment, amount, remarks=None):
        """
        Add debit to patient's wallet balance
        Used when patient pays for appointments using wallet balance
        
        Args:
            patient: Patient instance
            appointment: Appointment instance
            amount: Decimal amount to debit
            remarks: Optional remarks for the transaction
            
        Returns:
            PatientTransaction instance or None if failed
        """
        try:
            # Get or create wallet
            wallet, created = PatientWallet.objects.get_or_create(
                patient=patient,
                defaults={'balance': Decimal('0.00')}
            )

            # Check if wallet has sufficient balance
            if wallet.balance < Decimal(str(amount)):
                logger.error(f"Insufficient balance in patient {patient.id} wallet. Required: ₹{amount}, Available: ₹{wallet.balance}")
                return None

            # Create debit transaction
            transaction_obj = PatientTransaction.objects.create(
                patient=patient,
                appointment=appointment,
                amount=Decimal(str(amount)),
                type='debit',
                remarks=remarks or f"Payment for appointment on {appointment.appointment_date}"
            )

            # Update wallet balance
            wallet.balance -= Decimal(str(amount))
            wallet.save()

            logger.info(f"Debit added: ₹{amount} from patient {patient.id} for appointment {appointment.id}. New balance: ₹{wallet.balance}")
            return transaction_obj

        except Exception as e:
            logger.error(f"Error adding debit to patient {patient.id}: {str(e)}")
            return None

    

@transaction.atomic
def handle_appointment_cancellation(appointment, refund_amount):
    """
    Handle appointment cancellation by transferring money from doctor to patient wallet
    
    Args:
        appointment: Appointment instance
        refund_amount: Decimal amount to refund
        
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        doctor = appointment.doctor
        patient = appointment.patient
        
        # Add debit to doctor's wallet
        doctor_debit = DoctorEarningsManager.add_debit(
            doctor=doctor,
            appointment=appointment,
            amount=refund_amount,
            remarks=f"Refund for cancelled appointment - Patient: {patient.id}"
        )
        
        if not doctor_debit:
            return False, "Failed to debit from doctor's wallet. Insufficient balance."
        
        # Add credit to patient's wallet
        patient_credit = PatientWalletManager.add_credit(
            patient=patient,
            appointment=appointment,
            amount=refund_amount,
            remarks=f"Refund for cancelled appointment - Doctor: {doctor.id}"
        )
        
        if not patient_credit:
            return False, "Failed to credit to patient's wallet."
        
        logger.info(f"Successfully transferred ₹{refund_amount} from doctor {doctor.id} to patient {patient.id} for cancelled appointment {appointment.id}")
        return True, f"Successfully refunded ₹{refund_amount} to patient wallet."
        
    except Exception as e:
        logger.error(f"Error handling appointment cancellation: {str(e)}")
        return False, f"Error processing refund: {str(e)}"