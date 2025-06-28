import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield, User, Lock } from 'lucide-react';
import { adminLogin ,adminLogout } from '../endpoints/adm'; // Your API endpoints
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate=useNavigate()

    // Check if already authenticated on mount
    useEffect(() => {
        const adminToken = localStorage.getItem('admin_access_token');
        const adminUser = localStorage.getItem('admin_user_details');
        
        if (adminToken && adminUser) {
            try {
                const user = JSON.parse(adminUser);
                setSuccess(`Welcome back, ${user.name || user.email}!`);
                navigate('/dashboard');
            } catch (err) {
                // Clear invalid data
                localStorage.removeItem('admin_access_token');
                localStorage.removeItem('admin_user_details');
            }
        }
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear errors when user starts typing
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.email || !formData.password) {
            setError('Please enter both email and password');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            console.log('🔍 Admin login attempt:', { email: formData.email });
            
            // Use your adminLogin endpoint
            const response = await adminLogin({
                email: formData.email,
                password: formData.password,
                user_type: 'admin'
            });
            navigate('/dashboard')

            console.log('✅ Admin login response:', response.data);

            if (response.data) {
                // Store admin data based on your API response structure
                const adminData = {
                    id: response.data.user?.id || response.data.id,
                    email: response.data.user?.email || response.data.email || formData.email,
                    name: response.data.user?.name || response.data.name,
                    role: response.data.user?.role || 'admin',
                    isAdmin: true
                };

                // Store in localStorage (your interceptor checks this)
                if (response.data.access_token) {
                    localStorage.setItem('admin_access_token', response.data.access_token);
                }
                localStorage.setItem('admin_user_details', JSON.stringify(adminData));

                setSuccess(`Welcome ${adminData.name || adminData.email}! Redirecting to dashboard...`);
                
                // Clear form
                setFormData({ email: '', password: '' });
                
                // In real app, navigate to admin dashboard
                setTimeout(() => {
                    // window.location.href = '/admin/dashboard';
                    console.log('Would navigate to admin dashboard');
                }, 1500);
            }

        } catch (err) {
            console.error('❌ Admin login error:', err);
            
            let errorMessage = 'Login failed. Please try again.';
            
            if (err.response?.data) {
                const { status, data } = err.response;
                
                if (status === 401) {
                    errorMessage = 'Invalid admin credentials';
                } else if (status === 403) {
                    errorMessage = 'Access denied. Admin privileges required.';
                } else if (data.detail) {
                    errorMessage = data.detail;
                } else if (data.message) {
                    errorMessage = data.message;
                } else if (data.non_field_errors) {
                    errorMessage = data.non_field_errors[0];
                }
            } else if (err.request) {
                errorMessage = 'Network error. Please check your connection.';
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            // Call your adminLogout endpoint
            await adminLogout();
        } catch (error) {
            console.error('Logout error:', error);
            // Continue with cleanup even if API call fails
        } finally {
            // Clear stored admin data
            localStorage.removeItem('admin_access_token');
            localStorage.removeItem('admin_user_details');
            setSuccess('');
            setError('');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Admin Portal</h1>
                    <p className="text-gray-600 text-sm mt-1">Secure administrator access</p>
                </div>

                {/* Success Message */}
                {/* {success && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center text-green-700">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {success}
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="mt-2 text-sm text-green-800 hover:text-green-900 underline"
                        >
                            Logout
                        </button>
                    </div>
                )} */}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center text-red-700">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    </div>
                )}

                {/* Login Form */}
                {!success && (
                    <div className="space-y-6">
                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Admin Email
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="w-5 h-5 text-gray-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                                    disabled={loading}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="admin@company.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="w-5 h-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                                    disabled={loading}
                                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={loading}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || !formData.email || !formData.password}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Authenticating...
                                </div>
                            ) : (
                                'Sign In as Admin'
                            )}
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 text-center text-xs text-gray-500">
                    <p>Secured by advanced authentication • Admin privileges required</p>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;