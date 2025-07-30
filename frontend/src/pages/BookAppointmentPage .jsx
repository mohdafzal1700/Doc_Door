"use client"
import { useMemo } from "react";
import { useParams } from "react-router-dom"
import { useState, useEffect } from "react"
import { Calendar, Clock, MapPin, User, CreditCard, FileText, ChevronLeft, ChevronRight, Check, AlertCircle, Info } from "lucide-react"
import Button from "../components/ui/Button"
import Input from "../components/ui/Input"
import { getUserProfile, getAddresses, 
    getMedicalRecord, 
    getDoctorBookingDetail, 
    getDoctorSchedulesWithParams, 
    createAppointment } from "../endpoints/APIs"

export default function AppointmentBooking({ }) {
    const { id: doctorId } = useParams();
    const [currentStep, setCurrentStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [doctor, setDoctor] = useState(null)
    const [availableSlots, setAvailableSlots] = useState([])
    const [userProfile, setUserProfile] = useState(null)
    const [userAddresses, setUserAddresses] = useState([])
    const [medicalRecord, setMedicalRecord] = useState(null)
    const [showNotification, setShowNotification] = useState(false)
    const [notificationMessage, setNotificationMessage] = useState("")
    const [initialLoading, setInitialLoading] = useState(true)
    
    const [bookingData, setBookingData] = useState({
        consultationMode: "online",
        serviceId: "",
        appointmentDate: "",
        selectedSlot: null,
        selectedAddressId: "",
        patientInfo: {
            name: "",
            email: "",
            phone: "",
            address: "",
            notes: "",
            medicalHistory: {
                chronicDiseases: "",
                allergies: "",
                currentMedications: "",
                previousSurgeries: "",
                lifestyleInfo: "",
                vaccinationHistory: "",
            },
        },
    })

    const calculateTotalFee = () => {
        const serviceFee = selectedService?.service_fee || 0;
        const consultationFeeValue = consultationFee || 0;
        return serviceFee + consultationFeeValue;
    }

    useEffect(() => {
        const fetchDoctorData = async () => {
            if (!doctorId) {
                setError("Doctor ID is required")
                setInitialLoading(false)
                return
            }

            try {
                setInitialLoading(true)
                const doctorData = await getDoctorBookingDetail(doctorId)
                setDoctor(doctorData)
                setError("")
            } catch (err) {
                setError("Failed to load doctor information. Please try again.")
            } finally {
                setInitialLoading(false)
            }
        }

        fetchDoctorData()
    }, [doctorId])

    useEffect(() => {
        const fetchUserData = async () => {
            if (currentStep === 2) {
                try {
                    setLoading(true)
                    const profileResponse = await getUserProfile()
                    const profile = profileResponse?.data?.data || profileResponse?.data || profileResponse
                    setUserProfile(profile)
                    
                    let medical = null
                    try {
                        const medicalResponse = await getMedicalRecord()
                        medical = medicalResponse?.data?.data || medicalResponse?.data || medicalResponse
                        setMedicalRecord(medical)
                    } catch (medicalError) {
                        if (medicalError.response?.status !== 404) {
                            setMedicalRecord(null)
                        }
                    }
                    
                    let addresses = []
                    if (bookingData.consultationMode === "offline") {
                        try {
                            const addressResponse = await getAddresses()
                            addresses = addressResponse?.data?.data || addressResponse?.data || addressResponse
                            if (Array.isArray(addresses)) {
                                setUserAddresses(addresses)
                            }
                        } catch (addressError) {
                            setUserAddresses([])
                        }
                    }
                    
                    const updatedPatientInfo = {
                        ...bookingData.patientInfo,
                        name: profile?.full_name || profile?.name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || "",
                        email: profile?.email || "",
                        phone: profile?.phone_number || profile?.phone || "",
                        medicalHistory: {
                            chronicDiseases: medical?.chronic_diseases || medical?.chronicDiseases || "",
                            allergies: medical?.allergies || "",
                            currentMedications: medical?.medications || medical?.currentMedications || "",
                            previousSurgeries: medical?.surgeries || medical?.previousSurgeries || "",
                            lifestyleInfo: medical?.lifestyle || medical?.lifestyleInfo || "",
                            vaccinationHistory: medical?.vaccination_history || medical?.vaccinationHistory || "",
                        },
                    }
                    
                    setBookingData(prev => ({
                        ...prev,
                        patientInfo: updatedPatientInfo
                    }))
                } catch (err) {
                    setError("Failed to load user information. Please try again.")
                } finally {
                    setLoading(false)
                }
            }
        }

        fetchUserData()
    }, [currentStep, bookingData.consultationMode])

    useEffect(() => {
        const fetchSchedules = async () => {
            try {
                setLoading(true);
                const response = await getDoctorSchedulesWithParams(
                    doctorId,
                    bookingData.appointmentDate,
                    bookingData.consultationMode,
                    bookingData.serviceId
                );
                
                const schedules = response.data.schedules || response.data || [];
                const allSlots = [];
                
                schedules.forEach((schedule) => {
                    if (schedule.time_slots && Array.isArray(schedule.time_slots)) {
                        allSlots.push(...schedule.time_slots);
                    }
                });
                
                setAvailableSlots(allSlots);
            } catch (error) {
                setAvailableSlots([]);
            } finally {
                setLoading(false);
            }
        };

        if (bookingData.appointmentDate && 
            bookingData.consultationMode && 
            bookingData.serviceId && 
            doctorId) {
            fetchSchedules();
        } else {
            setAvailableSlots([]);
            setLoading(false);
        }
    }, [bookingData.appointmentDate, bookingData.consultationMode, bookingData.serviceId, doctorId]);

    useEffect(() => {
        const fetchAddresses = async () => {
            if (bookingData.consultationMode === "offline" && currentStep === 2) {
                try {
                    const addresses = await getAddresses()
                    setUserAddresses(addresses)
                } catch (err) {
                    setError("Failed to load addresses. Please try again.")
                }
            }
        }

        fetchAddresses()
    }, [bookingData.consultationMode, currentStep])

    const handleSlotSelect = (slot) => {
        setBookingData((prev) => ({ ...prev, selectedSlot: slot }))
    }

    const handleNextStep = () => {
        if (currentStep === 1 && bookingData.selectedSlot) {
            setCurrentStep(2)
        }
    }

    const handlePreviousStep = () => {
        if (currentStep === 2) {
            setCurrentStep(1)
        }
    }

    const showSuccessNotification = (message) => {
        setNotificationMessage(message)
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 3000)
    }

    const handleSubmitBooking = async () => {
        setLoading(true)
        setError("")
        const medicalRecordId = localStorage.getItem('medicalRecordId');

        try {
            const bookingPayload = {
                doctor: doctorId,
                service: bookingData.serviceId ? parseInt(bookingData.serviceId) : null,
                schedule: bookingData.selectedSlot?.id ? parseInt(bookingData.selectedSlot.id) : null,
                appointment_date: bookingData.appointmentDate,
                slot_time: bookingData.selectedSlot?.startTime || bookingData.selectedSlot?.start_time,
                mode: bookingData.consultationMode,
                notes: bookingData.patientInfo.notes || "",
                
            }
            console.log('Doctor ID from params:', doctorId);
            console.log('Doctor data:', doctor?.data);
            console.log('Selected slot:', bookingData.selectedSlot);
            console.log('Booking payload:', bookingPayload);

            // Handle address for offline appointments
            if (bookingData.consultationMode === "offline") {
                if (bookingData.selectedAddressId) {
                    bookingPayload.address = parseInt(bookingData.selectedAddressId);
                } else if (bookingData.patientInfo.address) {
                    bookingPayload.address = bookingData.patientInfo.address;
                }
            }
            if (medicalRecord?.id) {
                bookingPayload.medical_record = medicalRecordId;
            }
            const convertTo24HourFormat = (time12h) => {
                if (!time12h) return null;
                
                const [time, modifier] = time12h.split(' ');
                let [hours, minutes] = time.split(':');
                
                if (hours === '12') {
                    hours = '00';
                }
                
                if (modifier === 'PM' && hours !== '12') {
                    hours = parseInt(hours, 10) + 12;
                }
                
                return `${hours.toString().padStart(2, '0')}:${minutes}`;
            }

            const result = await createAppointment(bookingPayload)
            
            

            if (result && (result.success || result.status === 201 || result.status === 200 || (result.data && !result.error))) {
                showSuccessNotification("Appointment booked successfully!")
                
                setCurrentStep(1)
                setBookingData({
                    consultationMode: "online",
                    serviceId: "",
                    appointmentDate: "",
                    selectedSlot: null,
                    selectedAddressId: "",
                    patientInfo: {
                        name: "",
                        email: "",
                        phone: "",
                        address: "",
                        notes: "",
                        medicalHistory: {
                            chronicDiseases: "",
                            allergies: "",
                            currentMedications: "",
                            previousSurgeries: "",
                            lifestyleInfo: "",
                            vaccinationHistory: "",
                        },
                    },
                })
                setAvailableSlots([])
            }  else {
    
                    if (result.field_errors) {
                        const errorMessages = Object.entries(result.field_errors)
                            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
                            .join('\n');
                        setError(`Validation errors:\n${errorMessages}`);
                    } else {
                        setError(result.message || "Failed to book appointment. Please try again.");
                    }
                }
        } catch (err) {
            setError("Failed to book appointment. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const selectedService = useMemo(() => {
        if (!bookingData.serviceId || !doctor?.data?.services) {
            return null;
        }
        
        return doctor.data.services.find(service => 
            service.id.toString() === bookingData.serviceId
        );
    }, [bookingData.serviceId, doctor?.data?.services]);

    const consultationFee = useMemo(() => {
        if (!doctor?.data?.consultation_fee) return 0;
        
        return bookingData.consultationMode === "online" 
            ? doctor.data.consultation_fee.online || 0
            : doctor.data.consultation_fee.offline || 0;
    }, [bookingData.consultationMode, doctor?.data?.consultation_fee]);

    if (initialLoading) {
        return (
            <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
                    <p className="ml-4 text-lg text-gray-600">Loading appointment booking...</p>
                </div>
            </div>
        )
    }

    if (!doctor) {
        return (
            <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen">
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
                    <p className="text-lg font-medium">Unable to load doctor information</p>
                    <p className="text-sm mt-2">{error || "Please try again later or contact support."}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen">
            {/* Step Indicator */}
            <div className="flex justify-center mb-8">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                currentStep >= 1 ? "bg-black text-white" : "bg-gray-200 text-gray-600"
                            }`}
                        >
                            {currentStep > 1 ? <Check className="w-4 h-4" /> : "1"}
                        </div>
                        <span className="ml-2 text-sm font-medium text-gray-700">Select Schedule</span>
                    </div>
                    <div className={`w-12 h-0.5 ${currentStep > 1 ? "bg-black" : "bg-gray-200"}`}></div>
                    <div className="flex items-center">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                currentStep >= 2 ? "bg-black text-white" : "bg-gray-200 text-gray-600"
                            }`}
                        >
                            2
                        </div>
                        <span className="ml-2 text-sm font-medium text-gray-700">Confirm Booking</span>
                    </div>
                </div>
            </div>

            {/* Success Notification */}
            {showNotification && (
                <div className="fixed top-4 right-4 bg-black text-white px-6 py-3 rounded-lg shadow-lg z-50">
                    <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4" />
                        <span>{notificationMessage}</span>
                    </div>
                </div>
            )}

            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {currentStep === 1 && (
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Doctor Details */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-black text-white p-6">
                            <div className="flex items-center space-x-2">
                                <User className="w-5 h-5" />
                                <span className="text-lg font-semibold">Doctor Information</span>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-start space-x-4">
                                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-2xl font-bold">
                                    {doctor.data.profile_image ? (
                                        <img 
                                            src={doctor.data.profile_image} 
                                            alt={doctor.data.full_name}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        doctor.data.full_name
                                            ?.split(" ")
                                            .map((n) => n[0])
                                            .join("")
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-semibold text-gray-900">{doctor.data.full_name}</h3>
                                    <p className="text-gray-600 font-medium">{doctor.data.specialization}</p>
                                    <div className="flex items-center space-x-1 mt-1">
                                        <MapPin className="w-4 h-4 text-gray-500" />
                                        <span className="text-sm text-gray-600">{doctor.data.hospital}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-medium text-gray-900 mb-3">Available Consultation Modes</h4>
                                <div className="flex space-x-2">
                                    {doctor.data.available_modes?.map((mode) => (
                                        <span
                                            key={mode}
                                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium border"
                                        >
                                            {mode}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-medium text-gray-900">Consultation Fees</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between p-3 bg-gray-50 rounded border">
                                        <span className="text-gray-700">Online:</span>
                                        <span className="font-semibold text-gray-900">${doctor.data.consultation_fee?.online || 0}</span>
                                    </div>
                                    <div className="flex justify-between p-3 bg-gray-50 rounded border">
                                        <span className="text-gray-700">Offline:</span>
                                        <span className="font-semibold text-gray-900">${doctor.data.consultation_fee?.offline || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Booking Form */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-black text-white p-6">
                            <div className="flex items-center space-x-2">
                                <Calendar className="w-5 h-5" />
                                <span className="text-lg font-semibold">Book Appointment</span>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Consultation Mode */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-900">Consultation Mode</label>
                                <div className="space-y-2">
                                    {doctor.data?.available_modes?.includes("Online") && (
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="consultationMode"
                                                value="online"
                                                checked={bookingData.consultationMode === "online"}
                                                onChange={(e) => setBookingData((prev) => ({ 
                                                    ...prev, 
                                                    consultationMode: e.target.value 
                                                }))}
                                                className="w-4 h-4 text-black border-gray-300 focus:ring-black"
                                            />
                                            <span className="text-gray-700">
                                                Online (${doctor.data?.consultation_fee?.online || 0})
                                            </span>
                                        </label>
                                    )}
                                    {doctor.data?.available_modes?.includes("Offline") && (
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="consultationMode"
                                                value="offline"
                                                checked={bookingData.consultationMode === "offline"}
                                                onChange={(e) => setBookingData((prev) => ({ 
                                                    ...prev, 
                                                    consultationMode: e.target.value 
                                                }))}
                                                className="w-4 h-4 text-black border-gray-300 focus:ring-black"
                                            />
                                            <span className="text-gray-700">
                                                Offline (${doctor.data?.consultation_fee?.offline || 0})
                                            </span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Service Selection */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-900">Select Service</label>
                                <select
                                    value={bookingData.serviceId}
                                    onChange={(e) => setBookingData((prev) => ({ ...prev, serviceId: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                                >
                                    <option value="">Choose a service</option>
                                    {doctor.data?.services?.map((service) => (
                                        <option key={service.id} value={service.id.toString()}>
                                            {service.service_name} ({service.duration} mins) - ${service.service_fee}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Selection */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-900">Appointment Date</label>
                                <Input
                                    type="date"
                                    value={bookingData.appointmentDate}
                                    onChange={(e) => setBookingData((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                                    min={new Date().toISOString().split("T")[0]}
                                    className="border-gray-300 focus:border-black focus:ring-black"
                                />
                            </div>

                            {/* Available Slots */}
                            {bookingData.appointmentDate && bookingData.serviceId && (
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-gray-900">Available Time Slots</label>
                                    {loading ? (
                                        <div className="text-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                                            <p className="text-sm text-gray-600 mt-2">Loading available slots...</p>
                                        </div>
                                    ) : availableSlots.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {availableSlots.map((slot) => (
                                                <button
                                                    key={slot.id}
                                                    className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                                                        bookingData.selectedSlot?.id === slot.id
                                                        ? "border-black bg-black text-white"
                                                        : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                                                    } ${slot.remainingSlots === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                    onClick={() => handleSlotSelect(slot)}
                                                    disabled={slot.remainingSlots === 0}
                                                >
                                                    <div className="flex items-center justify-center space-x-1 mb-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span className="text-sm font-medium">
                                                            {slot.startTime} - {slot.endTime}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs opacity-75">
                                                        {slot.remainingSlots} slot{slot.remainingSlots !== 1 ? 's' : ''} left
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-600 py-8 text-center bg-gray-50 rounded-lg border">
                                            No available slots for the selected date and service.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Next Button */}
                            <Button
                                onClick={handleNextStep}
                                disabled={!bookingData.selectedSlot}
                                className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next: Confirm Booking
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 2 && (
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Booking Summary */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-black text-white p-6">
                            <div className="flex items-center space-x-2">
                                <FileText className="w-5 h-5" />
                                <span className="text-lg font-semibold">Booking Summary</span>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-700">Doctor:</span>
                                    <span className="font-semibold text-gray-900">{doctor.data.full_name}</span>
                                </div>
                                
                                <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-700">Date:</span>
                                    <span className="font-semibold text-gray-900">
                                        {bookingData.appointmentDate && new Date(bookingData.appointmentDate).toLocaleDateString("en-US", {
                                            weekday: "long",
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-700">Time:</span>
                                    <span className="font-semibold text-gray-900">
                                        {bookingData.selectedSlot?.startTime} - {bookingData.selectedSlot?.endTime}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-700">Mode:</span>
                                    <span className="font-semibold text-gray-900 capitalize">
                                        {bookingData.consultationMode}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-700">Service:</span>
                                    <span className="font-semibold text-gray-900">
                                        {selectedService?.service_name || 'General Consultation'}
                                    </span>
                                </div>
                                
                                {/* Fee Breakdown */}
                                <div className="bg-gray-50 p-4 rounded-lg mt-4">
                                    <h4 className="font-medium text-gray-900 mb-3">Fee Breakdown</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-700">Consultation Fee:</span>
                                            <span className="font-medium text-gray-900">
                                                ${consultationFee || 0}
                                            </span>
                                        </div>
                                        {selectedService?.service_fee && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-700">Service Fee:</span>
                                                <span className="font-medium text-gray-900">
                                                    ${selectedService.service_fee}
                                                </span>
                                            </div>
                                        )}
                                        <div className="border-t pt-2 mt-2">
                                            <div className="flex justify-between">
                                                <span className="text-gray-900 font-semibold">Total Fee:</span>
                                                <span className="font-bold text-gray-900 text-lg">
                                                    ${calculateTotalFee()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Patient Information */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-black text-white p-6">
                            <div className="flex items-center space-x-2">
                                <User className="w-5 h-5" />
                                <span className="text-lg font-semibold">Patient Information</span>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            {loading && (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black mx-auto"></div>
                                    <p className="text-sm text-gray-600 mt-2">Loading patient information...</p>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-900">Full Name</label>
                                    <Input
                                        value={bookingData.patientInfo.name}
                                        onChange={(e) =>
                                            setBookingData((prev) => ({
                                                ...prev,
                                                patientInfo: { ...prev.patientInfo, name: e.target.value },
                                            }))
                                        }
                                        className="border-gray-300 focus:border-black focus:ring-black"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-900">Phone Number</label>
                                    <Input
                                        value={bookingData.patientInfo.phone}
                                        onChange={(e) =>
                                            setBookingData((prev) => ({
                                                ...prev,
                                                patientInfo: { ...prev.patientInfo, phone: e.target.value },
                                            }))
                                        }
                                        className="border-gray-300 focus:border-black focus:ring-black"
                                        placeholder="Enter your phone number"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-900">Email Address</label>
                                <Input
                                    type="email"
                                    value={bookingData.patientInfo.email}
                                    onChange={(e) =>
                                        setBookingData((prev) => ({
                                            ...prev,
                                            patientInfo: { ...prev.patientInfo, email: e.target.value },
                                        }))
                                    }
                                    className="border-gray-300 focus:border-black focus:ring-black"
                                    placeholder="Enter your email address"
                                />
                            </div>

                            {/* Address for Offline Mode */}
                            {bookingData.consultationMode === "offline" && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-900">Address</label>
                                    {userAddresses && userAddresses.length > 0 ? (
                                        <div className="space-y-2">
                                            <select
                                                value={bookingData.selectedAddressId}
                                                onChange={(e) => {
                                                    const addressId = e.target.value;
                                                    setBookingData((prev) => ({ 
                                                        ...prev, 
                                                        selectedAddressId: addressId,
                                                        patientInfo: {
                                                            ...prev.patientInfo,
                                                            address: addressId ? "" : prev.patientInfo.address
                                                        }
                                                    }));
                                                }}
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                                            >
                                                <option value="">Select saved address</option>
                                                {userAddresses.map((address) => (
                                                    <option key={address.id} value={address.id}>
                                                        {address.address_line_1 || address.street || address.address}, 
                                                        {address.city}, {address.state} {address.postal_code || address.zipCode}
                                                        {address.is_primary ? ' (Primary)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-sm text-gray-600">Or enter a new address below:</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-600 mb-2">No saved addresses found. Please enter your address:</p>
                                    )}
                                    <textarea
                                        placeholder="Enter your full address"
                                        value={bookingData.patientInfo.address}
                                        onChange={(e) =>
                                            setBookingData((prev) => ({
                                                ...prev,
                                                patientInfo: { ...prev.patientInfo, address: e.target.value },
                                                selectedAddressId: e.target.value ? "" : prev.selectedAddressId
                                            }))
                                        }
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                                        rows="3"
                                        disabled={bookingData.selectedAddressId !== ""}
                                    />
                                    {bookingData.selectedAddressId && (
                                        <p className="text-sm text-blue-600">
                                            Using saved address. Clear the selection above to enter a new address.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Medical History Section */}
                            <div className="space-y-4 pt-4 border-t border-gray-200">
                                <h4 className="text-lg font-semibold text-gray-900">Medical History</h4>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-900">Chronic Diseases</label>
                                        <textarea
                                            placeholder="List any chronic conditions or ongoing health issues"
                                            value={bookingData.patientInfo.medicalHistory.chronicDiseases}
                                            onChange={(e) =>
                                                setBookingData((prev) => ({
                                                    ...prev,
                                                    patientInfo: {
                                                        ...prev.patientInfo,
                                                        medicalHistory: { ...prev.patientInfo.medicalHistory, chronicDiseases: e.target.value },
                                                    },
                                                }))
                                            }
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                                            rows="3"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-900">
                                            Allergies<span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            placeholder="List any known allergies to medications, foods, or environmental factors"
                                            value={bookingData.patientInfo.medicalHistory.allergies}
                                            onChange={(e) =>
                                                setBookingData((prev) => ({
                                                    ...prev,
                                                    patientInfo: {
                                                        ...prev.patientInfo,
                                                        medicalHistory: { ...prev.patientInfo.medicalHistory, allergies: e.target.value },
                                                    },
                                                }))
                                            }
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                                            rows="3"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-900">Current Medications</label>
                                        <textarea
                                            placeholder="List all current medications with dosage and frequency"
                                            value={bookingData.patientInfo.medicalHistory.currentMedications}
                                            onChange={(e) =>
                                                setBookingData((prev) => ({
                                                    ...prev,
                                                    patientInfo: {
                                                        ...prev.patientInfo,
                                                        medicalHistory: { ...prev.patientInfo.medicalHistory, currentMedications: e.target.value },
                                                    },
                                                }))
                                            }
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                                            rows="3"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-900">Previous Surgeries</label>
                                        <textarea
                                            placeholder="List any previous surgeries with dates and details"
                                            value={bookingData.patientInfo.medicalHistory.previousSurgeries}
                                            onChange={(e) =>
                                                setBookingData((prev) => ({
                                                    ...prev,
                                                    patientInfo: {
                                                        ...prev.patientInfo,
                                                        medicalHistory: { ...prev.patientInfo.medicalHistory, previousSurgeries: e.target.value },
                                                    },
                                                }))
                                            }
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                                            rows="3"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-900">Lifestyle Information</label>
                                        <textarea
                                            placeholder="Include information about smoking, alcohol consumption, exercise habits, diet, etc."
                                            value={bookingData.patientInfo.medicalHistory.lifestyleInfo}
                                            onChange={(e) =>
                                                setBookingData((prev) => ({
                                                    ...prev,
                                                    patientInfo: {
                                                        ...prev.patientInfo,
                                                        medicalHistory: { ...prev.patientInfo.medicalHistory, lifestyleInfo: e.target.value },
                                                    },
                                                }))
                                            }
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                                            rows="3"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-900">Vaccination History</label>
                                        <textarea
                                            placeholder="COVID-19: Covishield - 1st dose (Apr 2021), 2nd dose (July 2021), Booster (Jan 2023)"
                                            value={bookingData.patientInfo.medicalHistory.vaccinationHistory}
                                            onChange={(e) =>
                                                setBookingData((prev) => ({
                                                    ...prev,
                                                    patientInfo: {
                                                        ...prev.patientInfo,
                                                        medicalHistory: { ...prev.patientInfo.medicalHistory, vaccinationHistory: e.target.value },
                                                    },
                                                }))
                                            }
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                                            rows="3"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-900">Additional Notes (Optional)</label>
                                <textarea
                                    placeholder="Any specific concerns or information for the doctor"
                                    value={bookingData.patientInfo.notes}
                                    onChange={(e) =>
                                        setBookingData((prev) => ({
                                            ...prev,
                                            patientInfo: { ...prev.patientInfo, notes: e.target.value },
                                        }))
                                    }
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                                    rows="3"
                                />
                            </div>

                            <div className="flex space-x-3 pt-4">
                                <Button
                                    onClick={handlePreviousStep}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition-all duration-200 border border-gray-300"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                                <Button
                                    onClick={handleSubmitBooking}
                                    disabled={
                                        loading ||
                                        !bookingData.patientInfo.name ||
                                        !bookingData.patientInfo.email ||
                                        !bookingData.patientInfo.phone ||
                                        (bookingData.consultationMode === "offline" && 
                                        !bookingData.selectedAddressId && 
                                        !bookingData.patientInfo.address)
                                    }
                                    className="flex-1 bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Booking...
                                        </>
                                    ) : (
                                        "Confirm Booking"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}