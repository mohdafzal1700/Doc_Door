from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from django.contrib.auth.models import User


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