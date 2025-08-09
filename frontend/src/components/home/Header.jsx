"use client"
import { useState } from "react"
import { Home, Search, Video, Info, User, Menu, X, LogOut } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import HeaderLogo from "../ui/HeaderLogo"
import ThemeToggle from "../ui/ThemeToggle"
import NotificationSystem from "./NotificationSystem"
import MobileNotificationSystem from "./MNotificationSystem"
import { isAuthenticated, logoutUser, useAuthState } from "../../utils/auth"

const ROUTES = {
  HOME: "/home",
  FIND_DOCTOR: '/patient/findDoctor',
  CONSULTATION: "/consultation",
  ABOUT: "/about",  
  LOGIN: "/login",
  PATIENT_PORTAL: "/patientportal"
}

const Header = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Use the custom auth hook for consistent state management
  const authState = useAuthState()

  const navItems = [
    { name: "Home", path: ROUTES.HOME, icon: Home },
    { name: "Find Doctor", path: ROUTES.FIND_DOCTOR, icon: Search },
    { name: "Video Consultation", path: ROUTES.CONSULTATION, icon: Video },
    { name: "About Us", path: ROUTES.ABOUT, icon: Info },
  ]

  const handleProfileClick = async () => {
    console.log("🔍 Profile button clicked in Header")
    console.log("Header auth state:", authState)
    try {
      const isAuth = await isAuthenticated()
      if (isAuth && authState.isLoggedIn) {
        console.log("Header: User is authenticated, navigating to patient portal")
        navigate("/patientportal")
        setIsMenuOpen(false)
      } else {
        console.log("Header: User not authenticated, redirecting to login")
        navigate("/login")
        setIsMenuOpen(false)
      }
    } catch (error) {
      console.error("Header: Auth check failed:", error)
      navigate("/login")
      setIsMenuOpen(false)
    }
  }

  const handleLogout = async () => {
    console.log("🔍 Header: Logout clicked")
    try {
      const success = await logoutUser()
      if (success) {
        console.log("✅ Header: Logout successful")
      } else {
        console.log("⚠️ Header: Logout had issues but auth data cleared")
      }
    } catch (error) {
      console.error("Header: Logout failed:", error)
    } finally {
      console.log("✅ Header: Navigating to login after logout")
      navigate("/login")
      setIsMenuOpen(false)
    }
  }

  const getCurrentPage = () => {
    return navItems.find(item => location.pathname === item.path)
  }

  const currentPage = getCurrentPage()

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-100 dark:border-gray-800 transition-colors duration-300 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <div className="flex items-center cursor-pointer" onClick={() => {
            navigate("/home")
            setIsMenuOpen(false)
          }}>
            <HeaderLogo />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center justify-center space-x-8">
            {navItems.map((item) => {
              const IconComponent = item.icon
              const isActive = currentPage?.path === item.path
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.path)
                    setIsMenuOpen(false)
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg group ${
                    isActive
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400"
                  }`}
                >
                  <IconComponent
                    size={18}
                    className={`transition-colors duration-200 ${
                      isActive
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                    }`}
                  />
                  <span>{item.name}</span>
                </button>
              )
            })}
          </nav>

          {/* Desktop Right Section */}
          <div className="hidden lg:flex items-center space-x-2">
            {/* User greeting (when logged in) */}
            {authState.isLoggedIn && authState.user && (
              <span className="text-sm text-gray-600 dark:text-gray-300 mr-2">
                Hi, {authState.user.first_name || authState.user.name || authState.user.username || 'User'}
                {authState.userType && (
                  <span className="ml-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                    {authState.userType}
                  </span>
                )}
              </span>
            )}

            {/* Desktop Notification System */}
            <NotificationSystem isLoggedIn={authState.isLoggedIn} />

            {/* Profile Button */}
            <button
              onClick={handleProfileClick}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors duration-200 group"
              title={authState.isLoggedIn ? "Go to Profile" : "Login"}
            >
              <User size={20} className="text-gray-600 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
            </button>

            {/* Logout Button (only when logged in) */}
            {authState.isLoggedIn && (
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200 group"
                title="Logout"
              >
                <LogOut size={20} className="text-gray-600 dark:text-gray-300 group-hover:text-red-600 dark:group-hover:text-red-400" />
              </button>
            )}

            <ThemeToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center space-x-2">
            {/* Mobile Notification System */}
            <MobileNotificationSystem isLoggedIn={authState.isLoggedIn} />

            <ThemeToggle />
            
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-col space-y-2">
              {/* Mobile Navigation Items */}
              {navItems.map((item) => {
                const IconComponent = item.icon
                const isActive = currentPage?.path === item.path
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      navigate(item.path)
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center space-x-3 px-4 py-3 text-left text-sm font-medium transition-colors duration-200 rounded-lg ${
                      isActive
                        ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20"
                        : "text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    }`}
                  >
                    <IconComponent size={18} />
                    <span>{item.name}</span>
                  </button>
                )
              })}

              {/* Mobile User Section */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                {/* User greeting (mobile) */}
                {authState.isLoggedIn && authState.user && (
                  <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                    Hi, {authState.user.first_name || authState.user.name || authState.user.username || 'User'}
                    {authState.userType && (
                      <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                        {authState.userType}
                      </span>
                    )}
                  </div>
                )}

                {/* Mobile Profile Button */}
                <button
                  onClick={handleProfileClick}
                  className="flex items-center space-x-3 px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors duration-200 rounded-lg w-full"
                >
                  <User size={18} />
                  <span>{authState.isLoggedIn ? "Profile" : "Login"}</span>
                </button>

                {/* Mobile Logout Button (only when logged in) */}
                {authState.isLoggedIn && (
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200 rounded-lg w-full"
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header