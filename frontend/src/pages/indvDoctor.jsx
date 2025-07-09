import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, MessageCircle, Calendar, GraduationCap, Phone, Mail, Clock, Award, User, Stethoscope, DollarSign, Globe } from "lucide-react";
import { getPatientDoctor,handleApiError } from '../endpoints/APIs'; 
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
        // Navigate to booking page or open modal
        navigate(`/patient/book-appointment/${id}`);
    };

    const handleSendMessage = () => {
        // Navigate to messaging or open chat
        navigate(`/patient/messages/${id}`);
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                <div className="animate-pulse">
                    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                        <div className="flex gap-8">
                            <div className="w-28 h-28 bg-gray-200 rounded-full"></div>
                            <div className="flex-1 space-y-4">
                                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Doctor Profile</h2>
                    <p className="text-red-600">{error}</p>
                    <button 
                        onClick={() => navigate('/patient/doctors')}
                        className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Back to Doctors
                    </button>
                </div>
            </div>
        );
    }

    if (!doctor) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Doctor Not Found</h2>
                    <p className="text-gray-600">The requested doctor profile could not be found.</p>
                </div>
            </div>
        );
    }

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

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            <Header/>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100">
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

                        {/* Doctor Info */}
                        <div className="flex-1 space-y-3">
                            <div className="space-y-2">
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {doctor.full_name || `Dr. ${doctor.doctor_first_name} ${doctor.doctor_last_name}`}
                                </h1>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {doctor.doctor_specialization && (
                                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                            {doctor.doctor_specialization}
                                        </span>
                                    )}
                                    {doctor.doctor_experience > 0 && (
                                        <span className="text-gray-500 text-sm">
                                            {doctor.doctor_experience}+ years experience
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

                            <div className="space-y-2">
                                {doctor.doctor_clinic_name && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                        <span>{doctor.doctor_clinic_name}</span>
                                    </div>
                                )}
                                
                                {doctor.doctor_location && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                        <span>{doctor.doctor_location}</span>
                                    </div>
                                )}

                                {doctor.email && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Mail className="w-4 h-4 text-gray-400" />
                                        <span>{doctor.email}</span>
                                    </div>
                                )}

                                {doctor.phone_number && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Phone className="w-4 h-4 text-gray-400" />
                                        <span>{doctor.phone_number}</span>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-2">
                                    <div className="flex">
                                        {renderStars(4.5)}
                                    </div>
                                    <span className="text-sm text-gray-600">4.5 (Based on reviews)</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 w-full md:w-auto">
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

            {/* Professional Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
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

                        {doctor.doctor_consultation_fee > 0 && (
                            <div className="space-y-1">
                                <h3 className="font-medium text-gray-900">Consultation Fee</h3>
                                <p className="text-gray-600 flex items-center gap-1">
                                    <DollarSign className="w-4 h-4" />
                                    ${doctor.doctor_consultation_fee}
                                </p>
                            </div>
                        )}

                        <div className="space-y-1">
                            <h3 className="font-medium text-gray-900">Consultation Modes</h3>
                            <div className="flex gap-2">
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

                        {doctor.member_since && (
                            <div className="space-y-1">
                                <h3 className="font-medium text-gray-900">Member Since</h3>
                                <p className="text-gray-600">{new Date(doctor.member_since).toLocaleDateString()}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bio Section */}
            {doctor.doctor_bio && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6">
                        <h2 className="text-lg font-semibold mb-4">About</h2>
                        <p className="text-gray-600 leading-relaxed">{doctor.doctor_bio}</p>
                    </div>
                </div>
            )}

            {/* Education Section */}
            {doctor.doctor_educations && doctor.doctor_educations.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6">
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
            )}

            {/* Certifications Section */}
            {doctor.doctor_certifications && doctor.doctor_certifications.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6">
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
            )}

            {/* Reviews Section - Placeholder */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Patient Reviews</h2>
                    <div className="space-y-4">
                        <div className="text-center py-8 text-gray-500">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>No reviews available yet.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}