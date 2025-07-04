"use client"

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ForgotPassword from "./pages/ForgotPassword"
import VerifyOtp from "./pages/VerifyOtp"
import ResetPassword from "./pages/ResetPassword"
import VerifyEmailOtp from "./pages/VerifyEmailOtp"
import Home from "./pages/Home"
import About from "./pages/About"
import PatientPortal from "./pages/PatientPortal"
import PatientProfile from "./pages/PatientProfile"
import EditProfile from "./pages/EditProfile"
import AdminLogin from "./admin/AdminLoginPage"
import Dashboard from "./admin/Dashboard"
import PatientsPage from "./admin/PatientsPage"
import DoctorRegistration from "./doctor/pages/DocVerification"
import PreVerificationView from "./doctor/pages/preverification"
import PostVerificationDashboard from "./doctor/pages/post-verification-dashboard"
import DoctorsPage from "./admin/DoctorMPage"
import DoctorApplicationsPage from "./admin/DoctorApage"
import PortalProfile from "./doctor/components/DocProfileEdit"
import PortalCertification from "./doctor/components/DocCertification"
import ManageQualifications from "./doctor/components/DocEducation"
import DoctorProfilePage from "./doctor/components/DocProfile"
import { ToastProvider } from "./components/ui/Toast"



function App() {
  return (
    <ToastProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email-otp" element={<VerifyEmailOtp />} />
        <Route path="/home" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/patientportal" element={<PatientPortal />} />
        <Route path="/patientprofile" element={<PatientProfile />} />
        <Route path="/editprofile" element={<EditProfile />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/adminloginpage" element={<AdminLogin />} />
        <Route path='/patientspage' element={<PatientsPage/>}/>
        <Route path='/doctorspage'  element={<DoctorsPage/>}/>
        <Route path='/doctorapplications'  element={<DoctorApplicationsPage/>}/>
        <Route path='/doctor-registration/*' element={<DoctorRegistration/>}/>
        <Route path='/doctor/verification'  element={<PreVerificationView/>}/>
        <Route path='/doctor/home'  element={<PostVerificationDashboard/>}/>
        <Route path='/doctor/portal'  element={<DoctorProfilePage/>}/>
        <Route path='/doctor/editProfile'  element={<PortalProfile/>}/>
        <Route path='/doctor/certification'  element={<PortalCertification />}/>
        <Route path='/doctor/education'  element={<ManageQualifications/>}/>
        
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
    </ToastProvider>
  )
}

export default App
