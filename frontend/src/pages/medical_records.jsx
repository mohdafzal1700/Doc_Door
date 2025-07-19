import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  Loader2, 
  AlertCircle,
  FileText,
  ChevronLeft
} from 'lucide-react';
import { 
  createMedicalRecord, 
  updateMedicalRecord,
  getMedicalRecord 
} from '../endpoints/APIs';
import PatientSidebar from '../components/ui/PatientSidebar';
import Header from '../components/home/Header';
import { useToast } from '../components/ui/Toast';

const MedicalRecordForm = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const addToast = toast?.addToast || toast || (() => {});
  
  // Form state
  const [formData, setFormData] = useState({
    chronic_diseases: '',
    allergies: '',
    medications: '',
    surgeries: '',
    lifestyle: '',
    vaccination_history: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [medicalRecordId, setMedicalRecordId] = useState(null); // Add this state

  // Field configuration
  const fieldConfig = [
    {
      id: 'chronic_diseases',
      label: 'Chronic Diseases',
      placeholder: 'List any chronic conditions...',
      required: false,
    },
    {
      id: 'allergies',
      label: 'Allergies*',
      placeholder: 'List any known allergies...',
      required: true,
    },
    {
      id: 'medications',
      label: 'Current Medications',
      placeholder: 'List current medications...',
      required: false,
    },
    {
      id: 'surgeries',
      label: 'Previous Surgeries',
      placeholder: 'Describe any previous surgeries...',
      required: false,
    },
    {
      id: 'lifestyle',
      label: 'Lifestyle Information',
      placeholder: 'Diet, exercise, habits...',
      required: false,
    },
    {
      id: 'vaccination_history',
      label: 'Vaccination History',
      placeholder: 'List vaccinations received...',
      required: false,
    },
  ];

  // Load medical record
  const loadMedicalRecord = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getMedicalRecord();
      if (response.data?.data) {
        setHasExistingRecord(true);
        setMedicalRecordId(response.data.data.id); // Store the UUID
        setFormData(prev => ({
          ...prev,
          ...response.data.data
        }));
        
        // Store in localStorage for other components to access
        localStorage.setItem('medicalRecordId', response.data.data.id);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        setError('Failed to load medical record');
        showToast('error', 'Error', 'Failed to load your medical record');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedicalRecord();
  }, [loadMedicalRecord]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const showToast = (type, title, message) => {
    try {
      if (typeof addToast === 'function') {
        addToast({ type, title, description: message, duration: 5000 });
      }
    } catch (err) {
      console.error('Toast error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const cleanedData = {};
      fieldConfig.forEach(field => {
        cleanedData[field.id] = (formData[field.id] || '').trim();
      });

      let response;
      if (hasExistingRecord) {
        response = await updateMedicalRecord(cleanedData);
        showToast('success', 'Success', 'Medical record updated successfully');
      } else {
        response = await createMedicalRecord(cleanedData);
        showToast('success', 'Success', 'Medical record created successfully');
        setHasExistingRecord(true);
        
        // Store the new medical record ID
        if (response.data?.data?.id) {
          setMedicalRecordId(response.data.data.id);
          localStorage.setItem('medicalRecordId', response.data.data.id);
        }
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 
                      error.response?.data?.error || 
                      'Failed to save medical record';
      setError(errorMsg);
      showToast('error', 'Error', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  return (
    <div>
        <Header/>
    <div className="flex min-h-screen bg-gray-50">
        <PatientSidebar 
            activeSection="records" 
            onSectionNavigation={() => {}} 
            onLogout={() => {}} 
        />
        
        <div className="flex-1 p-6">
            <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex items-center">
                <button 
                onClick={() => navigate(-1)} 
                className="mr-4 p-2 rounded-full hover:bg-gray-100"
                >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h1 className="text-2xl font-semibold text-gray-800">
                {hasExistingRecord ? 'Update Medical Record' : 'Create Medical Record'}
                </h1>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-center text-red-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>{error}</span>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                {fieldConfig.map((field) => (
                    <div key={field.id} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {field.label}
                    </label>
                    <textarea
                        value={formData[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={4}
                        required={field.required}
                        disabled={isSubmitting}
                    />
                    </div>
                ))}

                <div className="pt-4 flex justify-end">
                    <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    {isSubmitting ? (
                        <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        Saving...
                        </>
                    ) : (
                        <>
                        <Save className="-ml-1 mr-2 h-4 w-4" />
                        {hasExistingRecord ? 'Update Record' : 'Save Record'}
                        </>
                    )}
                    </button>
                </div>
                </form>
            </div>
            </div>
        </div>
        </div>
        </div>
    );
};

export default MedicalRecordForm;