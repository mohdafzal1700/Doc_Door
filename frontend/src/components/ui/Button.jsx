"use client"

const Button = ({ children, onClick, type = "button", variant = "primary", className = "", disabled = false }) => {
    const baseClasses = "w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center transition-colors"

    const variants = {
        primary: "bg-purple-600 text-white hover:bg-purple-700",
        outline: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
    }

    return (
        <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`${baseClasses} ${variants[variant]} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
        {children}
        </button>
    )
    }

export default Button
