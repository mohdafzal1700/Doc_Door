    // import React, { useState, useEffect, useRef } from 'react';
    // import { User, Camera, Save, Edit2, Mail, Phone, Calendar, Shield, Upload, X, Check } from 'lucide-react';
    // import { adminGetProfile, adminUpdateProfile,
    // adminUploadProfilePicture,
    // adminUpdateBasicInfo } from '../endpoints/adm';

    // const AdminProfile = () => {
    // const [profileData, setProfileData] = useState(null);
    // const [loading, setLoading] = useState(true);
    // const [isEditing, setIsEditing] = useState(false);
    // const [saving, setSaving] = useState(false);
    // const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    
    // const [formData, setFormData] = useState({
    //     first_name: '',
    //     last_name: '',
    //     email: '',
    //     phone_number: '',
    //     profile_image: null
    // });
    
    // const [imagePreview, setImagePreview] = useState(null);
    // const fileInputRef = useRef(null);

    // // Load profile data
    // useEffect(() => {
    //     loadProfile();
    // }, []);

    // const loadProfile = async () => {
    //     try {
    //     setLoading(true);
    //     const response = await adminGetProfile();
        
    //     if (response.data.success) {
    //         const data = response.data.data;
    //         setProfileData(data);
    //         setFormData({
    //         first_name: data.admin_first_name || '',
    //         last_name: data.admin_last_name || '',
    //         email: data.email || '',
    //         phone_number: data.phone_number || '',
    //         profile_image: null
    //         });
    //         setImagePreview(data.profile_picture_url);
    //     }
    //     } catch (error) {
    //     showNotification('Failed to load profile data', 'error');
    //     console.error('Profile load error:', error);
    //     } finally {
    //     setLoading(false);
    //     }
    // };

    
    // const handleInputChange = (e) => {
    //     const { name, value } = e.target;
    //     setFormData(prev => ({
    //     ...prev,
    //     [name]: value
    //     }));
    // };

    // const handleImageChange = (e) => {
    //     const file = e.target.files[0];
    //     if (file) {
    //     if (file.size > 5 * 1024 * 1024) { // 5MB limit
    //         showNotification('Image size should be less than 5MB', 'error');
    //         return;
    //     }
        
    //     if (!file.type.startsWith('image/')) {
    //         showNotification('Please select a valid image file', 'error');
    //         return;
    //     }

    //     setFormData(prev => ({
    //         ...prev,
    //         profile_image: file
    //     }));
        
    //     // Create preview
    //     const reader = new FileReader();
    //     reader.onload = (e) => setImagePreview(e.target.result);
    //     reader.readAsDataURL(file);
    //     }
    // };

    // const handleRemoveImage = () => {
    //     setFormData(prev => ({
    //     ...prev,
    //     profile_image: null
    //     }));
    //     setImagePreview(profileData?.profile_picture_url || null);
    //     if (fileInputRef.current) {
    //     fileInputRef.current.value = '';
    //     }
    // };

    // const handleSave = async () => {
    //     try {
    //     setSaving(true);
        
    //     const submitData = new FormData();
    //     submitData.append('first_name', formData.first_name);
    //     submitData.append('last_name', formData.last_name);
    //     submitData.append('phone_number', formData.phone_number);
        
    //     if (formData.profile_image) {
    //         submitData.append('profile_image', formData.profile_image);
    //     }

    //     // Choose the appropriate API call based on what's being updated
    //     const response = formData.profile_image 
    //         ? await adminUploadProfilePicture(formData.profile_image)
    //         : await adminUpdateBasicInfo({
    //             first_name: formData.first_name,
    //             last_name: formData.last_name,
    //             phone_number: formData.phone_number
    //         });
        
    //     if (response.data.success) {
    //         // Reload the profile to get updated data including any transformations
    //         await loadProfile();
    //         setIsEditing(false);
    //         showNotification('Profile updated successfully!', 'success');
    //     } else {
    //         showNotification('Failed to update profile', 'error');
    //     }
    //     } catch (error) {
    //     showNotification('Error updating profile', 'error');
    //     console.error('Profile update error:', error);
        
    //     // Handle specific error cases
    //     if (error.response) {
    //         if (error.response.status === 413) {
    //         showNotification('Image size is too large (max 5MB)', 'error');
    //         } else if (error.response.data?.field_errors) {
    //         // Handle field-specific errors if your API returns them
    //         const firstError = Object.values(error.response.data.field_errors)[0];
    //         showNotification(firstError, 'error');
    //         }
    //     }
    //     } finally {
    //     setSaving(false);
    //     }
    // };

    
    // const showNotification = (message, type) => {
    //     setNotification({ show: true, message, type });
    //     setTimeout(() => {
    //     setNotification({ show: false, message: '', type: '' });
    //     }, 3000);
    // };

    // const triggerFileInput = () => {
    //     fileInputRef.current?.click();
    // };

    // if (loading) {
    //     return (
    //     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    //         <div className="bg-white rounded-xl p-8 shadow-lg">
    //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
    //         <p className="text-gray-600 mt-4 text-center">Loading profile...</p>
    //         </div>
    //     </div>
    //     );
    // }

    // return (
    //     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
    //     {/* Notification */}
    //     {notification.show && (
    //         <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
    //         notification.type === 'success' 
    //             ? 'bg-green-500 text-white' 
    //             : 'bg-red-500 text-white'
    //         }`}>
    //         {notification.type === 'success' ? <Check size={20} /> : <X size={20} />}
    //         <span>{notification.message}</span>
    //         </div>
    //     )}

    //     <div className="max-w-4xl mx-auto">
    //         {/* Header */}
    //         <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
    //         <div className="flex items-center justify-between">
    //             <div className="flex items-center space-x-4">
    //             <div className="p-3 bg-indigo-100 rounded-full">
    //                 <Shield className="w-8 h-8 text-indigo-600" />
    //             </div>
    //             <div>
    //                 <h1 className="text-2xl font-bold text-gray-900">Admin Profile</h1>
    //                 <p className="text-gray-600">Manage your administrator account</p>
    //             </div>
    //             </div>
                
    //             {!isEditing && (
    //             <button
    //                 onClick={() => setIsEditing(true)}
    //                 className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
    //             >
    //                 <Edit2 size={16} />
    //                 <span>Edit Profile</span>
    //             </button>
    //             )}
    //         </div>
    //         </div>

    //         {/* Profile Content */}
    //         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    //         {/* Profile Picture Section */}
    //         <div className="lg:col-span-1">
    //             <div className="bg-white rounded-xl shadow-lg p-6">
    //             <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h2>
                
    //             <div className="text-center">
    //                 <div className="relative inline-block">
    //                 <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
    //                     {imagePreview ? (
    //                     <img
    //                         src={imagePreview}
    //                         alt="Profile"
    //                         className="w-full h-full object-cover"
    //                     />
    //                     ) : (
    //                     <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-500">
    //                         <User className="w-16 h-16 text-white" />
    //                     </div>
    //                     )}
    //                 </div>
                    
    //                 {isEditing && (
    //                     <button
    //                     onClick={triggerFileInput}
    //                     className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-lg"
    //                     >
    //                     <Camera size={16} />
    //                     </button>
    //                 )}
    //                 </div>
                    
    //                 {isEditing && (
    //                 <div className="mt-4 space-y-2">
    //                     <button
    //                     onClick={triggerFileInput}
    //                     className="flex items-center justify-center space-x-2 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
    //                     >
    //                     <Upload size={16} />
    //                     <span>Upload Image</span>
    //                     </button>
                        
    //                     {formData.profile_image && (
    //                     <button
    //                         onClick={handleRemoveImage}
    //                         className="flex items-center justify-center space-x-2 w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
    //                     >
    //                         <X size={16} />
    //                         <span>Remove</span>
    //                     </button>
    //                     )}
                        
    //                     <input
    //                     ref={fileInputRef}
    //                     type="file"
    //                     accept="image/*"
    //                     onChange={handleImageChange}
    //                     className="hidden"
    //                     />
                        
    //                     <p className="text-xs text-gray-500">
    //                     Max size: 5MB. Formats: JPG, PNG, GIF
    //                     </p>
    //                 </div>
    //                 )}
    //             </div>
    //             </div>
    //         </div>

    //         {/* Profile Information */}
    //         <div className="lg:col-span-2">
    //             <div className="bg-white rounded-xl shadow-lg p-6">
    //             <div className="flex items-center justify-between mb-6">
    //                 <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
                    
    //                 {isEditing && (
    //                 <div className="flex space-x-3">
    //                     <button
    //                     onClick={() => {
    //                         setIsEditing(false);
    //                         setFormData({
    //                         first_name: profileData?.admin_first_name || '',
    //                         last_name: profileData?.admin_last_name || '',
    //                         email: profileData?.email || '',
    //                         phone_number: profileData?.phone_number || '',
    //                         profile_image: null
    //                         });
    //                         setImagePreview(profileData?.profile_picture_url);
    //                     }}
    //                     className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
    //                     >
    //                     Cancel
    //                     </button>
    //                     <button
    //                     onClick={handleSave}
    //                     disabled={saving}
    //                     className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
    //                     >
    //                     {saving ? (
    //                         <>
    //                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
    //                         <span>Saving...</span>
    //                         </>
    //                     ) : (
    //                         <>
    //                         <Save size={16} />
    //                         <span>Save Changes</span>
    //                         </>
    //                     )}
    //                     </button>
    //                 </div>
    //                 )}
    //             </div>

    //             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    //                 {/* First Name */}
    //                 <div>
    //                 <label className="block text-sm font-medium text-gray-700 mb-2">
    //                     First Name
    //                 </label>
    //                 {isEditing ? (
    //                     <input
    //                     type="text"
    //                     name="first_name"
    //                     value={formData.first_name}
    //                     onChange={handleInputChange}
    //                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    //                     placeholder="Enter first name"
    //                     />
    //                 ) : (
    //                     <p className="text-gray-900 py-2">{profileData?.admin_first_name || 'Not set'}</p>
    //                 )}
    //                 </div>

    //                 {/* Last Name */}
    //                 <div>
    //                 <label className="block text-sm font-medium text-gray-700 mb-2">
    //                     Last Name
    //                 </label>
    //                 {isEditing ? (
    //                     <input
    //                     type="text"
    //                     name="last_name"
    //                     value={formData.last_name}
    //                     onChange={handleInputChange}
    //                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    //                     placeholder="Enter last name"
    //                     />
    //                 ) : (
    //                     <p className="text-gray-900 py-2">{profileData?.admin_last_name || 'Not set'}</p>
    //                 )}
    //                 </div>

    //                 {/* Email */}
    //                 <div>
    //                 <label className="block text-sm font-medium text-gray-700 mb-2">
    //                     <Mail className="inline w-4 h-4 mr-1" />
    //                     Email Address
    //                 </label>
    //                 <p className="text-gray-900 py-2 bg-gray-50 px-3 rounded-lg">
    //                     {profileData?.email || 'Not set'}
    //                 </p>
    //                 <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
    //                 </div>

    //                 {/* Phone */}
    //                 <div>
    //                 <label className="block text-sm font-medium text-gray-700 mb-2">
    //                     <Phone className="inline w-4 h-4 mr-1" />
    //                     Phone Number
    //                 </label>
    //                 {isEditing ? (
    //                     <input
    //                     type="tel"
    //                     name="phone_number"
    //                     value={formData.phone_number}
    //                     onChange={handleInputChange}
    //                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    //                     placeholder="Enter phone number"
    //                     />
    //                 ) : (
    //                     <p className="text-gray-900 py-2">{profileData?.phone_number || 'Not set'}</p>
    //                 )}
    //                 </div>
    //             </div>

    //             {/* Account Info */}
    //             <div className="mt-8 pt-6 border-t border-gray-200">
    //                 <h3 className="text-md font-medium text-gray-900 mb-4">Account Information</h3>
                    
    //                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    //                 <div className="flex items-center space-x-2">
    //                     <Calendar className="w-4 h-4 text-gray-400" />
    //                     <div>
    //                     <p className="text-xs text-gray-500">Member Since</p>
    //                     <p className="text-sm font-medium text-gray-900">
    //                         {profileData?.member_since || 'Unknown'}
    //                     </p>
    //                     </div>
    //                 </div>
                    
    //                 <div className="flex items-center space-x-2">
    //                     <Calendar className="w-4 h-4 text-gray-400" />
    //                     <div>
    //                     <p className="text-xs text-gray-500">Last Login</p>
    //                     <p className="text-sm font-medium text-gray-900">
    //                         {profileData?.last_login_date || 'Unknown'}
    //                     </p>
    //                     </div>
    //                 </div>
                    
    //                 <div className="flex items-center space-x-2">
    //                     <Shield className="w-4 h-4 text-gray-400" />
    //                     <div>
    //                     <p className="text-xs text-gray-500">Role</p>
    //                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
    //                         {profileData?.role || 'Admin'}
    //                     </span>
    //                     </div>
    //                 </div>
    //                 </div>
    //             </div>
    //             </div>
    //         </div>
    //         </div>
    //     </div>
    //     </div>
    // );
    // };

    // export default AdminProfile;