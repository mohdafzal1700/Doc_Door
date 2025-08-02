import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import CallRecord, ActiveCall
from django.utils import timezone

User = get_user_model()

class VideoCallConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.user_group_name = f'user_{self.user_id}'
        
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"✅ User {self.user_id} connected")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.user_group_name,
            self.channel_name
        )
        await self.cleanup_active_calls()
        print(f"🔌 User {self.user_id} disconnected")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            print(f"📨 Received message: {message_type} from user {self.user_id}")
            print(f"📨 Message data: {data}")
            
            if message_type == 'call_initiate':
                await self.initiate_call(data)
            elif message_type == 'call_accept':
                await self.accept_call(data)
            elif message_type == 'call_reject':
                await self.reject_call(data)
            elif message_type == 'call_end':
                await self.end_call(data)
            elif message_type == 'offer':
                await self.handle_offer(data)
            elif message_type == 'answer':
                await self.handle_answer(data)
            elif message_type == 'ice_candidate':
                await self.handle_ice_candidate(data)
            else:
                print(f"❓ Unknown message type: {message_type}")
                
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON received: {e}")
        except Exception as e:
            print(f"❌ Error processing message: {e}")
            import traceback
            traceback.print_exc()

    async def initiate_call(self, data):
        caller_id = self.user_id
        callee_id = data.get('callee_id')
        
        print(f"🎯 CALL INITIATION: {caller_id} calling {callee_id}")
        
        if not callee_id:
            print("❌ No callee_id provided")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'No recipient specified'
            }))
            return
            
        try:
            # Check if callee exists
            callee_exists = await self.check_user_exists(callee_id)
            if not callee_exists:
                print(f"❌ Callee {callee_id} does not exist")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'User not found'
                }))
                return
            
            # Create call record
            call_record = await self.create_call_record(caller_id, callee_id)
            print(f"✅ Call record created: {call_record.id}")
            
            room_name = f"call_{call_record.id}_{uuid.uuid4().hex[:8]}"
            
            # Add caller to room
            await self.channel_layer.group_add(room_name, self.channel_name)
            print(f"✅ Caller {caller_id} added to room {room_name}")
            
            # Get caller name
            caller_name = await self.get_user_name(caller_id)
            
            # Send to callee
            callee_group = f'user_{callee_id}'
            print(f"📞 Sending incoming call to group: {callee_group}")
            
            await self.channel_layer.group_send(
                callee_group,
                {
                    'type': 'incoming_call',
                    'caller_id': caller_id,
                    'caller_name': caller_name,
                    'call_id': call_record.id,
                    'room_name': room_name
                }
            )
            
            # Confirm to caller
            await self.send(text_data=json.dumps({
                'type': 'call_initiated',
                'call_id': call_record.id,
                'room_name': room_name,
                'status': 'calling'
            }))
            
            print(f"📞 Call initiated successfully: {caller_id} → {callee_id}")
            
        except Exception as e:
            print(f"❌ Call initiation failed: {e}")
            import traceback
            traceback.print_exc()
            
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to initiate call'
            }))

    async def accept_call(self, data):
        call_id = data.get('call_id')
        room_name = data.get('room_name')
        
        print(f"✅ ACCEPTING CALL: {call_id} in room {room_name} by user {self.user_id}")
        
        try:
            await self.update_call_status(call_id, 'answered')
            print(f"✅ Call status updated to answered")
            
            # Add callee to room
            await self.channel_layer.group_add(room_name, self.channel_name)
            print(f"✅ Callee {self.user_id} added to room {room_name}")
            
            # Notify room members
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'call_accepted',
                    'call_id': call_id,
                    'accepter_id': self.user_id
                }
            )
            
            print(f"✅ Call accepted notification sent to room {room_name}")
            
        except Exception as e:
            print(f"❌ Call acceptance failed: {e}")
            import traceback
            traceback.print_exc()

    async def reject_call(self, data):
        call_id = data.get('call_id')
        room_name = data.get('room_name')
        
        try:
            await self.update_call_status(call_id, 'rejected')
            
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'call_rejected',
                    'call_id': call_id,
                    'rejector_id': self.user_id
                }
            )
            
            await self.cleanup_call(call_id)
            print(f"❌ Call rejected: {call_id}")
            
        except Exception as e:
            print(f"❌ Call rejection failed: {e}")

    async def end_call(self, data):
        call_id = data.get('call_id')
        room_name = data.get('room_name')
        
        try:
            await self.end_call_record(call_id)
            
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'call_ended',
                    'call_id': call_id,
                    'ended_by': self.user_id
                }
            )
            
            await self.cleanup_call(call_id)
            print(f"🔚 Call ended: {call_id}")
            
        except Exception as e:
            print(f"❌ Call end failed: {e}")

    async def handle_offer(self, data):
        room_name = data.get('room_name')
        offer = data.get('offer')
        
        print(f"📤 OFFER: Broadcasting from {self.user_id} to room {room_name}")
        
        try:
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'webrtc_offer',
                    'offer': offer,
                    'sender_id': self.user_id
                }
            )
            print(f"✅ Offer broadcast successful")
            
        except Exception as e:
            print(f"❌ Offer handling failed: {e}")

    async def handle_answer(self, data):
        room_name = data.get('room_name')
        answer = data.get('answer')
        
        print(f"📥 ANSWER: Broadcasting from {self.user_id} to room {room_name}")
        
        try:
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'webrtc_answer',
                    'answer': answer,
                    'sender_id': self.user_id
                }
            )
            print(f"✅ Answer broadcast successful")
            
        except Exception as e:
            print(f"❌ Answer handling failed: {e}")

    async def handle_ice_candidate(self, data):
        room_name = data.get('room_name')
        candidate = data.get('candidate')
        
        try:
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'webrtc_ice_candidate',
                    'candidate': candidate,
                    'sender_id': self.user_id
                }
            )
            print(f"🧊 ICE candidate sent to room: {room_name}")
            
        except Exception as e:
            print(f"❌ ICE candidate handling failed: {e}")

    # WebSocket event handlers
    async def incoming_call(self, event):
        print(f"📞 Sending incoming call notification to {self.user_id}")
        try:
            await self.send(text_data=json.dumps({
                'type': 'incoming_call',
                'caller_id': event['caller_id'],
                'caller_name': event['caller_name'],
                'call_id': event['call_id'],
                'room_name': event['room_name']
            }))
            print(f"✅ Incoming call sent to {self.user_id}")
        except Exception as e:
            print(f"❌ Error sending incoming call: {e}")

    async def call_accepted(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'call_accepted',
                'call_id': event['call_id'],
                'accepter_id': event['accepter_id']
            }))
        except Exception as e:
            print(f"❌ Error sending call accepted: {e}")

    async def call_rejected(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'call_rejected',
                'call_id': event['call_id'],
                'rejector_id': event['rejector_id']
            }))
        except Exception as e:
            print(f"❌ Error sending call rejected: {e}")

    async def call_ended(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'call_ended',
                'call_id': event['call_id'],
                'ended_by': event['ended_by']
            }))
        except Exception as e:
            print(f"❌ Error sending call ended: {e}")

    async def webrtc_offer(self, event):
        if event['sender_id'] != self.user_id:
            print(f"📤 Forwarding offer to {self.user_id} from {event['sender_id']}")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'webrtc_offer',
                    'offer': event['offer'],
                    'sender_id': event['sender_id']
                }))
                print(f"✅ Offer forwarded to {self.user_id}")
            except Exception as e:
                print(f"❌ Error forwarding offer: {e}")

    async def webrtc_answer(self, event):
        if event['sender_id'] != self.user_id:
            print(f"📥 Forwarding answer to {self.user_id} from {event['sender_id']}")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'webrtc_answer',
                    'answer': event['answer'],
                    'sender_id': event['sender_id']
                }))
                print(f"✅ Answer forwarded to {self.user_id}")
            except Exception as e:
                print(f"❌ Error forwarding answer: {e}")

    async def webrtc_ice_candidate(self, event):
        if event['sender_id'] != self.user_id:
            try:
                await self.send(text_data=json.dumps({
                    'type': 'ice_candidate',
                    'candidate': event['candidate'],
                    'sender_id': event['sender_id']
                }))
            except Exception as e:
                print(f"❌ Error forwarding ICE candidate: {e}")

    # Database operations with proper decorators
    @database_sync_to_async
    def create_call_record(self, caller_id, callee_id):
        """Create a new call record in the database"""
        try:
            print(f"🔄 Creating call record: {caller_id} -> {callee_id}")
            
            caller = User.objects.get(id=caller_id)
            callee = User.objects.get(id=callee_id)
            
            call_record = CallRecord.objects.create(
                caller=caller,
                callee=callee,
                status='initiated'
            )
            
            print(f"✅ Call record created with ID: {call_record.id}")
            return call_record
            
        except User.DoesNotExist as e:
            print(f"❌ User not found: {e}")
            raise
        except Exception as e:
            print(f"❌ Database error - create call record: {e}")
            raise

    @database_sync_to_async
    def check_user_exists(self, user_id):
        """Check if a user exists"""
        try:
            return User.objects.filter(id=user_id).exists()
        except Exception as e:
            print(f"❌ Error checking user existence: {e}")
            return False

    @database_sync_to_async
    def update_call_status(self, call_id, status):
        """Update call status"""
        try:
            updated = CallRecord.objects.filter(id=call_id).update(status=status)
            print(f"✅ Updated {updated} call record(s) to status: {status}")
            return updated > 0
        except Exception as e:
            print(f"❌ Database error - update call status: {e}")
            raise

    @database_sync_to_async
    def end_call_record(self, call_id):
        """End a call record"""
        try:
            call_record = CallRecord.objects.get(id=call_id)
            call_record.status = 'ended'
            call_record.ended_at = timezone.now()
            call_record.save()
            print(f"✅ Call {call_id} ended successfully")
        except CallRecord.DoesNotExist:
            print(f"❌ Call record {call_id} not found")
            raise
        except Exception as e:
            print(f"❌ Database error - end call record: {e}")
            raise

    @database_sync_to_async
    def cleanup_call(self, call_id):
        """Clean up active call data"""
        try:
            deleted = ActiveCall.objects.filter(call_record_id=call_id).delete()
            print(f"✅ Cleaned up {deleted[0]} active call records")
        except Exception as e:
            print(f"❌ Database error - cleanup call: {e}")

    @database_sync_to_async
    def cleanup_active_calls(self):
        """Clean up active calls for this connection"""
        try:
            deleted_caller = ActiveCall.objects.filter(caller_channel=self.channel_name).delete()
            deleted_callee = ActiveCall.objects.filter(callee_channel=self.channel_name).delete()
            total_deleted = deleted_caller[0] + deleted_callee[0]
            print(f"✅ Cleaned up {total_deleted} active call records for {self.user_id}")
        except Exception as e:
            print(f"❌ Database error - cleanup active calls: {e}")

    @database_sync_to_async
    def get_user_name(self, user_id):
        """Get user's display name"""
        try:
            user = User.objects.get(id=user_id)
            name = user.get_full_name() or user.username
            print(f"✅ Retrieved name for user {user_id}: {name}")
            return name
        except User.DoesNotExist:
            print(f"❌ User {user_id} not found")
            return f"User {user_id}"
        except Exception as e:
            print(f"❌ Database error - get user name: {e}")
            return f"User {user_id}"