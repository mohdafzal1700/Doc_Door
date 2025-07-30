# video_call/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import CallRecord, ActiveCall

class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'name']
        read_only_fields = ['id']
    
    def get_name(self, obj):
        return obj.get_full_name() or obj.username

class CallRecordSerializer(serializers.ModelSerializer):
    caller = UserSerializer(read_only=True)
    callee = UserSerializer(read_only=True)
    duration_seconds = serializers.SerializerMethodField()
    
    class Meta:
        model = CallRecord
        fields = [
            'id', 'caller', 'callee', 'status', 
            'started_at', 'ended_at', 'duration', 'duration_seconds'
        ]
        read_only_fields = ['id', 'started_at', 'ended_at', 'duration']
    
    def get_duration_seconds(self, obj):
        return obj.duration.total_seconds() if obj.duration else 0

class ActiveCallSerializer(serializers.ModelSerializer):
    call_record = CallRecordSerializer(read_only=True)
    other_user = serializers.SerializerMethodField()
    call_type = serializers.SerializerMethodField()
    
    class Meta:
        model = ActiveCall
        fields = ['id', 'room_name', 'call_record', 'other_user', 'call_type', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_other_user(self, obj):
        request = self.context.get('request')
        if request and request.user:
            other_user = (obj.call_record.callee 
                         if obj.call_record.caller == request.user 
                         else obj.call_record.caller)
            return UserSerializer(other_user).data
        return None
    
    def get_call_type(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return 'outgoing' if obj.call_record.caller == request.user else 'incoming'
        return None