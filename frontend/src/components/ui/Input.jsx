"use client"

const Input = ({ label, type = "text", placeholder, value, onChange, error, icon }) => {
    return (
        <div className="mb-4">
        {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <div className="relative">
            {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">{icon}</div>}
            <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={`w-full ${icon ? "pl-10" : "pl-3"} pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400`}
            />
        </div>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
    )
    }

export default Input
