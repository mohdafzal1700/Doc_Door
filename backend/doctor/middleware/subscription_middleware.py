# import logging
# from django.http import JsonResponse
# from django.utils.deprecation import MiddlewareMixin
# from django.conf import settings
# from datetime import datetime
# from asgiref.sync import iscoroutinefunction, markcoroutinefunction, sync_to_async
# import asyncio

# logger = logging.getLogger('subscription_debug')

# class SubscriptionMiddleware(MiddlewareMixin):
#     """Middleware to check subscription status for restricted actions with ASGI/WSGI compatibility"""
    
#     def __init__(self, get_response):
#         self.get_response = get_response
#         if iscoroutinefunction(self.get_response):
#             markcoroutinefunction(self)

#     def __call__(self, request):
#         if iscoroutinefunction(self.get_response):
#             return self.__acall__(request)
#         else:
#             return self._sync_call(request)

#     async def __acall__(self, request):
#         await self._add_subscription_context_async(request)
#         response = await self.get_response(request)
#         return response

#     def _sync_call(self, request):
#         self._add_subscription_context_sync(request)
#         response = self.get_response(request)
#         return response

#     def _add_subscription_context_sync(self, request):
#         try:
#             if hasattr(request, 'user') and request.user.is_authenticated:
#                 logger.debug(f"User authenticated: {request.user.username} (ID: {request.user.id})")
                
#                 if hasattr(request.user, 'doctor_profile'):
#                     doctor_profile = request.user.doctor_profile
#                     logger.debug(f"Doctor profile found - ID: {doctor_profile.id}")
                    
#                     try:
#                         subscription_active = doctor_profile.has_subscription()
#                         request.subscription_active = subscription_active
#                         logger.debug(f"Subscription active: {subscription_active}")
                        
#                         self._log_subscription_details(doctor_profile)
#                         self._log_service_count(doctor_profile)
                            
#                     except Exception as e:
#                         logger.error(f"Error checking subscription status: {str(e)}")
#                         request.subscription_active = False
                        
#                 else:
#                     logger.debug(f"No doctor profile found for user: {request.user.username}")
#                     request.subscription_active = False
#             else:
#                 logger.debug("User not authenticated or no user object")
#                 request.subscription_active = False
                
#         except Exception as e:
#             logger.error(f"Error in subscription middleware: {str(e)}")
#             request.subscription_active = False

#     async def _add_subscription_context_async(self, request):
#         try:
#             if hasattr(request, 'user') and request.user.is_authenticated:
#                 logger.debug(f"User authenticated: {request.user.username} (ID: {request.user.id})")
                
#                 if hasattr(request.user, 'doctor_profile'):
#                     doctor_profile = request.user.doctor_profile
#                     logger.debug(f"Doctor profile found - ID: {doctor_profile.id}")
                    
#                     try:
#                         subscription_active = await sync_to_async(doctor_profile.has_subscription)()
#                         request.subscription_active = subscription_active
#                         logger.debug(f"Subscription active: {subscription_active}")
                        
#                         await self._log_subscription_details_async(doctor_profile)
#                         await self._log_service_count_async(doctor_profile)
                            
#                     except Exception as e:
#                         logger.error(f"Error checking subscription status: {str(e)}")
#                         request.subscription_active = False
                        
#                 else:
#                     logger.debug(f"No doctor profile found for user: {request.user.username}")
#                     request.subscription_active = False
#             else:
#                 logger.debug("User not authenticated or no user object")
#                 request.subscription_active = False
                
#         except Exception as e:
#             logger.error(f"Error in subscription middleware: {str(e)}")
#             request.subscription_active = False

#     def _log_subscription_details(self, doctor_profile):
#         try:
#             if hasattr(doctor_profile, 'subscription'):
#                 subscription = doctor_profile.subscription
#                 if subscription:
#                     logger.debug("Subscription Details:")
#                     logger.debug(f"  - ID: {subscription.id}")
#                     logger.debug(f"  - Plan: {getattr(subscription, 'plan', 'No plan')}")
#                     logger.debug(f"  - Status: {getattr(subscription, 'status', 'No status')}")
#                     logger.debug(f"  - Start Date: {getattr(subscription, 'start_date', 'No start date')}")
#                     logger.debug(f"  - End Date: {getattr(subscription, 'end_date', 'No end date')}")
                    
#                     if hasattr(subscription, 'is_active'):
#                         is_active_method = subscription.is_active()
#                         logger.debug(f"  - is_active() method: {is_active_method}")
                    
#                     if hasattr(subscription, 'end_date') and subscription.end_date:
#                         from django.utils import timezone
#                         now = timezone.now()
#                         expired = subscription.end_date < now
#                         logger.debug(f"  - Current time: {now}")
#                         logger.debug(f"  - Expired: {expired}")
#                 else:
#                     logger.debug("Subscription object is None")
#             else:
#                 logger.debug("No subscription attribute found in doctor profile")
#         except Exception as e:
#             logger.error(f"Error logging subscription details: {str(e)}")

#     async def _log_subscription_details_async(self, doctor_profile):
#         try:
#             if hasattr(doctor_profile, 'subscription'):
#                 subscription = await sync_to_async(lambda: doctor_profile.subscription)()
#                 if subscription:
#                     logger.debug("Subscription Details:")
#                     logger.debug(f"  - ID: {subscription.id}")
#                     plan = await sync_to_async(lambda: getattr(subscription, 'plan', 'No plan'))()
#                     status = await sync_to_async(lambda: getattr(subscription, 'status', 'No status'))()
#                     start_date = await sync_to_async(lambda: getattr(subscription, 'start_date', 'No start date'))()
#                     end_date = await sync_to_async(lambda: getattr(subscription, 'end_date', 'No end date'))()
                    
#                     logger.debug(f"  - Plan: {plan}")
#                     logger.debug(f"  - Status: {status}")
#                     logger.debug(f"  - Start Date: {start_date}")
#                     logger.debug(f"  - End Date: {end_date}")
                    
#                     if hasattr(subscription, 'is_active'):
#                         is_active_method = await sync_to_async(subscription.is_active)()
#                         logger.debug(f"  - is_active() method: {is_active_method}")
                    
#                     if hasattr(subscription, 'end_date') and subscription.end_date:
#                         from django.utils import timezone
#                         now = timezone.now()
#                         expired = subscription.end_date < now
#                         logger.debug(f"  - Current time: {now}")
#                         logger.debug(f"  - Expired: {expired}")
#                 else:
#                     logger.debug("Subscription object is None")
#             else:
#                 logger.debug("No subscription attribute found in doctor profile")
#         except Exception as e:
#             logger.error(f"Error logging subscription details: {str(e)}")

#     def _log_service_count(self, doctor_profile):
#         try:
#             service_count = 0
#             try:
#                 from doctor.models import Service
#                 service_count = Service.objects.filter(doctor=doctor_profile).count()
#             except ImportError:
#                 try:
                    
#                     service_count = Service.objects.filter(doctor=doctor_profile).count()
#                 except ImportError:
#                     logger.debug("Could not import Service model")
                    
#             logger.debug(f"Current service count: {service_count}")
            
#         except Exception as e:
#             logger.debug(f"Error getting service count: {str(e)}")

#     async def _log_service_count_async(self, doctor_profile):
#         try:
#             service_count = 0
#             try:
#                 from doctor.models import Service
#                 service_count = await sync_to_async(Service.objects.filter(doctor=doctor_profile).count)()
#             except ImportError:
#                 try:
                    
#                     service_count = await sync_to_async(Service.objects.filter(doctor=doctor_profile).count)()
#                 except ImportError:
#                     logger.debug("Could not import Service model")
                    
#             logger.debug(f"Current service count: {service_count}")
            
#         except Exception as e:
#             logger.debug(f"Error getting service count: {str(e)}")
    
#     def process_view(self, request, view_func, view_args, view_kwargs):
#         try:
#             if not iscoroutinefunction(self.get_response):
#                 if request.path.startswith('/api/'):
#                     logger.debug(f"API Call: {request.method} {request.path}")
#                     logger.debug(f"Subscription active in view: {getattr(request, 'subscription_active', 'Not set')}")
                    
#                     if settings.DEBUG:
#                         auth_header = request.META.get('HTTP_AUTHORIZATION', 'No auth header')
#                         logger.debug(f"Auth header present: {'Yes' if auth_header != 'No auth header' else 'No'}")
                    
#                 if 'subscription' in request.path.lower():
#                     logger.debug(f"Subscription endpoint hit: {request.path}")
#                     logger.debug(f"Request data: {getattr(request, 'POST', {})} {getattr(request, 'GET', {})}")
                
#         except Exception as e:
#             logger.error(f"Error in process_view: {str(e)}")
        
#         return None
