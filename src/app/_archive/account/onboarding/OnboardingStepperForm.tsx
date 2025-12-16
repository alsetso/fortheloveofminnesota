'use client';

import { useState } from 'react';
import { AccountTrait } from '@/features/auth';
import { ImageUpload } from '@/features/ui/components/ImageUpload';
import AccountTraits from '@/components/profile/AccountTraits';
import { CheckCircleIcon, ArrowRightIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { validateEmail, validatePhone } from './utils/validation';

type FormData = {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bio: string;
  traits: AccountTrait[];
  image_url: string | null;
  cover_image_url: string | null;
};

interface OnboardingStepperFormProps {
  formData: FormData;
  usernameAvailable: boolean | null;
  checkingUsername: boolean;
  onFormChange: (field: keyof FormData, value: string | string[] | null) => void;
  onTraitToggle: (trait: AccountTrait) => void;
  checkUsername: (username: string) => void;
  saving: boolean;
  fieldErrors?: Record<string, string>;
  onImageUploadError?: (error: string | null) => void;
}

const STEPS = [
  { key: 'cover_image_url', label: 'Cover Photo', required: false },
  { key: 'image_url', label: 'Profile Photo', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'username', label: 'Username', required: true },
  { key: 'contact', label: 'Contact', required: true },
  { key: 'traits', label: 'Traits', required: false },
  { key: 'bio', label: 'Bio', required: false },
] as const;

export default function OnboardingStepperForm({
  formData,
  usernameAvailable,
  checkingUsername,
  onFormChange,
  onTraitToggle,
  checkUsername,
  saving,
  fieldErrors = {},
  onImageUploadError,
}: OnboardingStepperFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const isStepComplete = (stepIndex: number): boolean => {
    const step = STEPS[stepIndex];
    switch (step.key) {
      case 'cover_image_url':
        return true; // Optional
      case 'image_url':
        return !!formData.image_url;
      case 'name':
        return !!formData.first_name.trim() && !!formData.last_name.trim();
      case 'username':
        return !!formData.username.trim() && usernameAvailable === true;
      case 'contact': {
        const hasEmail = formData.email.trim().length > 0;
        const hasPhone = formData.phone.trim().length > 0;
        if (!hasEmail && !hasPhone) return false;
        // Validate format if provided
        if (hasEmail && !validateEmail(formData.email)) return false;
        if (hasPhone && !validatePhone(formData.phone)) return false;
        return true;
      }
      case 'traits':
        return true; // Optional
      case 'bio':
        return true; // Optional
      default:
        return false;
    }
  };

  const canProceed = (stepIndex: number): boolean => {
    const step = STEPS[stepIndex];
    if (!step.required) return true;
    return isStepComplete(stepIndex);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setExpandedStep(currentStep + 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // For first step (cover photo), always allow access
    if (stepIndex === 0 || stepIndex <= currentStep || isStepComplete(stepIndex - 1)) {
      setExpandedStep(expandedStep === stepIndex ? null : stepIndex);
      if (stepIndex > currentStep) {
        setCurrentStep(stepIndex);
      }
    }
  };

  const renderStepContent = (stepIndex: number) => {
    const step = STEPS[stepIndex];

    switch (step.key) {
      case 'cover_image_url':
        return (
          <div className="space-y-2">
            <ImageUpload
              value={formData.cover_image_url}
              onChange={(url) => onFormChange('cover_image_url', url)}
              onError={onImageUploadError}
              bucket="cover-photos"
              table="accounts"
              column="cover_image_url"
              label="Upload cover photo"
              className="w-full"
            />
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(stepIndex) || saving}
              className="w-full flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="w-3 h-3" />
            </button>
          </div>
        );

      case 'image_url':
        return (
          <div className="space-y-2">
            <ImageUpload
              value={formData.image_url}
              onChange={(url) => onFormChange('image_url', url)}
              onError={onImageUploadError}
              bucket="logos"
              table="accounts"
              column="image_url"
              label="Upload photo"
              className="w-full"
            />
            {fieldErrors.image_url && (
              <p className="text-xs text-red-600" role="alert" id="image_url-error">
                {fieldErrors.image_url}
              </p>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(stepIndex) || saving}
              className="w-full flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="w-3 h-3" />
            </button>
          </div>
        );

      case 'name':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => onFormChange('first_name', e.target.value)}
                  className={`w-full px-[10px] py-[10px] border rounded-md text-xs focus:outline-none focus:ring-1 transition-colors ${
                    fieldErrors.first_name
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900'
                  }`}
                  placeholder="First"
                  disabled={saving}
                  autoFocus
                  aria-label="First name"
                  aria-describedby={fieldErrors.first_name ? 'first_name-error' : undefined}
                  aria-invalid={!!fieldErrors.first_name}
                />
                {fieldErrors.first_name && (
                  <p className="text-xs text-red-600 mt-1" role="alert" id="first_name-error">
                    {fieldErrors.first_name}
                  </p>
                )}
              </div>
              <div>
                <input
                  type="text"
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => onFormChange('last_name', e.target.value)}
                  className={`w-full px-[10px] py-[10px] border rounded-md text-xs focus:outline-none focus:ring-1 transition-colors ${
                    fieldErrors.last_name
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900'
                  }`}
                  placeholder="Last"
                  disabled={saving}
                  aria-label="Last name"
                  aria-describedby={fieldErrors.last_name ? 'last_name-error' : undefined}
                  aria-invalid={!!fieldErrors.last_name}
                />
                {fieldErrors.last_name && (
                  <p className="text-xs text-red-600 mt-1" role="alert" id="last_name-error">
                    {fieldErrors.last_name}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(stepIndex) || saving}
              className="w-full flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="w-3 h-3" />
            </button>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => onFormChange('email', e.target.value)}
                  className={`w-full px-[10px] py-[10px] border rounded-md text-xs focus:outline-none focus:ring-1 transition-colors ${
                    fieldErrors.email
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900'
                  }`}
                  placeholder="Email"
                  disabled={saving}
                  autoFocus
                  inputMode="email"
                  aria-label="Email address"
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1" role="alert" id="email-error">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              <div>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => onFormChange('phone', e.target.value)}
                  className={`w-full px-[10px] py-[10px] border rounded-md text-xs focus:outline-none focus:ring-1 transition-colors ${
                    fieldErrors.phone
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900'
                  }`}
                  placeholder="Phone"
                  disabled={saving}
                  inputMode="tel"
                  aria-label="Phone number"
                  aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                  aria-invalid={!!fieldErrors.phone}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-600 mt-1" role="alert" id="phone-error">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
            </div>
            {fieldErrors.contact && (
              <p className="text-xs text-red-600" role="alert" id="contact-error">
                {fieldErrors.contact}
              </p>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(stepIndex) || saving}
              className="w-full flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="w-3 h-3" />
            </button>
          </div>
        );

      case 'traits':
        return (
          <div className="space-y-2">
            <AccountTraits
              traits={formData.traits}
              onTraitToggle={onTraitToggle}
              editable={true}
              maxTraits={3}
            />
            <p className="text-xs text-gray-500">
              {formData.traits.length}/3 traits selected
              {formData.traits.length >= 3 && (
                <span className="text-gray-400 ml-1">(maximum reached)</span>
              )}
            </p>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(stepIndex) || saving}
              className="w-full flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="w-3 h-3" />
            </button>
          </div>
        );

      case 'username':
        return (
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={(e) => {
                  onFormChange('username', e.target.value);
                  if (e.target.value.length >= 3) {
                    checkUsername(e.target.value);
                  }
                }}
                className={`w-full px-[10px] py-[10px] border rounded-md text-xs focus:outline-none focus:ring-1 transition-colors ${
                  fieldErrors.username
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : usernameAvailable === true
                    ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                    : usernameAvailable === false
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900'
                }`}
                placeholder="johndoe"
                disabled={saving}
                pattern="[a-zA-Z0-9_-]+"
                minLength={3}
                maxLength={30}
                autoFocus
                aria-label="Username"
                aria-describedby={fieldErrors.username ? 'username-error' : 'username-help'}
                aria-invalid={!!fieldErrors.username || usernameAvailable === false}
                aria-live="polite"
              />
              {checkingUsername && (
                <div className="absolute right-[10px] top-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {!checkingUsername && usernameAvailable === true && (
                <div className="absolute right-[10px] top-1/2 -translate-y-1/2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                </div>
              )}
            </div>
            {fieldErrors.username ? (
              <p className="text-xs text-red-600" role="alert" id="username-error">
                {fieldErrors.username}
              </p>
            ) : (
              <p className="text-xs text-gray-500" id="username-help" aria-live="polite">
                {usernameAvailable === true
                  ? 'Username available'
                  : usernameAvailable === false
                  ? 'Username taken'
                  : '3-30 characters, letters, numbers, hyphens, and underscores'}
              </p>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(stepIndex) || saving || checkingUsername}
              className="w-full flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="w-3 h-3" />
            </button>
          </div>
        );

      case 'bio':
        return (
          <div className="space-y-2">
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => onFormChange('bio', e.target.value)}
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:border-gray-900 focus:ring-gray-900 transition-colors resize-none"
              placeholder="Tell us about yourself..."
              rows={3}
              maxLength={2000}
              disabled={saving}
              autoFocus
              aria-label="Bio"
              aria-describedby="bio-help"
            />
            <p className={`text-xs ${formData.bio.length > 1800 ? 'text-orange-600' : 'text-gray-500'}`} id="bio-help">
              {formData.bio.length}/2000 characters {formData.bio.length > 1800 && '(approaching limit)'} (optional)
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-md border border-gray-200">
      <div className="p-[10px] space-y-0">
        {STEPS.map((step, index) => {
          const isComplete = isStepComplete(index);
          const isExpanded = expandedStep === index;
          const isAccessible = index === 0 || (index > 0 && isStepComplete(index - 1)) || index <= currentStep;

          return (
            <div key={step.key} className="border-b border-gray-200 last:border-b-0">
              <button
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isAccessible || saving}
                aria-expanded={isExpanded}
                aria-controls={`step-${step.key}-content`}
                aria-label={`${step.label} step${isComplete ? ' - completed' : ''}`}
                className={`w-full flex items-center justify-between p-[10px] text-left transition-colors ${
                  !isAccessible
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {isComplete ? (
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium ${
                      isExpanded ? 'text-gray-900' : 'text-gray-600'
                    }`}>
                      {step.label}
                      {!step.required && <span className="text-gray-400 ml-1">(optional)</span>}
                    </span>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronRightIcon className="w-3 h-3 text-gray-500 rotate-90 flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-[10px] pb-[10px] pt-0" id={`step-${step.key}-content`}>
                  {renderStepContent(index)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


