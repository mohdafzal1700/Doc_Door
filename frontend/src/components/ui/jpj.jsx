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
// Recent Activity Component
const RecentActivity = () => {
    const activities = [
        { id: 1, action: 'New patient registered', user: 'Dr. Smith', time: '2 hours ago', type: 'patient' },
        { id: 2, action: 'Appointment scheduled', user: 'Dr. Johnson', time: '3 hours ago', type: 'appointment' },
        { id: 3, action: 'Medical report uploaded', user: 'Dr. Williams', time: '5 hours ago', type: 'report' },
        { id: 4, action: 'New doctor application', user: 'System', time: '1 day ago', type: 'application' },
        { id: 5, action: 'Department updated', user: 'Admin', time: '2 days ago', type: 'department' },
    ];

    const getActivityIcon = (type) => {
        switch (type) {
        case 'patient': return <UserCheck className="w-4 h-4 text-blue-500" />;
        case 'appointment': return <Calendar className="w-4 h-4 text-green-500" />;
        case 'report': return <FileText className="w-4 h-4 text-purple-500" />;
        case 'application': return <Users className="w-4 h-4 text-orange-500" />;
        default: return <Activity className="w-4 h-4 text-gray-500" />;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
            {activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-3">
                <div className="p-2 bg-gray-50 rounded-full">
                {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                <p className="text-xs text-gray-500">by {activity.user}</p>
                </div>
                <div className="text-xs text-gray-400 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {activity.time}
                </div>
            </div>
            ))}
        </div>
        </div>
    );
    };


export default RecentActivity