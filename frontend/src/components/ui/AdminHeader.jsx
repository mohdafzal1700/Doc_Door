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
import { useNavigate } from "react-router-dom"
import { adminLogout } from '../../endpoints/adm';




const AdminHeader = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const navigate=useNavigate()

    const handleLogout = async () => {
    try {
        const success = await adminLogout()
        
        if (success) {
            console.log('✅ Admin logout successful')
        } else {
            console.log('⚠️ Backend logout failed, but clearing local data anyway')
        }
        
    } catch (error) {
        console.error("❌ Admin logout error:", error)
    } finally {
        // Always clear tokens and redirect, regardless of backend response
        localStorage.removeItem('admin_access_token')
        localStorage.removeItem('admin_user_details')
        navigate('/adminloginpage')
    }
}

    return (
        <header className="bg-slate-900 text-white h-16 fixed top-0 right-0 left-64 z-10 flex items-center justify-between px-6 border-b border-slate-700">
        <div>
            <h2 className="text-lg font-semibold">Dashboard</h2>
        </div>
        
        <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>
            
            {/* <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
            </button> */}
            
            <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">A</span>
                </div>
                <span className="text-sm">Admin</span>
                <ChevronDown className="w-4 h-4" />
            </button>
            
            {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profile</a>
                {/* <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Settings</a> */}
                <hr className="my-1" />
                <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={handleLogout}>Logout</a>
                </div>
            )}
            </div>
        </div>
        </header>
    );
    };

export default AdminHeader