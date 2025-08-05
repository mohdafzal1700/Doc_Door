import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    FileText,
    UserCheck,
    Calendar,
    Briefcase,
    Building2,
    Bell,
    Settings,
    ChevronDown,
    Activity,
    TrendingUp,
    Clock,
    DollarSign
} from 'lucide-react';

// Sidebar Component
const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Get current active item based on current route
    const getCurrentActiveItem = () => {
        const path = location.pathname;
        if (path === '/' || path === '/dashboard') return 'dashboard';
        if (path === '/doctorspage') return 'doctors';
        if (path === '/doctorapplications') return 'applications';
        if (path === '/patientspage') return 'patients';
        if (path === '/admin/appointmentDashboard') return 'appointments';
        if (path === '/admin/Plan') return 'plans';
        if (path === '/departments') return 'departments';
        return 'dashboard';
    };

    const activeItem = getCurrentActiveItem();

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { id: 'doctors', label: 'Doctors', icon: Users, path: '/doctorspage' },
        { id: 'applications', label: 'Applications', icon: FileText, path: '/doctorapplications' },
        { id: 'patients', label: 'Patients', icon: UserCheck, path: '/patientspage' },
        { id: 'appointments', label: 'Appointments', icon: Calendar, path: '/admin/appointmentDashboard' },
        { id: 'plans', label: 'Plans', icon: Briefcase, path: '/admin/Plan' },
        { id: 'departments', label: 'Departments', icon: Building2, path:"/adminREviewPage"  },
    ];

    const handleNavigation = (path) => {
        navigate(path);
    };

    return (
        <div className="w-64 bg-slate-800 text-white h-screen fixed left-0 top-0 overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
                <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            </div>
            
            <nav className="mt-6">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNavigation(item.path)}
                            className={`w-full flex items-center px-6 py-3 text-left hover:bg-slate-700 transition-colors ${
                                activeItem === item.id ? 'bg-slate-700 border-r-2 border-purple-500' : ''
                            }`}
                        >
                            <Icon className="w-5 h-5 mr-3" />
                            <span className="text-sm">{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default Sidebar;