import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import CallRecord, ActiveCall
from django.utils import timezone

class VideoCallConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print(f"[CONNECT] WebSocket connection initiated")
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.user_group_name = f'user_{self.user_id}'
        print(f"[CONNECT] User ID: {self.user_id}, Group: {self.user_group_name}")
        
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        print(f"[CONNECT] Added to group: {self.user_group_name}, Channel: {self.channel_name}")
        
        await self.accept()
        print(f"[CONNECT] WebSocket connection accepted for user {self.user_id}")
        
        await self.channel_layer.group_send(
            self.user_group_name,
            {
                'type': 'user_status',
                'status': 'online',
                'user_id': self.user_id
            }
        )
        print(f"[CONNECT] Sent online status for user {self.user_id}")

    async def disconnect(self, close_code):
        print(f"[DISCONNECT] WebSocket disconnecting for user {self.user_id}, close_code: {close_code}")
        
        await self.channel_layer.group_discard(
            self.user_group_name,
            self.channel_name
        )
        print(f"[DISCONNECT] Removed from group: {self.user_group_name}")
        
        await self.cleanup_active_calls()
        print(f"[DISCONNECT] Cleaned up active calls for user {self.user_id}")

    async def receive(self, text_data):
        print(f"[RECEIVE] Raw message received: {text_data}")
        
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            print(f"[RECEIVE] Message type: {message_type}, Data: {data}")
            
            if message_type == 'call_initiate':
                print(f"[RECEIVE] Processing call initiation")
                await self.initiate_call(data)
            elif message_type == 'call_accept':
                print(f"[RECEIVE] Processing call acceptance")
                await self.accept_call(data)
            elif message_type == 'call_reject':
                print(f"[RECEIVE] Processing call rejection")
                await self.reject_call(data)
            elif message_type == 'call_end':
                print(f"[RECEIVE] Processing call end")
                await self.end_call(data)
            elif message_type == 'offer':
                print(f"[RECEIVE] Processing WebRTC offer")
                await self.handle_offer(data)
            elif message_type == 'answer':
                print(f"[RECEIVE] Processing WebRTC answer")
                await self.handle_answer(data)
            elif message_type == 'ice_candidate':
                print(f"[RECEIVE] Processing ICE candidate")
                await self.handle_ice_candidate(data)
            else:
                print(f"[RECEIVE] Unknown message type: {message_type}")
                
        except json.JSONDecodeError as e:
            print(f"[RECEIVE ERROR] JSON decode error: {e}")
        except Exception as e:
            print(f"[RECEIVE ERROR] Unexpected error: {e}")

    async def initiate_call(self, data):
        caller_id = self.user_id
        callee_id = data.get('callee_id')
        print(f"[INITIATE_CALL] Caller: {caller_id}, Callee: {callee_id}")
        
        try:
            call_record = await self.create_call_record(caller_id, callee_id)
            print(f"[INITIATE_CALL] Created call record with ID: {call_record.id}")
            
            room_name = f"call_{call_record.id}_{uuid.uuid4().hex[:8]}"
            print(f"[INITIATE_CALL] Generated room name: {room_name}")
            
            await self.channel_layer.group_add(room_name, self.channel_name)
            print(f"[INITIATE_CALL] Added caller to room: {room_name}")
            
            callee_group = f'user_{callee_id}'
            print(f"[INITIATE_CALL] Sending incoming call to group: {callee_group}")
            
            caller_name = await self.get_user_name(caller_id)
            print(f"[INITIATE_CALL] Caller name: {caller_name}")
            
            await self.channel_layer.group_send(
                callee_group, {
                    'type': 'incoming_call',
                    'caller_id': caller_id,
                    'caller_name': caller_name,
                    'call_id': call_record.id,
                    'room_name': room_name
                }
            )
            print(f"[INITIATE_CALL] Sent incoming call notification to {callee_group}")
            
            await self.send(text_data=json.dumps({
                'type': 'call_initiated',
                'call_id': call_record.id,
                'room_name': room_name,
                'status': 'calling'
            }))
            print(f"[INITIATE_CALL] Sent call initiated confirmation to caller")
            
        except Exception as e:
            print(f"[INITIATE_CALL ERROR] Error initiating call: {e}")

    async def accept_call(self, data):
        call_id = data.get('call_id')
        room_name = data.get('room_name')
        print(f"[ACCEPT_CALL] Call ID: {call_id}, Room: {room_name}, Accepter: {self.user_id}")
        
        try:
            await self.update_call_status(call_id, 'answered')
            print(f"[ACCEPT_CALL] Updated call status to 'answered'")
            
            await self.channel_layer.group_add(room_name, self.channel_name)
            print(f"[ACCEPT_CALL] Added accepter to room: {room_name}")
            
            await self.channel_layer.group_send(
                room_name, {
                    'type': 'call_accepted',
                    'call_id': call_id,
                    'accepter_id': self.user_id
                }
            )
            print(f"[ACCEPT_CALL] Sent call accepted notification to room: {room_name}")
            
        except Exception as e:
            print(f"[ACCEPT_CALL ERROR] Error accepting call: {e}")

    async def reject_call(self, data):
        call_id = data.get('call_id')
        room_name = data.get('room_name')
        print(f"[REJECT_CALL] Call ID: {call_id}, Room: {room_name}, Rejector: {self.user_id}")
        
        try:
            await self.update_call_status(call_id, 'rejected')
            print(f"[REJECT_CALL] Updated call status to 'rejected'")
            
            await self.channel_layer.group_send(
                room_name, {
                    'type': 'call_rejected',
                    'call_id': call_id,
                    'rejector_id': self.user_id
                }
            )
            print(f"[REJECT_CALL] Sent call rejected notification to room: {room_name}")
            
            await self.cleanup_call(call_id)
            print(f"[REJECT_CALL] Cleaned up call: {call_id}")
            
        except Exception as e:
            print(f"[REJECT_CALL ERROR] Error rejecting call: {e}")

    async def end_call(self, data):
        call_id = data.get('call_id')
        room_name = data.get('room_name')
        print(f"[END_CALL] Call ID: {call_id}, Room: {room_name}, Ended by: {self.user_id}")
        
        try:
            await self.end_call_record(call_id)
            print(f"[END_CALL] Updated call record end time")
            
            await self.channel_layer.group_send(
                room_name, {
                    'type': 'call_ended',
                    'call_id': call_id,
                    'ended_by': self.user_id
                }
            )
            print(f"[END_CALL] Sent call ended notification to room: {room_name}")
            
            await self.cleanup_call(call_id)
            print(f"[END_CALL] Cleaned up call: {call_id}")
            
        except Exception as e:
            print(f"[END_CALL ERROR] Error ending call: {e}")

    async def handle_offer(self, data):
        room_name = data.get('room_name')
        offer = data.get('offer')
        print(f"[HANDLE_OFFER] Room: {room_name}, Sender: {self.user_id}")
        print(f"[HANDLE_OFFER] Offer data: {str(offer)[:100]}...")  # Truncate for readability
        
        try:
            await self.channel_layer.group_send(
                room_name, {
                    'type': 'webrtc_offer',
                    'offer': offer,
                    'sender_id': self.user_id
                }
            )
            print(f"[HANDLE_OFFER] Sent WebRTC offer to room: {room_name}")
            
        except Exception as e:
            print(f"[HANDLE_OFFER ERROR] Error handling offer: {e}")

    async def handle_answer(self, data):
        room_name = data.get('room_name')
        answer = data.get('answer')
        print(f"[HANDLE_ANSWER] Room: {room_name}, Sender: {self.user_id}")
        print(f"[HANDLE_ANSWER] Answer data: {str(answer)[:100]}...")  # Truncate for readability
        
        try:
            await self.channel_layer.group_send(
                room_name, {
                    'type': 'webrtc_answer',
                    'answer': answer,
                    'sender_id': self.user_id
                }
            )
            print(f"[HANDLE_ANSWER] Sent WebRTC answer to room: {room_name}")
            
        except Exception as e:
            print(f"[HANDLE_ANSWER ERROR] Error handling answer: {e}")

    async def handle_ice_candidate(self, data):
        room_name = data.get('room_name')
        candidate = data.get('candidate')
        print(f"[HANDLE_ICE] Room: {room_name}, Sender: {self.user_id}")
        print(f"[HANDLE_ICE] Candidate: {candidate}")
        
        try:
            await self.channel_layer.group_send(
                room_name, {
                    'type': 'webrtc_ice_candidate',
                    'candidate': candidate,
                    'sender_id': self.user_id
                }
            )
            print(f"[HANDLE_ICE] Sent ICE candidate to room: {room_name}")
            
        except Exception as e:
            print(f"[HANDLE_ICE ERROR] Error handling ICE candidate: {e}")

    # WebSocket event handlers
    async def incoming_call(self, event):
        print(f"[INCOMING_CALL] Event received: {event}")
        try:
            await self.send(text_data=json.dumps({
                'type': 'incoming_call',
                'caller_id': event['caller_id'],
                'caller_name': event['caller_name'],
                'call_id': event['call_id'],
                'room_name': event['room_name']
            }))
            print(f"[INCOMING_CALL] Sent incoming call to client")
        except Exception as e:
            print(f"[INCOMING_CALL ERROR] Error sending incoming call: {e}")

    async def call_accepted(self, event):
        print(f"[CALL_ACCEPTED] Event received: {event}")
        try:
            await self.send(text_data=json.dumps({
                'type': 'call_accepted',
                'call_id': event['call_id'],
                'accepter_id': event['accepter_id']
            }))
            print(f"[CALL_ACCEPTED] Sent call accepted to client")
        except Exception as e:
            print(f"[CALL_ACCEPTED ERROR] Error sending call accepted: {e}")

    async def call_rejected(self, event):
        print(f"[CALL_REJECTED] Event received: {event}")
        try:
            await self.send(text_data=json.dumps({
                'type': 'call_rejected',
                'call_id': event['call_id'],
                'rejector_id': event['rejector_id']
            }))
            print(f"[CALL_REJECTED] Sent call rejected to client")
        except Exception as e:
            print(f"[CALL_REJECTED ERROR] Error sending call rejected: {e}")

    async def call_ended(self, event):
        print(f"[CALL_ENDED] Event received: {event}")
        try:
            await self.send(text_data=json.dumps({
                'type': 'call_ended',
                'call_id': event['call_id'],
                'ended_by': event['ended_by']
            }))
            print(f"[CALL_ENDED] Sent call ended to client")
        except Exception as e:
            print(f"[CALL_ENDED ERROR] Error sending call ended: {e}")

    async def webrtc_offer(self, event):
        if event['sender_id'] != self.user_id:
            print(f"[WEBRTC_OFFER] Forwarding offer from {event['sender_id']} to {self.user_id}")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'offer',
                    'offer': event['offer'],
                    'sender_id': event['sender_id']
                }))
                print(f"[WEBRTC_OFFER] Sent offer to client")
            except Exception as e:
                print(f"[WEBRTC_OFFER ERROR] Error sending offer: {e}")
        else:
            print(f"[WEBRTC_OFFER] Ignoring own offer")

    async def webrtc_answer(self, event):
        if event['sender_id'] != self.user_id:
            print(f"[WEBRTC_ANSWER] Forwarding answer from {event['sender_id']} to {self.user_id}")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'answer',
                    'answer': event['answer'],
                    'sender_id': event['sender_id']
                }))
                print(f"[WEBRTC_ANSWER] Sent answer to client")
            except Exception as e:
                print(f"[WEBRTC_ANSWER ERROR] Error sending answer: {e}")
        else:
            print(f"[WEBRTC_ANSWER] Ignoring own answer")

    async def webrtc_ice_candidate(self, event):
        if event['sender_id'] != self.user_id:
            print(f"[WEBRTC_ICE] Forwarding ICE candidate from {event['sender_id']} to {self.user_id}")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'ice_candidate',
                    'candidate': event['candidate'],
                    'sender_id': event['sender_id']
                }))
                print(f"[WEBRTC_ICE] Sent ICE candidate to client")
            except Exception as e:
                print(f"[WEBRTC_ICE ERROR] Error sending ICE candidate: {e}")
        else:
            print(f"[WEBRTC_ICE] Ignoring own ICE candidate")

    # Database operations
    @database_sync_to_async
    def create_call_record(self, caller_id, callee_id):
        print(f"[DB] Creating call record: caller={caller_id}, callee={callee_id}")
        try:
            caller = User.objects.get(id=caller_id)
            callee = User.objects.get(id=callee_id)
            call_record = CallRecord.objects.create(caller=caller, callee=callee, status='initiated')
            print(f"[DB] Call record created with ID: {call_record.id}")
            return call_record
        except Exception as e:
            print(f"[DB ERROR] Error creating call record: {e}")
            raise

    @database_sync_to_async
    def create_active_call(self, call_record, room_name, caller_channel):
        print(f"[DB] Creating active call: call_record={call_record.id}, room={room_name}")
        try:
            active_call = ActiveCall.objects.create(
                call_record=call_record,
                room_name=room_name,
                caller_channel=caller_channel
            )
            print(f"[DB] Active call created with ID: {active_call.id}")
            return active_call
        except Exception as e:
            print(f"[DB ERROR] Error creating active call: {e}")
            raise

    @database_sync_to_async
    def update_call_status(self, call_id, status):
        print(f"[DB] Updating call {call_id} status to: {status}")
        try:
            updated_count = CallRecord.objects.filter(id=call_id).update(status=status)
            print(f"[DB] Updated {updated_count} call record(s)")
        except Exception as e:
            print(f"[DB ERROR] Error updating call status: {e}")
            raise

    @database_sync_to_async
    def update_active_call_callee(self, call_id, callee_channel):
        print(f"[DB] Updating active call {call_id} callee channel: {callee_channel}")
        try:
            active_call = ActiveCall.objects.get(call_record_id=call_id)
            active_call.callee_channel = callee_channel
            active_call.save()
            print(f"[DB] Active call updated")
        except Exception as e:
            print(f"[DB ERROR] Error updating active call callee: {e}")
            raise

    @database_sync_to_async
    def end_call_record(self, call_id):
        print(f"[DB] Ending call record: {call_id}")
        try:
            call_record = CallRecord.objects.get(id=call_id)
            call_record.status = 'ended'
            call_record.ended_at = timezone.now()
            call_record.save()
            print(f"[DB] Call record ended at: {call_record.ended_at}")
        except Exception as e:
            print(f"[DB ERROR] Error ending call record: {e}")
            raise

    @database_sync_to_async
    def cleanup_call(self, call_id):
        print(f"[DB] Cleaning up active call: {call_id}")
        try:
            deleted_count = ActiveCall.objects.filter(call_record_id=call_id).delete()[0]
            print(f"[DB] Deleted {deleted_count} active call record(s)")
        except Exception as e:
            print(f"[DB ERROR] Error cleaning up call: {e}")

    @database_sync_to_async
    def cleanup_active_calls(self):
        print(f"[DB] Cleaning up active calls for channel: {self.channel_name}")
        try:
            caller_deleted = ActiveCall.objects.filter(caller_channel=self.channel_name).delete()[0]
            callee_deleted = ActiveCall.objects.filter(callee_channel=self.channel_name).delete()[0]
            print(f"[DB] Deleted {caller_deleted} caller records, {callee_deleted} callee records")
        except Exception as e:
            print(f"[DB ERROR] Error cleaning up active calls: {e}")

    @database_sync_to_async
    def get_user_name(self, user_id):
        print(f"[DB] Getting user name for ID: {user_id}")
        try:
            user = User.objects.get(id=user_id)
            name = user.get_full_name() or user.username
            print(f"[DB] User name: {name}")
            return name
        except Exception as e:
            print(f"[DB ERROR] Error getting user name: {e}")
            raise