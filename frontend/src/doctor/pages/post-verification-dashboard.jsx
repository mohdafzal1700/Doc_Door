"use client"

import Button from "../../components/ui/Button"
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "../../components/ui/card" 
import { Calendar, Users, Clock, Plus, Edit, ChevronRight } from "lucide-react"
import DocHeader from "../../components/ui/DocHeader"

export default function PostVerificationDashboard({ onToggleVerification }) {
    const todaysAppointments = [
        { id: 1, time: "09:00 AM", patient: "John Doe", type: "Consultation", status: "confirmed" },
        { id: 2, time: "10:30 AM", patient: "Sarah Wilson", type: "Follow-up", status: "pending" },
        { id: 3, time: "02:00 PM", patient: "Mike Johnson", type: "Check-up", status: "confirmed" },
    ]

    const quickActions = [
        { icon: Plus, label: "Add New Appointment", color: "bg-blue-500", hoverColor: "hover:bg-blue-600" },
        { icon: Calendar, label: "View Availability", color: "bg-green-500", hoverColor: "hover:bg-green-600" },
        { icon: Users, label: "My Patients List", color: "bg-purple-500", hoverColor: "hover:bg-purple-600" },
        { icon: Edit, label: "Edit Profile", color: "bg-orange-500", hoverColor: "hover:bg-orange-600" },
    ]

    // Mini calendar data
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()
    const today = currentDate.getDate()

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()

    const appointmentDays = [5, 12, 18, 23, 28] // Days with appointments
    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]

    const renderCalendar = () => {
        const days = []
        const totalCells = 42 // 6 rows × 7 days

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<div key={`empty-${i}`} className="h-8"></div>)
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today
        const hasAppointment = appointmentDays.includes(day)

        days.push(
            <div
            key={day}
            className={`h-8 flex items-center justify-center text-sm relative cursor-pointer hover:bg-blue-50 rounded ${
                isToday ? "bg-blue-500 text-white font-bold" : "text-gray-700"
            }`}
            >
            {day}
            {hasAppointment && !isToday && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full"></div>
            )}
            </div>,
        )
        }

        // Fill remaining cells
        const remainingCells = totalCells - (firstDayOfMonth + daysInMonth)
        for (let i = 0; i < remainingCells; i++) {
        days.push(<div key={`empty-end-${i}`} className="h-8"></div>)
        }

        return days
    }

    return (
        <div className="min-h-screen bg-gray-50">
        <DocHeader/>
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Top Welcome Header */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between">
                <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, Dr. Smith 👋</h1>
                <p className="text-gray-600">Here's what's happening today</p>
                </div>
                <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600">DS</span>
                </div>
                <Button
                    variant="outline"
                    onClick={onToggleVerification}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                >
                    Simulate Unverified
                </Button>
                </div>
            </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                    <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                        <p className="text-blue-100 text-sm font-medium">Appointments Today</p>
                        <p className="text-4xl font-bold">3</p>
                        <p className="text-blue-100 text-sm">scheduled</p>
                        </div>
                        <Calendar className="w-12 h-12 text-blue-200" />
                    </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                    <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                        <p className="text-green-100 text-sm font-medium">Patients to Visit</p>
                        <p className="text-4xl font-bold">5</p>
                        <p className="text-green-100 text-sm">total</p>
                        </div>
                        <Users className="w-12 h-12 text-green-200" />
                    </div>
                    </CardContent>
                </Card>
                </div>

                {/* Today's Appointments */}
                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-blue-600" />
                        Today's Appointments
                    </div>
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                        View All Appointments
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                    {todaysAppointments.map((appointment) => (
                        <div
                        key={appointment.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                                {appointment.patient
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            </div>
                            <div>
                            <p className="font-semibold text-gray-900">{appointment.patient}</p>
                            <p className="text-sm text-gray-600">{appointment.type}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-semibold text-blue-600">{appointment.time}</p>
                            <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                appointment.status === "confirmed"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                            >
                            {appointment.status}
                            </span>
                        </div>
                        </div>
                    ))}
                    </div>
                </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {quickActions.map((action, index) => {
                        const Icon = action.icon
                        return (
                        <div
                            key={index}
                            className={`${action.color} ${action.hoverColor} text-white p-6 rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg`}
                        >
                            <div className="text-center">
                            <Icon className="w-8 h-8 mx-auto mb-3" />
                            <p className="text-sm font-medium">{action.label}</p>
                            </div>
                        </div>
                        )
                    })}
                    </div>
                </CardContent>
                </Card>
            </div>

            {/* Right Column - Mini Calendar */}
            <div className="space-y-6">
                <Card>
                <CardHeader>
                    <CardTitle className="text-center">
                    {monthNames[currentMonth]} {currentYear}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-7 gap-1 mb-4">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                        {day}
                        </div>
                    ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
                    <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-600">
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                        Today
                    </div>
                    <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        Appointments
                    </div>
                    </div>
                </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                    <span className="text-gray-600">This Week</span>
                    <span className="font-semibold">18 appointments</span>
                    </div>
                    <div className="flex items-center justify-between">
                    <span className="text-gray-600">This Month</span>
                    <span className="font-semibold">72 appointments</span>
                    </div>
                    <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Patients</span>
                    <span className="font-semibold">247</span>
                    </div>
                    <div className="flex items-center justify-between">
                    <span className="text-gray-600">Pending Reviews</span>
                    <span className="font-semibold text-orange-600">3</span>
                    </div>
                </CardContent>
                </Card>
            </div>
            </div>
        </div>
        </div>
    )
    }
