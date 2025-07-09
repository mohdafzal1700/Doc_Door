import { User, LogOut } from 'lucide-react'

const PatientSidebar = ({ 
    sidebarItems, 
    activeSection, 
    setActiveSection, 
    onLogout, 
    user 
}) => {
    // Get user display data with fallbacks
    const getUserDisplayData = () => {
        if (!user) return null

        return {
            name: user.name || 
                `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
                user.username || 
                "User",
            profilePicture: user.profile_picture || user.avatar || null
        }
    }

    const displayData = getUserDisplayData()

    return (
        <div className="lg:w-80">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Patient Portal Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center overflow-hidden">
                            {displayData?.profilePicture ? (
                                <img 
                                    src={displayData.profilePicture} 
                                    alt="Profile" 
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <User className="w-6 h-6 text-white" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Patient Portal</h2>
                            {displayData?.name && (
                                <p className="text-sm text-gray-600">{displayData.name}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className="p-4">
                    <ul className="space-y-2">
                        {sidebarItems.map((item) => {
                            const IconComponent = item.icon
                            return (
                                <li key={item.id}>
                                    <button
                                        onClick={() => setActiveSection(item.id)}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors ${
                                                    activeSection === item.id
                                                ? "bg-purple-600 text-white"
                                                : "text-gray-700 hover:bg-purple-50 hover:text-purple-600"
                                        }`}
                                    >
                                        <IconComponent size={20} />
                                        <span className="font-medium">{item.name}</span>
                                    </button>
                                </li>
                            )
                        })}

                        {/* Logout Button */}
                        <li className="pt-4 border-t border-gray-200">
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut size={20} />
                                <span className="font-medium">Logout</span>
                            </button>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    )
}

export default PatientSidebar