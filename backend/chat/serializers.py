from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Conversation, Message, Notification

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'full_name', 'is_online']
        read_only_fields = ['id', 'is_online']
    
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model"""
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    receiver_id = serializers.UUIDField(write_only=True, required=False)
    
    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'receiver', 'receiver_id',
            'content', 'status', 'is_edited', 'is_deleted',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'updated_at', 'is_edited']
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['sender'] = request.user
        
        # Handle receiver_id if provided
        receiver_id = validated_data.pop('receiver_id', None)
        if receiver_id:
            try:
                receiver = User.objects.get(id=receiver_id)
                validated_data['receiver'] = receiver
            except User.DoesNotExist:
                raise serializers.ValidationError({'receiver_id': 'Invalid receiver ID'})
        
        return super().create(validated_data)


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for Conversation model"""
    participants = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'participants', 'created_at', 'updated_at',
            'last_message', 'unread_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_last_message(self, obj):
        last_message = obj.messages.filter(is_deleted=False).order_by('-created_at').first()
        if last_message:
            return {
                'id': str(last_message.id),
                'content': last_message.content,
                'sender': last_message.sender.username,
                'created_at': last_message.created_at,
                'status': last_message.status
            }
        return None
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.messages.filter(
                receiver=request.user,
                status__in=['sent', 'delivered']
            ).count()
        return 0


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model"""
    
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'notification_type', 'title', 'message',
            'data', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']


class ConversationCreateSerializer(serializers.Serializer):
    """Serializer for creating conversations"""
    participants = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    participant_id = serializers.UUIDField(write_only=True, required=False)
    
    def validate(self, data):
        participants = data.get('participants', [])
        participant_id = data.get('participant_id')
        
        if not participants and not participant_id:
            raise serializers.ValidationError(
                "Either 'participants' list or 'participant_id' is required"
            )
        
        if participant_id and not participants:
            data['participants'] = [participant_id]
        
        return data