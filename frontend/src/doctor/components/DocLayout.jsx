import DocHeader from "../../components/ui/DocHeader.jsx"
import ProgressStepper from "../../components/ui/progress-stepper.jsx"

export default function DocLayout({ children }) {
    return (
        <div className="min-h-screen bg-gray-100">
        <DocHeader />
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-2xl font-bold text-center mb-8 text-gray-800">Doctor Registration</h1>
            <ProgressStepper />
            {children}
            </div>
        </div>
        </div>
    )
    }
