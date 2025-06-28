"use client"

import { Star, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

const DoctorsSection = () => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)

  const doctors = [
    {
      id: 1,
      name: "Dr. Sarah Johnson",
      specialty: "Cardiologist",
      rating: 4.9,
      reviews: 127,
      experience: "15+ years",
      image: "/placeholder.svg?height=200&width=200",
      available: true,
    },
    {
      id: 2,
      name: "Dr. Michael Chen",
      specialty: "Pediatrician",
      rating: 4.8,
      reviews: 203,
      experience: "12+ years",
      image: "/placeholder.svg?height=200&width=200",
      available: true,
    },
    {
      id: 3,
      name: "Dr. Emily Davis",
      specialty: "Dermatologist",
      rating: 4.9,
      reviews: 156,
      experience: "10+ years",
      image: "/placeholder.svg?height=200&width=200",
      available: false,
    },
    {
      id: 4,
      name: "Dr. James Wilson",
      specialty: "Orthopedic",
      rating: 4.7,
      reviews: 89,
      experience: "18+ years",
      image: "/placeholder.svg?height=200&width=200",
      available: true,
    },
  ]

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % doctors.length)
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + doctors.length) % doctors.length)
  }

  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Meet Our Top Doctors</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Connect with experienced healthcare professionals who are dedicated to providing you with the best care.
          </p>
        </div>

        {/* Doctors Grid */}
        <div className="relative">
          {/* Navigation Buttons */}
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
          </button>

          {/* Doctors Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {doctors.map((doctor, index) => (
              <div
                key={doctor.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 ${
                  index === currentIndex ? "ring-2 ring-purple-500" : ""
                }`}
              >
                <div className="p-6">
                  {/* Doctor Image */}
                  <div className="relative mb-4">
                    <img
                      src={doctor.image || "/placeholder.svg"}
                      alt={doctor.name}
                      className="w-20 h-20 rounded-full mx-auto object-cover"
                    />
                    {doctor.available && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>

                  {/* Doctor Info */}
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{doctor.name}</h3>
                    <p className="text-purple-600 dark:text-purple-400 font-medium">{doctor.specialty}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{doctor.experience}</p>

                    {/* Rating */}
                    <div className="flex items-center justify-center space-x-1">
                      <Star size={16} className="text-yellow-500" fill="currentColor" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{doctor.rating}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">({doctor.reviews})</span>
                    </div>

                    {/* Book Button */}
                    <button
                      onClick={() => navigate(`/doctor/${doctor.id}`)}
                      disabled={!doctor.available}
                      className={`w-full mt-4 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        doctor.available
                          ? "bg-purple-600 text-white hover:bg-purple-700 transform hover:scale-105"
                          : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <Calendar size={16} className="inline mr-2" />
                      {doctor.available ? "Book Appointment" : "Not Available"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <button
            onClick={() => navigate("/doctors")}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            View All Doctors
          </button>
        </div>
      </div>
    </section>
  )
}

export default DoctorsSection
