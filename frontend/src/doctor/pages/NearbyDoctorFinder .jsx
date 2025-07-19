import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    MapPin, 
    Navigation, 
    User, 
    Stethoscope, 
    RefreshCw, 
    AlertCircle, 
    Star, 
    Phone,
    Clock,
    DollarSign,
    MapIcon,
    Filter,
    X
    } from 'lucide-react';
    import { 
    searchNearbyDoctors, 
    updatePatientLocation 
    } from '../../endpoints/APIs';

    // Fix for default markers in react-leaflet
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    // Enhanced custom icons
    const userIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTEiIGZpbGw9IiMzQjgyRjYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSIzIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNyAxNmMwLTIuNSAyLjI1LTUgNS01czUgMi41IDUgNSIgZmlsbD0id2hpdGUiLz4KPC9zdmc+',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
    className: 'user-marker'
    });

    const doctorIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTEiIGZpbGw9IiMxMEI5ODEiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMTIgN3YxME04IDEyaDhNMTQgOWgtNE0xNyAxNWgtMTAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    className: 'doctor-marker'
    });

    // Component to handle map updates
    const MapUpdater = ({ center, zoom }) => {
    const map = useMap();
    
    useEffect(() => {
        if (center) {
        map.setView(center, zoom);
        }
    }, [center, zoom, map]);
    
    return null;
    };

    const NearbyDoctorFinder = () => {
    const navigate = useNavigate();
    const [userLocation, setUserLocation] = useState(null);
    const [nearbyDoctors, setNearbyDoctors] = useState([]);
    const [filteredDoctors, setFilteredDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [mapCenter, setMapCenter] = useState([8.5241, 76.9366]);
    const [mapZoom, setMapZoom] = useState(13);
    const [locationUpdateLoading, setLocationUpdateLoading] = useState(false);
    const [searchRadius, setSearchRadius] = useState(10);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [filters, setFilters] = useState({
        specialization: '',
        minRating: 0,
        maxDistance: 50,
        availableOnly: false,
        onlineConsultation: false
    });
    
    const mapRef = useRef(null);
    const locationWatchId = useRef(null);
    const isInitialLoad = useRef(true);

    // Save location to backend with retry logic
    const saveLocationToBackend = async (location, retries = 3) => {
        try {
        console.log("💾 Saving location to backend...", location);
        const locationData = {
            latitude: location.lat,
            longitude: location.lng
        };
        
        const response = await updatePatientLocation(locationData);
        console.log("✅ Location saved successfully");
        return response;
        } catch (error) {
        console.error("❌ Failed to save location:", error);
        if (retries > 0) {
            setTimeout(() => saveLocationToBackend(location, retries - 1), 2000);
        }
        }
    };

    // Enhanced fetch nearby doctors with better error handling - FIXED to prevent infinite loops
    const fetchNearbyDoctors = useCallback(async (location, radius = 10) => {
        if (!location) {
        setError('Location is required to find nearby doctors');
        return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
        console.log("🔍 Fetching doctors for location:", location, "radius:", radius);
        const response = await searchNearbyDoctors(location.lat, location.lng, radius);
        
        console.log("📥 API response:", response);
        
        let doctorsData = [];
        
        // Enhanced response parsing
        if (response?.data?.data && Array.isArray(response.data.data)) {
            doctorsData = response.data.data;
        } else if (response?.data && Array.isArray(response.data)) {
            doctorsData = response.data;
        } else if (Array.isArray(response)) {
            doctorsData = response;
        } else {
            console.warn("⚠️ Unexpected response structure:", response);
            doctorsData = [];
        }
        
        // Validate and sanitize doctor data
        const validDoctors = doctorsData.filter(doctor => {
            return doctor && 
                doctor.latitude && 
                doctor.longitude && 
                !isNaN(parseFloat(doctor.latitude)) && 
                !isNaN(parseFloat(doctor.longitude));
        });
        
        console.log("👩‍⚕️ Valid doctors found:", validDoctors.length);
        setNearbyDoctors(validDoctors);
        setFilteredDoctors(validDoctors);
        
        if (validDoctors.length === 0) {
            setError(`No doctors found within ${radius}km. Try increasing the search radius.`);
        }
        
        } catch (err) {
        console.error('❌ Error fetching nearby doctors:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch nearby doctors';
        setError(`Unable to find doctors: ${errorMessage}`);
        setNearbyDoctors([]);
        setFilteredDoctors([]);
        } finally {
        setLoading(false);
        }
    }, []); // FIXED: Removed dependencies that caused infinite loops

    // Enhanced geolocation - FIXED to prevent automatic refetching
    const getCurrentLocation = useCallback((shouldFetchDoctors = true) => {
        setLocationUpdateLoading(true);
        setError(null);
        
        if (!navigator.geolocation) {
        setError('Geolocation is not supported by this browser.');
        setLocationUpdateLoading(false);
        return;
        }

        const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000 // Increased cache time to prevent frequent calls
        };

        const onSuccess = async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation = { lat: latitude, lng: longitude, accuracy };
        
        console.log("📍 Location updated:", newLocation);
        
        setUserLocation(newLocation);
        setMapCenter([latitude, longitude]);
        setMapZoom(15);
        
        // Save to backend
        saveLocationToBackend(newLocation);
        
        // Only fetch doctors if explicitly requested
        if (shouldFetchDoctors) {
            await fetchNearbyDoctors(newLocation, searchRadius);
        }
        
        setLocationUpdateLoading(false);
        };

        const onError = (err) => {
        console.error("❌ Geolocation error:", err);
        let errorMessage = 'Unable to get location';
        
        switch(err.code) {
            case err.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions.';
            break;
            case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
            case err.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }
        
        setError(errorMessage);
        setLocationUpdateLoading(false);
        };

        navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    }, [fetchNearbyDoctors, searchRadius]);

    // FIXED: Apply filters without causing re-renders
    const applyFilters = useCallback(() => {
        if (nearbyDoctors.length === 0) {
        setFilteredDoctors([]);
        return;
        }

        let filtered = [...nearbyDoctors];
        
        if (filters.specialization) {
        filtered = filtered.filter(doctor => 
            getDoctorSpecialization(doctor).toLowerCase().includes(filters.specialization.toLowerCase())
        );
        }
        
        if (filters.minRating > 0) {
        filtered = filtered.filter(doctor => getDoctorRating(doctor) >= filters.minRating);
        }
        
        if (filters.maxDistance < 50) {
        filtered = filtered.filter(doctor => {
            const distance = parseFloat(doctor.distance) || 0;
            return distance <= filters.maxDistance;
        });
        }
        
        if (filters.availableOnly) {
        filtered = filtered.filter(doctor => doctor.doctor_is_available !== false);
        }
        
        if (filters.onlineConsultation) {
        filtered = filtered.filter(doctor => doctor.doctor_consultation_mode_online === true);
        }
        
        setFilteredDoctors(filtered);
    }, [nearbyDoctors, filters]);

    // Handle doctor marker click
    const handleDoctorClick = useCallback((doctor) => {
        const doctorLat = parseFloat(doctor.latitude);
        const doctorLng = parseFloat(doctor.longitude);
        
        if (!isNaN(doctorLat) && !isNaN(doctorLng)) {
        setMapCenter([doctorLat, doctorLng]);
        setMapZoom(16);
        }
    }, []);

    // Navigate to doctor detail with validation
    const navigateToDoctorDetail = useCallback((doctor) => {
        console.log("🔍 Navigating to doctor:", doctor);
        
        const doctorId = doctor.doctor_id || doctor.id;
        console.log("🆔 Doctor ID:", doctorId);
        
        if (doctorId && doctorId !== 'null' && doctorId !== 'undefined') {
        navigate(`/patient/doctor/${doctorId}`);
        } else {
        setError("Unable to view doctor profile: Invalid doctor ID");
        setTimeout(() => setError(null), 3000);
        }
    }, [navigate]);

    // Manual refresh function
    const handleRefresh = useCallback(() => {
        if (userLocation) {
        fetchNearbyDoctors(userLocation, searchRadius);
        }
    }, [userLocation, searchRadius, fetchNearbyDoctors]);

    // Utility functions with better fallbacks
    const getDoctorImage = (doctor) => {
        const imageUrl = doctor.doctor_image || 
                        doctor.profile_picture || 
                        doctor.doctor?.profile_picture;
                        
        return imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iMjQiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4KPC9zdmc+';
    };

    const getDoctorName = (doctor) => {
        return doctor.doctor_name?.trim() || 
            doctor.name?.trim() || 
            `${doctor.doctor?.user?.first_name || ''} ${doctor.doctor?.user?.last_name || ''}`.trim() ||
            doctor.doctor?.name?.trim() ||
            'Unknown Doctor';
    };

    const getDoctorSpecialization = (doctor) => {
        return doctor.doctor_specialization || 
            doctor.specialization || 
            doctor.specialty || 
            doctor.doctor?.specialization || 
            'Not specified';
    };

    const getDoctorRating = (doctor) => {
        const rating = doctor.doctor_rating || doctor.rating || 0;
        return typeof rating === 'number' ? Math.round(rating * 10) / 10 : 0;
    };

    const getDoctorFee = (doctor) => {
        const fee = doctor.doctor_consultation_fee || doctor.consultation_fee || 0;
        return typeof fee === 'number' ? fee : parseFloat(fee) || 0;
    };

    const handleImageError = (e) => {
        e.target.src = getDoctorImage({});
    };

    // FIXED: Only run on mount, prevent automatic re-fetching
    useEffect(() => {
        if (isInitialLoad.current) {
        getCurrentLocation(true);
        isInitialLoad.current = false;
        }
    }, []); // Only run once on mount

    // FIXED: Apply filters only when filters or doctors change
    useEffect(() => {
        applyFilters();
    }, [nearbyDoctors, filters]); // Only depend on the actual data

    // Cleanup on unmount
    useEffect(() => {
        return () => {
        if (locationWatchId.current) {
            navigator.geolocation.clearWatch(locationWatchId.current);
        }
        };
    }, []);

    return (
        <div className="w-full h-screen bg-gray-100 relative overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-[1000] bg-white shadow-lg">
            <div className="p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Stethoscope className="h-6 w-6 text-blue-600" />
                Nearby Doctors
                </h1>
                <div className="flex gap-2">
                <button
                    onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    <Filter className="h-4 w-4" />
                    Filters
                </button>
                <button
                    onClick={() => getCurrentLocation()}
                    disabled={locationUpdateLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {locationUpdateLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                    <Navigation className="h-4 w-4" />
                    )}
                    Update Location
                </button>
                </div>
            </div>
            
            {/* Status Bar */}
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {userLocation ? (
                    <span className="text-green-600">Location: Active</span>
                ) : (
                    <span className="text-red-500">Location: Not set</span>
                )}
                </div>
                <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Found: {filteredDoctors.length}/{nearbyDoctors.length} doctors
                </div>
                {userLocation && userLocation.accuracy && (
                <div className="flex items-center gap-1 text-xs">
                    <span>Accuracy: ±{Math.round(userLocation.accuracy)}m</span>
                </div>
                )}
            </div>
            </div>
        </div>

        {/* Filter Panel */}
        {filterPanelOpen && (
            <div className="absolute top-20 left-4 right-4 z-[1001] bg-white rounded-lg shadow-xl border p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Filter Doctors</h3>
                <button
                onClick={() => setFilterPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                >
                <X className="h-5 w-5" />
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium mb-1">Specialization</label>
                <input
                    type="text"
                    placeholder="e.g., Cardiology"
                    value={filters.specialization}
                    onChange={(e) => setFilters({...filters, specialization: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                </div>
                
                <div>
                <label className="block text-sm font-medium mb-1">Min Rating</label>
                <select
                    value={filters.minRating}
                    onChange={(e) => setFilters({...filters, minRating: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value={0}>Any Rating</option>
                    <option value={3}>3+ Stars</option>
                    <option value={4}>4+ Stars</option>
                    <option value={4.5}>4.5+ Stars</option>
                </select>
                </div>
                
                <div>
                <label className="block text-sm font-medium mb-1">Max Distance ({filters.maxDistance}km)</label>
                <input
                    type="range"
                    min="1"
                    max="50"
                    value={filters.maxDistance}
                    onChange={(e) => setFilters({...filters, maxDistance: parseInt(e.target.value)})}
                    className="w-full"
                />
                </div>
                
                <div className="space-y-2">
                <label className="flex items-center gap-2">
                    <input
                    type="checkbox"
                    checked={filters.availableOnly}
                    onChange={(e) => setFilters({...filters, availableOnly: e.target.checked})}
                    className="rounded"
                    />
                    Available only
                </label>
                <label className="flex items-center gap-2">
                    <input
                    type="checkbox"
                    checked={filters.onlineConsultation}
                    onChange={(e) => setFilters({...filters, onlineConsultation: e.target.checked})}
                    className="rounded"
                    />
                    Online consultation
                </label>
                </div>
            </div>
            </div>
        )}

        {/* Error Message */}
        {error && (
            <div className="absolute top-28 left-4 right-4 z-[1000] bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button 
                onClick={() => setError(null)}
                className="text-red-700 hover:text-red-900 text-xl leading-none"
            >
                ×
            </button>
            </div>
        )}

        {/* Loading Overlay */}
        {loading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]">
            <div className="bg-white p-6 rounded-lg shadow-xl flex items-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-lg font-medium">Finding nearby doctors...</span>
            </div>
            </div>
        )}

        {/* Map */}
        <div className="absolute inset-0 pt-32 pb-64">
            <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            className="h-full w-full"
            ref={mapRef}
            >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            
            {/* User Location Marker */}
            {userLocation && (
                <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={userIcon}
                >
                <Popup>
                    <div className="p-3">
                    <h3 className="font-semibold text-blue-600 flex items-center gap-2 mb-2">
                        <User className="h-4 w-4" />
                        Your Location
                    </h3>
                    <div className="text-sm text-gray-600 space-y-1">
                        <p>Lat: {userLocation.lat.toFixed(6)}</p>
                        <p>Lng: {userLocation.lng.toFixed(6)}</p>
                        {userLocation.accuracy && (
                        <p>Accuracy: ±{Math.round(userLocation.accuracy)}m</p>
                        )}
                    </div>
                    </div>
                </Popup>
                </Marker>
            )}

            {/* Nearby Doctors Markers */}
            {filteredDoctors.map((doctor, index) => (
                <Marker
                key={doctor.doctor_id || doctor.id || index}
                position={[parseFloat(doctor.latitude), parseFloat(doctor.longitude)]}
                icon={doctorIcon}
                eventHandlers={{
                    click: () => handleDoctorClick(doctor),
                }}
                >
                <Popup className="doctor-popup">
                    <div className="p-4 min-w-[280px] max-w-sm">
                    {/* Doctor Header */}
                    <div className="flex items-start gap-3 mb-4">
                        <img 
                        src={getDoctorImage(doctor)} 
                        alt={getDoctorName(doctor)}
                        className="w-14 h-14 rounded-full object-cover border-2 border-green-200 flex-shrink-0"
                        onError={handleImageError}
                        />
                        <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-green-600 flex items-center gap-2 text-base">
                            <Stethoscope className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{getDoctorName(doctor)}</span>
                        </h3>
                        {getDoctorRating(doctor) > 0 && (
                            <div className="flex items-center gap-1 text-sm text-amber-600 mt-1">
                            <Star className="h-3 w-3 fill-current" />
                            <span>{getDoctorRating(doctor)}/5</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                            {doctor.doctor_is_available !== false && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                Available
                            </span>
                            )}
                            {doctor.doctor_consultation_mode_online && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                Online
                            </span>
                            )}
                        </div>
                        </div>
                    </div>
                    
                    {/* Doctor Details */}
                    <div className="text-sm text-gray-600 space-y-2 mb-4">
                        <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-gray-400" />
                        <span>{getDoctorSpecialization(doctor)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-gray-400" />
                        <span>{doctor.distance || 'Distance unknown'}</span>
                        </div>
                        {getDoctorFee(doctor) > 0 && (
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span>₹{getDoctorFee(doctor)} consultation</span>
                        </div>
                        )}
                        <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="truncate">{doctor.doctor_clinic_name || doctor.loc_name || 'Location not specified'}</span>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button 
                        onClick={() => navigateToDoctorDetail(doctor)}
                        className="flex-1 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                        View Profile
                        </button>
                        <button 
                        onClick={() => navigateToDoctorDetail(doctor)}
                        className="flex-1 bg-green-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                        Book Now
                        </button>
                    </div>
                    </div>
                </Popup>
                </Marker>
            ))}
            </MapContainer>
        </div>

        {/* Enhanced Doctors List Panel */}
        <div className="absolute bottom-0 left-0 right-0 bg-white shadow-2xl rounded-t-xl z-[1000] max-h-72 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-600" />
                Available Doctors Nearby
                <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full ml-2">
                    {filteredDoctors.length}
                </span>
                </h2>
                {nearbyDoctors.length !== filteredDoctors.length && (
                <span className="text-sm text-gray-500">
                    {filteredDoctors.length} of {nearbyDoctors.length} shown
                </span>
                )}
            </div>
            </div>
            
            <div className="overflow-y-auto max-h-64">
            {filteredDoctors.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                {loading ? 'Searching for doctors...' : 'No doctors match your filters. Try adjusting them.'}
                </div>
            ) : (
                <ul className="divide-y divide-gray-200">
                {filteredDoctors.map((doctor, index) => (
                    <li 
                    key={doctor.doctor_id || doctor.id || index}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigateToDoctorDetail(doctor)}
                    >
                    <div className="flex items-center gap-3">
                        {/* Doctor Image */}
                        <img 
                        src={getDoctorImage(doctor)} 
                        alt={getDoctorName(doctor)}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                        onError={handleImageError}
                        />
                        
                        {/* Doctor Info */}
                        <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div className="min-w-0">
                            <h3 className="font-medium text-gray-900 flex items-center gap-2 truncate">
                                {getDoctorName(doctor)}
                                {getDoctorRating(doctor) > 0 && (
                                <div className="flex items-center gap-1 text-sm text-amber-600 shrink-0">
                                    <Star className="h-3 w-3 fill-current" />
                                    <span className="text-xs">{getDoctorRating(doctor)}</span>
                                </div>
                                )}
                            </h3>
                            <p className="text-sm text-gray-500 truncate">
                                {getDoctorSpecialization(doctor)}
                            </p>
                            </div>
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2">
                            {doctor.distance ? `${parseFloat(doctor.distance).toFixed(1)} km` : 'Unknown'}
                            </span>
                        </div>
                        
                        {/* Additional Info */}
                        <div className="mt-1 flex flex-wrap gap-2">
                            {doctor.doctor_is_available !== false && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                                Available
                            </span>
                            )}
                            {doctor.doctor_consultation_mode_online && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                Online
                            </span>
                            )}
                            {getDoctorFee(doctor) > 0 && (
                            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
                                ₹{getDoctorFee(doctor)}
                            </span>
                            )}
                        </div>
                        
                        <p className="text-xs text-gray-400 mt-1 truncate">
                            {doctor.doctor_clinic_name || doctor.loc_name || 'Location not specified'}
                        </p>
                        </div>
                    </div>
                    </li>
                ))}
                </ul>
            )}
            </div>
        </div>
        </div>
    );
};

export default NearbyDoctorFinder;