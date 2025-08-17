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
            'allowed_service_types', 'can_create_online_service', 
            'can_create_offline_service', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'display_name']

    def validate_price(self, value):
        """Validate price with general constraints"""
        if value <= 0:
            logger.warning("Validation failed: Price is zero or negative.")
            raise serializers.ValidationError("Price must be greater than 0")
        if value > Decimal('500.00'):
            logger.warning(f"Validation failed: Price too high - ₹{value}")
            raise serializers.ValidationError("Price cannot exceed ₹500.00")
        return value

    def validate_duration_days(self, value):
        """Validate duration with general constraints"""
        if value <= 0:
            logger.warning("Validation failed: Duration is zero or negative.")
            raise serializers.ValidationError("Duration must be greater than 0 days")
        if value > 90:
            logger.warning(f"Validation failed: Duration too long - {value} days")
            raise serializers.ValidationError("Duration cannot exceed 90 days")
        return value

    def validate_max_services(self, value):
        """Validate max_services with general constraints"""
        if value < 1:
            logger.warning("Validation failed: max_services less than 1")
            raise serializers.ValidationError("Maximum services must be at least 1")
        if value > 20:
            logger.warning("Validation failed: max_services greater than 20")
            raise serializers.ValidationError("Maximum services cannot exceed 20")
        return value

    def validate_max_schedules_per_day(self, value):
        """Validate max_schedules_per_day with general constraints"""
        if value < 1:
            logger.warning("Validation failed: max_schedules_per_day less than 1")
            raise serializers.ValidationError("Maximum schedules per day must be at least 1")
        if value > 10:
            logger.warning("Validation failed: max_schedules_per_day greater than 10")
            raise serializers.ValidationError("Maximum schedules per day cannot exceed 10")
        return value

    def validate_max_schedules_per_month(self, value):
        """Validate max_schedules_per_month with general constraints"""
        if value < 1:
            logger.warning("Validation failed: max_schedules_per_month less than 1")
            raise serializers.ValidationError("Maximum schedules per month must be at least 1")
        if value > 100:
            logger.warning("Validation failed: max_schedules_per_month greater than 100")
            raise serializers.ValidationError("Maximum schedules per month cannot exceed 100")
        return value

    def validate_allowed_service_types(self, value):
        """Validate allowed service types"""
        valid_choices = ['basic', 'standard', 'premium']
        for service_type in value:
            if service_type not in valid_choices:
                logger.warning(f"Invalid service type: {service_type}")
                raise serializers.ValidationError(f"Invalid service type: {service_type}")
        return value

    def _validate_basic_plan(self, data):
        """Validate Basic plan specific constraints"""
        logger.debug("Applying Basic plan-specific validations")
        errors = {}
        
        # Price validation: ₹50 to ₹100
        price = data.get('price')
        if price:
            if price < Decimal('50.00'):
                logger.warning(f"Basic plan price too low: ₹{price}")
                errors['price'] = 'Basic plan price must be at least ₹50.00'
            elif price > Decimal('100.00'):
                logger.warning(f"Basic plan price too high: ₹{price}")
                errors['price'] = 'Basic plan price cannot exceed ₹100.00'
        
        # Services limit: max 3
        max_services = data.get('max_services')
        if max_services and max_services > 3:
            logger.warning(f"Basic plan max_services too high: {max_services}")
            errors['max_services'] = 'Basic plan cannot have more than 3 services'
        
        # Schedules per day: max 2
        max_schedules_per_day = data.get('max_schedules_per_day')
        if max_schedules_per_day and max_schedules_per_day > 2:
            logger.warning(f"Basic plan max_schedules_per_day too high: {max_schedules_per_day}")
            errors['max_schedules_per_day'] = 'Basic plan cannot have more than 2 schedules per day'
        
        # Schedules per month: max 20
        max_schedules_per_month = data.get('max_schedules_per_month')
        if max_schedules_per_month and max_schedules_per_month > 20:
            logger.warning(f"Basic plan max_schedules_per_month too high: {max_schedules_per_month}")
            errors['max_schedules_per_month'] = 'Basic plan cannot have more than 20 schedules per month'
        
        # Duration: max 30 days
        duration_days = data.get('duration_days')
        if duration_days and duration_days > 30:
            logger.warning(f"Basic plan duration too long: {duration_days}")
            errors['duration_days'] = 'Basic plan duration cannot exceed 30 days'
        
        # Service types: only basic allowed
        allowed_service_types = data.get('allowed_service_types', [])
        invalid_types = [stype for stype in allowed_service_types if stype != 'basic']
        if invalid_types:
            logger.warning(f"Basic plan cannot access service types: {invalid_types}")
            errors['allowed_service_types'] = 'Basic plan can only access basic service type'
        
        return errors

    def _validate_standard_plan(self, data):
        """Validate Standard plan specific constraints"""
        logger.debug("Applying Standard plan-specific validations")
        errors = {}
        
        # Price validation: ₹150 to ₹250
        price = data.get('price')
        if price:
            if price < Decimal('150.00'):
                logger.warning(f"Standard plan price too low: ₹{price}")
                errors['price'] = 'Standard plan price must be at least ₹150.00'
            elif price > Decimal('250.00'):
                logger.warning(f"Standard plan price too high: ₹{price}")
                errors['price'] = 'Standard plan price cannot exceed ₹250.00'
        
        # Services limit: 2-8
        max_services = data.get('max_services')
        if max_services:
            if max_services < 2:
                logger.warning(f"Standard plan max_services too low: {max_services}")
                errors['max_services'] = 'Standard plan must have at least 2 services'
            elif max_services > 8:
                logger.warning(f"Standard plan max_services too high: {max_services}")
                errors['max_services'] = 'Standard plan cannot have more than 8 services'
        
        # Schedules per day: 2-5
        max_schedules_per_day = data.get('max_schedules_per_day')
        if max_schedules_per_day:
            if max_schedules_per_day < 2:
                logger.warning(f"Standard plan max_schedules_per_day too low: {max_schedules_per_day}")
                errors['max_schedules_per_day'] = 'Standard plan must have at least 2 schedules per day'
            elif max_schedules_per_day > 5:
                logger.warning(f"Standard plan max_schedules_per_day too high: {max_schedules_per_day}")
                errors['max_schedules_per_day'] = 'Standard plan cannot have more than 5 schedules per day'
        
        # Schedules per month: 20-50
        max_schedules_per_month = data.get('max_schedules_per_month')
        if max_schedules_per_month:
            if max_schedules_per_month < 20:
                logger.warning(f"Standard plan max_schedules_per_month too low: {max_schedules_per_month}")
                errors['max_schedules_per_month'] = 'Standard plan must have at least 20 schedules per month'
            elif max_schedules_per_month > 50:
                logger.warning(f"Standard plan max_schedules_per_month too high: {max_schedules_per_month}")
                errors['max_schedules_per_month'] = 'Standard plan cannot have more than 50 schedules per month'
        
        # Duration: 15-60 days
        duration_days = data.get('duration_days')
        if duration_days:
            if duration_days < 15:
                logger.warning(f"Standard plan duration too short: {duration_days}")
                errors['duration_days'] = 'Standard plan duration must be at least 15 days'
            elif duration_days > 60:
                logger.warning(f"Standard plan duration too long: {duration_days}")
                errors['duration_days'] = 'Standard plan duration cannot exceed 60 days'
        
        # Service types: basic and standard allowed
        allowed_service_types = data.get('allowed_service_types', [])
        invalid_types = [stype for stype in allowed_service_types if stype not in ['basic', 'standard']]
        if invalid_types:
            logger.warning(f"Standard plan cannot access service types: {invalid_types}")
            errors['allowed_service_types'] = 'Standard plan can only access basic and standard service types'
        
        return errors

    def _validate_premium_plan(self, data):
        """Validate Premium plan specific constraints"""
        logger.debug("Applying Premium plan-specific validations")
        errors = {}
        
        # Price validation: ₹300 to ₹500
        price = data.get('price')
        if price:
            if price < Decimal('300.00'):
                logger.warning(f"Premium plan price too low: ₹{price}")
                errors['price'] = 'Premium plan price must be at least ₹300.00'
            elif price > Decimal('500.00'):
                logger.warning(f"Premium plan price too high: ₹{price}")
                errors['price'] = 'Premium plan price cannot exceed ₹500.00'
        
        # Services limit: min 5, max 20
        max_services = data.get('max_services')
        if max_services:
            if max_services < 5:
                logger.warning(f"Premium plan max_services too low: {max_services}")
                errors['max_services'] = 'Premium plan must have at least 5 services'
            elif max_services > 20:
                logger.warning(f"Premium plan max_services too high: {max_services}")
                errors['max_services'] = 'Premium plan cannot have more than 20 services'
        
        # Schedules per day: min 5, max 10
        max_schedules_per_day = data.get('max_schedules_per_day')
        if max_schedules_per_day:
            if max_schedules_per_day < 5:
                logger.warning(f"Premium plan max_schedules_per_day too low: {max_schedules_per_day}")
                errors['max_schedules_per_day'] = 'Premium plan must have at least 5 schedules per day'
            elif max_schedules_per_day > 10:
                logger.warning(f"Premium plan max_schedules_per_day too high: {max_schedules_per_day}")
                errors['max_schedules_per_day'] = 'Premium plan cannot have more than 10 schedules per day'
        
        # Schedules per month: min 50, max 100
        max_schedules_per_month = data.get('max_schedules_per_month')
        if max_schedules_per_month:
            if max_schedules_per_month < 50:
                logger.warning(f"Premium plan max_schedules_per_month too low: {max_schedules_per_month}")
                errors['max_schedules_per_month'] = 'Premium plan must have at least 50 schedules per month'
            elif max_schedules_per_month > 100:
                logger.warning(f"Premium plan max_schedules_per_month too high: {max_schedules_per_month}")
                errors['max_schedules_per_month'] = 'Premium plan cannot have more than 100 schedules per month'
        
        # Duration: 30-90 days
        duration_days = data.get('duration_days')
        if duration_days:
            if duration_days < 30:
                logger.warning(f"Premium plan duration too short: {duration_days}")
                errors['duration_days'] = 'Premium plan duration must be at least 30 days'
            elif duration_days > 90:
                logger.warning(f"Premium plan duration too long: {duration_days}")
                errors['duration_days'] = 'Premium plan duration cannot exceed 90 days'
        
        # Service types: all service types allowed (basic, standard, premium)
        # Premium can access all service types, so no restriction needed
        
        # Premium plans should have both service creation enabled
        if not data.get('can_create_online_service', True):
            logger.warning("Premium plan should have online service enabled")
            errors['can_create_online_service'] = 'Premium plan should have online service creation enabled'
        
        if not data.get('can_create_offline_service', False):
            logger.warning("Premium plan should have offline service enabled")
            errors['can_create_offline_service'] = 'Premium plan should have offline service creation enabled'
        
        return errors

    def validate(self, data):
        """Cross-field validation with plan-specific business logic"""
        logger.debug(f"Cross-field validation started with data: {data}")
        
        # General cross-field validation
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

        # Plan-specific validation
        name = data.get('name')
        plan_errors = {}
        
        if name == 'basic':
            plan_errors = self._validate_basic_plan(data)
        elif name == 'standard':
            plan_errors = self._validate_standard_plan(data)
        elif name == 'premium':
            plan_errors = self._validate_premium_plan(data)
        
        if plan_errors:
            logger.warning(f"Plan-specific validation failed for {name} plan: {plan_errors}")
            raise serializers.ValidationError(plan_errors)

        logger.debug("All validations passed")
        return data
    
from rest_framework import serializers


class MonthlyTrendSerializer(serializers.Serializer):
    """Monthly revenue/growth trends"""
    month = serializers.CharField()
    revenue = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    subscriptions = serializers.IntegerField(required=False)
    count = serializers.IntegerField(required=False)


class PlanBreakdownSerializer(serializers.Serializer):
    """Subscription plan breakdown"""
    plan_name = serializers.CharField()
    price = serializers.DecimalField(max_digits=8, decimal_places=2)
    active_subscriptions = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)


class RevenueDataSerializer(serializers.Serializer):
    """Revenue metrics"""
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    period_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    active_subscriptions = serializers.IntegerField()
    monthly_trends = MonthlyTrendSerializer(many=True)
    plan_breakdown = PlanBreakdownSerializer(many=True)


class UsersDataSerializer(serializers.Serializer):
    """User statistics"""
    total_doctors = serializers.IntegerField()
    total_patients = serializers.IntegerField()
    period_doctors = serializers.IntegerField()
    period_patients = serializers.IntegerField()
    verified_doctors = serializers.IntegerField()
    pending_doctors = serializers.IntegerField()


class DateRangeSerializer(serializers.Serializer):
    """Date range for filtering"""
    start_date = serializers.CharField()
    end_date = serializers.CharField()


class AdminDashboardSerializer(serializers.Serializer):
    """Main admin dashboard serializer"""
    revenue = RevenueDataSerializer()
    users = UsersDataSerializer()
    date_range = DateRangeSerializer()


class DailyRevenueSerializer(serializers.Serializer):
    """Daily revenue data"""
    date = serializers.CharField()
    revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    subscriptions = serializers.IntegerField()


class PaymentBreakdownSerializer(serializers.Serializer):
    """Payment status breakdown"""
    status = serializers.CharField()
    count = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class SubscriptionBreakdownSerializer(serializers.Serializer):
    """Subscription status breakdown"""
    status = serializers.CharField()
    count = serializers.IntegerField()


class AdminRevenueSerializer(serializers.Serializer):
    """Detailed revenue analytics"""
    daily_revenue = DailyRevenueSerializer(many=True)
    payment_breakdown = PaymentBreakdownSerializer(many=True)
    subscription_breakdown = SubscriptionBreakdownSerializer(many=True)


class DoctorStatsSerializer(serializers.Serializer):
    """Doctor statistics"""
    total = serializers.IntegerField()
    verified = serializers.IntegerField()
    pending = serializers.IntegerField()
    rejected = serializers.IntegerField()
    with_subscription = serializers.IntegerField()


class PatientStatsSerializer(serializers.Serializer):
    """Patient statistics"""
    total = serializers.IntegerField()


class GrowthTrendsSerializer(serializers.Serializer):
    """Growth trends data"""
    doctors = MonthlyTrendSerializer(many=True)
    patients = MonthlyTrendSerializer(many=True)


class SpecializationSerializer(serializers.Serializer):
    """Doctor specializations"""
    specialization = serializers.CharField()
    count = serializers.IntegerField()


class AdminUsersSerializer(serializers.Serializer):
    """User analytics serializer"""
    doctor_stats = DoctorStatsSerializer()
    patient_stats = PatientStatsSerializer()
    growth_trends = GrowthTrendsSerializer()
    specializations = SpecializationSerializer(many=True)


class PendingDoctorSerializer(serializers.Serializer):
    """Pending doctor verification data"""
    id = serializers.CharField()
    name = serializers.CharField()
    email = serializers.EmailField()
    specialization = serializers.CharField()
    experience = serializers.IntegerField(allow_null=True)
    license_number = serializers.CharField(allow_null=True, allow_blank=True)
    clinic_name = serializers.CharField()
    location = serializers.CharField()
    submitted_date = serializers.DateField()
    profile_complete = serializers.BooleanField()
    education_complete = serializers.BooleanField()
    certification_complete = serializers.BooleanField()
    license_complete = serializers.BooleanField()


class PendingVerificationsSerializer(serializers.Serializer):
    """Pending verifications response"""
    pending_verifications = PendingDoctorSerializer(many=True)
    total_pending = serializers.IntegerField()


class AdminActionRequestSerializer(serializers.Serializer):
    """Admin action request (approve/reject)"""
    doctor_id = serializers.UUIDField()
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    comment = serializers.CharField(required=False, allow_blank=True)


class AdminActionResponseSerializer(serializers.Serializer):
    """Admin action response"""
    message = serializers.CharField()
    doctor_id = serializers.CharField()
    new_status = serializers.CharField()