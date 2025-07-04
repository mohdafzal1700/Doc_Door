"use client"

import { useState } from "react"
import { User, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import DocHeaderLogo from "./DocLogo"
import { 
  logoutUser, 
  useAuthState 
} from "../../utils/auth" // Adjust path as needed

export default function DocHe() {
  const navigate = useNavigate()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  
  // Use the custom auth hook for consistent state management
  const authState = useAuthState()

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
    }
  }

  return (
    <header className="bg-blue-900 text-white px-6 py-4 relative">
      <div className="flex items-center justify-between">
        {/* Left side - Logo */}
        <div className="flex-1">
          <DocHeaderLogo />
        </div>

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
    </header>
  )
}