"use client"

import { useState, useRef, useEffect } from "react"

const OtpInput = ({ length = 4, value, onChange, error }) => {
  const [otp, setOtp] = useState(new Array(length).fill(""))
  const inputRefs = useRef([])

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  useEffect(() => {
    if (value) {
      const otpArray = value.split("").slice(0, length)
      const newOtp = [...new Array(length).fill("")]
      otpArray.forEach((digit, index) => {
        newOtp[index] = digit
      })
      setOtp(newOtp)
    }
  }, [value, length])

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return false

    const newOtp = [...otp]
    newOtp[index] = element.value
    setOtp(newOtp)

    // Call parent onChange
    onChange(newOtp.join(""))

    // Focus next input
    if (element.value && index < length - 1) {
      inputRefs.current[index + 1].focus()
    }
  }

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp]
      newOtp[index] = ""
      setOtp(newOtp)
      onChange(newOtp.join(""))

      if (index > 0) {
        inputRefs.current[index - 1].focus()
      }
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    const newOtp = [...new Array(length).fill("")]

    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i]
    }

    setOtp(newOtp)
    onChange(newOtp.join(""))

    // Focus the next empty input or the last input
    const nextIndex = Math.min(pastedData.length, length - 1)
    if (inputRefs.current[nextIndex]) {
      inputRefs.current[nextIndex].focus()
    }
  }

  return (
    <div className="mb-6">
      <div className="flex justify-center gap-3">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            type="text"
            inputMode="numeric"
            maxLength="1"
            value={otp[index] || ""}
            onChange={(e) => handleChange(e.target, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            className={`w-14 h-14 text-center text-xl font-semibold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all ${
              error ? "border-red-500" : "border-gray-300"
            } ${otp[index] ? "bg-gray-50 border-purple-300" : "bg-white"}`}
            placeholder=""
          />
        ))}
      </div>
      {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
    </div>
  )
}

export default OtpInput
