"use client"
import { useState } from "react"
import { Home, Calendar, MessageSquare, Bell, User, LogOut, X, Menu } from "lucide-react"
import { useNavigate } from "react-router-dom"
import DocHeaderLogo from "./DocLogo"
import { isAuthenticated, logoutUser, useAuthState } from "../../utils/auth" // Adjust path as needed
import NotificationSystem from "../home/NotificationSystem"
import MobileNotificationSystem from "../home/MNotificationSystem"

export default function DocHeader() {
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  // Use the custom auth hook for consistent state management
  const authState = useAuthState()

  const navItems = [
    { name: "Home", icon: Home, path: "/doctor/home" },
    { name: "Appointments", icon: Calendar, path: '/doctor/currentSubscription' },
    { name: "Messages", icon: MessageSquare, path: "/video-call/" },
    { name: "Notifications", icon: Bell, path: "/chat" },
  ]

  const handleNavigation = (path) => {
    navigate(path)
    setIsMenuOpen(false)
    setIsUserMenuOpen(false)
  }

  const handleProfileClick = () => {
    navigate("/doctor/portal")
    setIsUserMenuOpen(false)
    setIsMenuOpen(false)
  }

  const handleLogout = async () => {
    console.log("🔍 DocHeader: Logout clicked")
    try {
      const success = await logoutUser()
      if (success) {
        console.log("✅ DocHeader: Logout successful")
      } else {
        console.log("⚠️ DocHeader: Logout had issues but auth data cleared")
      }
    } catch (error) {
      console.error("DocHeader: Logout failed:", error)
    } finally {
      console.log("✅ DocHeader: Navigating to login after logout")
      navigate("/login")
      setIsUserMenuOpen(false)
      setIsMenuOpen(false)
    }
  }

  return (
    <header className="bg-blue-900 text-white px-6 py-4 relative">
      <div className="flex items-center justify-between">
        {/* Left side - Logo */}
        <div className="flex-1">
          <DocHeaderLogo />
        </div>

        {/* Center - Navigation (Desktop) */}
        <nav className="hidden lg:flex items-center space-x-6 flex-1 justify-center">
          {navItems.map((item) => {
            const IconComponent = item.icon
            return (
              <div
                key={item.name}
                className="flex items-center space-x-2 cursor-pointer hover:bg-blue-800 px-3 py-2 rounded transition-colors duration-200"
                onClick={() => handleNavigation(item.path)}
              >
                <IconComponent className="w-4 h-4" />
                <span>{item.name}</span>
              </div>
            )
          })}
        </nav>

        {/* Right side - User Section (Desktop) */}
        <div className="hidden lg:flex flex-1 justify-end items-center space-x-4">
          {/* User greeting */}
          {authState.isLoggedIn && authState.user && (
            <span className="text-sm text-blue-100">
              Dr. {authState.user.first_name || authState.user.name || authState.user.username || 'User'}
            </span>
          )}

          {/* Desktop Notification System */}
          <NotificationSystem isLoggedIn={authState.isLoggedIn} />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="bg-white text-blue-900 p-2 rounded-full cursor-pointer hover:bg-gray-100 transition-colors duration-200"
            >
              <User className="w-5 h-5" />
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  onClick={handleProfileClick}
                  className="flex items-center space-x-3 px-4 py-2 text-left w-full hover:bg-gray-100 transition-colors duration-200"
                >
                  <User size={16} />
                  <span>Profile</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 px-4 py-2 text-left w-full hover:bg-red-50 text-red-600 transition-colors duration-200"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center space-x-2">
          {/* Mobile Notification System */}
          <MobileNotificationSystem isLoggedIn={authState.isLoggedIn} />
          
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md text-white hover:bg-blue-800 transition-colors duration-200"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-blue-900 border-t border-blue-800 py-4 px-6 z-40">
          <div className="flex flex-col space-y-2">
            {/* Mobile Navigation Items */}
            {navItems.map((item) => {
              const IconComponent = item.icon
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.path)}
                  className="flex items-center space-x-3 px-4 py-3 text-left text-sm font-medium text-white hover:bg-blue-800 transition-colors duration-200 rounded-lg w-full"
                >
                  <IconComponent size={18} />
                  <span>{item.name}</span>
                </button>
              )
            })}

            {/* Mobile User Section */}
            <div className="border-t border-blue-800 pt-2 mt-2">
              {/* User greeting (mobile) */}
              {authState.isLoggedIn && authState.user && (
                <div className="px-4 py-2 text-sm text-blue-100">
                  Dr. {authState.user.first_name || authState.user.name || authState.user.username || 'User'}
                </div>
              )}

              {/* Mobile Profile Button */}
              <button
                onClick={handleProfileClick}
                className="flex items-center space-x-3 px-4 py-3 text-left text-sm font-medium text-white hover:bg-blue-800 transition-colors duration-200 rounded-lg w-full"
              >
                <User size={18} />
                <span>Profile</span>
              </button>

              {/* Mobile Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-4 py-3 text-left text-sm font-medium text-white hover:bg-red-600 transition-colors duration-200 rounded-lg w-full"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}