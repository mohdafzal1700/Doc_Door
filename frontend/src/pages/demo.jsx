// class UpdatePatientLocationView(generics.CreateAPIView):
//     """POST /patients/location/update/"""
//     serializer_class = PatientLocationUpdateSerializer
//     permission_classes = [IsAuthenticated]
    
//     def get_patient(self):
//         """Get the patient instance for the authenticated user"""
//         logger.debug(f"🔍 Getting patient for user: {self.request.user.id}")
//         try:
//             patient = self.request.user.patient_profile
//             logger.debug(f"✅ Patient found: {patient.id}")
//             return patient
//         except Exception as e:
//             logger.error(f"❌ Error getting patient: {str(e)}")
//             raise
    
//     def perform_create(self, serializer):
//         logger.debug("🚀 Starting perform_create")
//         patient = self.get_patient()
        
//         try:
//             with transaction.atomic():
//                 # Delete existing location if any
//                 existing_count = PatientLocation.objects.filter(patient=patient).count()
//                 logger.debug(f"📊 Found {existing_count} existing locations for patient {patient.id}")
                
//                 if existing_count > 0:
//                     deleted_count = PatientLocation.objects.filter(patient=patient).delete()[0]
//                     logger.debug(f"🗑️ Deleted {deleted_count} existing locations")
                
//                 # Create new location
//                 logger.debug(f"📍 Creating new location with data: {serializer.validated_data}")
//                 new_location = serializer.save(patient=patient)
//                 logger.debug(f"✅ New location created with ID: {new_location.id}")
                
//                 self._updated_location = new_location
                
//         except Exception as e:
//             logger.error(f"❌ Error in perform_create: {str(e)}")
//             logger.error(f"🔥 Traceback: {traceback.format_exc()}")
//             raise
    
//     def create(self, request, *args, **kwargs):
//         """Override create to provide custom response messages"""
//         logger.debug("="*50)
//         logger.debug("🎯 UpdatePatientLocationView.create() called")
//         logger.debug(f"👤 User: {request.user.id} ({request.user.username})")
//         logger.debug(f"📨 Request data: {request.data}")
//         logger.debug(f"🍪 Cookies: {request.COOKIES}")
//         logger.debug(f"🔐 Headers: {dict(request.headers)}")
        
//         try:
//             # Check if user is authenticated
//             if not request.user.is_authenticated:
//                 logger.error("❌ User is not authenticated")
//                 return Response({
//                     'message': 'Authentication required.',
//                     'data': None
//                 }, status=status.HTTP_401_UNAUTHORIZED)
            
//             # Check if user has patient profile
//             try:
//                 patient = request.user.patient_profile
//                 logger.debug(f"✅ Patient profile found: {patient.id}")
//             except Exception as e:
//                 logger.error(f"❌ No patient profile found: {str(e)}")
//                 return Response({
//                     'message': 'Patient profile not found for this user.',
//                     'data': None,
//                     'debug': str(e)
//                 }, status=status.HTTP_404_NOT_FOUND)
            
//             # Validate serializer
//             logger.debug("🔍 Validating serializer data...")
//             serializer = self.get_serializer(data=request.data)
            
//             if not serializer.is_valid():
//                 logger.error(f"❌ Serializer validation failed: {serializer.errors}")
//                 return Response({
//                     'message': 'Invalid data provided.',
//                     'data': None,
//                     'errors': serializer.errors,
//                     'debug': f"Received data: {request.data}"
//                 }, status=status.HTTP_400_BAD_REQUEST)
            
//             logger.debug(f"✅ Serializer validated. Clean data: {serializer.validated_data}")
            
//             # Perform the create logic
//             logger.debug("🔄 Calling perform_create...")
//             self.perform_create(serializer)
            
//             # Get the location data for response
//             logger.debug("📋 Preparing response data...")
//             location_data = PatientLocationSerializer(self._updated_location).data
//             logger.debug(f"✅ Location data prepared: {location_data}")
            
//             response_data = {
//                 'message': 'Location updated successfully.',
//                 'data': location_data
//             }
            
//             logger.debug(f"🎉 Success! Returning response: {response_data}")
//             return Response(response_data, status=status.HTTP_201_CREATED)
            
//         except ValidationError as e:
//             logger.error(f"❌ Validation error: {str(e)}")
//             return Response({
//                 'message': 'Validation error occurred.',
//                 'data': None,
//                 'errors': str(e),
//                 'debug': f"Request data: {request.data}"
//             }, status=status.HTTP_400_BAD_REQUEST)
            
//         except Exception as e:
//             logger.error(f"❌ Unexpected error in create(): {str(e)}")
//             logger.error(f"🔥 Full traceback: {traceback.format_exc()}")
//             return Response({
//                 'message': 'An unexpected error occurred.',
//                 'data': None,
//                 'error': str(e),
//                 'debug': {
//                     'user_id': request.user.id if request.user.is_authenticated else None,
//                     'request_data': request.data,
//                     'traceback': traceback.format_exc()
//                 }
//             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


// class CurrentPatientLocationView(generics.RetrieveAPIView):
//     """GET /patients/location/current/"""
//     serializer_class = PatientLocationSerializer
//     permission_classes = [IsAuthenticated]
    
//     def get_object(self):
//         logger.debug("🔍 Getting current location object")
//         try:
//             patient = self.request.user.patient_profile
//             logger.debug(f"✅ Patient found: {patient.id}")
//         except Exception as e:
//             logger.error(f"❌ Patient profile not found: {str(e)}")
//             raise Http404("Patient profile not found for this user")
        
//         location = PatientLocation.objects.filter(patient=patient).first()
        
//         if not location:
//             logger.warning(f"⚠️ No location found for patient {patient.id}")
//             raise Http404("No location found for this patient")
        
//         logger.debug(f"✅ Location found: {location.id}")
//         return location
    
//     def retrieve(self, request, *args, **kwargs):
//         """Override retrieve to provide custom response format"""
//         logger.debug("="*50)
//         logger.debug("🎯 CurrentPatientLocationView.retrieve() called")
//         logger.debug(f"👤 User: {request.user.id} ({request.user.username})")
        
//         try:
//             instance = self.get_object()
//             serializer = self.get_serializer(instance)
            
//             response_data = {
//                 'message': 'Current location retrieved successfully.',
//                 'data': serializer.data
//             }
            
//             logger.debug(f"✅ Success! Returning: {response_data}")
//             return Response(response_data, status=status.HTTP_200_OK)
            
//         except Http404 as e:
//             logger.warning(f"⚠️ 404 error: {str(e)}")
//             return Response({
//                 'message': str(e),
//                 'data': None
//             }, status=status.HTTP_404_NOT_FOUND)
            
//         except Exception as e:
//             logger.error(f"❌ Unexpected error in retrieve(): {str(e)}")
//             logger.error(f"🔥 Full traceback: {traceback.format_exc()}")
//             return Response({
//                 'message': 'An unexpected error occurred.',
//                 'data': None,
//                 'error': str(e),
//                 'debug': {
//                     'user_id': request.user.id if request.user.is_authenticated else None,
//                     'traceback': traceback.format_exc()
//                 }
//             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            

// class SearchNearbyDoctorsView(generics.ListAPIView):
//     """GET /search/nearby-doctors/ - Find nearby doctors based on patient location"""
//     serializer_class = DoctorLocationSerializer
//     permission_classes = [IsAuthenticated]
    
//     def calculate_distance(self, lat1, lng1, lat2, lng2):
//         """Calculate distance between two coordinates using Haversine formula"""
//         try:
//             lat1, lng1, lat2, lng2 = map(radians, [float(lat1), float(lng1), float(lat2), float(lng2)])
//             dlng = lng2 - lng1
//             dlat = lat2 - lat1
//             a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
//             c = 2 * asin(sqrt(a))
//             r = 6371  # Earth's radius in km
//             return c * r
//         except (ValueError, TypeError) as e:
//             logger.error(f"Error in distance calculation: {str(e)}")
//             return float('inf')  # Return large distance for invalid coordinates
    
//     def list(self, request, *args, **kwargs):
//         logger.debug("SearchNearbyDoctorsView.list() called")
//         logger.debug(f"User: {request.user.id} ({request.user.username})")
        
//         try:
//             # Get patient's current location
//             try:
//                 patient = request.user.patient_profile
//                 patient_location = PatientLocation.objects.filter(patient=patient).first()
                
//                 if not patient_location:
//                     logger.warning(f"No location found for patient {patient.id}")
//                     return Response({
//                         'message': 'Please update your location first to find nearby doctors.',
//                         'data': [],
//                         'count': 0
//                     }, status=status.HTTP_400_BAD_REQUEST)
                
//                 patient_lat = float(patient_location.latitude)
//                 patient_lng = float(patient_location.longitude)
//                 logger.debug(f"Patient location: {patient_lat}, {patient_lng}")
                
//             except Patient.DoesNotExist:
//                 logger.error("Patient profile not found")
//                 return Response({
//                     'message': 'Patient profile not found.',
//                     'data': [],
//                     'count': 0
//                 }, status=status.HTTP_404_NOT_FOUND)
//             except Exception as e:
//                 logger.error(f"Error getting patient location: {str(e)}")
//                 return Response({
//                     'message': 'Unable to get your location. Please update your location first.',
//                     'data': [],
//                     'count': 0,
//                     'error': str(e)
//                 }, status=status.HTTP_400_BAD_REQUEST)
            
//             # Get radius parameter
//             try:
//                 radius = float(request.GET.get('radius', 10))
//                 if radius <= 0:
//                     radius = 10
//             except (ValueError, TypeError):
//                 radius = 10
            
//             logger.debug(f"Searching within {radius}km radius")
            
        
//             try:
//                 doctor_locations = DoctorLocation.objects.filter(
//                     doctor__is_available=True,  # Use doctor's availability field
//                     doctor__user__is_active=True  # Check if user is active
//                 ).select_related('doctor', 'doctor__user')
                
                
                
//             except Exception as query_error:
//                 logger.error(f"Error in doctor query: {str(query_error)}")
//                 # Fallback to simpler query
//                 doctor_locations = DoctorLocation.objects.select_related(
//                     'doctor', 'doctor__user'
//                 ).filter(doctor__user__is_active=True)
            
//             logger.debug(f"Found {doctor_locations.count()} total active doctor locations")
            
//             # Calculate distances and filter by radius
//             nearby_locations = []
//             for location in doctor_locations:
//                 try:
//                     # Skip if doctor or user is None
//                     if not location.doctor or not location.doctor.user:
//                         continue
                        
//                     distance = self.calculate_distance(
//                         patient_lat, patient_lng,
//                         location.latitude, location.longitude
//                     )
                    
//                     if distance <= radius:
//                         location.distance = round(distance, 2)
//                         nearby_locations.append(location)
//                         logger.debug(f"Doctor {location.doctor.user.username} - {distance:.2f}km away")
//                     else:
//                         logger.debug(f"Doctor {location.doctor.user.username} - {distance:.2f}km away (outside radius)")
                        
//                 except Exception as e:
//                     logger.error(f"Error calculating distance for doctor {location.id}: {str(e)}")
//                     continue
            
//             # Sort by distance
//             nearby_locations.sort(key=lambda x: getattr(x, 'distance', float('inf')))
            
//             logger.debug(f"Found {len(nearby_locations)} doctors within {radius}km")
            
//             # Serialize the data
//             serializer = self.get_serializer(nearby_locations, many=True)
            
//             response_data = {
//                 'message': f'Found {len(nearby_locations)} doctors within {radius}km of your location.',
//                 'count': len(nearby_locations),
//                 'radius': radius,
//                 'patient_location': {
//                     'latitude': patient_lat,
//                     'longitude': patient_lng
//                 },
//                 'data': serializer.data
//             }
            
//             logger.debug(f"Success! Returning {len(nearby_locations)} nearby doctors")
//             return Response(response_data, status=status.HTTP_200_OK)
            
//         except Exception as e:
//             logger.error(f"Unexpected error in SearchNearbyDoctorsView: {str(e)}")
//             logger.error(f"Full traceback: {traceback.format_exc()}")
//             return Response({
//                 'message': 'An unexpected error occurred while searching for nearby doctors.',
//                 'data': [],
//                 'count': 0,
//                 'error': str(e)
//             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

