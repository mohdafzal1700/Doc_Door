"use client"

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom'

import { Card, CardContent, CardFooter } from "../components/ui/card";
import Button from "../components/ui/Button";
import Header from '../components/home/Header';
import { Search, Star, MapPin, MessageCircle, Calendar, Loader2 } from "lucide-react";
import Input from "../components/ui/Input";
import { getPatientDoctors, handleApiError } from '../endpoints/APIs';

export default function FindDoctorPage() {
    const router = useNavigate();
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [specialtyFilter, setSpecialtyFilter] = useState("All");
    const [locationFilter, setLocationFilter] = useState("All");

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await getPatientDoctors();
                console.log('API Response:', response);
                
                // Check if response has the expected structure
                let doctorsData = []
                if (response.data) {
                    if (Array.isArray(response.data)) {
                        doctorsData = response.data
                    } else if (response.data.data && Array.isArray(response.data.data)) {
                        doctorsData = response.data.data
                    } else if (response.data.results && Array.isArray(response.data.results)) {
                        doctorsData = response.data.results
                    } else {
                        throw new Error('Invalid data format received from server')
                    }
                } else {
                    throw new Error('No data received from server')
                }
                
                const transformedDoctors = doctorsData.map(doctorData => {
                    console.log('Doctor Data:', doctorData);
                    
                    // Handle the flattened structure with doctor_ prefixed fields
                    if (!doctorData.id) {
                        console.warn('Doctor data missing ID:', doctorData)
                        return null
                    }
                    
                    return {
                        id: doctorData.id,
                        name: doctorData.full_name || 
                              `${doctorData.doctor_first_name || ''} ${doctorData.doctor_last_name || ''}`.trim() || 
                              doctorData.email || doctorData.username || 'Unknown Doctor',
                        specialty: doctorData.doctor_specialization || doctorData.doctor_department || 'General Practice',
                        rating: parseFloat(doctorData.doctor_rating) || 4.8,
                        reviewCount: parseInt(doctorData.doctor_reviews) || Math.floor(Math.random() * 200) + 50,
                        experience: doctorData.doctor_experience ? `${parseInt(doctorData.doctor_experience)}+ years` : 'N/A',
                        image: doctorData.profile_picture_url || "/default-doctor.png",
                        available: doctorData.doctor_is_available !== false,
                        consultation_fee: parseInt(doctorData.doctor_consultation_fee || 0),
                        consultation_mode_online: Boolean(doctorData.doctor_consultation_mode_online),
                        consultation_mode_offline: Boolean(doctorData.doctor_consultation_mode_offline),
                        clinic_name: doctorData.doctor_clinic_name || '',
                        location: doctorData.doctor_location || 'Location not specified',
                        verification_status: doctorData.doctor_verification_status || 'pending',
                        bio: doctorData.doctor_bio || '',
                        license_number: doctorData.doctor_license_number || '',
                        gender: doctorData.doctor_gender || '',
                        date_of_birth: doctorData.doctor_date_of_birth || '',
                        profile_completed: doctorData.profile_completed || false,
                        has_profile_picture: doctorData.has_profile_picture || false
                    }
                }).filter(doctor => doctor !== null);
                
                setDoctors(transformedDoctors);
            } catch (err) {
                const errorInfo = handleApiError(err);
                setError(errorInfo.message || 'Failed to load doctors. Please try again later.');
                console.error('Error fetching doctors:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDoctors();
    }, []);

    const handleBookAppointment = (doctorId) => {
        router(`/patient/doctor/${doctorId}`);
    };

    const handleSendMessage = (doctorId) => {
        router(`/messages/${doctorId}`);
    };

    const renderStars = (rating = 4.5) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;

        for (let i = 0; i < fullStars; i++) {
            stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
        }

        if (hasHalfStar) {
            stars.push(<Star key="half" className="w-4 h-4 fill-yellow-400 text-yellow-400 opacity-50" />);
        }

        const remainingStars = 5 - Math.ceil(rating);
        for (let i = 0; i < remainingStars; i++) {
            stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />);
        }

        return stars;
    };

    const filteredDoctors = doctors.filter(doctor => {
        const matchesSearch = (doctor.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesSpecialty = specialtyFilter === "All" || doctor.specialty === specialtyFilter;
        const matchesLocation = locationFilter === "All" || doctor.location === locationFilter;
        
        return matchesSearch && matchesSpecialty && matchesLocation;
    });

    // Extract unique specialties and locations for filters
    const specialties = ["All", ...new Set(doctors.map(doctor => doctor.specialty))];
    const locations = ["All", ...new Set(doctors.map(doctor => doctor.location))];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <Header title="Find Your Doctor" />
                <main className="container mx-auto px-4 py-8">
                    <div className="flex flex-col justify-center items-center py-20">
                        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
                        <span className="mt-4 text-gray-600 dark:text-gray-300 text-lg">Loading our medical specialists...</span>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">This may take a moment</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <Header title="Find Your Doctor" />
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center py-20">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
                            <div className="flex flex-col items-center">
                                <svg className="w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Unable to Load Doctors</h3>
                                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                                <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700 text-white">
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Header title="Find Your Doctor" />
            
            <main className="container mx-auto px-4 py-8">
                {/* Hero Section */}
                <section className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Find Your Doctor</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                        Book appointments with top doctors in your area
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor' : 'doctors'} available
                    </p>
                </section>

                {/* Search and Filter */}
                <section className="mb-8">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Search doctors by name or specialty..."
                                className="pl-10 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex gap-2 w-full md:w-auto">
                            <select 
                                value={specialtyFilter}
                                onChange={(e) => setSpecialtyFilter(e.target.value)}
                                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                {specialties.map(specialty => (
                                    <option key={specialty} value={specialty}>{specialty}</option>
                                ))}
                            </select>
                            
                            <select 
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                {locations.map(location => (
                                    <option key={location} value={location}>{location}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Doctors List */}
                {filteredDoctors.length === 0 ? (
                    <section className="text-center py-12">
                        <div className="max-w-md mx-auto">
                            <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">No Doctors Found</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                We couldn't find any doctors matching your criteria.
                            </p>
                            <Button 
                                variant="outline" 
                                className="mt-4"
                                onClick={() => {
                                    setSearchTerm("");
                                    setSpecialtyFilter("All");
                                    setLocationFilter("All");
                                }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </section>
                ) : (
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDoctors.map((doctor) => (
                            <div
                                key={doctor.id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 dark:border-gray-700"
                            >
                                <div className="p-6">
                                    {/* Doctor Image and Info */}
                                    <div className="flex items-start space-x-4 mb-4">
                                        {/* Doctor Image */}
                                        <div className="relative flex-shrink-0">
                                            <img
                                                src={doctor.image}
                                                alt={`Dr. ${doctor.name}`}
                                                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                                                onError={(e) => {
                                                    e.target.src = "/default-doctor.png"
                                                }}
                                            />
                                            
                                            {/* Availability Indicator */}
                                            {doctor.available ? (
                                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                                </div>
                                            ) : (
                                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-400 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                                </div>
                                            )}
                                            
                                            {/* Verification Badge */}
                                            {doctor.verification_status === 'approved' && (
                                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Doctor Details */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{doctor.name}</h3>
                                            <p className="text-purple-600 dark:text-purple-400 font-medium mb-2">{doctor.specialty}</p>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                                                <span>{doctor.experience}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-4 h-4" />
                                                    {doctor.location}
                                                </span>
                                            </div>
                                            <div className="flex items-center mb-2">
                                                {renderStars(doctor.rating)}
                                                <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                                                    ({doctor.reviewCount || 0} reviews)
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Consultation Info */}
                                    <div className="mb-4">
                                        {doctor.consultation_fee > 0 && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                Consultation: ₹{doctor.consultation_fee}
                                            </p>
                                        )}
                                        
                                        {/* Consultation Modes */}
                                        <div className="flex items-center space-x-2 mb-2">
                                            {doctor.consultation_mode_online && (
                                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                                                    Online
                                                </span>
                                            )}
                                            {doctor.consultation_mode_offline && (
                                                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                                                    In-person
                                                </span>
                                            )}
                                        </div>

                                        {/* Availability Status */}
                                        <div className="flex items-center space-x-2">
                                            <span className={`flex items-center text-sm ${doctor.available ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                <div className={`w-2 h-2 rounded-full mr-1 ${doctor.available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                                {doctor.available ? 'Available now' : 'Not available'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <Button 
                                            className={`flex-1 ${doctor.available ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'}`}
                                            onClick={() => handleBookAppointment(doctor.id)}
                                            disabled={!doctor.available}
                                        >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Book
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            className="flex-1"
                                            onClick={() => handleSendMessage(doctor.id)}
                                        >
                                            <MessageCircle className="mr-2 h-4 w-4" />
                                            Message
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                )}
            </main>
        </div>
    )
}