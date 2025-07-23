from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from doctor.models import SubscriptionPlan
from decimal import Decimal


class AdminLoginSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'] = serializers.EmailField(required=True)
        self.fields['password'] = serializers.CharField(required=True, write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['user_id'] = str(user.id)
        token['email'] = user.email
        token['is_admin'] = user.is_superuser or getattr(user, 'role', '') == 'admin'
        return token

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(request=self.context.get('request'), username=email, password=password)

            if not user:
                raise AuthenticationFailed('Invalid email or password')

            if not user.is_active:
                raise AuthenticationFailed('Your account is deactivated.')

            is_admin = user.is_superuser or getattr(user, 'role', '') == 'admin'
            if not is_admin:
                raise AuthenticationFailed('Admin access required.')

            attrs['username'] = email  # Important for token generation
            self.user = user
        else:
            raise AuthenticationFailed('Email and password are required')

        return super().validate(attrs)
    
    
import logging
from decimal import Decimal
from rest_framework import serializers


logger = logging.getLogger(__name__)  # Get logger for this module

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Serializer for SubscriptionPlan model with comprehensive validation and logging"""

    display_name = serializers.CharField(source='get_name_display', read_only=True)
    
    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'display_name', 'price', 'duration_days',
            'max_services', 'max_schedules_per_day', 'max_schedules_per_month',
            'can_create_online_service', 'can_create_offline_service',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'display_name']

    def validate_price(self, value):
        if value <= 0:
            logger.warning("Validation failed: Price is zero or negative.")
            raise serializers.ValidationError("Price must be greater than 0")
        if value > Decimal('99999.99'):
            logger.warning(f"Validation failed: Price too high - ₹{value}")
            raise serializers.ValidationError("Price cannot exceed ₹99,999.99")
        return value

    def validate_duration_days(self, value):
        if value <= 0:
            logger.warning("Validation failed: Duration is zero or negative.")
            raise serializers.ValidationError("Duration must be greater than 0 days")
        if value > 365:
            logger.warning(f"Validation failed: Duration too long - {value} days")
            raise serializers.ValidationError("Duration cannot exceed 365 days")
        return value

    def validate_max_services(self, value):
        if value < 1:
            logger.warning("Validation failed: max_services less than 1")
            raise serializers.ValidationError("Maximum services must be at least 1")
        if value > 100:
            logger.warning("Validation failed: max_services greater than 100")
            raise serializers.ValidationError("Maximum services cannot exceed 100")
        return value

    def validate_max_schedules_per_day(self, value):
        if value < 1:
            logger.warning("Validation failed: max_schedules_per_day less than 1")
            raise serializers.ValidationError("Maximum schedules per day must be at least 1")
        if value > 50:
            logger.warning("Validation failed: max_schedules_per_day greater than 50")
            raise serializers.ValidationError("Maximum schedules per day cannot exceed 50")
        return value

    def validate_max_schedules_per_month(self, value):
        if value < 1:
            logger.warning("Validation failed: max_schedules_per_month less than 1")
            raise serializers.ValidationError("Maximum schedules per month must be at least 1")
        if value > 1000:
            logger.warning("Validation failed: max_schedules_per_month greater than 1000")
            raise serializers.ValidationError("Maximum schedules per month cannot exceed 1000")
        return value

    def validate(self, data):
        logger.debug(f"Cross-field validation started with data: {data}")

        max_schedules_per_day = data.get('max_schedules_per_day')
        max_schedules_per_month = data.get('max_schedules_per_month')
        duration_days = data.get('duration_days', 30)

        if max_schedules_per_day and max_schedules_per_month:
            theoretical_monthly_max = max_schedules_per_day * min(duration_days, 31)
            if max_schedules_per_month > theoretical_monthly_max:
                logger.warning(
                    f"Validation failed: max_schedules_per_month ({max_schedules_per_month}) "
                    f"exceeds theoretical limit ({theoretical_monthly_max})"
                )
                raise serializers.ValidationError({
                    'max_schedules_per_month': f'Monthly limit cannot exceed daily limit × days in month ({theoretical_monthly_max})'
                })

        name = data.get('name')
        if name == 'basic':
            logger.debug("Applying Basic plan-specific validations")
            if data.get('can_create_offline_service', False):
                logger.warning("Validation failed: Basic plan cannot have offline service enabled")
                raise serializers.ValidationError({
                    'can_create_offline_service': 'Basic plan cannot have offline service creation'
                })

            if data.get('max_services', 0) > 5:
                logger.warning("Validation failed: Basic plan max_services > 5")
                raise serializers.ValidationError({
                    'max_services': 'Basic plan cannot have more than 5 services'
                })

        logger.debug("Validation passed")
        return data
