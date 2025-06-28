import AdminHeader from "../components/ui/AdminHeader";
import Sidebar from "../components/ui/Sidebar";
import StatsCard from "../components/ui/StatsCard";
import RecentActivity from "../components/ui/jpj";
import QuickActions from "../components/ui/QuickActions";
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



const Dashboard = () => {
    const [activeItem, setActiveItem] = useState('dashboard');


    

    return (
        <div className="bg-gray-50 min-h-screen">
        <Sidebar activeItem={activeItem} setActiveItem={setActiveItem} />
        <AdminHeader />
        
        <main className="ml-64 pt-16 p-6">
            <div className="max-w-7xl mx-auto">
            {/* Welcome Section */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Welcome back, Admin!</h1>
                <p className="text-gray-600 mt-1">Here's what's happening with your healthcare system today.</p>
            </div>

            {/* Stats Grid */}
            {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatsCard
                title="Total Patients"
                value="2,847"
                change={12}
                icon={UserCheck}
                color="bg-blue-500"
                />
                <StatsCard
                title="Active Doctors"
                value="156"
                change={8}
                icon={Users}
                color="bg-green-500"
                />
                <StatsCard
                title="Appointments Today"
                value="89"
                change={-3}
                icon={Calendar}
                color="bg-purple-500"
                />
                <StatsCard
                title="Revenue"
                value="$45,890"
                change={15}
                icon={DollarSign}
                color="bg-orange-500"
                />
            </div> */}

        
            {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
                <div className="lg:col-span-2">
                <RecentActivity />
                </div>
                
            
                <div>
                <QuickActions />
                </div>
            </div> */}

            {/* Additional Charts Section */}
            {/* <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Appointments</h3>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center">
                    <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Chart visualization would go here</p>
                    </div>
                </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Performance</h3>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Performance metrics would go here</p>
                    </div>
                </div>
                </div> */}
            
            </div>
        </main>
        </div>
    );
    };

    export default Dashboard;