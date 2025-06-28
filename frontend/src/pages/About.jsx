"use client"

import { useState, useEffect } from "react"
import {
  Heart,
  Shield,
  Users,
  Award,
  Clock,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  Target,
  Eye,
  Lightbulb,
} from "lucide-react"
import Header from "../components/home/Header"

const About = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const stats = [
    { icon: Users, value: "10,000+", label: "Happy Patients", color: "text-blue-600" },
    { icon: Heart, value: "1,200+", label: "Verified Doctors", color: "text-red-500" },
    { icon: Award, value: "4.9/5", label: "Average Rating", color: "text-yellow-500" },
    { icon: Clock, value: "24/7", label: "Support Available", color: "text-green-500" },
  ]

  const values = [
    {
      icon: Heart,
      title: "Patient-Centered Care",
      description:
        "We put patients at the heart of everything we do, ensuring personalized and compassionate healthcare.",
      color: "from-red-400 to-pink-500",
    },
    {
      icon: Shield,
      title: "Trust & Security",
      description: "Your health data is protected with enterprise-grade security and complete privacy compliance.",
      color: "from-blue-400 to-cyan-500",
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "We leverage cutting-edge technology to make healthcare more accessible and efficient for everyone.",
      color: "from-yellow-400 to-orange-500",
    },
    {
      icon: CheckCircle,
      title: "Quality Assurance",
      description:
        "All our healthcare professionals are thoroughly verified and maintain the highest standards of care.",
      color: "from-green-400 to-emerald-500",
    },
  ]

  const team = [
    {
      name: "Dr. Sarah Johnson",
      role: "Chief Medical Officer",
      image: "/placeholder.svg?height=300&width=300",
      description: "15+ years in healthcare innovation",
    },
    {
      name: "Michael Chen",
      role: "CEO & Founder",
      image: "/placeholder.svg?height=300&width=300",
      description: "Healthcare technology entrepreneur",
    },
    {
      name: "Dr. Emily Rodriguez",
      role: "Head of Quality",
      image: "/placeholder.svg?height=300&width=300",
      description: "Patient safety and care standards expert",
    },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-purple-900/20 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`text-center space-y-6 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          >
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white">
              About{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                DOC-DOOR
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              We're revolutionizing healthcare by making quality medical care accessible to everyone, anywhere, anytime.
              Our platform connects patients with verified healthcare professionals through innovative technology.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center space-x-3">
                  <Target size={32} className="text-purple-600" />
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Our Mission</h2>
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                  To democratize healthcare by providing seamless access to quality medical services, breaking down
                  barriers between patients and healthcare providers through technology and innovation.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center space-x-3">
                  <Eye size={32} className="text-blue-600" />
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Our Vision</h2>
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                  A world where everyone has instant access to trusted healthcare professionals, where distance and time
                  are no longer barriers to receiving quality medical care.
                </p>
              </div>
            </div>

            <div className="relative">
              <img
                src="/placeholder.svg?height=500&width=600"
                alt="Healthcare Mission"
                className="w-full h-auto rounded-2xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent rounded-2xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Our Impact</h2>
            <p className="text-xl text-purple-100">Making a difference in healthcare, one patient at a time</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon
              return (
                <div
                  key={index}
                  className="text-center space-y-4 animate-fade-in-up"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center">
                    <IconComponent size={32} className="text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white">{stat.value}</div>
                  <div className="text-purple-100">{stat.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Our Values</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">The principles that guide everything we do</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => {
              const IconComponent = value.icon
              return (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
                >
                  <div
                    className={`w-16 h-16 mb-6 rounded-full bg-gradient-to-br ${value.color} flex items-center justify-center`}
                  >
                    <IconComponent size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{value.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{value.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Meet Our Team</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">The passionate people behind DOC-DOOR</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <div
                key={index}
                className="text-center group animate-fade-in-up"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="relative mb-6">
                  <img
                    src={member.image || "/placeholder.svg"}
                    alt={member.name}
                    className="w-48 h-48 mx-auto rounded-full object-cover shadow-lg group-hover:shadow-xl transition-shadow duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent rounded-full"></div>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{member.name}</h3>
                <p className="text-purple-600 dark:text-purple-400 font-medium mb-2">{member.role}</p>
                <p className="text-gray-600 dark:text-gray-300">{member.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-purple-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Get In Touch</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">We'd love to hear from you</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                <MapPin size={32} className="text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Address</h3>
              <p className="text-gray-600 dark:text-gray-300">
                123 Healthcare Street
                <br />
                Medical District, MD 12345
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Phone size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Phone</h3>
              <p className="text-gray-600 dark:text-gray-300">
                +1 (555) 123-4567
                <br />
                24/7 Support Available
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <Mail size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Email</h3>
              <p className="text-gray-600 dark:text-gray-300">
                info@doc-door.com
                <br />
                support@doc-door.com
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
