"use client"

const UserTypeToggle = ({ value, onChange }) => {
    return (
        <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
        <div className="flex bg-gray-200 rounded-lg p-1">
            <button
            type="button"
            onClick={() => onChange("patient")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                value === "patient" ? "bg-white text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            >
            Patient
            </button>
            <button
            type="button"
            onClick={() => onChange("doctor")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                value === "doctor" ? "bg-white text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            >
            Doctor
            </button>
        </div>
        </div>
    )
}

export default UserTypeToggle
