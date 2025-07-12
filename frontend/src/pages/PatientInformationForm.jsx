import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

const PatientInformationForm = ({ bookingDetails, onBack, onSubmit }) => {
  const [formData, setFormData] = useState({
    age: '',
    gender: 'Male',
    weight: '',
    houseName: '',
    street: '',
    city: '',
    state: '',
    zipcode: '',
    country: '',
    allergies: '',
    chronicDiseases: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.age) newErrors.age = 'Age is required';
    if (!formData.weight) newErrors.weight = 'Weight is required';
    if (!formData.houseName) newErrors.houseName = 'House name is required';
    if (!formData.street) newErrors.street = 'Street is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.zipcode) newErrors.zipcode = 'Zipcode is required';
    if (!formData.country) newErrors.country = 'Country is required';
    
    if (formData.age && (isNaN(formData.age) || formData.age < 1 || formData.age > 120)) {
      newErrors.age = 'Please enter a valid age (1-120)';
    }
    
    if (formData.weight && (isNaN(formData.weight) || formData.weight < 1 || formData.weight > 500)) {
      newErrors.weight = 'Please enter a valid weight (1-500 kg)';
    }
    
    if (formData.zipcode && !/^\d{5,6}$/.test(formData.zipcode)) {
      newErrors.zipcode = 'Please enter a valid zipcode (5-6 digits)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const patientData = {
        ...bookingDetails,
        patientInfo: formData
      };
      
      await onSubmit(patientData);
      // The parent component should handle the redirection to payment
    } catch (error) {
      console.error('Error submitting patient information:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full mr-2"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Patient Information</h1>
        </div>

        <p className="text-gray-600 mb-6">Please fill out the form below with your details</p>

        <form onSubmit={handleSubmit}>
          {/* Patient Details */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Patient Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded ${errors.age ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter age"
                />
                {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <div className="flex space-x-4 mt-1">
                  {['Male', 'Female', 'Other'].map(gender => (
                    <label key={gender} className="flex items-center">
                      <input
                        type="radio"
                        name="gender"
                        value={gender}
                        checked={formData.gender === gender}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span>{gender}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded ${errors.weight ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter weight"
                />
                {errors.weight && <p className="text-red-500 text-xs mt-1">{errors.weight}</p>}
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Address Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">House Name</label>
                <input
                  type="text"
                  name="houseName"
                  value={formData.houseName}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded ${errors.houseName ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter house name"
                />
                {errors.houseName && <p className="text-red-500 text-xs mt-1">{errors.houseName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded ${errors.street ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter street"
                />
                {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded ${errors.city ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter city"
                />
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded ${errors.state ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter state"
                />
                {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zipcode</label>
                <input
                  type="text"
                  name="zipcode"
                  value={formData.zipcode}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded ${errors.zipcode ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter zipcode"
                />
                {errors.zipcode && <p className="text-red-500 text-xs mt-1">{errors.zipcode}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded ${errors.country ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select country</option>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Australia">Australia</option>
                  <option value="India">India</option>
                </select>
                {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
              </div>
            </div>
          </div>

          {/* Medical History */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Medical History</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                <input
                  type="text"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="List any allergies"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chronic Diseases</label>
                <input
                  type="text"
                  name="chronicDiseases"
                  value={formData.chronicDiseases}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="List any chronic diseases"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2 rounded-md text-white ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Patient Information'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientInformationForm;