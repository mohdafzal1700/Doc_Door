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

import PatientDoctor from "./pages/PatientDoctorpage"
import MedicalRecordForm from "./pages/medical_records"
import AppointmentBooking from "./pages/BookAppointmentPage "
import MyAppointments from "./pages/MyAppoinments"
import AppointmentRequestsPage from "./doctor/pages/appointment-requests"
import DoctorDashboard from "./doctor/pages/appoinment-page"
import FindDoctorPage from "./pages/FindDoctorPage"
import NearbyDoctorFinder from "./doctor/pages/NearbyDoctorFinder "
import Plan from "./admin/Adminplan"
import SubscriptionPlanForm from "./admin/Adminplanform"
import CurrentSubscription from "./doctor/pages/currentSubscription"
import ChoosePlanDashboard from "./doctor/pages/ChoosePlan"
import ChatApp from "./Chat/chat"
import ScheduleService from "./doctor/pages/Service&shcedule"
import DocDashboard from "./doctor/pages/dashboard"

import { VideoCallProvider } from "./videocall/context"
import GlobalVideoCallWrapper from "./videocall/wrapper"
import PaymentPage from "./pages/payment_conformation"


function App() {


  


  return (
    <ToastProvider>
      <VideoCallProvider>
    <GlobalVideoCallWrapper>
      
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
        
        <Route path='/doctor/schedule'  element={<ScheduleService/>}/>
        <Route path='/patient/doctor/:id' element={<PatientDoctor/>}/>
        <Route path="/patient/medical_record" element={<MedicalRecordForm />} />
        <Route path='/patient/appointmentBooking/:id' element={<AppointmentBooking />} />
        <Route path='/patient/myAppointments' element={<MyAppointments />} />
        <Route path='/doctor/appointmentsRequest' element={<AppointmentRequestsPage/>} />
        <Route path='/doctor/appointmentsPage' element={<DoctorDashboard/>} />
        <Route path='/patient/findDoctor' element={<FindDoctorPage/>} />
        <Route path='/patient/nearbyDoctorFinder' element={<NearbyDoctorFinder/>} />
        <Route path='/admin/Plan' element={<Plan/>} />
        <Route path='/admin/subscriptionPlanForm' element={<SubscriptionPlanForm/>} />
        <Route path='/doctor/currentSubscription' element={<CurrentSubscription/>} />
        <Route path='/doctor/choosePlan' element={<ChoosePlanDashboard/>} />
        <Route path="/chat/:userId?" element={<ChatApp />} />
        <Route path='/doctor/dashboard' element={<DocDashboard/>}/>
        <Route path='/confirm-payment' element={<PaymentPage/>}/>
        
        
        
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    
    </Router>
    </GlobalVideoCallWrapper>
   </VideoCallProvider>
    </ToastProvider>
  )
}

export default App