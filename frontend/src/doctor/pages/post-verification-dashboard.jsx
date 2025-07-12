import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import Button from "../../components/ui/Button";
import { isDoctorAuthenticated, clearAuthData } from '../../utils/auth';
import { 
    MapPin, 
    Plus, 
    Edit, 
    Trash2, 
    Navigation, 
    CheckCircle,
    X,
    Save,
    Loader2,
    AlertTriangle
} from "lucide-react";

import DocHeader from '../../components/ui/DocHeader';
import { 
    getDoctorLocations,
    createDoctorLocation, 
    updateDoctorLocation, 
    deleteDoctorLocation, 
    updateCurrentDoctorLocation  
} from '../../endpoints/Doc';

export default function DoctorLocationManager() {
    const [locations, setLocations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingLocation, setEditingLocation] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        latitude: '',
        longitude: '',
        loc_name: '',
        is_active: true,
        is_current: false
    });

    // Load locations on component mount
    useEffect(() => {
        loadLocations();
    }, []);

    const loadLocations = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            // Check if user is authenticated
            const isAuth = await isDoctorAuthenticated();
            if (!isAuth) {
                throw new Error('Authentication required. Please log in again.');
            }
        
            const data = await getDoctorLocations();
            console.log('API Response:', data); // Debug log
            
            // Handle different response formats
            if (data && Array.isArray(data)) {
                setLocations(data);
            } else if (data && data.results && Array.isArray(data.results)) {
                setLocations(data.results);
            } else if (data && data.data && Array.isArray(data.data)) {
                setLocations(data.data);
            } else {
                console.warn('Unexpected response format:', data);
                setLocations([]);
            }
            
        } catch (error) {
            console.error('Error loading locations:', error);
            
            // Set user-friendly error messages
            if (error.response) {
                switch (error.response.status) {
                    case 401:
                        setError('Authentication failed. Please log in again.');
                        clearAuthData();
                        break;
                    case 403:
                        setError('Access denied. You may not have permission to view locations.');
                        break;
                    case 404:
                        setError('Doctor profile not found. Please contact support.');
                        break;
                    case 500:
                        setError('Server error. Please try again later.');
                        break;
                    default:
                        setError(`Error loading locations: ${error.response.data?.error || 'Unknown error'}`);
                }
            } else if (error.message) {
                setError(error.message);
            } else {
                setError('Failed to load locations. Please check your connection.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            latitude: '',
            longitude: '',
            loc_name: '',
            is_active: true,
            is_current: false
        });
        setShowAddForm(false);
        setEditingLocation(null);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleGetCurrentLocation = async () => {
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setFormData(prev => ({
                            ...prev,
                            latitude: position.coords.latitude.toString(),
                            longitude: position.coords.longitude.toString()
                        }));
                    },
                    (error) => {
                        console.error('Geolocation error:', error);
                        alert('Could not get current location. Please enter manually.');
                    }
                );
            } else {
                alert('Geolocation is not supported by your browser. Please enter manually.');
            }
        } catch (error) {
            console.error('Error getting location:', error);
            alert('Could not get current location. Please enter manually.');
        }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.latitude || !formData.longitude) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            setIsSubmitting(true);
            
            const submitData = {
                ...formData,
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude)
            };

            console.log('Submitting data:', submitData); // Debug log

            if (editingLocation) {
                // Update existing location
                const result = await updateDoctorLocation(editingLocation.id, submitData);
                console.log('Update result:', result); // Debug log
                
                // Instead of manually updating state, reload all locations to ensure consistency
                await loadLocations();
                
            } else {
                // Create new location
                const result = await createDoctorLocation(submitData);
                console.log('Create result:', result); // Debug log
                
                // Instead of manually adding to state, reload all locations to ensure consistency
                await loadLocations();
            }

            resetForm();
            
        } catch (error) {
            console.error('Error saving location:', error);
            
            // More specific error handling
            if (error.response) {
                const errorMessage = error.response.data?.error || 
                                   error.response.data?.detail || 
                                   'Server error occurred';
                alert(`Error saving location: ${errorMessage}`);
            } else if (error.message) {
                alert(`Error saving location: ${error.message}`);
            } else {
                alert('Error saving location. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (location) => {
        setEditingLocation(location);
        setFormData({
            name: location.name,
            latitude: location.latitude.toString(),
            longitude: location.longitude.toString(),
            loc_name: location.loc_name || '',
            is_active: location.is_active,
            is_current: location.is_current
        });
        setShowAddForm(true);
    };

    const handleDelete = async (locationId) => {
    if (!confirm('Are you sure you want to delete this location?')) {
        return;
    }

    try {
        await deleteDoctorLocation(locationId);
        await loadLocations();
    } catch (error) {
        console.error('Error deleting location:', error);
        
        // Show specific error message from backend
        if (error.response && error.response.data) {
            const errorMessage = error.response.data.error || 
                            error.response.data.message || 
                            error.response.data.detail || 
                            'Unknown error occurred';
            alert(`Cannot delete location: ${errorMessage}`);
        } else {
            alert('Error deleting location. Please try again.');
        }
    }
};

    const handleSetCurrent = async (location) => {
        try {
            const updateData = {
                name: location.name,
                latitude: location.latitude,
                longitude: location.longitude,
                loc_name: location.loc_name || '',
                is_active: location.is_active,
                is_current: true
            };

            await updateCurrentDoctorLocation(updateData);
            
            // Reload locations to ensure consistency
            await loadLocations();
            
        } catch (error) {
            console.error('Error setting current location:', error);
            alert('Error setting current location. Please try again.');
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-6">
                <DocHeader/>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            <span>Loading locations...</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="space-y-6">
                <DocHeader/>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-center flex-col">
                            <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Locations</h3>
                            <p className="text-red-600 text-center mb-4">{error}</p>
                            <Button 
                                onClick={loadLocations}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Try Again
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <DocHeader/>
            
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center">
                                <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                                My Locations
                            </CardTitle>
                            <CardDescription>
                                Manage your practice locations and set your current location
                            </CardDescription>
                        </div>
                        <Button
                            onClick={() => setShowAddForm(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Location
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Add/Edit Form */}
            {showAddForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {editingLocation ? 'Edit Location' : 'Add New Location'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Location Name *
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., Main Clinic"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Address/Description
                                    </label>
                                    <input
                                        type="text"
                                        name="loc_name"
                                        value={formData.loc_name}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., Thiruvananthapuram Medical Center"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Latitude *
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        name="latitude"
                                        value={formData.latitude}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., 8.5241"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Longitude *
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        name="longitude"
                                        value={formData.longitude}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., 76.9366"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                <Button
                                    variant="outline"
                                    onClick={handleGetCurrentLocation}
                                    className="flex items-center"
                                >
                                    <Navigation className="w-4 h-4 mr-2" />
                                    Get Current Location
                                </Button>
                                
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="is_current"
                                        checked={formData.is_current}
                                        onChange={handleInputChange}
                                        className="mr-2"
                                    />
                                    Set as current location
                                </label>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <Button
                                    variant="outline"
                                    onClick={resetForm}
                                    disabled={isSubmitting}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    {editingLocation ? 'Update' : 'Save'} Location
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Locations List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locations.map((location) => (
                    <Card key={location.id} className={`${location.is_current ? 'ring-2 ring-blue-500' : ''}`}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center">
                                    <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                                    {location.name}
                                </CardTitle>
                                {location.is_current && (
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Current
                                    </span>
                                )}
                            </div>
                            {location.loc_name && (
                                <CardDescription>{location.loc_name}</CardDescription>
                            )}
                        </CardHeader>
                        <CardContent className="pb-3">
                            <div className="text-sm text-gray-600 space-y-1">
                                <div>Lat: {location.latitude}</div>
                                <div>Lng: {location.longitude}</div>
                                <div className="text-xs text-gray-500">
                                    Updated: {new Date(location.updated_at).toLocaleDateString()}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between pt-3">
                            <div className="flex space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(location)}
                                    className="text-blue-600 hover:bg-blue-50"
                                >
                                    <Edit className="w-3 h-3 mr-1" />
                                    Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(location.id)}
                                    className="text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                </Button>
                            </div>
                            {!location.is_current && (
                                <Button
                                    size="sm"
                                    onClick={() => handleSetCurrent(location)}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    Set Current
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {locations.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No locations found</h3>
                        <p className="text-gray-600 mb-4">
                            Add your first location to get started managing your practice locations.
                        </p>
                        <Button
                            onClick={() => setShowAddForm(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Your First Location
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}