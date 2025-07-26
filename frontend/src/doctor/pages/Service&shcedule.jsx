"use client"
import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ChevronLeft, Calendar, Settings } from "lucide-react"
import Button from "../../components/ui/Button"
import DocHeader from '../../components/ui/DocHeader'
import DoctorSidebar from '../../components/ui/DocSide'
import ServicePage from "./service_management"
import ScheduleManagement from './ScheduleManagement'

export default function ScheduleService() {
  const [activeTab, setActiveTab] = useState("schedules") // Default to schedules
  const navigate = useNavigate()
  const location = useLocation()

  // Handle tab change - just update state, no navigation
  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  // Handle back button
  const handleBack = () => {
    navigate(-1) // Go back one step in history
  }

  // Set active tab based on current route on component mount
  useEffect(() => {
    const currentPath = location.pathname
    if (currentPath.includes('/doctor/service')) {
      setActiveTab("services")
    } else if (currentPath.includes('/doctor/schedule')) {
      setActiveTab("schedules")
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <DocHeader />
      <div className="flex">
        <DoctorSidebar />
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full hover:bg-gray-100 transition-colors"
                  onClick={handleBack}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                    Schedule & Service Management
                  </h1>
                  <p className="text-gray-600">
                    Manage your schedules and services in one place
                  </p>
                </div>
              </div>
            </div>

            {/* Enhanced Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="flex">
                <button
                  onClick={() => handleTabChange("schedules")}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all duration-200 rounded-l-xl ${
                    activeTab === "schedules"
                      ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Calendar className="h-5 w-5" />
                  <span className="hidden sm:inline">Schedule Management</span>
                  <span className="sm:hidden">Schedules</span>
                </button>
                <div className="w-px bg-gray-200"></div>
                <button
                  onClick={() => handleTabChange("services")}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all duration-200 rounded-r-xl ${
                    activeTab === "services"
                      ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Settings className="h-5 w-5" />
                  <span className="hidden sm:inline">Service Management</span>
                  <span className="sm:hidden">Services</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Tab Content Header */}
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <div className="flex items-center gap-3">
                  {activeTab === "schedules" ? (
                    <>
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Schedule Management</h2>
                    </>
                  ) : (
                    <>
                      <Settings className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Service Management</h2>
                    </>
                  )}
                </div>
              </div>

              {/* Content - Conditionally render based on activeTab */}
              <div className="min-h-[500px] transition-all duration-300 ease-in-out">
                {activeTab === "schedules" && (
                  <div className="animate-fadeIn">
                    <ScheduleManagement />
                  </div>
                )}
                {activeTab === "services" && (
                  <div className="animate-fadeIn">
                    <ServicePage />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Need help? Contact support or check our documentation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}