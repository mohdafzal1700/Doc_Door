    "use client"

    import {  Routes, Route, Navigate } from "react-router-dom"
    import DocLayout from "../components/DocLayout.jsx"
    import StepProfile from "../components/step-profile.jsx"
    import StepEducation from "../components/step-education.jsx"
    import StepCertification from "../components/step-certification.jsx"
    import StepLicense from "../components/step-license.jsx"

    export default function DoctorRegistration() {
        return (
            
                <DocLayout>
                    
                    <Routes>
                <Route path="/" element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<StepProfile />} />
                <Route path="education" element={<StepEducation />} />
                <Route path="certification" element={<StepCertification />} />
                <Route path="license" element={<StepLicense />} />
            </Routes>
                    
                </DocLayout>
            
        )
        }
