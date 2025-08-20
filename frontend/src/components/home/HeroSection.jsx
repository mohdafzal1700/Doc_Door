"use client"

import { useState, useEffect } from "react"
import { Calendar, Video, MapPin, Star, TrendingUp, Heart, Shield, Clock } from "lucide-react"
import { useNavigate } from "react-router-dom"
import docimage from "../../assets/nu.jpg";


const HeroSection = () => {
  const navigate = useNavigate()
  const [selectedLocation, setSelectedLocation] = useState("")
  const [selectedSpecialty, setSelectedSpecialty] = useState("")
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 py-20 transition-colors duration-300 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-purple-200/30 dark:bg-purple-500/10 rounded-full animate-float"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-blue-200/30 dark:bg-blue-500/10 rounded-full animate-float-delayed"></div>
        <div className="absolute bottom-32 left-1/4 w-20 h-20 bg-indigo-200/30 dark:bg-indigo-500/10 rounded-full animate-float"></div>
        <div className="absolute bottom-20 right-1/3 w-16 h-16 bg-pink-200/30 dark:bg-pink-500/10 rounded-full animate-float-delayed"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div
            className={`space-y-8 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          >
            {/* Main Heading with Typewriter Effect */}
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
                <span className="inline-block animate-fade-in-up">Professional</span>{" "}
                <span
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 animate-fade-in-up"
                  style={{ animationDelay: "0.2s" }}
                >
                  Healthcare
                </span>
                <br />
                <span className="inline-block animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
                  at Your
                </span>{" "}
                <span
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 animate-fade-in-up"
                  style={{ animationDelay: "0.6s" }}
                >
                  Fingertips
                </span>
              </h1>
              <p
                className={`text-xl text-gray-600 dark:text-gray-300 max-w-xl leading-relaxed transition-all duration-1000 delay-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
              >
                Book an appointment with Trusted Doctors instantly. Experience seamless healthcare with our platform.
              </p>
            </div>

            {/* Action Buttons with Stagger Animation */}
            <div
              className={`flex flex-col sm:flex-row gap-4 transition-all duration-1000 delay-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
            >
              <button
                onClick={() => navigate("/find-doctor")}
                className="group flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl font-semibold relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <Calendar size={20} className="mr-3 relative z-10" />
                <span className="relative z-10">Book Appointment</span>
              </button>
              <button
                onClick={() => navigate("/consultation")}
                className="group flex items-center justify-center px-8 py-4 border-2 border-purple-600 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-600 hover:text-white transform hover:scale-105 transition-all duration-300 font-semibold relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-purple-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                <Video size={20} className="mr-3 relative z-10" />
                <span className="relative z-10">Video Consultation</span>
              </button>
            </div>

            {/* Trust Indicators */}
            <div
              className={`flex items-center space-x-8 transition-all duration-1000 delay-1200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
            >
              <div className="flex items-center space-x-2">
                <Shield size={20} className="text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Verified Doctors</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock size={20} className="text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">24/7 Support</span>
              </div>
            </div>
          </div>

          {/* Right Content - Animated Image with Floating Stats */}
          <div
            className={`relative transition-all duration-1000 delay-500 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}
          >
            <div className="relative z-10">
              <div className="relative overflow-hidden rounded-2xl shadow-2xl">
                <img
                    src={docimage}
                    alt="Healthcare Professional"
                    className="w-full h-auto transform hover:scale-105 transition-transform duration-700"
                  />
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent"></div>
              </div>

              {/* Floating Stats with Enhanced Animations */}
              <div className="absolute top-8 -left-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg animate-float border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">1000+</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Doctors Online</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-8 -right-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg animate-float-delayed border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center space-x-3">
                  <Star size={20} className="text-yellow-500 animate-pulse" fill="currentColor" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">4.9/5</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Rating</p>
                  </div>
                </div>
              </div>

              <div className="absolute top-1/2 -right-8 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg animate-float border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
                <TrendingUp size={24} className="text-green-500 animate-bounce" />
              </div>

              <div className="absolute top-1/4 -left-4 bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg animate-float-delayed border border-gray-100 dark:border-gray-700">
                <Heart size={20} className="text-red-500 animate-pulse" fill="currentColor" />
              </div>
            </div>

            {/* Background Decoration with Animation */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-2xl transform rotate-3 -z-10 animate-pulse-slow"></div>
            <div
              className="absolute inset-0 bg-gradient-to-tl from-blue-400/10 to-purple-400/10 rounded-2xl transform -rotate-2 -z-20 animate-pulse-slow"
              style={{ animationDelay: "1s" }}
            ></div>
          </div>
        </div>

        {/* Enhanced Search Form */}
        <div
          className={`mt-20 max-w-4xl mx-auto transition-all duration-1000 delay-1500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {/* <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl transition-all duration-300">
           */}
{/* 
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="group">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Find doctors near you
                </label>
                <div className="relative">
                  <MapPin
                    size={20}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors duration-200"
                  />
                  <input
                    type="text"
                    placeholder="Enter your location"
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700/50 dark:text-white text-lg transition-all duration-200 hover:border-purple-300"
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Search by specialty
                </label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700/50 dark:text-white text-lg transition-all duration-200 hover:border-purple-300"
                >
                  <option value="">Select specialty</option>
                  <option value="cardiology">Cardiology</option>
                  <option value="dermatology">Dermatology</option>
                  <option value="pediatrics">Pediatrics</option>
                  <option value="orthopedics">Orthopedics</option>
                  <option value="neurology">Neurology</option>
                  <option value="oncology">Oncology</option>
                </select>
              </div>
            </div> */}

            {/* <button
              onClick={() => navigate("/find-doctor")}
              className="group w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              <span className="relative z-10">Search Doctors</span>
            </button> */}
          </div>
        </div>
      {/* </div> */}
    </section>
  )
}

export default HeroSection
