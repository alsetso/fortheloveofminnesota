import { useState } from 'react';
import { isValidEmail, isValidUrl, isValidSlug, validateRequired } from '@/constants/validation';
import { ERROR_MESSAGES } from '@/constants/errors';

interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  validate?: boolean;
}

export default function FormInput({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  required = false,
  placeholder,
  validate = true,
}: FormInputProps) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    
    if (!validate) {
      setError(null);
      return;
    }

    // Clear error on change
    if (error) {
      setError(null);
    }
  };

  const handleBlur = () => {
    if (!validate) return;

    if (required && !validateRequired(value)) {
      setError(ERROR_MESSAGES.REQUIRED_FIELD);
      return;
    }

    if (value && type === 'email' && !isValidEmail(value)) {
      setError(ERROR_MESSAGES.INVALID_EMAIL);
      return;
    }

    if (value && type === 'url' && !isValidUrl(value)) {
      setError(ERROR_MESSAGES.INVALID_URL);
      return;
    }

    if (value && type === 'text' && label.toLowerCase().includes('slug') && !isValidSlug(value)) {
      setError(ERROR_MESSAGES.INVALID_SLUG);
      return;
    }

    setError(null);
  };

  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 ${
          error 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 focus:ring-blue-500'
        }`}
        required={required}
        placeholder={placeholder}
      />
      {error && (
        <p className="text-[10px] text-red-600 mt-0.5">{error}</p>
      )}
    </div>
  );
}

