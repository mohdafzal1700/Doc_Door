import React, { useState, useEffect } from 'react';
import {
    User,
    LayoutDashboard,
    Calendar,
    CreditCard,
    Award,
    Star,
    Lock,
    LogOut,
    Mail,
    Phone,
    Building2,
    Stethoscope,
    Clock,
    Shield,
    Edit
} from 'lucide-react';
import { getDoctorProfile } from '../../endpoints/Doc'; // Added the missing import

// Reusable Doctor Sidebar Component
const DoctorSidebar = ({ initialActiveMenuItem = 'Profile' }) => {
    const [activeMenuItem, setActiveMenuItem] = useState(initialActiveMenuItem);
    const [doctorData, setDoctorData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const menuItems = [
        { name: 'Profile', icon: User, href: '/doctor/portal' },
        { name: 'Dashboard', icon: LayoutDashboard, href: '/doctor/dashboard' },
        { name: 'Service & Slots', icon: Calendar, href: '/doctor/schedule' },
        { name: 'Subscriptions', icon: CreditCard, href: '/doctor/currentSubscription'},
        { name: 'Qualifications', icon: Award, href: '/doctor/education' },
        { name: 'Review and Ratings', icon: Star, href: '/doctor/review'  },
        { name: 'Password Change', icon: Lock, href:'/doctor/appointmentsRequest' },
        { name: 'Logout', icon: LogOut, href: '#' }
    ];

    const handleMenuClick = (itemName) => {
        setActiveMenuItem(itemName);
    };

    const fetchDoctorProfile = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getDoctorProfile();
            
            if (response.data && response.data.success) {
                setDoctorData(response.data.data);
            } else {
                setError('Failed to fetch profile data');
            }
        } catch (err) {
            console.error('Error fetching doctor profile:', err);
            setError('Error loading profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctorProfile();
    }, []);

    useEffect(() => {
        const currentPath = window.location.pathname;
        const currentItem = menuItems.find(item => item.href === currentPath);
        if (currentItem) {
            setActiveMenuItem(currentItem.name);
        }
    }, []);

    // Helper functions to get dynamic data
    const getDoctorName = () => {
        if (!doctorData) return 'Loading...';
        return `${doctorData.doctor_first_name} ${doctorData.doctor_last_name}` || doctorData.full_name || 'Doctor';
    };

    const getDoctorSpecialization = () => {
        if (!doctorData) return 'Loading...';
        return doctorData.doctor_specialization || doctorData.doctor_department || 'General Practitioner';
    };

    const getProfileImage = () => {
        if (!doctorData) return "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face";
        return doctorData.profile_picture_url || "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face";
    };

    return (
        <aside className="w-64 bg-white shadow-sm min-h-screen">
            {/* Doctor Info */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                        <img
                            src={getProfileImage()}
                            alt={`Dr. ${getDoctorName()}`}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Dr. {getDoctorName()}</h3>
                        <p className="text-sm text-gray-600">{getDoctorSpecialization()}</p>
                    </div>
                </div>
            </div>

            {/* Navigation Menu */}
            <nav className="p-4">
                <ul className="space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeMenuItem === item.name;
                        
                        return (
                            <li key={item.name}>
                                <a
                                    href={item.href}
                                    onClick={(e) => {
                                        handleMenuClick(item.name);
                                    }}
                                    className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                                        isActive
                                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className={isActive ? 'font-medium' : ''}>{item.name}</span>
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </aside>
    );
};

export default DoctorSidebar;