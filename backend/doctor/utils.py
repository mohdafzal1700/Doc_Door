
import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from datetime import datetime

logger = logging.getLogger('subscription_debug')


def debug_subscription_state(doctor_profile):
    """Utility function to debug subscription state"""
    debug_info = {
        'doctor_id': doctor_profile.id,
        'has_subscription_attr': hasattr(doctor_profile, 'subscription'),
        'subscription_exists': False,
        'subscription_details': {},
        'has_subscription_method_result': None,
        'errors': []
    }
    
    try:
        # Check if subscription exists
        if hasattr(doctor_profile, 'subscription') and doctor_profile.subscription:
            subscription = doctor_profile.subscription
            debug_info['subscription_exists'] = True
            debug_info['subscription_details'] = {
                'id': subscription.id,
                'status': getattr(subscription, 'status', 'No status'),
                'plan': getattr(subscription, 'plan', 'No plan'),
                'start_date': getattr(subscription, 'start_date', 'No start date'),
                'end_date': getattr(subscription, 'end_date', 'No end date'),
            }
            
            # Test is_active method if it exists
            if hasattr(subscription, 'is_active'):
                debug_info['subscription_details']['is_active_method'] = subscription.is_active()
        
        # Test has_subscription method
        if hasattr(doctor_profile, 'has_subscription'):
            debug_info['has_subscription_method_result'] = doctor_profile.has_subscription()
            
    except Exception as e:
        debug_info['errors'].append(str(e))
    
    logger.debug(f"🔍 Subscription Debug Info: {debug_info}")
    return debug_info