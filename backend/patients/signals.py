from django.db.models.signals import post_save
from django.dispatch import receiver

from doctor.models import User, Patient, PatientWallet

@receiver(post_save, sender=User)
def create_patient_profile_and_wallet(sender, instance, created, **kwargs):
    """Automatically create Patient profile & Wallet when a Patient user is created."""
    if created and instance.role == 'patient':
        # Create patient profile
        patient = Patient.objects.create(user=instance)

        # Create wallet linked to patient
        PatientWallet.objects.create(patient=patient)

        print(f"✅ Created Patient profile and wallet for {instance.email}")
