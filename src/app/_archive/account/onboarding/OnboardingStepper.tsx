'use client';

import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { AccountTrait } from '@/features/auth';

interface OnboardingStepperProps {
  formData: {
    first_name: string;
    last_name: string;
    traits: AccountTrait[];
    username: string;
    image_url: string | null;
    cover_image_url: string | null;
    email: string;
    phone: string;
    bio: string;
  };
  usernameAvailable: boolean | null;
}

type Step = {
  readonly key: string;
  readonly label: string;
  readonly optional?: boolean;
};

const STEPS: readonly Step[] = [
  { key: 'cover_image_url', label: 'Cover Photo', optional: true },
  { key: 'image_url', label: 'Photo' },
  { key: 'name', label: 'Name' },
  { key: 'username', label: 'Username' },
  { key: 'contact', label: 'Contact' },
  { key: 'traits', label: 'Traits', optional: true },
  { key: 'bio', label: 'Bio', optional: true },
];

export default function OnboardingStepper({ formData, usernameAvailable }: OnboardingStepperProps) {
  const isStepComplete = (stepKey: string): boolean => {
    switch (stepKey) {
      case 'cover_image_url':
        return true; // Optional, always considered complete
      case 'image_url':
        return !!formData.image_url;
      case 'name':
        return !!formData.first_name.trim() && !!formData.last_name.trim();
      case 'username':
        return !!formData.username.trim() && usernameAvailable === true;
      case 'contact':
        return !!(formData.email.trim() || formData.phone.trim());
      case 'traits':
        return true; // Optional, always considered complete
      case 'bio':
        return true; // Optional, always considered complete
      default:
        return false;
    }
  };

  return (
    <div className="bg-white rounded-md p-[10px] border border-gray-200">
      <h3 className="text-xs font-semibold text-gray-900 mb-3">Progress</h3>
      <div className="space-y-2">
        {STEPS.map((step) => {
          const isComplete = isStepComplete(step.key);
          const isOptional = step.optional ?? false;
          
          return (
            <div key={step.key} className="flex items-center gap-2">
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
                <span className={`text-xs ${isComplete ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  {step.label}
                  {isOptional && <span className="text-gray-400 ml-1">(optional)</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


