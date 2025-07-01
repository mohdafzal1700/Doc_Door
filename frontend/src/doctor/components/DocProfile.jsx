import React, { useState, useEffect } from 'react';
import { 
    User, 
    Mail,
    Phone,
    Clock,
    Shield,
    AlertCircle,
    Loader,
    Calendar,
    Stethoscope,
    MapPin,
    CheckCircle,
    GraduationCap,
    Edit,
    BriefcaseMedical,
    BadgeDollarSign,
    ShieldCheck,
    Building2,
    ClipboardList
} from 'lucide-react';
import { getDoctorProfile } from '../../endpoints/Doc';
import DocHeader from '../../components/ui/DocHeader';
import DoctorSidebar from '../../components/ui/DocSide';
import { useNavigate } from 'react-router-dom';

const DoctorProfilePage = () => {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate()

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                const response = await getDoctorProfile();
                
                if (response.data?.data) {
                    setProfile(response.data.data);
                } else {
                    setError('No profile data found');
                }
            } catch (err) {
                setError('Failed to load profile. Please try again.');
                console.error('Error fetching profile:', err);
                
                if (err?.response?.status === 404) {
                    setError('Profile not found');
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleEditProfile = () => {
        navigate('/doctor/editProfile')
        console.log('Edit profile clicked');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex items-center space-x-2">
                    <Loader className="w-6 h-6 animate-spin text-purple-600" />
                    <span className="text-gray-600">Loading profile...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-sm">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-sm">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600">No profile data available</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <DocHeader/>
            
            <div className="flex">
                <DoctorSidebar/>
                
                <div className="flex-1 p-6">
                    <div className="max-w-6xl mx-auto">
                        {/* Profile Header Card */}
                        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-purple-100">
                                    {profile.profile_picture_url ? (
                                        <img 
                                            src={profile.profile_picture_url}
                                            alt={profile.full_name || 'Doctor profile'} 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-purple-50 flex items-center justify-center">
                                            <User className="w-16 h-16 text-purple-400" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 text-center md:text-left">
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                                        {profile.full_name || 'Dr. [Name]'}
                                    </h1>
                                    {(profile.doctor_specialization || profile.doctor_department) && (
                                        <p className="text-lg text-purple-600 font-medium mb-3">
                                            {profile.doctor_specialization || profile.doctor_department}
                                        </p>
                                    )}
                                    
                                    <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-4">
                                        <div className="flex items-center bg-purple-50 px-3 py-1 rounded-full">
                                            <ShieldCheck className="w-4 h-4 text-purple-600 mr-1" />
                                            <span className="text-xs font-medium text-purple-700">
                                                {profile.doctor_verification_status === 'verified' ? 'Verified' : 'Pending Verification'}
                                            </span>
                                        </div>
                                        <div className="flex items-center bg-purple-50 px-3 py-1 rounded-full">
                                            <BriefcaseMedical className="w-4 h-4 text-purple-600 mr-1" />
                                            <span className="text-xs font-medium text-purple-700">
                                                {profile.doctor_experience ? `${profile.doctor_experience} years exp` : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center bg-purple-50 px-3 py-1 rounded-full">
                                            <BadgeDollarSign className="w-4 h-4 text-purple-600 mr-1" />
                                            <span className="text-xs font-medium text-purple-700">
                                                {profile.doctor_consultation_fee ? `$${profile.doctor_consultation_fee}` : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column - Personal Info */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* About Section */}
                                {profile.doctor_bio && (
                                    <div className="bg-white rounded-xl shadow-sm p-6">
                                        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                                            <ClipboardList className="w-5 h-5 text-purple-600 mr-2" />
                                            About
                                        </h2>
                                        <p className="text-gray-700 leading-relaxed">
                                            {profile.doctor_bio}
                                        </p>
                                    </div>
                                )}

                                {/* Contact & Professional Info */}
                                <div className="bg-white rounded-xl shadow-sm p-6">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-start">
                                            <Mail className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Email</p>
                                                <p className="text-gray-900">{profile.email || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <Phone className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Phone</p>
                                                <p className="text-gray-900">{profile.phone_number || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <Calendar className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                                                <p className="text-gray-900">{formatDate(profile.doctor_date_of_birth)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <User className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Gender</p>
                                                <p className="text-gray-900">{profile.doctor_gender || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Practice Details */}
                                <div className="bg-white rounded-xl shadow-sm p-6">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Practice Details</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-start">
                                            <Stethoscope className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Specialization</p>
                                                <p className="text-gray-900">
                                                    {profile.doctor_specialization || profile.doctor_department || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <BriefcaseMedical className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Experience</p>
                                                <p className="text-gray-900">
                                                    {profile.doctor_experience ? `${profile.doctor_experience} years` : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <Shield className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">License Number</p>
                                                <p className="text-gray-900">{profile.doctor_license_number || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <BadgeDollarSign className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Consultation Fee</p>
                                                <p className="text-gray-900">
                                                    {profile.doctor_consultation_fee ? `$${profile.doctor_consultation_fee}` : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Additional Info */}
                            <div className="space-y-6">
                                {/* Availability */}
                                <div className="bg-white rounded-xl shadow-sm p-6">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Availability</h2>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-700">Current Status</span>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            profile.doctor_is_available 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {profile.doctor_is_available ? 'Available' : 'Not Available'}
                                        </span>
                                    </div>
                                </div>

                                {/* Consultation Modes */}
                                <div className="bg-white rounded-xl shadow-sm p-6">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Consultation Modes</h2>
                                    <div className="space-y-3">
                                        <div className="flex items-center">
                                            <CheckCircle 
                                                className={`w-5 h-5 mr-3 ${
                                                    profile.doctor_consultation_mode_online 
                                                        ? 'text-green-500' 
                                                        : 'text-gray-300'
                                                }`} 
                                            />
                                            <span className="text-gray-700">Online Consultation</span>
                                        </div>
                                        <div className="flex items-center">
                                            <CheckCircle 
                                                className={`w-5 h-5 mr-3 ${
                                                    profile.doctor_consultation_mode_offline 
                                                        ? 'text-green-500' 
                                                        : 'text-gray-300'
                                                }`} 
                                            />
                                            <span className="text-gray-700">In-Person Consultation</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Clinic Information */}
                                <div className="bg-white rounded-xl shadow-sm p-6">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Clinic Information</h2>
                                    <div className="space-y-3">
                                        <div className="flex items-start">
                                            <Building2 className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Clinic Name</p>
                                                <p className="text-gray-900">{profile.doctor_clinic_name || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <MapPin className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Location</p>
                                                <p className="text-gray-900">{profile.doctor_location || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Account Details */}
                                <div className="bg-white rounded-xl shadow-sm p-6">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Details</h2>
                                    <div className="space-y-3">
                                        <div className="flex items-start">
                                            <Clock className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Member Since</p>
                                                <p className="text-gray-900">{formatDate(profile.member_since)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <Clock className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Last Login</p>
                                                <p className="text-gray-900">{formatDate(profile.last_login_date)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Edit Button */}
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleEditProfile}
                                className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md"
                            >
                                <Edit className="w-5 h-5" />
                                <span>Edit Profile</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorProfilePage;