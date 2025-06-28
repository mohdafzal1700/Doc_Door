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
      className={`aspect-square h-4 w-4 rounded-full border border-gray-300 text-blue-600 ring-offset-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        isSelected ? "bg-blue-600 border-blue-600" : "bg-white"
      } ${className || ""}`}
      id={id}
      {...props}
    >
      {isSelected && (
        <div className="flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>
      )}
    </button>
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
