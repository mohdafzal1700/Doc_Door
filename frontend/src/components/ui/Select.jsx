"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"

const SelectContext = React.createContext()

const Select = ({ children, value, onValueChange, defaultValue }) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || "")
    const [selectedLabel, setSelectedLabel] = React.useState("")

    const handleValueChange = (newValue, label) => {
        setSelectedValue(newValue)
        setSelectedLabel(label)
        setIsOpen(false)
        if (onValueChange) {
        onValueChange(newValue)
        }
    }

    return (
        <SelectContext.Provider
        value={{
            isOpen,
            setIsOpen,
            selectedValue,
            selectedLabel,
            handleValueChange,
        }}
        >
        <div className="relative">{children}</div>
        </SelectContext.Provider>
    )
    }

    const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
    const { isOpen, setIsOpen, selectedLabel } = React.useContext(SelectContext)

    return (
        <button
        ref={ref}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
        {...props}
        >
        <span className={selectedLabel ? "text-gray-900" : "text-gray-500"}>{children}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
    )
    })
    SelectTrigger.displayName = "SelectTrigger"

    const SelectValue = ({ placeholder }) => {
    const { selectedLabel } = React.useContext(SelectContext)
    return <span>{selectedLabel || placeholder}</span>
    }

    const SelectContent = ({ children, className }) => {
    const { isOpen } = React.useContext(SelectContext)

    if (!isOpen) return null

    return (
        <div
        className={`absolute top-full left-0 z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto ${className || ""}`}
        >
        <div className="py-1">{children}</div>
        </div>
    )
    }

    const SelectItem = ({ value, children, className }) => {
    const { selectedValue, handleValueChange } = React.useContext(SelectContext)
    const isSelected = selectedValue === value

    return (
        <div
        onClick={() => handleValueChange(value, children)}
        className={`relative flex cursor-pointer select-none items-center px-3 py-2 text-sm hover:bg-gray-100 ${
            isSelected ? "bg-blue-50 text-blue-600" : "text-gray-900"
        } ${className || ""}`}
        >
        <span className="flex-1">{children}</span>
        {isSelected && <Check className="h-4 w-4 ml-2" />}
        </div>
    )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
