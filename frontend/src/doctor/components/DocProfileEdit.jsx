"use client"
import { useState, useEffect } from "react"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { Label } from "../../components/ui/Label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/Select"
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group"
import { Checkbox } from "../../components/ui/checkbox"
import { User, Camera, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { getDoctorProfile, updateDoctorProfile, createDoctorProfile } from "../../endpoints/Doc"
import { useToast } from "../../components/ui/Toast"

export default function PortalProfile() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [profileExists, setProfileExists] = useState(false)
  const [existingProfilePicture, setExistingProfilePicture] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "male",
    department: "",
    years_of_experience: "",
    consultation_mode_online: false,
    consultation_mode_offline: false,
    clinic_name: "",
    location: "",
    license_number: "",
    consultation_fee: "",
    profile_image: null
  })

  // Fetch existing profile data on component mount
  useEffect(() => {
    fetchProfileData()
  }, [])

  const fetchProfileData = async () => {
    try {
      setInitialLoading(true)
      console.log("🔍 Fetching doctor profile data...")
      const response = await getDoctorProfile()
      console.log("✅ Profile data fetched:", response.data)

      if (response.data?.data) {
        const profileData = response.data.data
        setProfileExists(true)

        // Set existing profile picture URL
        if (profileData.profile_picture_url) {
          setExistingProfilePicture(profileData.profile_picture_url)
        }

        // Populate form with existing data using the serializer field names
        setFormData({
          first_name: profileData.doctor_first_name || "",
          last_name: profileData.doctor_last_name || "",
          date_of_birth: profileData.doctor_date_of_birth || "",
          gender: profileData.doctor_gender || "male",
          department: profileData.doctor_department || profileData.doctor_specialization || "",
          years_of_experience: profileData.doctor_experience || "",
          consultation_mode_online: profileData.doctor_consultation_mode_online || false,
          consultation_mode_offline: profileData.doctor_consultation_mode_offline || false,
          clinic_name: profileData.doctor_clinic_name || "",
          location: profileData.doctor_location || "",
          license_number: profileData.doctor_license_number || "",
          consultation_fee: profileData.doctor_consultation_fee || "",
          profile_image: null // File input will be handled separately
        })
        console.log("✅ Form populated with existing data")
      } else {
        console.log("ℹ️ No existing profile data found")
        setProfileExists(false)
      }
    } catch (error) {
      console.error("❌ Error fetching profile data:", error)
      // If it's a 404, it means profile doesn't exist yet
      if (error?.response?.status === 404) {
        console.log("ℹ️ Profile doesn't exist yet - creating new profile")
        setProfileExists(false)
      } else {
        toast.error("Failed to load profile data")
      }
    } finally {
      setInitialLoading(false)
    }
  }

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle checkbox changes
  const handleCheckboxChange = (field, checked) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked
    }))
  }

  // Handle file upload
  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Validate file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB")
        return
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Please select a valid image file")
        return
      }

      setFormData(prev => ({
        ...prev,
        profile_image: file
      }))
    }
  }

  // Validate form
  const validateForm = () => {
    const requiredFields = [
      { field: 'first_name', label: 'First Name' },
      { field: 'last_name', label: 'Last Name' },
      { field: 'date_of_birth', label: 'Date of Birth' },
      { field: 'department', label: 'Department' },
      { field: 'years_of_experience', label: 'Years of Experience' },
      { field: 'license_number', label: 'License Number' }
    ]

    for (let { field, label } of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === '') {
        toast.error(`${label} is required`)
        return false
      }
    }

    // Validate years of experience
    const experience = parseInt(formData.years_of_experience)
    if (isNaN(experience) || experience < 0 || experience > 50) {
      toast.error("Years of experience must be between 0 and 50")
      return false
    }

    // Validate consultation fee if provided
    if (formData.consultation_fee && formData.consultation_fee !== '') {
      const fee = parseFloat(formData.consultation_fee)
      if (isNaN(fee) || fee < 0) {
        toast.error("Consultation fee must be a valid positive number")
        return false
      }
    }

    // Validate consultation modes
    if (!formData.consultation_mode_online && !formData.consultation_mode_offline) {
      toast.error("Please select at least one consultation mode")
      return false
    }

    // Validate date of birth
    const dob = new Date(formData.date_of_birth)
    const today = new Date()
    const age = today.getFullYear() - dob.getFullYear()
    if (age < 18 || age > 100) {
      toast.error("Please enter a valid date of birth")
      return false
    }

    return true
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return

    try {
      setLoading(true)
      console.log("🔄 Submitting profile data...")

      // Prepare data - use regular object if no file, FormData if file exists
      let submitData
      const hasFile = formData.profile_image instanceof File

      if (hasFile) {
        submitData = new FormData()
        // Add file
        submitData.append('profile_image', formData.profile_image)
        
        // Add other fields
        Object.keys(formData).forEach(key => {
          const value = formData[key]
          if (key === 'profile_image' || value === null || value === '' || value === undefined) {
            return
          }
          
          if (key === 'consultation_fee') {
            const feeValue = parseFloat(value)
            if (!isNaN(feeValue)) {
              submitData.append(key, feeValue.toString())
            }
          } else if (key === 'years_of_experience') {
            submitData.append(key, parseInt(value).toString())
          } else if (typeof value === 'boolean') {
            submitData.append(key, value ? 'true' : 'false')
          } else {
            submitData.append(key, value.toString())
          }
        })
      } else {
        // Use regular object
        submitData = {}
        Object.keys(formData).forEach(key => {
          const value = formData[key]
          if (key === 'profile_image' || value === null || value === '' || value === undefined) {
            return
          }
          
          if (key === 'consultation_fee') {
            const feeValue = parseFloat(value)
            if (!isNaN(feeValue)) {
              submitData[key] = feeValue // Send as actual number
            }
          } else if (key === 'years_of_experience') {
            submitData[key] = parseInt(value)
          } else {
            submitData[key] = value
          }
        })
      }

      // Log form data for debugging
      console.log("📝 Form data being submitted:", submitData)
      if (hasFile) {
        console.log("📝 FormData entries:")
        for (let [key, value] of submitData.entries()) {
          console.log(`${key}:`, value, typeof value)
        }
      }

      let response
      if (profileExists) {
        console.log("🔄 Updating existing profile...")
        response = await updateDoctorProfile(submitData)
      } else {
        console.log("🔄 Creating new profile...")
        response = await createDoctorProfile(submitData)
      }

      console.log("✅ Profile saved successfully:", response.data)

      // Handle success response
      if (response.data?.success !== false) {
        toast.success(response.data?.message || "Profile saved successfully!")
        // Navigate to next step
        navigate("/doctor/portal")
      } else {
        // Handle case where success is explicitly false
        toast.error(response.data?.message || "Failed to save profile")
      }

    } catch (error) {
      console.error("❌ Error saving profile:", error)
      // Handle different error response formats
      if (error?.response?.data) {
        const errorData = error.response.data
        
        // Check for the new field_errors format
        if (errorData.field_errors && typeof errorData.field_errors === 'object') {
          // Handle field-specific errors
          Object.keys(errorData.field_errors).forEach(fieldName => {
            const fieldErrors = errorData.field_errors[fieldName]
            if (Array.isArray(fieldErrors)) {
              fieldErrors.forEach(errorMessage => {
                toast.error(errorMessage, `${fieldName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Error`)
              })
            } else {
              toast.error(fieldErrors, `${fieldName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Error`)
            }
          })
        }
        // Handle legacy errors format  
        else if (errorData.errors && typeof errorData.errors === 'object') {
          Object.keys(errorData.errors).forEach(field => {
            const fieldErrors = Array.isArray(errorData.errors[field]) 
              ? errorData.errors[field] 
              : [errorData.errors[field]]
            fieldErrors.forEach(err => {
              toast.error(`${field}: ${err}`)
            })
          })
        }
        // Handle general error message
        else if (errorData.message) {
          toast.error(errorData.message)
        }
        // Handle success: false case
        else if (errorData.success === false) {
          toast.error("Failed to save profile. Please check your information and try again.")
        }
        // Fallback error message
        else {
          toast.error("An error occurred while saving your profile.")
        }
      } else {
        // Network or other errors
        toast.error("Network error. Please check your connection and try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Get current profile image to display
  const getCurrentProfileImage = () => {
    if (formData.profile_image) {
      return URL.createObjectURL(formData.profile_image)
    }
    if (existingProfilePicture) {
      return existingProfilePicture
    }
    return null
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-900" />
        <span className="ml-2 text-gray-600">Loading profile data...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Profile Image Section */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-300">
            {getCurrentProfileImage() ? (
              <img
                src={getCurrentProfileImage()}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <label
            htmlFor="profile-image"
            className="absolute bottom-0 right-0 bg-blue-900 rounded-full p-2 cursor-pointer hover:bg-blue-800 transition-colors"
          >
            <Camera className="w-4 h-4 text-white" />
          </label>
          <input
            id="profile-image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Personal Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            placeholder="Enter first name"
            value={formData.first_name}
            onChange={(e) => handleInputChange('first_name', e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            placeholder="Enter last name"
            value={formData.last_name}
            onChange={(e) => handleInputChange('last_name', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="phoneNumber">Phone Number *</Label>
        <Input
          id="phoneNumber"
          placeholder="Enter phone number"
          value={formData.phone_number}
          onChange={(e) => handleInputChange('phone_number', e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="date">Date of Birth *</Label>
        <Input
          id="date"
          type="date"
          value={formData.date_of_birth}
          onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
          className="mt-1"
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
        />
      </div>

      <div>
        <Label className="text-base font-semibold text-gray-800 mb-4 block">Gender</Label>
        <RadioGroup
          value={formData.gender}
          onValueChange={(value) => handleInputChange('gender', value)}
          className="flex flex-col sm:flex-row gap-4"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200">
            <RadioGroupItem value="male" id="male" />
            <Label htmlFor="male" className="font-medium text-gray-700 cursor-pointer flex items-center">
              <span className="mr-2">👨</span> Male
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200">
            <RadioGroupItem value="female" id="female" />
            <Label htmlFor="female" className="font-medium text-gray-700 cursor-pointer flex items-center">
              <span className="mr-2">👩</span> Female
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200">
            <RadioGroupItem value="other" id="other" />
            <Label htmlFor="other" className="font-medium text-gray-700 cursor-pointer flex items-center">
              <span className="mr-2">🧑</span> Other
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Professional Information */}
      <div>
        <Label>Department/Specialization *</Label>
        <Select
          value={formData.department}
          onValueChange={(value) => handleInputChange('department', value)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={formData.department} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cardiology">Cardiology</SelectItem>
            <SelectItem value="neurology">Neurology</SelectItem>
            <SelectItem value="orthopedics">Orthopedics</SelectItem>
            <SelectItem value="pediatrics">Pediatrics</SelectItem>
            <SelectItem value="dermatology">Dermatology</SelectItem>
            <SelectItem value="psychiatry">Psychiatry</SelectItem>
            <SelectItem value="general_medicine">General Medicine</SelectItem>
            <SelectItem value="gynecology">Gynecology</SelectItem>
            <SelectItem value="surgery">Surgery</SelectItem>
            <SelectItem value="ophthalmology">Ophthalmology</SelectItem>
            <SelectItem value="ent">ENT</SelectItem>
            <SelectItem value="radiology">Radiology</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="experience">Years of Experience *</Label>
          <Input
            id="experience"
            placeholder="0"
            type="number"
            min="0"
            max="50"
            value={formData.years_of_experience}
            onChange={(e) => handleInputChange('years_of_experience', e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="licenseNumber">License Number *</Label>
          <Input
            id="licenseNumber"
            placeholder="Enter license number"
            value={formData.license_number}
            onChange={(e) => handleInputChange('license_number', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="consultationFee">Consultation Fee (Optional)</Label>
        <Input
          id="consultationFee"
          placeholder="0.00"
          type="number"
          min="0"
          step="0.01"
          value={formData.consultation_fee}
          onChange={(e) => handleInputChange('consultation_fee', e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Consultation Modes */}
      <div>
        <Label>Consultation Mode *</Label>
        <div className="flex space-x-4 mt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="online"
              checked={formData.consultation_mode_online}
              onCheckedChange={(checked) => handleCheckboxChange('consultation_mode_online', checked)}
            />
            <Label htmlFor="online">Online Consultation</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="offline"
              checked={formData.consultation_mode_offline}
              onCheckedChange={(checked) => handleCheckboxChange('consultation_mode_offline', checked)}
            />
            <Label htmlFor="offline">In-Person Consultation</Label>
          </div>
        </div>
      </div>

      {/* Clinic Information */}
      <div>
        <Label htmlFor="clinicName">Clinic Name (Optional)</Label>
        <Input
          id="clinicName"
          placeholder="Enter your clinic name"
          value={formData.clinic_name}
          onChange={(e) => handleInputChange('clinic_name', e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="location">Location (Optional)</Label>
        <Input
          id="location"
          placeholder="Enter your clinic location"
          value={formData.location}
          onChange={(e) => handleInputChange('location', e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 pt-6">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={loading}
        >
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          className="bg-blue-900 hover:bg-blue-800"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {profileExists ? 'Updating...' : 'Saving...'}
            </>
          ) : (
            profileExists ? 'Update & Next' : 'Save & Next'
          )}
        </Button>
      </div>
    </div>
  )
}