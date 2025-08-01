import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import CallRecord, ActiveCall
from django.utils import timezone
from django.contrib.auth import get_user_model

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
                
        except json.JSONDecodeError:
            print("❌ Invalid JSON received")
        except Exception as e:
            print(f"❌ Error processing message: {e}")

    async def initiate_call(self, data):
        caller_id = self.user_id
        callee_id = data.get('callee_id')
        
        try:
            call_record = await self.create_call_record(caller_id, callee_id)
            room_name = f"call_{call_record.id}_{uuid.uuid4().hex[:8]}"
            
            await self.channel_layer.group_add(room_name, self.channel_name)
            
            caller_name = await self.get_user_name(caller_id)
            callee_group = f'user_{callee_id}'
            
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
            
            await self.send(text_data=json.dumps({
                'type': 'call_initiated',
                'call_id': call_record.id,
                'room_name': room_name,
                'status': 'calling'
            }))
            
            print(f"📞 Call initiated: {caller_id} → {callee_id}")
            
        except Exception as e:
            print(f"❌ Call initiation failed: {e}")

    async def accept_call(self, data):
        call_id = data.get('call_id')
        room_name = data.get('room_name')
        
        try:
            await self.update_call_status(call_id, 'answered')
            
            print(f"🎯 ADDING CALLEE {self.user_id} TO ROOM {room_name}")
            await self.channel_layer.group_add(room_name, self.channel_name)
            print(f"✅ CALLEE {self.user_id} ADDED TO ROOM {room_name}")
            
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'call_accepted',
                    'call_id': call_id,
                    'accepter_id': self.user_id
                }
            )
            
            print(f"✅ Call accepted: {call_id}")
            
        except Exception as e:
            print(f"❌ Call acceptance failed: {e}")

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
        
        print(f"🎯 OFFER RECEIVED FROM {self.user_id} FOR ROOM {room_name}")
        print(f"🎯 BROADCASTING OFFER TO ROOM {room_name}")
        
        try:
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'webrtc_offer',
                    'offer': offer,
                    'sender_id': self.user_id
                }
            )
            print(f"✅ OFFER BROADCAST SUCCESSFUL TO ROOM {room_name}")
        except Exception as e:
            print(f"❌ Offer handling failed: {e}")


    async def handle_answer(self, data):
        room_name = data.get('room_name')
        answer = data.get('answer')
        
        print(f"🎯 ANSWER RECEIVED FROM {self.user_id} FOR ROOM {room_name}")
        print(f"🎯 BROADCASTING ANSWER TO ROOM {room_name}")
        
        try:
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'webrtc_answer',
                    'answer': answer,
                    'sender_id': self.user_id
                }
            )
            print(f"✅ ANSWER BROADCAST SUCCESSFUL TO ROOM {room_name}")
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
        try:
            await self.send(text_data=json.dumps({
                'type': 'incoming_call',
                'caller_id': event['caller_id'],
                'caller_name': event['caller_name'],
                'call_id': event['call_id'],
                'room_name': event['room_name']
            }))
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
            print(f"🎯 SENDING OFFER TO CLIENT {self.user_id} FROM SENDER {event['sender_id']}")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'offer',
                    'offer': event['offer'],
                    'sender_id': event['sender_id']
                }))
                print(f"✅ OFFER SENT TO CLIENT {self.user_id}")
            except Exception as e:
                print(f"❌ Error forwarding offer to {self.user_id}: {e}")
        else:
            print(f"🚫 SKIPPING OFFER SEND TO SENDER {self.user_id}")

async def webrtc_answer(self, event):
    if event['sender_id'] != self.user_id:
        print(f"🎯 SENDING ANSWER TO CLIENT {self.user_id} FROM SENDER {event['sender_id']}")
        try:
            await self.send(text_data=json.dumps({
                'type': 'answer',
                'answer': event['answer'],
                'sender_id': event['sender_id']
            }))
            print(f"✅ ANSWER SENT TO CLIENT {self.user_id}")
        except Exception as e:
            print(f"❌ Error forwarding answer to {self.user_id}: {e}")
    else:
        print(f"🚫 SKIPPING ANSWER SEND TO SENDER {self.user_id}")

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

    # Database operations
    @database_sync_to_async
    def create_call_record(self, caller_id, callee_id):
        try:
            caller = User.objects.get(id=caller_id)
            callee = User.objects.get(id=callee_id)
            call_record = CallRecord.objects.create(
                caller=caller, 
                callee=callee, 
                status='initiated'
            )
            return call_record
        except Exception as e:
            print(f"❌ Database error - create call record: {e}")
            raise

    @database_sync_to_async
    def update_call_status(self, call_id, status):
        try:
            CallRecord.objects.filter(id=call_id).update(status=status)
        except Exception as e:
            print(f"❌ Database error - update call status: {e}")
            raise

    @database_sync_to_async
    def end_call_record(self, call_id):
        try:
            call_record = CallRecord.objects.get(id=call_id)
            call_record.status = 'ended'
            call_record.ended_at = timezone.now()
            call_record.save()
        except Exception as e:
            print(f"❌ Database error - end call record: {e}")
            raise

    @database_sync_to_async
    def cleanup_call(self, call_id):
        try:
            ActiveCall.objects.filter(call_record_id=call_id).delete()
        except Exception as e:
            print(f"❌ Database error - cleanup call: {e}")

    @database_sync_to_async
    def cleanup_active_calls(self):
        try:
            ActiveCall.objects.filter(
                caller_channel=self.channel_name
            ).delete()
            ActiveCall.objects.filter(
                callee_channel=self.channel_name
            ).delete()
        except Exception as e:
            print(f"❌ Database error - cleanup active calls: {e}")

    @database_sync_to_async
    def get_user_name(self, user_id):
        try:
            user = User.objects.get(id=user_id)
            return user.get_full_name() or user.username
        except Exception as e:
            print(f"❌ Database error - get user name: {e}")
            raise