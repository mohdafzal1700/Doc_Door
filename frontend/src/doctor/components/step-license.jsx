"use client"

import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { Label } from "../../components/ui/Label"
import { Upload } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function StepLicense() {
    const navigate = useNavigate()

    const handleBack = () => {
        navigate("../certification")
    }

    const handleSubmit = () => {
        alert("Registration submitted successfully!")
        navigate("/complete-verification", { state: { submitted: true } }) // Redirect to start or success page
    }

    return (
        <div className="space-y-6">
        <div>
            <Label htmlFor="licenseNumber">Medical License Number</Label>
            <Input id="licenseNumber" placeholder="Enter your medical license number" />
        </div>

        <div>
            <Label>License Document</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 mb-2">Drag and drop your file here, or</p>
            <Button variant="outline" className="bg-white text-gray-700">
                browse to upload
            </Button>
            <p className="text-xs text-gray-400 mt-2">Supported: PDF, JPG, PNG (Max 10MB)</p>
            </div>
        </div>

        <div>
            <Label>ID Proof</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 mb-2">Drag and drop your file here, or</p>
            <Button variant="outline" className="bg-white text-gray-700">
                browse to upload
            </Button>
            <p className="text-xs text-gray-400 mt-2">Supported: PDF, JPG, PNG (Max 10MB)</p>
            </div>
        </div>

        <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack} className="bg-gray-200 text-gray-700">
            Back
            </Button>
            <Button onClick={handleSubmit} className="bg-blue-900 hover:bg-blue-800">
            Submit Registration
            </Button>
        </div>
        </div>
    )
    }
