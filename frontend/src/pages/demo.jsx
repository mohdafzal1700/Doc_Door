// import { useState, useEffect, useCallback } from "react"
// import { ArrowLeft, Save, X, User, Mail, Phone, MapPin, Calendar, Heart } from 'lucide-react'
// import Button from "../components/ui/Button"
// import Header from "../components/home/Header"
// import { useNavigate, useLocation } from "react-router-dom"
// import { getUserProfile, updateUserProfile } from "../endpoints/APIs"

// const EditProfile = () => {
//     const navigate = useNavigate()
//     const location = useLocation()
//     const [user, setUser] = useState(null)
//     const [loading, setLoading] = useState(true)
//     const [error, setError] = useState(null)
//     const [updateLoading, setUpdateLoading] = useState(false)
//     const [formData, setFormData] = useState({
//         first_name: '',
//         last_name: '',
//         email: '',
//         phone: '',
//         gender: '',
//         age: '',
//         bloodGroup: '',
//         address: {
//             street1: '',
//             street2: '',
//             city: '',
//             state: '',
//             zipCode: '',
//             country: ''
//         }
//     })

//     // Initialize form data from location state or fetch from API
//     useEffect(() => {
//         const initializeData = async () => {
//             try {
//                 setLoading(true)
//                 setError(null)
                
//                 let userData = location?.state?.user
                
//                 if (!userData) {
//                     // Fetch user data if not provided in location state
//                     const response = await getUserProfile()
//                     if (response.data.success) {
//                         userData = response.data.data
//                     } else {
//                         setError(response.data.message || 'Failed to load profile')
//                         return
//                     }
//                 }
                
//                 setUser(userData)
//                 setFormData({
//                     first_name: userData.first_name || '',
//                     last_name: userData.last_name || '',
//                     email: userData.email || '',
//                     phone: userData.phone || '',
//                     gender: userData.gender || '',
//                     age: userData.age || '',
//                     bloodGroup: userData.bloodGroup || '',
//                     address: {
//                         street1: userData.address?.street1 || '',
//                         street2: userData.address?.street2 || '',
//                         city: userData.address?.city || '',
//                         state: userData.address?.state || '',
//                         zipCode: userData.address?.zipCode || '',
//                         country: userData.address?.country || ''
//                     }
//                 })
//             } catch (error) {
//                 console.error("Error fetching user profile:", error)
//                 setError('Failed to load profile data')
//             } finally {
//                 setLoading(false)
//             }
//         }

//         initializeData()
//     }, [location])

//     const handleBack = () => navigate("/patientprofile")

//     // Memoized input change handler to prevent unnecessary re-renders
//     const handleInputChange = useCallback((field, value) => {
//         setFormData(prev => {
//             if (field.includes('.')) {
//                 // Handle nested fields like address.street1
//                 const [parent, child] = field.split('.')
//                 return {
//                     ...prev,
//                     [parent]: {
//                         ...prev[parent],
//                         [child]: value
//                     }
//                 }
//             } else {
//                 return {
//                     ...prev,
//                     [field]: value
//                 }
//             }
//         })
//     }, [])

//     const handleSaveProfile = async () => {
//         try {
//             setUpdateLoading(true)
//             setError(null)

//             const response = await updateUserProfile(formData)
            
//             if (response.data.success) {
//                 // Navigate back to profile page with success message
//                 navigate('/patientprofile', { 
//                     state: { 
//                         success: true, 
//                         message: 'Profile updated successfully!' 
//                     } 
//                 })
//             } else {
//                 if (response.data.field_errors) {
//                     // Handle field-specific errors
//                     const errorMessages = Object.entries(response.data.field_errors)
//                         .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
//                         .join('\n')
//                     setError(`Validation errors:\n${errorMessages}`)
//                 } else {
//                     setError(response.data.message || 'Failed to update profile')
//                 }
//             }
//         } catch (error) {
//             console.error("Error updating profile:", error)
            
//             if (error.response?.status === 401) {
//                 setError('Session expired. Please login again.')
//             } else if (error.response?.status === 400) {
//                 // Handle validation errors
//                 const fieldErrors = error.response.data.field_errors
//                 if (fieldErrors) {
//                     const errorMessages = Object.entries(fieldErrors)
//                         .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
//                         .join('\n')
//                     setError(`Validation errors:\n${errorMessages}`)
//                 } else {
//                     setError('Invalid data provided')
//                 }
//             } else {
//                 setError('Failed to update profile')
//             }
//         } finally {
//             setUpdateLoading(false)
//         }
//     }

//     // Memoized Form Section Component to prevent unnecessary re-renders
//     const FormSection = useCallback(({ title, icon: Icon, iconBg, children }) => (
//         <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
//             <div className="flex items-center mb-6">
//                 <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center mr-3`}>
//                     <Icon size={20} className={iconBg.includes('purple') ? 'text-purple-600' : 
//                                                 iconBg.includes('blue') ? 'text-blue-600' : 
//                                                 iconBg.includes('green') ? 'text-green-600' : 'text-red-600'} />
//                 </div>
//                 <h2 className="text-xl font-bold text-gray-900">{title}</h2>
//             </div>
//             {children}
//         </div>
//     ), [])

//     // Memoized Input Field Component to prevent unnecessary re-renders
//     const InputField = useCallback(({ label, icon: Icon, type = "text", field, value, placeholder, required = false }) => (
//         <div className="space-y-2">
//             <label className="block text-sm font-medium text-gray-700 flex items-center">
//                 <Icon size={16} className="mr-2 text-gray-500" />
//                 {label}
//                 {required && <span className="text-red-500 ml-1">*</span>}
//             </label>
//             <input
//                 type={type}
//                 value={value}
//                 onChange={(e) => handleInputChange(field, e.target.value)}
//                 placeholder={placeholder}
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
//                 disabled={updateLoading}
//             />
//         </div>
//     ), [handleInputChange, updateLoading])

//     // Memoized Select Field Component
//     const SelectField = useCallback(({ label, icon: Icon, field, value, options, placeholder }) => (
//         <div className="space-y-2">
//             <label className="block text-sm font-medium text-gray-700 flex items-center">
//                 <Icon size={16} className="mr-2 text-gray-500" />
//                 {label}
//             </label>
//             <select
//                 value={value}
//                 onChange={(e) => handleInputChange(field, e.target.value)}
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
//                 disabled={updateLoading}
//             >
//                 <option value="">{placeholder}</option>
//                 {options.map(option => (
//                     <option key={option.value} value={option.value}>
//                         {option.label}
//                     </option>
//                 ))}
//             </select>
//         </div>
//     ), [handleInputChange, updateLoading])

//     // Loading state
//     if (loading) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
//                 <Header />
//                 <div className="flex items-center justify-center py-20">
//                     <div className="relative">
//                         <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200"></div>
//                         <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-600 absolute top-0 left-0"></div>
//                         <div className="mt-4 text-center">
//                             <p className="text-gray-600 animate-pulse">Loading profile...</p>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         )
//     }

//     const displayName = user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'User'

//     const genderOptions = [
//         { value: 'male', label: 'Male' },
//         { value: 'female', label: 'Female' },
//         { value: 'other', label: 'Other' },
//         { value: 'prefer-not-to-say', label: 'Prefer not to say' }
//     ]

//     return (
//         <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
//             <Header />

//             <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//                 {/* Back Button */}
//                 <button 
//                     onClick={handleBack}
//                     className="flex items-center text-gray-600 hover:text-purple-600 mb-8 transition-all duration-200 group bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md"
//                     disabled={updateLoading}
//                 >
//                     <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
//                     <span className="font-medium">Back to Profile</span>
//                 </button>

//                 {/* Page Header */}
//                 <div className="text-center mb-8">
//                     <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Profile</h1>
//                     <p className="text-gray-600">Update your personal information and address details</p>
//                 </div>

//                 {/* Error Display */}
//                 {error && (
//                     <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
//                         <div className="flex items-center">
//                             <X className="w-5 h-5 text-red-500 mr-2" />
//                             <div>
//                                 <h3 className="text-sm font-medium text-red-800">Error</h3>
//                                 <pre className="text-sm text-red-600 mt-1 whitespace-pre-wrap">{error}</pre>
//                             </div>
//                         </div>
//                     </div>
//                 )}

//                 <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="space-y-8">
//                     {/* Personal Information Section */}
//                     <FormSection title="Personal Information" icon={User} iconBg="bg-purple-100">
//                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                             <InputField
//                                 label="First Name"
//                                 icon={User}
//                                 field="first_name"
//                                 value={formData.first_name}
//                                 placeholder="Enter your first name"
//                                 required
//                             />
//                             <InputField
//                                 label="Last Name"
//                                 icon={User}
//                                 field="last_name"
//                                 value={formData.last_name}
//                                 placeholder="Enter your last name"
//                                 required
//                             />
//                             <InputField
//                                 label="Email Address"
//                                 icon={Mail}
//                                 type="email"
//                                 field="email"
//                                 value={formData.email}
//                                 placeholder="Enter your email address"
//                                 required
//                             />
//                             <InputField
//                                 label="Phone Number"
//                                 icon={Phone}
//                                 type="tel"
//                                 field="phone"
//                                 value={formData.phone}
//                                 placeholder="Enter your phone number"
//                             />
//                             <SelectField
//                                 label="Gender"
//                                 icon={User}
//                                 field="gender"
//                                 value={formData.gender}
//                                 options={genderOptions}
//                                 placeholder="Select gender"
//                             />
//                             <InputField
//                                 label="Age"
//                                 icon={Calendar}
//                                 type="number"
//                                 field="age"
//                                 value={formData.age}
//                                 placeholder="Enter your age"
//                             />
//                         </div>
//                         <div className="mt-6">
//                             <InputField
//                                 label="Blood Group"
//                                 icon={Heart}
//                                 field="bloodGroup"
//                                 value={formData.bloodGroup}
//                                 placeholder="Enter your blood group (e.g., A+, B-, O+)"
//                             />
//                         </div>
//                     </FormSection>

//                     {/* Address Information Section */}
//                     <FormSection title="Address Information" icon={MapPin} iconBg="bg-green-100">
//                         <div className="space-y-6">
//                             <InputField
//                                 label="Street Address"
//                                 icon={MapPin}
//                                 field="address.street1"
//                                 value={formData.address.street1}
//                                 placeholder="Enter your street address"
//                             />
//                             <InputField
//                                 label="Apartment, Suite, etc."
//                                 icon={MapPin}
//                                 field="address.street2"
//                                 value={formData.address.street2}
//                                 placeholder="Enter apartment, suite, unit, etc."
//                             />
//                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                                 <InputField
//                                     label="City"
//                                     icon={MapPin}
//                                     field="address.city"
//                                     value={formData.address.city}
//                                     placeholder="Enter your city"
//                                 />
//                                 <InputField
//                                     label="State/Province"
//                                     icon={MapPin}
//                                     field="address.state"
//                                     value={formData.address.state}
//                                     placeholder="Enter your state or province"
//                                 />
//                                 <InputField
//                                     label="ZIP/Postal Code"
//                                     icon={MapPin}
//                                     field="address.zipCode"
//                                     value={formData.address.zipCode}
//                                     placeholder="Enter your ZIP or postal code"
//                                 />
//                                 <InputField
//                                     label="Country"
//                                     icon={MapPin}
//                                     field="address.country"
//                                     value={formData.address.country}
//                                     placeholder="Enter your country"
//                                 />
//                             </div>
//                         </div>
//                     </FormSection>

//                     {/* Action Buttons */}
//                     <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
//                         <div className="flex flex-col sm:flex-row justify-center gap-4">
//                             <Button 
//                                 type="submit"
//                                 disabled={updateLoading}
//                                 className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
//                             >
//                                 <Save size={20} className="mr-2" />
//                                 {updateLoading ? 'Saving Changes...' : 'Save Changes'}
//                             </Button>
//                             <Button 
//                                 type="button"
//                                 onClick={handleBack}
//                                 disabled={updateLoading}
//                                 variant="outline" 
//                                 className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white border-none transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
//                             >
//                                 <X size={20} className="mr-2" />
//                                 Cancel
//                             </Button>
//                         </div>
//                     </div>
//                 </form>
//             </div>
//         </div>
//     )
// }

// export default EditProfile