import React, { useState } from 'react';
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

const QuickActions = () => {
    const actions = [
        { label: 'Add New Doctor', icon: Users, color: 'bg-blue-500 hover:bg-blue-600' },
        { label: 'Schedule Appointment', icon: Calendar, color: 'bg-green-500 hover:bg-green-600' },
        { label: 'View Reports', icon: FileText, color: 'bg-purple-500 hover:bg-purple-600' },
        { label: 'Manage Departments', icon: Building2, color: 'bg-orange-500 hover:bg-orange-600' },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
            {actions.map((action, index) => {
            const Icon = action.icon;
            return (
                <button
                key={index}
                className={`p-4 rounded-lg text-white transition-colors ${action.color} flex items-center justify-center space-x-2`}
                >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{action.label}</span>
                </button>
            );
            })}
        </div>
        </div>
    );
    };

export default QuickActions