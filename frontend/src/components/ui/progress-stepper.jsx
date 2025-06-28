import { Check } from "lucide-react"
import { useLocation } from "react-router-dom"

export default function ProgressStepper() {
    const location = useLocation()
    
    const steps = [
        { number: 1, label: "Profile", path: "profile" },
        { number: 2, label: "Education", path: "education" },
        { number: 3, label: "Certification", path: "certification" },
        { number: 4, label: "License", path: "license" },
    ]
    
    const getCurrentStep = () => {
        const currentPath = location.pathname
        // Extract the last segment of the path (e.g., "profile" from "/doctor-registration/profile")
        const pathSegment = currentPath.split('/').pop()
        const step = steps.find((step) => step.path === pathSegment)
        return step ? step.number : 1
    }
    
    const currentStep = getCurrentStep()
    
    return (
        <div className="flex items-center justify-center mb-8">
            {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                                step.number <= currentStep ? "bg-blue-900" : "bg-gray-300"
                            }`}
                        >
                            {step.number < currentStep ? <Check className="w-5 h-5" /> : step.number}
                        </div>
                        <span className="text-sm mt-2 text-gray-600">{step.label}</span>
                    </div>
                    {index < steps.length - 1 && (
                        <div className={`w-20 h-0.5 mx-4 ${step.number < currentStep ? "bg-blue-900" : "bg-gray-300"}`} />
                    )}
                </div>
            ))}
        </div>
    )
}