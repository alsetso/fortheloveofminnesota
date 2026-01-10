'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface OnboardingDemoProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
}

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  highlightSelector?: string;
  highlightPosition?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' | 'center';
  action?: () => void;
}

export default function OnboardingDemo({ map, mapLoaded }: OnboardingDemoProps) {
  const { account, refreshAccount } = useAuthStateSafe();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Check if user needs onboarding
  useEffect(() => {
    if (account && !account.onboarded && mapLoaded) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [account, mapLoaded]);

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Explore the Map',
      description: 'Navigate and explore Minnesota using the interactive map. Click anywhere to discover locations.',
      highlightPosition: 'center',
    },
    {
      id: 2,
      title: 'Search Locations',
      description: 'Use the search bar at the top to find addresses, places, and people across Minnesota.',
      highlightSelector: '[data-search-container]',
      highlightPosition: 'top-left',
    },
    {
      id: 3,
      title: 'Transcribe Audio',
      description: 'Use the microphone icon to search by voice and transcribe audio for quick location searches.',
      highlightSelector: '[data-microphone-button]',
      highlightPosition: 'top-left',
    },
    {
      id: 4,
      title: 'Manage Account',
      description: 'Access your account settings, profile, and preferences by clicking your account icon.',
      highlightSelector: '[data-account-button]',
      highlightPosition: 'top-right',
    },
    {
      id: 5,
      title: 'Map Settings',
      description: 'Customize your map view with layers, styles, and filters using the settings icon.',
      highlightSelector: '[data-map-settings-button]',
      highlightPosition: 'top-left',
    },
    {
      id: 6,
      title: 'Create Mentions',
      description: 'Click the camera button at the bottom to create mentions and share your experiences on the map.',
      highlightSelector: '[data-camera-button]',
      highlightPosition: 'bottom-left',
    },
  ];

  const currentStepData = steps[currentStep];

  // Add glowing blue border to highlighted elements
  useEffect(() => {
    if (!isVisible || !currentStepData) return;

    const highlightedElements: HTMLElement[] = [];

    const updateHighlights = () => {
      // Remove previous highlights
      highlightedElements.forEach(el => {
        el.style.boxShadow = '';
        el.style.border = '';
        el.style.borderRadius = '';
      });
      highlightedElements.length = 0;

      if (currentStepData.highlightSelector) {
        const element = document.querySelector(currentStepData.highlightSelector) as HTMLElement;
        if (element) {
          // Add glowing blue border to element
          // Apply circular border-radius for account button, microphone button, and camera button
          const isCircular = currentStepData.highlightSelector === '[data-account-button]' ||
                            currentStepData.highlightSelector === '[data-microphone-button]' ||
                            currentStepData.highlightSelector === '[data-camera-button]';
          element.style.boxShadow = '0 0 0 5px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.6)';
          if (isCircular) {
            element.style.borderRadius = '50%';
          } else {
            // Preserve existing border-radius for other elements
            const computedStyle = window.getComputedStyle(element);
            const existingRadius = computedStyle.borderRadius;
            if (existingRadius && existingRadius !== '0px') {
              element.style.borderRadius = existingRadius;
            }
          }
          highlightedElements.push(element);
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateHighlights, 100);
    window.addEventListener('resize', updateHighlights);
    window.addEventListener('scroll', updateHighlights);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateHighlights);
      window.removeEventListener('scroll', updateHighlights);
      // Clean up highlights
      highlightedElements.forEach(el => {
        el.style.boxShadow = '';
        el.style.border = '';
        el.style.borderRadius = '';
      });
    };
  }, [isVisible, currentStep, currentStepData]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!account) return;

    try {
      const response = await fetch('/api/accounts/onboard', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await refreshAccount();
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Failed to mark account as onboarded:', error);
    }
  };

  if (!isVisible || !currentStepData) return null;

  return (
    <>
      {/* Step card - Centered on mobile, bottom right on desktop */}
      <div
        className="fixed top-1/2 left-4 right-4 -translate-y-1/2 sm:top-auto sm:translate-y-0 sm:bottom-4 sm:left-auto sm:right-4 z-[202] bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm mx-auto sm:mx-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={handleComplete}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {currentStepData.title}
            </h3>
            <p className="text-sm text-gray-600">
              {currentStepData.description}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 pt-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-gray-900 w-6'
                    : index < currentStep
                    ? 'bg-gray-400 w-1.5'
                    : 'bg-gray-200 w-1.5'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex-1 text-xs font-medium text-gray-600 hover:text-gray-900 py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className={`text-xs font-medium text-gray-900 bg-gray-900 hover:bg-gray-800 text-white py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                currentStep > 0 ? 'flex-1' : 'w-full'
              }`}
            >
              {currentStep < steps.length - 1 ? (
                <>
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </>
              ) : (
                'Get Started'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

