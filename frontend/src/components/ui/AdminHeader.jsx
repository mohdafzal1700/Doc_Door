import React, { useState } from 'react';
import { 
    Bell,
    ChevronDown,
    User,
    LogOut,
    Settings
} from 'lucide-react';
import { useNavigate } from "react-router-dom"
import { adminLogout } from '../../endpoints/adm';

const AdminHeader = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const navigate = useNavigate();

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
        <header className="bg-white border-b border-gray-200 h-16 fixed top-0 right-0 left-64 z-10 flex items-center justify-between px-8 shadow-sm">
            <div className="flex items-center">
                <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
            </div>
            
            <div className="flex items-center space-x-3">
                {/* Notification Bell */}
                <button className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200">
                    <Bell className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    </span>
                </button>
                
                {/* User Profile Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center space-x-3 p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 min-w-[120px]"
                    >
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-sm font-semibold text-white">A</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <span className="text-sm font-medium">Admin</span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                        </div>
                    </button>
                    
                    {showDropdown && (
                        <>
                            {/* Backdrop */}
                            <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setShowDropdown(false)}
                            />
                            
                            {/* Dropdown Menu */}
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20 transform transition-all duration-200 origin-top-right">
                                <div className="px-4 py-3 border-b border-gray-100">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                                            <span className="text-sm font-semibold text-white">A</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Admin</p>
                                            <p className="text-xs text-gray-500">Administrator</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="py-2">
                                    <button 
                                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                                        onClick={() => setShowDropdown(false)}
                                    >
                                        <User className="w-4 h-4" />
                                        <span>Profile</span>
                                    </button>
                                    
                                    <button 
                                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                                        onClick={() => setShowDropdown(false)}
                                    >
                                        <Settings className="w-4 h-4" />
                                        <span>Settings</span>
                                    </button>
                                </div>
                                
                                <div className="border-t border-gray-100 py-2">
                                    <button 
                                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default AdminHeader;