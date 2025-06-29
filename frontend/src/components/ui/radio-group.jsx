"use client"

import * as React from "react"

const RadioGroupContext = React.createContext()

const RadioGroup = React.forwardRef(({ className, value, onValueChange, defaultValue, ...props }, ref) => {
  const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || "")

  const handleValueChange = (newValue) => {
    setSelectedValue(newValue)
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
    }
  }, [value])

  return (
    <RadioGroupContext.Provider value={{ selectedValue, handleValueChange }}>
      <div ref={ref} role="radiogroup" className={`grid gap-2 ${className || ""}`} {...props} />
    </RadioGroupContext.Provider>
  )
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef(({ className, value, id, ...props }, ref) => {
  const { selectedValue, handleValueChange } = React.useContext(RadioGroupContext)
  const isSelected = selectedValue === value

  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={() => handleValueChange(value)}
      className={`relative aspect-square h-5 w-5 rounded-full border-2 transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-blue-400 ${
        isSelected 
          ? "bg-blue-600 border-blue-600 shadow-md" 
          : "bg-white border-gray-300 hover:bg-blue-50"
      } ${className || ""}`}
      id={id}
      {...props}
    >
      {isSelected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-white animate-scale-in" />
        </div>
      )}
    </button>
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

// Enhanced Radio Card Component for better UX
const RadioCard = React.forwardRef(({ className, value, id, children, icon, description, ...props }, ref) => {
  const { selectedValue, handleValueChange } = React.useContext(RadioGroupContext)
  const isSelected = selectedValue === value

  return (
    <label
      htmlFor={id}
      className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ease-in-out hover:border-blue-300 hover:bg-blue-50 ${
        isSelected 
          ? "border-blue-600 bg-blue-50 shadow-md" 
          : "border-gray-200 bg-white"
      } ${className || ""}`}
    >
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={() => handleValueChange(value)}
        className={`mr-3 aspect-square h-5 w-5 rounded-full border-2 transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          isSelected 
            ? "bg-blue-600 border-blue-600" 
            : "bg-white border-gray-300"
        }`}
        id={id}
        {...props}
      >
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-white animate-scale-in" />
          </div>
        )}
      </button>
      
      <div className="flex-1">
        <div className="flex items-center">
          {icon && <span className="mr-2 text-lg">{icon}</span>}
          <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
            {children}
          </span>
        </div>
        {description && (
          <p className={`text-sm mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
            {description}
          </p>
        )}
      </div>
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
        </div>
      )}
    </label>
  )
})
RadioCard.displayName = "RadioCard"

export { RadioGroup, RadioGroupItem, RadioCard }