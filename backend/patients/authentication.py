from doctor.models import User
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
    
        
        # First try header authentication (fallback)
        header_auth = super().authenticate(request)
        if header_auth:
            
            return header_auth
        
        # Try cookie authentication
        access_token = request.COOKIES.get('access_token')
        if not access_token:
        
            return None
            
    
        
        try:
            # Validate token
            validated_token = self.get_validated_token(access_token)
            user = self.get_user(validated_token)
            
            return (user, validated_token)
        except TokenError as e:
            
            return None