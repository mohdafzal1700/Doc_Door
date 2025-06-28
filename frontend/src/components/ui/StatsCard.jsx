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


const StatsCard = ({ title, value, change, icon: Icon, color }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
            <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            <p className={`text-sm mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? '+' : ''}{change}% from last month
            </p>
            </div>
            <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6 text-white" />
            </div>
        </div>
        </div>
    );
    };


export default StatsCard