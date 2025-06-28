"use client"

import * as React from "react"
import { Check } from "lucide-react"

const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, defaultChecked, id, ...props }, ref) => {
  const [isChecked, setIsChecked] = React.useState(checked || defaultChecked || false)

  const handleToggle = () => {
    const newChecked = !isChecked
    setIsChecked(newChecked)
    if (onCheckedChange) {
      onCheckedChange(newChecked)
    }
  }

  React.useEffect(() => {
    if (checked !== undefined) {
      setIsChecked(checked)
    }
  }, [checked])

  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={isChecked}
      onClick={handleToggle}
      className={`peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        isChecked ? "bg-blue-600 border-blue-600 text-white" : "bg-white"
      } ${className || ""}`}
      id={id}
      {...props}
    >
      {isChecked && (
        <div className="flex items-center justify-center">
          <Check className="h-3 w-3" />
        </div>
      )}
    </button>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
