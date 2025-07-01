import React from 'react';
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

    // Reusable Doctor Sidebar Component
    const DoctorSidebar = ({ activeMenuItem = 'Profile' }) => {
    const menuItems = [
        { name: 'Profile', icon: User, href: '/doctor/portal' },
        { name: 'Dashboard', icon: LayoutDashboard, href: '/doctor/education' },
        { name: 'Service & Slots', icon: Calendar, href: '#' },
        { name: 'Subscriptions', icon: CreditCard, href: '#' },
        { name: 'Qualifications', icon: Award, href: '#' },
        { name: 'Review and Ratings', icon: Star, href: '#' },
        { name: 'Password Change', icon: Lock, href: '#' },
        { name: 'Logout', icon: LogOut, href: '#' }
    ];

    return (
        <aside className="w-64 bg-white shadow-sm min-h-screen">
        {/* Doctor Info */}
        <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full overflow-hidden">
                <img 
                src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face" 
                alt="Dr. Bony Johnson" 
                className="w-full h-full object-cover"
                />
            </div>
            <div>
                <h3 className="font-semibold text-gray-900">Dr. Bony Johnson</h3>
                <p className="text-sm text-gray-600">Cardiologist</p>
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

export default DoctorSidebar