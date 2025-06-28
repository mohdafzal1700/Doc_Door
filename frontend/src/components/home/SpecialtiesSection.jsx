"use client"

import { Heart, Baby, Shield, Stethoscope, Eye, Brain, Bone, Pill } from "lucide-react"
import { useNavigate } from "react-router-dom"

const SpecialtiesSection = () => {
  const navigate = useNavigate()

  const specialties = [
    {
      id: 1,
      name: "Cardiology",
      icon: Heart,
      color: "from-red-400 to-pink-500",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400",
      description: "Heart & cardiovascular care",
    },
    {
      id: 2,
      name: "Pediatrics",
      icon: Baby,
      color: "from-blue-400 to-cyan-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400",
      description: "Children's healthcare",
    },
    {
      id: 3,
      name: "Oncology",
      icon: Shield,
      color: "from-purple-400 to-indigo-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      textColor: "text-purple-600 dark:text-purple-400",
      description: "Cancer treatment & care",
    },
    {
      id: 4,
      name: "Dermatology",
      icon: Stethoscope,
      color: "from-green-400 to-emerald-500",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-600 dark:text-green-400",
      description: "Skin & beauty care",
    },
    {
      id: 5,
      name: "Ophthalmology",
      icon: Eye,
      color: "from-yellow-400 to-orange-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
      textColor: "text-yellow-600 dark:text-yellow-400",
      description: "Eye care & vision",
    },
    {
      id: 6,
      name: "Neurology",
      icon: Brain,
      color: "from-indigo-400 to-purple-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
      textColor: "text-indigo-600 dark:text-indigo-400",
      description: "Brain & nervous system",
    },
    {
      id: 7,
      name: "Orthopedics",
      icon: Bone,
      color: "from-gray-400 to-slate-500",
      bgColor: "bg-gray-50 dark:bg-gray-800",
      textColor: "text-gray-600 dark:text-gray-400",
      description: "Bone & joint care",
    },
    {
      id: 8,
      name: "Pharmacy",
      icon: Pill,
      color: "from-teal-400 to-cyan-500",
      bgColor: "bg-teal-50 dark:bg-teal-900/20",
      textColor: "text-teal-600 dark:text-teal-400",
      description: "Medication & prescriptions",
    },
  ]

  return (
    <section className="py-16 bg-white dark:bg-gray-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Explore Our Specialties</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Find the right specialist for your healthcare needs. Our platform connects you with experts across various
            medical fields.
          </p>
        </div>

        {/* Specialties Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
          {specialties.map((specialty, index) => {
            const IconComponent = specialty.icon
            return (
              <div
                key={specialty.id}
                className={`group cursor-pointer transition-all duration-300 hover:scale-105 animate-fade-in-up`}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => navigate(`/specialty/${specialty.id}`)}
              >
                <div
                  className={`${specialty.bgColor} rounded-2xl p-6 text-center hover:shadow-lg transition-all duration-300`}
                >
                  {/* Icon */}
                  <div
                    className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br ${specialty.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                  >
                    <IconComponent size={32} className="text-white" />
                  </div>

                  {/* Content */}
                  <h3 className={`text-lg font-semibold ${specialty.textColor} mb-2`}>{specialty.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{specialty.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA Section */}
        <div className="text-center mt-12">
          <button
            onClick={() => navigate("/specialties")}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            View All Specialties
          </button>
        </div>
      </div>
    </section>
  )
}

export default SpecialtiesSection
