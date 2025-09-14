import { useState, useEffect } from "react"
import { ArrowLeft, Save, User, Mail, Phone, Calendar, Heart, MapPin, Camera, Edit3, Globe, Building } from 'lucide-react'
import Button from "../components/ui/Button"
import Header from "../components/home/Header"
import { useNavigate, useLocation } from "react-router-dom"
import { useToast } from "../components/ui/Toast"
import { getUserProfile, updateUserProfile, getAddresses, updateAddress, createAddress, handleApiError } from "../endpoints/APIs"

const EditProfile = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userData, setUserData] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [validationErrors, setValidationErrors] = useState({})

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '',
    age: '',
    bloodGroup: '',
    address: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
  })

  // Helper function to safely trim strings
  const safeTrim = (value) => {
    if (value === null || value === undefined) return ''
    return String(value).trim()
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        let userData = location?.state?.user
        let addressData = location?.state?.primaryAddress

        if (!userData) {
          const [profileResponse, addressResponse] = await Promise.all([
            getUserProfile(),
            getAddresses().catch(() => ({ data: { success: false, data: { addresses: [] } } }))
          ])

          if (profileResponse.data.success) {
            userData = profileResponse.data.data
            if (addressResponse.data.success) {
              addressData = addressResponse.data.data.addresses.find(a => a.is_primary)
            }
          } else {
            const err = handleApiError({ response: profileResponse })
            setError(err.message)
            return
          }
        }

        setUserData(userData)
        setFormData({
          first_name: safeTrim(userData.first_name),
          last_name: safeTrim(userData.last_name),
          email: safeTrim(userData.email),
          phone: safeTrim(userData.phone_number),
          gender: safeTrim(userData.patient_gender),
          age: userData.patient_age ? String(userData.patient_age) : '',
          bloodGroup: safeTrim(userData.patient_blood_group),
          address: {
            street1: safeTrim(addressData?.address_line_1),
            street2: safeTrim(addressData?.street),
            city: safeTrim(addressData?.city),
            state: safeTrim(addressData?.state),
            zipCode: safeTrim(addressData?.postal_code),
            country: safeTrim(addressData?.country)
          }
        })
      } catch (err) {
        console.error('Fetch error:', err)
        setError('Something went wrong')
        toast.error('Failed to load profile data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [location, toast])

  // Client-side validation function
  const validateField = (name, value) => {
    const errors = {}
    const trimmedValue = safeTrim(value)

    switch (name) {
      case 'first_name':
        if (!trimmedValue) {
          errors.first_name = 'First name is required'
        } else if (!/^[A-Za-z\s]+$/.test(trimmedValue)) {
          errors.first_name = 'First name must contain only letters and spaces'
        }
        break
      case 'last_name':
        if (!trimmedValue) {
          errors.last_name = 'Last name is required'
        } else if (!/^[A-Za-z\s]+$/.test(trimmedValue)) {
          errors.last_name = 'Last name must contain only letters and spaces'
        }
        break
      case 'email':
        if (!trimmedValue) {
          errors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
          errors.email = 'Please enter a valid email address'
        }
        break
      case 'phone':
        if (!trimmedValue) {
          errors.phone = 'Phone number is required'
        } else if (!/^\d{10}$/.test(trimmedValue.replace(/\D/g, ''))) {
          errors.phone = 'Phone number must be exactly 10 digits'
        }
        break
      case 'age':
        if (trimmedValue) {
          const ageNum = parseInt(trimmedValue)
          if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
            errors.age = 'Please enter a valid age between 1 and 120'
          }
        }
        break
      case 'bloodGroup':
        if (trimmedValue) {
          const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
          if (!validBloodGroups.includes(trimmedValue.toUpperCase())) {
            errors.bloodGroup = 'Please enter a valid blood group (A+, A-, B+, B-, AB+, AB-, O+, O-)'
          }
        }
        break
      case 'address.zipCode':
        if (trimmedValue && !/^\d{5,6}$/.test(trimmedValue)) {
          errors['address.zipCode'] = 'ZIP code must be 5-6 digits'
        }
        break
    }
    return errors
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target

    // Clear field errors when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }

    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }

    // Update form data
    if (name.startsWith('address.')) {
      const field = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [field]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    const fieldValidationErrors = validateField(name, value)
    if (Object.keys(fieldValidationErrors).length > 0) {
      setValidationErrors(prev => ({ ...prev, ...fieldValidationErrors }))
    }
  }

  const validateAllFields = () => {
    let allErrors = {}
    
    // Validate required fields
    const fieldsToValidate = ['first_name', 'last_name', 'email', 'phone']
    fieldsToValidate.forEach(field => {
      const value = formData[field]
      const fieldErrors = validateField(field, value)
      allErrors = { ...allErrors, ...fieldErrors }
    })

    // Validate optional fields if they have values
    if (formData.age) {
      const ageErrors = validateField('age', formData.age)
      allErrors = { ...allErrors, ...ageErrors }
    }

    if (formData.bloodGroup) {
      const bloodGroupErrors = validateField('bloodGroup', formData.bloodGroup)
      allErrors = { ...allErrors, ...bloodGroupErrors }
    }

    // Validate address fields
    if (formData.address.zipCode) {
      const zipErrors = validateField('address.zipCode', formData.address.zipCode)
      allErrors = { ...allErrors, ...zipErrors }
    }

    return allErrors
  }

  const showFieldErrorToasts = (fieldErrors) => {
    Object.entries(fieldErrors).forEach(([field, errors]) => {
      const fieldName = field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
      const errorArray = Array.isArray(errors) ? errors : [errors]
      errorArray.forEach(error => {
        toast.error(`${fieldName}: ${error}`)
      })
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setUpdateLoading(true)
    setError(null)
    setFieldErrors({})
    setValidationErrors({})

    // Client-side validation
    const clientValidationErrors = validateAllFields()
    if (Object.keys(clientValidationErrors).length > 0) {
      setValidationErrors(clientValidationErrors)
      showFieldErrorToasts(clientValidationErrors)
      setUpdateLoading(false)
      return
    }

    try {
      // Prepare profile data with safe trimming
      const profileData = {
        first_name: safeTrim(formData.first_name),
        last_name: safeTrim(formData.last_name),
        email: safeTrim(formData.email),
        phone_number: safeTrim(formData.phone).replace(/\D/g, ''), // Remove non-digits
        patient_gender: formData.gender || null,
        patient_age: formData.age ? parseInt(formData.age) : null,
        patient_blood_group: formData.bloodGroup ? safeTrim(formData.bloodGroup).toUpperCase() : null
      }

      console.log('Sending profile data:', profileData)

      const response = await updateUserProfile(profileData)
      
      if (response.data.success) {
        // Handle address update
        try {
          const addressRes = await getAddresses()
          const existingPrimary = addressRes.data.success ? 
            addressRes.data.data.addresses.find(a => a.is_primary) : null

          const addressPayload = {
            address_line_1: safeTrim(formData.address.street1),
            street: safeTrim(formData.address.street2),
            city: safeTrim(formData.address.city),
            state: safeTrim(formData.address.state),
            postal_code: safeTrim(formData.address.zipCode),
            country: safeTrim(formData.address.country),
            is_primary: true,
            address_type: 'home',
            label: 'Home'
          }

          if (existingPrimary) {
            await updateAddress(existingPrimary.id, addressPayload)
          } else if (addressPayload.address_line_1 || addressPayload.city) {
            // Only create address if there's meaningful data
            await createAddress(addressPayload)
          }
        } catch (addressError) {
          console.error('Address update error:', addressError)
          // Don't fail the entire update for address errors
        }

        toast.success('Profile updated successfully!')
        navigate('/patientprofile')
      } else {
        // Handle backend response with nested errors structure
        const backendResponse = response.data
        const backendErrors = backendResponse.errors || backendResponse.field_errors || backendResponse
        
        if (backendErrors && typeof backendErrors === 'object') {
          setFieldErrors(backendErrors)
          showFieldErrorToasts(backendErrors)
        } else if (backendResponse.message) {
          toast.error(backendResponse.message)
        } else {
          setError('Update failed.')
          toast.error('Update failed. Please try again.')
        }
      }
    } catch (err) {
      console.error("Update error:", err)
      
      // Handle backend validation errors
      if (err?.response?.data) {
        const backendResponse = err.response.data
        console.log("Backend error response:", backendResponse)
        
        const backendErrors = backendResponse.errors || backendResponse.field_errors || backendResponse
        
        // Handle field-specific errors
        const fieldMappings = {
          'first_name': 'first_name',
          'last_name': 'last_name',
          'email': 'email',
          'phone_number': 'phone',
          'phone': 'phone',
          'patient_age': 'age',
          'age': 'age',
          'patient_blood_group': 'bloodGroup',
          'blood_group': 'bloodGroup',
          'patient_gender': 'gender',
          'gender': 'gender'
        }

        let hasFieldErrors = false
        Object.entries(fieldMappings).forEach(([backendField, frontendField]) => {
          if (backendErrors[backendField]) {
            hasFieldErrors = true
            const errorMsg = Array.isArray(backendErrors[backendField]) 
              ? backendErrors[backendField][0] 
              : backendErrors[backendField]
            setFieldErrors(prev => ({
              ...prev,
              [frontendField]: errorMsg
            }))
            toast.error(`${frontendField.replace('_', ' ')}: ${errorMsg}`)
          }
        })

        // Handle general message from backend response
        if (backendResponse.message && backendResponse.success === false) {
          toast.error(backendResponse.message)
        }

        // Handle non-field errors
        if (!hasFieldErrors) {
          if (typeof backendErrors === 'string') {
            toast.error(backendErrors)
          } else if (backendErrors.detail) {
            toast.error(backendErrors.detail)
          } else if (backendErrors.non_field_errors) {
            const nonFieldError = Array.isArray(backendErrors.non_field_errors) 
              ? backendErrors.non_field_errors[0] 
              : backendErrors.non_field_errors
            toast.error(nonFieldError)
          } else if (backendResponse.message) {
            toast.error(backendResponse.message)
          } else {
            toast.error('Update failed. Please try again.')
          }
        }
      } else {
        const parsed = handleApiError(err)
        setError(parsed.message)
        toast.error(parsed.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setUpdateLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center">
            <button 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold ml-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Edit Profile
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black opacity-10"></div>
            <div className="relative z-10 flex items-center space-x-6">
              <div className="relative">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white ring-opacity-50">
                  {userData?.profile_picture_url ? (
                    <img 
                      src={userData.profile_picture_url} 
                      alt="Profile" 
                      className="w-full h-full rounded-full object-cover" 
                    />
                  ) : (
                    <User className="w-16 h-16 text-gray-400" />
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold">{userData?.username || 'User'}</h2>
                <p className="text-blue-100 mt-1">Update your profile information</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit}>
              {/* Personal Information Section */}
              <div className="mb-10">
                <div className="flex items-center mb-6">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold ml-3 text-gray-800">Personal Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Input
                    icon={<User className="w-5 h-5" />}
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="First Name"
                    error={fieldErrors.first_name || validationErrors.first_name}
                    required
                  />
                  <Input
                    icon={<User className="w-5 h-5" />}
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Last Name"
                    error={fieldErrors.last_name || validationErrors.last_name}
                    required
                  />
                  <Input
                    icon={<Mail className="w-5 h-5" />}
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Email Address"
                    type="email"
                    error={fieldErrors.email || validationErrors.email}
                    required
                  />
                  <Input
                    icon={<Phone className="w-5 h-5" />}
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Phone Number"
                    error={fieldErrors.phone || validationErrors.phone}
                    required
                  />
                  <Input
                    icon={<Calendar className="w-5 h-5" />}
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Age"
                    type="number"
                    min="1"
                    max="120"
                    error={fieldErrors.age || validationErrors.age}
                  />
                  <SelectInput
                    icon={<User className="w-5 h-5" />}
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    placeholder="Select Gender"
                    options={[
                      { value: '', label: 'Select Gender' },
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' },
                      { value: 'prefer_not_to_say', label: 'Prefer not to say' }
                    ]}
                    error={fieldErrors.gender || validationErrors.gender}
                  />
                  <Input
                    icon={<Heart className="w-5 h-5" />}
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Blood Group (e.g., A+, O-)"
                    maxLength={3}
                    error={fieldErrors.bloodGroup || validationErrors.bloodGroup}
                  />
                </div>
              </div>

              {/* Address Information Section */}
              <div className="mb-10">
                <div className="flex items-center mb-6">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <MapPin className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold ml-3 text-gray-800">Address Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    icon={<Building className="w-5 h-5" />}
                    name="address.street1"
                    value={formData.address.street1}
                    onChange={handleInputChange}
                    placeholder="Street Address 1"
                  />
                  <Input
                    icon={<Building className="w-5 h-5" />}
                    name="address.street2"
                    value={formData.address.street2}
                    onChange={handleInputChange}
                    placeholder="Street Address 2 (Optional)"
                  />
                  <Input
                    icon={<MapPin className="w-5 h-5" />}
                    name="address.city"
                    value={formData.address.city}
                    onChange={handleInputChange}
                    placeholder="City"
                  />
                  <Input
                    icon={<MapPin className="w-5 h-5" />}
                    name="address.state"
                    value={formData.address.state}
                    onChange={handleInputChange}
                    placeholder="State/Province"
                  />
                  <Input
                    icon={<Edit3 className="w-5 h-5" />}
                    name="address.zipCode"
                    value={formData.address.zipCode}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="ZIP/Postal Code"
                    error={validationErrors['address.zipCode']}
                  />
                  <Input
                    icon={<Globe className="w-5 h-5" />}
                    name="address.country"
                    value={formData.address.country}
                    onChange={handleInputChange}
                    placeholder="Country"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-8 py-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  disabled={updateLoading}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={updateLoading}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {updateLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

const Input = ({ icon, type = "text", error, required, onBlur, ...props }) => (
  <div className="relative group">
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
      <div className={`transition-colors ${error ? 'text-red-500' : 'text-gray-400 group-focus-within:text-blue-500'}`}>
        {icon}
      </div>
    </div>
    <input
      type={type}
      onBlur={onBlur}
      {...props}
      className={`w-full pl-12 pr-4 py-4 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md group-hover:border-gray-300 ${
        error 
          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
          : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
      }`}
    />
    {error && (
      <div className="mt-1 text-sm text-red-600">
        {Array.isArray(error) ? error[0] : error}
      </div>
    )}
  </div>
)

const SelectInput = ({ icon, options, error, ...props }) => (
  <div className="relative group">
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
      <div className={`transition-colors ${error ? 'text-red-500' : 'text-gray-400 group-focus-within:text-blue-500'}`}>
        {icon}
      </div>
    </div>
    <select
      {...props}
      className={`w-full pl-12 pr-4 py-4 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md group-hover:border-gray-300 appearance-none cursor-pointer ${
        error 
          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
          : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
      }`}
    >
      {options.map((option, index) => (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
    {error && (
      <div className="mt-1 text-sm text-red-600">
        {Array.isArray(error) ? error[0] : error}
      </div>
    )}
  </div>
)

export default EditProfile