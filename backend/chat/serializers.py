
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Count
from .models import Conversation, Message, Notification

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'full_name', 'is_online', 'last_seen']
        read_only_fields = ['id', 'is_online', 'last_seen']
    
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

import json
import uuid


class ConversationCreateSerializer(serializers.Serializer):
    """Handles all conversation creation logic with proper UUID support"""
    participants = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    participant_id = serializers.UUIDField(write_only=True, required=False)

    def validate(self, data):
        # Handle both dictionary and other data types
        if isinstance(data, str):
            # If somehow the entire data is a string, try to parse it
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                raise serializers.ValidationError("Invalid data format")

        if not isinstance(data, dict):
            raise serializers.ValidationError("Data must be a dictionary")

        participants = data.get('participants', [])
        participant_id = data.get('participant_id')

        if not participants and not participant_id:
            raise serializers.ValidationError(
                "Either 'participants' list or 'participant_id' is required"
            )

        # Convert participant_id to UUID if it's a string
        if participant_id and isinstance(participant_id, str):
            try:
                participant_id = uuid.UUID(participant_id)
                data['participant_id'] = participant_id
            except ValueError:
                raise serializers.ValidationError(
                    "Invalid UUID format for participant_id"
                )

        # Convert participants to UUIDs if they're strings
        if participants:
            try:
                participants = [
                    uuid.UUID(str(p)) if not isinstance(p, uuid.UUID) else p 
                    for p in participants
                ]
                data['participants'] = participants
            except ValueError:
                raise serializers.ValidationError(
                    "Invalid UUID format in participants list"
                )

        # Combine participant_id with participants list
        if participant_id and not participants:
            data['participants'] = [participant_id]
        elif participant_id and participants:
            # Add participant_id to participants if not already there
            if participant_id not in participants:
                participants.append(participant_id)
            data['participants'] = participants

        return data

    def create(self, validated_data):
        request = self.context.get('request')
        
        # Debug print to see what we're getting
        print(f"DEBUG - validated_data type: {type(validated_data)}")
        print(f"DEBUG - validated_data content: {validated_data}")

        # Ensure we have a dictionary
        if not isinstance(validated_data, dict):
            raise serializers.ValidationError("Invalid validated data format")

        participant_ids = validated_data.get('participants', [])

        # Ensure participant_ids is a list of UUIDs
        if isinstance(participant_ids, (str, uuid.UUID)):
            participant_ids = [participant_ids]
        elif not isinstance(participant_ids, list):
            participant_ids = []

        # Convert all IDs to UUID objects for consistency
        try:
            participant_ids = [
                uuid.UUID(str(pid)) if not isinstance(pid, uuid.UUID) else pid
                for pid in participant_ids
            ]
        except ValueError as e:
            raise serializers.ValidationError(
                f"Invalid UUID format in participants: {str(e)}"
            )

        # Add current user if not included
        current_user_uuid = request.user.id
        if current_user_uuid not in participant_ids:
            participant_ids.append(current_user_uuid)

        # Remove duplicates while preserving order
        seen = set()
        participant_ids = [
            pid for pid in participant_ids 
            if not (pid in seen or seen.add(pid))
        ]

        print(f"DEBUG - final participant_ids: {participant_ids}")

        # Validate participants exist
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            existing_users = User.objects.filter(id__in=participant_ids)
            if existing_users.count() != len(participant_ids):
                existing_ids = [user.id for user in existing_users]
                missing_ids = set(participant_ids) - set(existing_ids)
                raise serializers.ValidationError({
                    'participants': f'These participants do not exist: {list(missing_ids)}'
                })
        except Exception as e:
            if isinstance(e, serializers.ValidationError):
                raise e
            raise serializers.ValidationError({
                'participants': f'Invalid participant IDs: {str(e)}'
            })

        # Check for existing conversation with exact same participants
        if len(existing_users) == 2:
            # For 2-person chats, check if conversation already exists
            user_objects = list(existing_users)
            existing_conversation = Conversation.objects.filter(
                participants__in=user_objects
            ).annotate(
                participant_count=Count('participants')
            ).filter(participant_count=2)

            # Ensure exact match
            for user_obj in user_objects:
                existing_conversation = existing_conversation.filter(participants=user_obj)
            
            existing_conversation = existing_conversation.first()
            if existing_conversation:
                return existing_conversation

        # Create new conversation
        conversation = Conversation.objects.create()
        conversation.participants.set(existing_users)
        return conversation


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for reading Conversation data"""
    participants = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'participants',
            'created_at',
            'updated_at',
            'last_message',
            'unread_count'
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
                'status': last_message.status,
                'is_read': last_message.is_read
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.messages.filter(
                receiver=request.user,
                is_read=False,
                is_deleted=False
            ).count()
        return 0


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model"""
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    receiver_id = serializers.CharField(write_only=True, required=False)
    
    # Add these file fields
    file_url = serializers.SerializerMethodField()
    is_file_message = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'receiver', 'receiver_id', 'content',
            'status', 'is_read', 'read_at', 'is_edited', 'is_deleted',
            'created_at', 'updated_at',
            # Add file fields
            'file', 'file_name', 'file_size', 'file_type', 'mime_type',
            'file_url', 'is_file_message'
        ]
        read_only_fields = [
            'id', 'sender', 'created_at', 'updated_at', 'is_edited', 'read_at',
            'file_url', 'is_file_message'
        ]

    def get_file_url(self, obj):
        """Get the file URL from Cloudinary"""
        return obj.file.url if obj.file else None
    
    def get_is_file_message(self, obj):
        """Check if this message contains a file"""
        return bool(obj.file)

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['sender'] = request.user

        # Handle receiver_id
        receiver_id = validated_data.pop('receiver_id', None)
        if receiver_id:
            try:
                receiver = User.objects.get(id=receiver_id)
                validated_data['receiver'] = receiver
            except User.DoesNotExist:
                raise serializers.ValidationError({'receiver_id': 'Invalid receiver ID'})

        return super().create(validated_data)

class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model"""
    
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'notification_type', 'title', 'message', 
            'data', 'is_read', 'read_at', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'read_at']