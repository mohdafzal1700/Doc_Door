import { Star, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getPatientDoctors, handleApiError } from "../../endpoints/APIs" 

const DoctorsSection = () => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Handle booking appointment - Updated to use new route
  const handleBookAppointment = (doctorId) => {
    navigate(`/patient/doctor/${doctorId}`)
  }

  // Handle view all doctors
  const handleViewAllDoctors = () => {
    navigate('/doctors')
  }

  // Fetch doctors from backend
  const fetchDoctors = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await getPatientDoctors()
      console.log('API Response:', response) // Debug log
      
      // Check if response has the expected structure
      let doctorsData = []
      if (response.data) {
        if (Array.isArray(response.data)) {
          doctorsData = response.data
        } else if (response.data.data && Array.isArray(response.data.data)) {
          doctorsData = response.data.data
        } else if (response.data.results && Array.isArray(response.data.results)) {
          doctorsData = response.data.results
        } else {
          throw new Error('Invalid data format received from server')
        }
      } else {
        throw new Error('No data received from server')
      }
      
      const transformedDoctors = doctorsData.map(doctorData => {
        console.log('Doctor Data:', doctorData) // Debug log
        
        // Handle the flattened structure with doctor_ prefixed fields
        if (!doctorData.id) {
          console.warn('Doctor data missing ID:', doctorData)
          return null
        }
        
        return {
          id: doctorData.id,
          name: doctorData.full_name || 
                `${doctorData.doctor_first_name || ''} ${doctorData.doctor_last_name || ''}`.trim() || 
                doctorData.email || doctorData.username || 'Unknown Doctor',
          specialty: doctorData.doctor_specialization || doctorData.doctor_department || 'General Practice',
          rating: parseFloat(doctorData.doctor_rating) || 4.8, // Add rating field if available
          reviews: parseInt(doctorData.doctor_reviews) || Math.floor(Math.random() * 200) + 50, // Add reviews field if available
          experience: doctorData.doctor_experience ? `${parseInt(doctorData.doctor_experience)}+ years` : 'N/A',
          image: doctorData.profile_picture_url || "/default-doctor.png",
          available: doctorData.doctor_is_available !== false,
          consultation_fee: parseInt(doctorData.doctor_consultation_fee || 0),
          consultation_mode_online: Boolean(doctorData.doctor_consultation_mode_online),
          consultation_mode_offline: Boolean(doctorData.doctor_consultation_mode_offline),
          clinic_name: doctorData.doctor_clinic_name || '',
          location: doctorData.doctor_location || '',
          verification_status: doctorData.doctor_verification_status || 'pending',
          bio: doctorData.doctor_bio || '',
          license_number: doctorData.doctor_license_number || '',
          gender: doctorData.doctor_gender || '',
          date_of_birth: doctorData.doctor_date_of_birth || '',
          profile_completed: doctorData.profile_completed || false,
          has_profile_picture: doctorData.has_profile_picture || false
        }
      }).filter(doctor => doctor !== null) // Filter out any invalid entries
      
      setDoctors(transformedDoctors)
      setCurrentIndex(0) // Reset to first slide when new data loads
    } catch (err) {
      console.error('Error fetching doctors:', err)
      const errorInfo = handleApiError(err)
      setError(errorInfo.message || 'Failed to load doctors. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDoctors()
  }, [])

  // Fixed carousel navigation
  const nextSlide = () => {
    if (doctors.length <= 3) return // Don't navigate if 3 or fewer doctors
    setCurrentIndex((prev) => {
      const nextIndex = prev + 3
      return nextIndex >= doctors.length ? 0 : nextIndex
    })
  }

  const prevSlide = () => {
    if (doctors.length <= 3) return // Don't navigate if 3 or fewer doctors
    setCurrentIndex((prev) => {
      const prevIndex = prev - 3
      return prevIndex < 0 ? Math.max(0, doctors.length - 3) : prevIndex
    })
  }

  // Get current doctors to display
  const getCurrentDoctors = () => {
    if (doctors.length <= 3) {
      return doctors // Show all if 3 or fewer
    }
    
    const remainingDoctors = doctors.length - currentIndex
    if (remainingDoctors >= 3) {
      return doctors.slice(currentIndex, currentIndex + 3)
    } else {
      // If less than 3 remaining, show from current index to end
      return doctors.slice(currentIndex)
    }
  }

  // Loading state
  if (loading) {
    return (
      <section className="py-16 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Meet Our Healthcare Professionals</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Connecting you with qualified doctors for your healthcare needs.
            </p>
          </div>
          <div className="flex flex-col justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            <span className="mt-4 text-gray-600 dark:text-gray-300 text-lg">Loading our medical specialists...</span>
            <p className="text-gray-500 dark:text-gray-400 mt-2">This may take a moment</p>
          </div>
        </div>
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section className="py-16 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Our Medical Team</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              We're having trouble loading our doctors list.
            </p>
          </div>
          <div className="text-center py-20">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
              <div className="flex flex-col items-center">
                <svg className="w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Unable to Load Doctors</h3>
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <div className="flex space-x-3">
                  <button
                    onClick={fetchDoctors}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </button>
                  <button
                    onClick={() => navigate('/contact')}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                  >
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // Empty state
  if (doctors.length === 0) {
    return (
      <section className="py-16 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Our Medical Team</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Currently there are no doctors available in your area.
            </p>
          </div>
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">No Doctors Found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We couldn't find any doctors matching your criteria. Please check back later or expand your search.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={fetchDoctors}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                >
                  Refresh
                </button>
                <button
                  onClick={() => navigate('/contact')}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  Request a Doctor
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const currentDoctors = getCurrentDoctors()

  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3">Our Healthcare Providers</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Qualified professionals ready to assist with your medical needs.
          </p>
          {doctors.length > 3 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Showing {Math.min(currentIndex + 1, doctors.length)}-{Math.min(currentIndex + currentDoctors.length, doctors.length)} of {doctors.length} doctors
            </p>
          )}
        </div>

        {/* Doctors Grid */}
        <div className="relative">
          {/* Navigation Buttons - only show if more than 3 doctors */}
          {doctors.length > 3 && (
            <>
              <button
                onClick={prevSlide}
                disabled={currentIndex === 0}
                className={`absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  currentIndex === 0 
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                aria-label="Previous doctors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextSlide}
                disabled={currentIndex + 3 >= doctors.length}
                className={`absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 z-10 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  currentIndex + 3 >= doctors.length 
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                aria-label="Next doctors"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Doctors Cards */}
          <div className={`grid gap-6 ${currentDoctors.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' : currentDoctors.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
            {currentDoctors.map((doctor) => (
              <div
                key={doctor.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 dark:border-gray-700"
              >
                <div className="p-6">
                  {/* Doctor Image and Info Layout */}
                  <div className="flex items-start space-x-4">
                    {/* Doctor Image */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={doctor.image}
                        alt={`Dr. ${doctor.name}`}
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                        onError={(e) => {
                          e.target.src = "/default-doctor.png"
                        }}/>
                      
                      {/* Availability Indicator */}
                      {doctor.available ? (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      ) : (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-400 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                      
                      {/* Verification Badge */}
                      {doctor.verification_status === 'approved' && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Doctor Details */}
                    <div className="flex-1 min-w-0">
                      {/* Name and Experience Row */}
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-2">
                          {doctor.name}
                        </h3>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {doctor.experience}
                        </span>
                      </div>

                      {/* Specialty */}
                      <p className="text-purple-600 dark:text-purple-400 font-medium mb-2">
                        {doctor.specialty}
                      </p>

                      {/* Rating */}
                      <div className="flex items-center space-x-1 mb-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {doctor.rating}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({doctor.reviews} reviews)
                        </span>
                      </div>

                      {/* Consultation Fee */}
                      {doctor.consultation_fee > 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Consultation: ₹{doctor.consultation_fee}
                        </p>
                      )}

                      {/* Consultation Modes */}
                      <div className="flex items-center space-x-2 mb-2">
                        {doctor.consultation_mode_online && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                            Online
                          </span>
                        )}
                        {doctor.consultation_mode_offline && (
                          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                            In-person
                          </span>
                        )}
                      </div>

                      {/* Availability Status */}
                      <div className="flex items-center space-x-2 mb-4">
                        <span className={`flex items-center text-sm ${doctor.available ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <div className={`w-2 h-2 rounded-full mr-1 ${doctor.available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          {doctor.available ? 'Available now' : 'Not available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Book Appointment Button */}
                  <button
                    onClick={() => handleBookAppointment(doctor.id)}
                    disabled={!doctor.available}
                    className={`w-full mt-4 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                      doctor.available
                        ? "bg-purple-600 text-white hover:bg-purple-700 transform hover:scale-[1.02] shadow-md hover:shadow-lg focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    }`}
                    aria-label={`Book appointment with Dr. ${doctor.name}`}
                  >
                    <Calendar size={16} className={doctor.available ? "text-white" : "text-gray-400"} />
                    <span>{doctor.available ? "Book Appointment" : "Currently Unavailable"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <button
            onClick={handleViewAllDoctors}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            View All Doctors
          </button>
        </div>
      </div>
    </section>
  )
}

export default DoctorsSection