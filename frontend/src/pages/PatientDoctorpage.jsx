import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, MessageCircle, Calendar, GraduationCap, Phone, Mail, Clock, Award, User, Stethoscope, DollarSign, Globe } from "lucide-react";
import { getPatientDoctor, handleApiError } from '../endpoints/APIs'; 
import Header from '../components/home/Header';

export default function PatientDoctor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [doctor, setDoctor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDoctor = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await getPatientDoctor(id);
                setDoctor(response.data);
            } catch (err) {
                const errorInfo = handleApiError(err);
                setError(errorInfo.message);
                console.error('Error fetching doctor:', err);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchDoctor();
        }
    }, [id]);

    const handleBookAppointment = () => {
        navigate(`/patient/appointmentBooking/${id}`);
    };

    const handleSendMessage = () => {
        navigate(`/patient/messages/${id}`);
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

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="animate-pulse space-y-8">
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="w-32 h-32 bg-gray-200 rounded-full self-center md:self-start"></div>
                            <div className="flex-1 space-y-4">
                                <div className="h-8 bg-gray-200 rounded w-2/3 md:w-1/3"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            </div>
                            <div className="flex flex-col gap-3 w-full md:w-48">
                                <div className="h-10 bg-gray-200 rounded"></div>
                                <div className="h-10 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl shadow-sm p-6 h-32"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Doctor Profile</h2>
                    <p className="text-red-600">{error}</p>
                    <button 
                        onClick={() => navigate('/patient/doctors')}
                        className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Back to Doctors
                    </button>
                </div>
            </div>
        );
    }

    if (!doctor) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Doctor Not Found</h2>
                    <p className="text-gray-600">The requested doctor profile could not be found.</p>
                    <button 
                        onClick={() => navigate('/patient/doctors')}
                        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Browse Doctors
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Main Profile Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 md:p-8">
                        <div className="flex flex-col lg:flex-row gap-8 items-start">
                            {/* Avatar Section */}
                            <div className="flex flex-col items-center w-full lg:w-auto">
                                <div className="relative">
                                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100">
                                        {doctor.profile_picture_url ? (
                                            <img 
                                                src={doctor.profile_picture_url} 
                                                alt={doctor.full_name} 
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600" style={{display: doctor.profile_picture_url ? 'none' : 'flex'}}>
                                            <User className="w-12 h-12" />
                                        </div>
                                    </div>
                                    <span className={`absolute -bottom-2 -right-2 ${doctor.doctor_is_available ? 'bg-green-500' : 'bg-gray-400'} text-white text-xs px-2 py-1 rounded-full shadow`}>
                                        {doctor.doctor_is_available ? 'Available' : 'Busy'}
                                    </span>
                                </div>
                                
                                {/* Action Buttons - Mobile */}
                                <div className="flex gap-3 mt-6 w-full lg:hidden">
                                    <button
                                        onClick={handleSendMessage}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        <span className="sr-only md:not-sr-only">Message</span>
                                    </button>
                                    <button
                                        onClick={handleBookAppointment}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Calendar className="w-4 h-4" />
                                        <span className="sr-only md:not-sr-only">Book</span>
                                    </button>
                                </div>
                            </div>

                            {/* Doctor Info */}
                            <div className="flex-1 space-y-4">
                                <div className="space-y-2">
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                                        {doctor.full_name || `Dr. ${doctor.doctor_first_name} ${doctor.doctor_last_name}`}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {doctor.doctor_department && (
                                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                                {doctor.doctor_department}
                                            </span>
                                        )}
                                        
                                        {doctor.doctor_experience >= 0 && (
                                            <span className="flex items-center gap-1 text-gray-600 text-sm">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                {doctor.doctor_experience === 0 ? "New practitioner" : `${doctor.doctor_experience}+ years experience`}
                                            </span>
                                        )}
                                        
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            doctor.doctor_verification_status === 'approved' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {doctor.doctor_verification_status === 'approved' ? 'Verified' : 'Pending Verification'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {doctor.doctor_clinic_name && (
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                                            <span>{doctor.doctor_clinic_name}</span>
                                        </div>
                                    )}
                                    
                                    {doctor.doctor_location && (
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                                            <span>{doctor.doctor_location}</span>
                                        </div>
                                    )}

                                    {doctor.email && (
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <Mail className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                                            <span className="break-all">{doctor.email}</span>
                                        </div>
                                    )}

                                    {doctor.phone_number && (
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <Phone className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                                            <span>{doctor.phone_number}</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <div className="flex">
                                        {renderStars(4.5)}
                                    </div>
                                    <span className="text-sm text-gray-600">4.8 (87 reviews)</span>
                                </div>
                            </div>

                            {/* Action Buttons - Desktop */}
                            <div className="hidden lg:flex flex-col gap-3 w-full lg:w-48">
                                <button
                                    onClick={handleSendMessage}
                                    className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Message
                                </button>
                                <button
                                    onClick={handleBookAppointment}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Calendar className="w-4 h-4" />
                                    Book Appointment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid Layout for Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Bio Section */}
                        {doctor.doctor_bio ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 md:p-8">
                                    <h2 className="text-lg font-semibold mb-4">About</h2>
                                    <p className="text-gray-600 leading-relaxed whitespace-pre-line">{doctor.doctor_bio}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 md:p-8">
                                    <h2 className="text-lg font-semibold mb-4">About</h2>
                                    <p className="text-gray-400 italic">No bio information available</p>
                                </div>
                            </div>
                        )}

                        {/* Professional Details */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-6 md:p-8">
                                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                    <Stethoscope className="w-5 h-5 text-blue-600" />
                                    Professional Details
                                </h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {doctor.doctor_license_number && (
                                        <div className="space-y-1">
                                            <h3 className="font-medium text-gray-900">License Number</h3>
                                            <p className="text-gray-600">{doctor.doctor_license_number}</p>
                                        </div>
                                    )}

                                    {doctor.doctor_consultation_fee > 0 ? (
                                        <div className="space-y-1">
                                            <h3 className="font-medium text-gray-900">Consultation Fee</h3>
                                            <p className="text-gray-600 flex items-center gap-1">
                                                <DollarSign className="w-4 h-4" />
                                                ${doctor.doctor_consultation_fee}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <h3 className="font-medium text-gray-900">Consultation Fee</h3>
                                            <p className="text-gray-600">Free</p>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <h3 className="font-medium text-gray-900">Consultation Modes</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {doctor.doctor_consultation_mode_online && (
                                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm flex items-center gap-1">
                                                    <Globe className="w-3 h-3" />
                                                    Online
                                                </span>
                                            )}
                                            {doctor.doctor_consultation_mode_offline && (
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    In-person
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {doctor.doctor_experience >= 0 && (
                                        <div className="space-y-1">
                                            <h3 className="font-medium text-gray-900">Experience</h3>
                                            <p className="text-gray-600">
                                                {doctor.doctor_experience === 0 
                                                    ? "New practitioner" 
                                                    : `${doctor.doctor_experience} years`}
                                            </p>
                                        </div>
                                    )}

                                    {doctor.doctor_date_of_birth && (
                                        <div className="space-y-1">
                                            <h3 className="font-medium text-gray-900">Age</h3>
                                            <p className="text-gray-600">
                                                {new Date().getFullYear() - new Date(doctor.doctor_date_of_birth).getFullYear()} years
                                            </p>
                                        </div>
                                    )}

                                    {doctor.doctor_gender && (
                                        <div className="space-y-1">
                                            <h3 className="font-medium text-gray-900">Gender</h3>
                                            <p className="text-gray-600 capitalize">{doctor.doctor_gender}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Education Section */}
                        {doctor.doctor_educations && doctor.doctor_educations.length > 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 md:p-8">
                                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                        <GraduationCap className="w-5 h-5 text-blue-600" />
                                        Education
                                    </h2>
                                    <div className="space-y-4">
                                        {doctor.doctor_educations.map((education, index) => (
                                            <div key={index} className="space-y-1">
                                                <h3 className="font-medium text-gray-900">{education.degree_name}</h3>
                                                <p className="text-blue-600">{education.institution_name}</p>
                                                <p className="text-gray-500 text-sm">{education.year_of_completion}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 md:p-8">
                                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                        <GraduationCap className="w-5 h-5 text-blue-600" />
                                        Education
                                    </h2>
                                    <p className="text-gray-400 italic">No education information available</p>
                                </div>
                            </div>
                        )}

                        {/* Certifications Section */}
                        {doctor.doctor_certifications && doctor.doctor_certifications.length > 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 md:p-8">
                                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                        <Award className="w-5 h-5 text-blue-600" />
                                        Certifications
                                    </h2>
                                    <div className="space-y-4">
                                        {doctor.doctor_certifications.map((cert, index) => (
                                            <div key={index} className="space-y-1">
                                                <h3 className="font-medium text-gray-900">{cert.certification_name}</h3>
                                                <p className="text-blue-600">{cert.issued_by}</p>
                                                <p className="text-gray-500 text-sm">{cert.year_of_issue}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 md:p-8">
                                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                        <Award className="w-5 h-5 text-blue-600" />
                                        Certifications
                                    </h2>
                                    <p className="text-gray-400 italic">No certifications available</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reviews Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 md:p-8">
                        <h2 className="text-lg font-semibold mb-4">Patient Reviews</h2>
                        <div className="space-y-4">
                            <div className="text-center py-8 text-gray-500">
                                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                <p>No reviews available yet.</p>
                                <button 
                                    className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                                    onClick={() => navigate(`/patient/write-review/${id}`)}
                                >
                                    Be the first to review
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}