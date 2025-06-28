"use client"

import { Heart, Stethoscope, MapPin, Clock } from "lucide-react"
import { useNavigate } from "react-router-dom"

const SecondaryHero = () => {
  const navigate = useNavigate()

  return (
    <section className="bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 py-16 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-float"></div>
        <div className="absolute top-32 right-20 w-16 h-16 bg-white/10 rounded-full animate-float-delayed"></div>
        <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-white/10 rounded-full animate-float"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-white space-y-6 animate-fade-in-up">
            <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
              Find Your Nearest Doctor &
              <br />
              <span className="text-yellow-300">Book Appointments Hassle-Free</span>
            </h2>
            <p className="text-xl text-blue-100 max-w-lg">
              Experience seamless healthcare booking with our AI-driven platform. Connect with verified doctors in your
              area.
            </p>

            {/* Features */}
            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <MapPin size={20} className="text-white" />
                </div>
                <span className="text-blue-100">Find nearby doctors</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Clock size={20} className="text-white" />
                </div>
                <span className="text-blue-100">24/7 availability</span>
              </div>
            </div>

            <button
              onClick={() => navigate("/find-doctor")}
              className="inline-flex items-center px-8 py-4 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Get Started
            </button>
          </div>

          {/* Right Content - Illustration */}
          <div className="relative animate-fade-in-right">
            <div className="relative z-10 flex items-center justify-center">
              {/* Heart with Stethoscope Illustration */}
              <div className="relative">
                <div className="w-64 h-64 bg-gradient-to-br from-red-400 to-pink-500 rounded-full flex items-center justify-center shadow-2xl animate-pulse-slow">
                  <Heart size={120} className="text-white" fill="currentColor" />
                </div>
                {/* Stethoscope */}
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/20 rounded-full flex items-center justify-center animate-float">
                  <Stethoscope size={60} className="text-white" />
                </div>
                {/* Medical Cross */}
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white rounded-lg flex items-center justify-center shadow-lg animate-float-delayed">
                  <div className="w-8 h-8 relative">
                    <div className="absolute inset-x-0 top-1/2 h-1 bg-red-500 transform -translate-y-1/2"></div>
                    <div className="absolute inset-y-0 left-1/2 w-1 bg-red-500 transform -translate-x-1/2"></div>
                  </div>
                </div>
              </div>
            </div>
            {/* Background Glow */}
            <div className="absolute inset-0 bg-white/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SecondaryHero

