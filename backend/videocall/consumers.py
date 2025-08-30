import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import CallRecord, ActiveCall
from datetime import datetime, timedelta
from django.utils import timezone
from doctor.models import Appointment
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
        appointment_id = data.get('appointment_id')
        print(f"🎯 CALL INITIATION: {caller_id} calling {callee_id} for appointment {appointment_id}")
        print(f"🔍 Appointment ID: {appointment_id}")
        if not callee_id:
            print("❌ No callee_id provided")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'No recipient specified'
            }))
            return

        if not appointment_id:
            print("❌ No appointment_id provided")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Appointment ID required for call'
            }))
            return

        try:
            # Validate appointment
            appointment_validation = await self.validate_appointment_call(caller_id, callee_id, appointment_id)
            # Check if validation returned None or invalid response
            if not appointment_validation or not isinstance(appointment_validation, dict):
                print(f"❌ Appointment validation returned invalid response: {appointment_validation}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Error validating appointment'
                }))
                return

            # Check if callee exists
            callee_exists = await self.check_user_exists(callee_id)
            if not callee_exists:
                print(f"❌ Callee {callee_id} does not exist")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'User not found'
                }))
                return

            # Create call record - FIXED: Pass appointment_id as third parameter
            call_record = await self.create_call_record(caller_id, callee_id, appointment_id)
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
            print(f"🔍 Appointment ID: {appointment_id}")
            await self.channel_layer.group_send(
                callee_group,
                {
                    'type': 'incoming_call',
                    'caller_id': caller_id,
                    'caller_name': caller_name,
                    'call_id': call_record.id,
                    'room_name': room_name,
                    'appointment_id': appointment_id
                }
            )

            # Confirm to caller
            await self.send(text_data=json.dumps({
                'type': 'call_initiated',
                'call_id': call_record.id,
                'room_name': room_name,
                'status': 'calling',
                'appointment_id': appointment_id
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

            # ✅ FIXED: Include room_name in the call_accepted event
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'call_accepted',
                    'call_id': call_id,
                    'room_name': room_name,  # ✅ Added room_name
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
            
            # ✅ FIXED: Include room_name in call_rejected event
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'call_rejected',
                    'call_id': call_id,
                    'room_name': room_name,  # ✅ Added room_name
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
            
            # ✅ FIXED: Include room_name in call_ended event
            await self.channel_layer.group_send(
                room_name,
                {
                    'type': 'call_ended',
                    'call_id': call_id,
                    'room_name': room_name,  # ✅ Added room_name
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
                    'room_name': room_name,  # ✅ Include room_name for consistency
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
                    'room_name': room_name,  # ✅ Include room_name for consistency
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
                    'room_name': room_name,  
                    'sender_id': self.user_id
                }
            )
            print(f"🧊 ICE candidate sent to room: {room_name}")
        except Exception as e:
            print(f"❌ ICE candidate handling failed: {e}")

    # WebSocket event handlers

    async def incoming_call(self, event):
	    """Handle incoming call messages sent via channel layer"""
	    print(f"📞 Sending incoming call notification to user {self.user_id}")
	    try:
	        await self.send(text_data=json.dumps({
	            'type': 'incoming_call',
	            'caller_id': event['caller_id'],
	            'caller_name': event['caller_name'],
	            'call_id': event['call_id'],
	            'room_name': event['room_name'],
	            'appointment_id': event.get('appointment_id')
	        }))
	        print(f"✅ Incoming call notification sent to user {self.user_id}")
	    except Exception as e:
	        print(f"❌ Error sending incoming call notification: {e}")

    async def call_accepted(self, event):
	    """Handle call accepted messages"""
	    print(f"✅ Sending call accepted notification to user {self.user_id}")
	    try:
	        await self.send(text_data=json.dumps({
	            'type': 'call_accepted',
	            'call_id': event['call_id'],
	            'room_name': event['room_name'],
	            'accepter_id': event['accepter_id']
	        }))
	        print(f"✅ Call accepted notification sent to user {self.user_id}")
	    except Exception as e:
	        print(f"❌ Error sending call accepted notification: {e}")

    async def call_rejected(self, event):
	    """Handle call rejected messages"""
	    print(f"❌ Sending call rejected notification to user {self.user_id}")
	    try:
	        await self.send(text_data=json.dumps({
	            'type': 'call_rejected',
	            'call_id': event['call_id'],
	            'room_name': event['room_name'],
	            'rejector_id': event['rejector_id']
	        }))
	        print(f"✅ Call rejected notification sent to user {self.user_id}")
	    except Exception as e:
	        print(f"❌ Error sending call rejected notification: {e}")
     

    async def call_ended(self, event):
	    """Handle call ended messages"""
	    print(f"🔚 Sending call ended notification to user {self.user_id}")
	    try:
	        await self.send(text_data=json.dumps({
	            'type': 'call_ended',
	            'call_id': event['call_id'],
	            'room_name': event['room_name'],
	            'ended_by': event['ended_by']
	        }))
	        print(f"✅ Call ended notification sent to user {self.user_id}")
	    except Exception as e:
	        print(f"❌ Error sending call ended notification: {e}")


    async def webrtc_offer(self, event):
	    """Handle WebRTC offer messages"""
	    # Don't send offer back to the sender
	    if event['sender_id'] != self.user_id:
	        print(f"📤 Forwarding WebRTC offer to user {self.user_id} from {event['sender_id']}")
	        try:
	            await self.send(text_data=json.dumps({
	                'type': 'webrtc_offer',
	                'offer': event['offer'],
	                'room_name': event['room_name'],
	                'sender_id': event['sender_id']
	            }))
	            print(f"✅ WebRTC offer forwarded to user {self.user_id}")
	        except Exception as e:
	            print(f"❌ Error forwarding WebRTC offer: {e}")


    async def webrtc_answer(self, event):
	    """Handle WebRTC answer messages"""
	    # Don't send answer back to the sender
	    if event['sender_id'] != self.user_id:
	        print(f"📥 Forwarding WebRTC answer to user {self.user_id} from {event['sender_id']}")
	        try:
	            await self.send(text_data=json.dumps({
	                'type': 'webrtc_answer',
	                'answer': event['answer'],
	                'room_name': event['room_name'],
	                'sender_id': event['sender_id']
	            }))
	            print(f"✅ WebRTC answer forwarded to user {self.user_id}")
	        except Exception as e:
	            print(f"❌ Error forwarding WebRTC answer: {e}")


    async def webrtc_ice_candidate(self, event):
	    """Handle WebRTC ICE candidate messages"""
	    # Don't send ICE candidate back to the sender
	    if event['sender_id'] != self.user_id:
	        print(f"🧊 Forwarding ICE candidate to user {self.user_id} from {event['sender_id']}")
	        try:
	            await self.send(text_data=json.dumps({
	                'type': 'ice_candidate',
	                'candidate': event['candidate'],
	                'room_name': event['room_name'],
	                'sender_id': event['sender_id']
	            }))
	            print(f"✅ ICE candidate forwarded to user {self.user_id}")
	        except Exception as e:
	            print(f"❌ Error forwarding ICE candidate: {e}")


    # Database operations remain the same...
    @database_sync_to_async
    def create_call_record(self, caller_id, callee_id,appointment_id=None):
        """Create a new call record in the database"""
        try:
            print(f"🔄 Creating call record: {caller_id} -> {callee_id}")
            caller = User.objects.get(id=caller_id)
            callee = User.objects.get(id=callee_id)
            call_record = CallRecord.objects.create(
                caller=caller,
                callee=callee,
                status='initiated',
                appointment_id=appointment_id,
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
	        print(f"🔍 DEBUG - Checking if user exists: {user_id} (type: {type(user_id)})")
	        
	        # Try to find the user
	        user_exists = User.objects.filter(id=user_id).exists()
	        print(f"🔍 DEBUG - User exists result: {user_exists}")
	        
	        # If not found, try alternative lookups
	        if not user_exists:
	            print(f"🔍 DEBUG - Trying alternative lookups...")
	            
	            # Try by username (if user_id is actually a username)
	            user_by_username = User.objects.filter(username=user_id).exists()
	            print(f"🔍 DEBUG - User by username: {user_by_username}")
	            
	            # Try by email (if user_id is actually an email)
	            user_by_email = User.objects.filter(email=user_id).exists()
	            print(f"🔍 DEBUG - User by email: {user_by_email}")
	            
	            # List all users for debugging
	            all_users = User.objects.all()
	            print(f"🔍 DEBUG - All users in database:")
	            for user in all_users:
	                print(f"   - ID: {user.id} (type: {type(user.id)}), Username: {user.username}, Email: {user.email}")
	        
	        return user_exists
	        
	    except Exception as e:
	        print(f"❌ Error checking user existence: {e}")
	        import traceback
	        traceback.print_exc()
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
        
    @database_sync_to_async
    def validate_appointment_call(self, caller_id, callee_id, appointment_id):
        """Simple validation for appointment call with User ID comparison"""
        try:
            
            
            # Get the appointment
            appointment = Appointment.objects.select_related('patient__user', 'doctor__user').get(id=appointment_id)
            
            # Get User IDs from the appointment
            patient_user_id = appointment.patient.user.id
            doctor_user_id = appointment.doctor.user.id
            
            # DEBUG: Print all the IDs for comparison
            print(f"🔍 DEBUGGING APPOINTMENT VALIDATION:")
            print(f"   Appointment ID: {appointment_id}")
            print(f"   Caller ID: {caller_id} (type: {type(caller_id)})")
            print(f"   Callee ID: {callee_id} (type: {type(callee_id)})")
            print(f"   Patient User ID: {patient_user_id} (type: {type(patient_user_id)})")
            print(f"   Doctor User ID: {doctor_user_id} (type: {type(doctor_user_id)})")
            
            # Convert to strings for comparison
            caller_str = str(caller_id)
            callee_str = str(callee_id)
            patient_user_str = str(patient_user_id)
            doctor_user_str = str(doctor_user_id)
            
            print(f"   String comparisons:")
            print(f"   Caller '{caller_str}' == Patient User '{patient_user_str}': {caller_str == patient_user_str}")
            print(f"   Caller '{caller_str}' == Doctor User '{doctor_user_str}': {caller_str == doctor_user_str}")
            print(f"   Callee '{callee_str}' == Patient User '{patient_user_str}': {callee_str == patient_user_str}")
            print(f"   Callee '{callee_str}' == Doctor User '{doctor_user_str}': {callee_str == doctor_user_str}")
            
            # Basic checks
            if appointment.status.lower() != 'confirmed':
                print(f"❌ Appointment status is '{appointment.status}', not 'confirmed'")
                return {'valid': False, 'reason': 'Appointment must be confirmed'}
                
            if appointment.mode != 'online':
                print(f"❌ Appointment mode is '{appointment.mode}', not 'online'")
                return {'valid': False, 'reason': 'Only online appointments support video calls'}
            
            # Check if users are part of this appointment (using User IDs)
            caller_is_patient = caller_str == patient_user_str
            caller_is_doctor = caller_str == doctor_user_str
            callee_is_patient = callee_str == patient_user_str
            callee_is_doctor = callee_str == doctor_user_str
            
            user_is_part_of_appointment = (caller_is_patient or caller_is_doctor or callee_is_patient or callee_is_doctor)
            
            print(f"   User participation check: {user_is_part_of_appointment}")
            print(f"   - Caller is patient: {caller_is_patient}")
            print(f"   - Caller is doctor: {caller_is_doctor}")
            print(f"   - Callee is patient: {callee_is_patient}")
            print(f"   - Callee is doctor: {callee_is_doctor}")
            
            if not user_is_part_of_appointment:
                print(f"❌ Neither caller nor callee is part of appointment {appointment_id}")
                return {'valid': False, 'reason': 'You are not part of this appointment'}
            
            # If we reach here, validation passed
            print(f"✅ Appointment validation passed!")
            return {'valid': True, 'reason': 'Call is allowed'}
            
            # Uncomment the time check code below if you want to enable it:
            
            # # Time check - Allow calls for the entire appointment duration
            # from datetime import datetime, timedelta
            # from django.utils import timezone
            
            # # Parse appointment time
            # appointment_date = appointment.appointment_date
            
            # # Handle slot_time whether it's a time object or string
            # if hasattr(appointment.slot_time, 'hour'):
            #     # It's already a time object
            #     appointment_time = appointment.slot_time
            # else:
            #     # It's a string, parse it
            #     time_parts = str(appointment.slot_time).split(':')
            #     appointment_time = datetime.min.time().replace(
            #         hour=int(time_parts[0]),
            #         minute=int(time_parts[1])
            #     )
            
            # appointment_datetime = datetime.combine(appointment_date, appointment_time)
            # appointment_datetime = timezone.make_aware(appointment_datetime)
            # now = timezone.now()
            
            # # Get appointment duration (check if appointment has duration field, otherwise default to 30 minutes)
            # if hasattr(appointment, 'duration') and appointment.duration:
            #     appointment_duration = appointment.duration  # in minutes
            # else:
            #     appointment_duration = 30  # default 30 minutes
            
            # # Allow calls for the entire booked slot duration
            # start_time = appointment_datetime  # Start exactly at appointment time
            # end_time = appointment_datetime + timedelta(minutes=appointment_duration)  # End after full duration
            
            # print(f"   Time check - Now: {now}, Start: {start_time}, End: {end_time}")
            # print(f"   Appointment duration: {appointment_duration} minutes")
            
            # if now < start_time:
            #     return {'valid': False, 'reason': 'Call will be available at appointment start time'}
            # elif now > end_time:
            #     return {'valid': False, 'reason': f'Call window has expired. You had {appointment_duration} minutes from {start_time.strftime("%H:%M")}'}
            
            # # Calculate remaining time for user info
            # remaining_minutes = int((end_time - now).total_seconds() / 60)
            # print(f"✅ Appointment validation passed! {remaining_minutes} minutes remaining in slot")
            # return {'valid': True, 'reason': f'Call is allowed. {remaining_minutes} minutes remaining in your appointment slot'}
            
        except Appointment.DoesNotExist:
            print(f"❌ Appointment {appointment_id} does not exist")
            return {'valid': False, 'reason': 'Appointment not found'}
        except Exception as e:
            print(f"❌ Error validating appointment: {e}")
            import traceback
            traceback.print_exc()
            return {'valid': False, 'reason': 'Error validating appointment'}  
