import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from datetime import datetime

logger = logging.getLogger('subscription_debug')

class SubscriptionMiddleware(MiddlewareMixin):
    """Middleware to check subscription status for restricted actions with debug info"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Add subscription context to request with detailed debugging
        try:
            if hasattr(request, 'user') and request.user.is_authenticated:
                logger.debug(f"🔍 User authenticated: {request.user.username} (ID: {request.user.id})")
                
                if hasattr(request.user, 'doctor_profile'):
                    doctor_profile = request.user.doctor_profile
                    logger.debug(f"👨‍⚕️ Doctor profile found - ID: {doctor_profile.id}")
                    
                    # Check subscription status with detailed logging
                    try:
                        subscription_active = doctor_profile.has_subscription()
                        request.subscription_active = subscription_active
                        logger.debug(f"💳 Subscription active: {subscription_active}")
                        
                        # Get subscription object details
                        if hasattr(doctor_profile, 'subscription'):
                            subscription = doctor_profile.subscription
                            if subscription:
                                logger.debug(f"📋 Subscription Details:")
                                logger.debug(f"  - ID: {subscription.id}")
                                logger.debug(f"  - Plan: {getattr(subscription, 'plan', 'No plan')}")
                                logger.debug(f"  - Status: {getattr(subscription, 'status', 'No status')}")
                                logger.debug(f"  - Start Date: {getattr(subscription, 'start_date', 'No start date')}")
                                logger.debug(f"  - End Date: {getattr(subscription, 'end_date', 'No end date')}")
                                
                                # Check if subscription is actually active
                                if hasattr(subscription, 'is_active'):
                                    is_active_method = subscription.is_active()
                                    logger.debug(f"  - is_active() method: {is_active_method}")
                                
                                # Check expiration
                                if hasattr(subscription, 'end_date') and subscription.end_date:
                                    from django.utils import timezone
                                    now = timezone.now()
                                    expired = subscription.end_date < now
                                    logger.debug(f"  - Current time: {now}")
                                    logger.debug(f"  - Expired: {expired}")
                            else:
                                logger.debug("❌ Subscription object is None")
                        else:
                            logger.debug("❌ No subscription attribute found in doctor profile")
                            
                        # Debug service count
                        try:
                            # Try different possible import paths
                            service_count = 0
                            try:
                                from .models import Service
                                service_count = Service.objects.filter(doctor=doctor_profile).count()
                            except ImportError:
                                try:
                                    from apps.services.models import Service
                                    service_count = Service.objects.filter(doctor=doctor_profile).count()
                                except ImportError:
                                    logger.debug("⚠️ Could not import Service model")
                                    
                            logger.debug(f"🛠️ Current service count: {service_count}")
                            
                        except Exception as e:
                            logger.debug(f"❌ Error getting service count: {str(e)}")
                            
                    except Exception as e:
                        logger.error(f"❌ Error checking subscription status: {str(e)}")
                        request.subscription_active = False
                        
                else:
                    logger.debug(f"❌ No doctor profile found for user: {request.user.username}")
                    request.subscription_active = False
            else:
                logger.debug("❌ User not authenticated or no user object")
                request.subscription_active = False
                
        except Exception as e:
            logger.error(f"❌ Error in subscription middleware: {str(e)}")
            request.subscription_active = False
        
        response = self.get_response(request)
        return response
    
    def process_view(self, request, view_func, view_args, view_kwargs):
        """Additional debugging for specific views"""
        try:
            # Log API calls
            if request.path.startswith('/api/'):
                logger.debug(f"🌐 API Call: {request.method} {request.path}")
                logger.debug(f"📊 Subscription active in view: {getattr(request, 'subscription_active', 'Not set')}")
                
                # Log request headers for debugging
                if settings.DEBUG:
                    auth_header = request.META.get('HTTP_AUTHORIZATION', 'No auth header')
                    logger.debug(f"🔑 Auth header present: {'Yes' if auth_header != 'No auth header' else 'No'}")
                
            # Specific logging for subscription-related endpoints
            if 'subscription' in request.path.lower():
                logger.debug(f"💳 Subscription endpoint hit: {request.path}")
                logger.debug(f"📝 Request data: {getattr(request, 'POST', {})} {getattr(request, 'GET', {})}")
                
        except Exception as e:
            logger.error(f"❌ Error in process_view: {str(e)}")
        
        return None