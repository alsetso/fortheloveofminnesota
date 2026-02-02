'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import OnboardingClient from '@/features/account/components/OnboardingClient';
import type { Account } from '@/features/auth';
import { determineOnboardingStep } from '@/lib/onboardingService';

interface OnboardingBannerProps {
  initialAccount: Account | null;
  redirectTo: string;
}

export default function OnboardingBanner({ initialAccount, redirectTo }: OnboardingBannerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stepperState, setStepperState] = useState<{
    currentStep: number;
    totalSteps: number;
  } | null>(null);
  const [currentStepName, setCurrentStepName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedRedirect, setHasCheckedRedirect] = useState(false);

  const handleStepperChange = useCallback((currentStep: number, totalSteps: number, stepName?: string) => {
    setStepperState({ currentStep, totalSteps });
    if (stepName) {
      setCurrentStepName(stepName);
    }
  }, []);

  const stepInstructions: Record<string, { heading: string; subtext: string }> = {
    profile_photo: {
      heading: 'Upload profile image',
      subtext: 'Add a photo to personalize your profile',
    },
    username: {
      heading: 'Choose username',
      subtext: 'Pick a unique username for your account',
    },
    name: {
      heading: 'Your name',
      subtext: 'Tell us how you\'d like to be addressed',
    },
    bio: {
      heading: 'Bio',
      subtext: 'Share a bit about yourself',
    },
    traits: {
      heading: 'Traits',
      subtext: 'Select traits that describe you',
    },
    owns_business: {
      heading: 'Business ownership',
      subtext: 'Do you own a business?',
    },
    contact: {
      heading: 'Contact information',
      subtext: 'How can others reach you?',
    },
    location: {
      heading: 'Location',
      subtext: 'Where are you located?',
    },
    review: {
      heading: 'Review your account',
      subtext: 'Review and confirm your information',
    },
  };

  const instructions = currentStepName ? stepInstructions[currentStepName] : null;

  useEffect(() => {
    // Run auth checks during loading screen
    const checkAccountAndRedirect = async () => {
      // Wait for account to be available
      if (!initialAccount) {
        // If no account, wait a bit and check again
        setTimeout(() => {
          setIsLoading(false);
        }, 1200);
        return;
      }

      // Use service to determine current onboarding step
      if (!hasCheckedRedirect && initialAccount) {
        const onboardingState = determineOnboardingStep(initialAccount);
        
        // Handle any redirects if needed (currently not used, but keeping for future use)
        if (onboardingState.redirectUrl) {
          const urlStep = searchParams.get('step');
          const isAlreadyOnTargetStep = urlStep === onboardingState.currentStep;
          
          if (!isAlreadyOnTargetStep) {
            // Only redirect if not already there to prevent loops
            setHasCheckedRedirect(true);
            router.replace(onboardingState.redirectUrl);
            return; // Don't hide loading yet, let redirect happen
          }
        }
      }

      // Show loading state for at least 800ms to ensure checks complete
      const timer = setTimeout(() => {
        setIsLoading(false);
        setHasCheckedRedirect(true);
      }, 800);

      return () => clearTimeout(timer);
    };

    checkAccountAndRedirect();
  }, [initialAccount, hasCheckedRedirect, router, searchParams]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black z-50 overflow-hidden flex flex-col">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-neutral-400">Getting everything ready..</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center w-full">
          {/* Stepper Container */}
          {stepperState && (
            <div className="w-full max-w-[500px] bg-transparent relative z-10">
              <div className="flex-shrink-0 px-4 py-3">
                <div className="h-5" />
                <div className="flex items-center gap-1">
                  {Array.from({ length: stepperState.totalSteps }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1 rounded-full transition-all ${
                        i <= stepperState.currentStep ? 'bg-white' : 'bg-neutral-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Heading and Subtext - Floating fixed below stepper */}
          {stepperState && instructions && (
            <div className="fixed top-[calc(1.25rem+0.75rem+0.25rem+1rem)] left-0 right-0 w-full max-w-[500px] mx-auto px-4 z-10">
              <h2 className="text-2xl font-semibold text-white text-center mb-1">
                {instructions.heading}
              </h2>
              <p className="text-xs text-neutral-400 text-center">
                {instructions.subtext}
              </p>
            </div>
          )}

          {/* Content Container */}
          <div className={`flex-1 w-full max-w-[500px] overflow-y-auto scrollbar-hide ${stepperState && instructions ? 'pt-24' : ''}`}>
            <OnboardingClient 
              initialAccount={initialAccount}
              redirectTo={redirectTo}
              onStepperChange={handleStepperChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
