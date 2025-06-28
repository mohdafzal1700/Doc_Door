"use client"

import { Users, Calendar, Award, Clock } from "lucide-react"
import { useState, useEffect } from "react"

const StatsSection = () => {
  const [counters, setCounters] = useState({
    doctors: 0,
    appointments: 0,
    rating: 0,
    availability: 0,
  })

  const finalStats = {
    doctors: 1249,
    appointments: 345,
    rating: 4.8,
    availability: 24,
  }

  useEffect(() => {
    const duration = 2000 // 2 seconds
    const steps = 60
    const stepDuration = duration / steps

    const intervals = Object.keys(finalStats).map((key) => {
      const finalValue = finalStats[key]
      const increment = finalValue / steps

      return setInterval(() => {
        setCounters((prev) => ({
          ...prev,
          [key]: Math.min(prev[key] + increment, finalValue),
        }))
      }, stepDuration)
    })

    setTimeout(() => {
      intervals.forEach(clearInterval)
      setCounters(finalStats)
    }, duration)

    return () => intervals.forEach(clearInterval)
  }, [])

  const stats = [
    {
      icon: Users,
      value: Math.floor(counters.doctors),
      suffix: "+",
      label: "Trusted Doctors",
      description: "Licensed and verified professionals",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Calendar,
      value: Math.floor(counters.appointments),
      suffix: "K+",
      label: "Appointments Booked",
      description: "Successful consultations completed",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: Award,
      value: counters.rating.toFixed(1),
      suffix: "/5",
      label: "Average Rating",
      description: "Patient satisfaction score",
      color: "from-yellow-500 to-orange-500",
    },
    {
      icon: Clock,
      value: Math.floor(counters.availability),
      suffix: "/7",
      label: "Available 24/7",
      description: "Round-the-clock healthcare support",
      color: "from-purple-500 to-pink-500",
    },
  ]

  return (
    <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Why Choose DOC-DOOR?</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Join thousands of satisfied patients who trust us with their healthcare needs.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon
            return (
              <div
                key={index}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 animate-fade-in-up`}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Icon */}
                <div
                  className={`w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                >
                  <IconComponent size={32} className="text-white" />
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  <div className={`text-4xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                    {stat.value}
                    {stat.suffix}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{stat.label}</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">{stat.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Additional Features */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-4 animate-fade-in-up" style={{ animationDelay: "600ms" }}>
            <div className="w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-green-500 rounded-full"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Verified Doctors</h3>
            <p className="text-gray-600 dark:text-gray-300">
              All our healthcare professionals are licensed and verified
            </p>
          </div>

          <div className="text-center space-y-4 animate-fade-in-up" style={{ animationDelay: "750ms" }}>
            <div className="w-12 h-12 mx-auto bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Secure Platform</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your health data is protected with enterprise-grade security
            </p>
          </div>

          <div className="text-center space-y-4 animate-fade-in-up" style={{ animationDelay: "900ms" }}>
            <div className="w-12 h-12 mx-auto bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Easy Booking</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Book appointments in just a few clicks, anytime, anywhere
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default StatsSection
