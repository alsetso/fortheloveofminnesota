'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe, AccountService, useAuth } from '@/features/auth';
import { supabase } from '@/lib/supabase';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import confetti from 'canvas-confetti';

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

// Check if onboarding profile is complete (photo, username, and at least first_name)
function isOnboardingProfileComplete(account: any): boolean {
  if (!account) return false;
  return !!(
    account.image_url &&
    account.username &&
    (account.first_name || account.last_name)
  );
}

export default function OnboardingDemo({ map, mapLoaded }: OnboardingDemoProps) {
  const { account, refreshAccount } = useAuthStateSafe();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for custom event to show onboarding demo (triggered by info button click)
  useEffect(() => {
    const handleShowOnboarding = () => {
      if (mapLoaded) {
        setIsVisible(true);
        setCurrentStep(0); // Reset to first step
      }
    };

    window.addEventListener('show-onboarding-demo', handleShowOnboarding);
    return () => {
      window.removeEventListener('show-onboarding-demo', handleShowOnboarding);
    };
  }, [mapLoaded]);

  // Initialize form fields when account changes
  useEffect(() => {
    if (account) {
      setUsername(account.username || '');
      setFirstName(account.first_name || '');
      setLastName(account.last_name || '');
      // If username is already set, don't start in edit mode
      setIsEditingUsername(!account.username);
    }
  }, [account]);

  const allSteps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Search Locations or Users',
      description: 'Type in the search bar to find addresses, places, and people across Minnesota.',
      highlightSelector: '[data-search-container]',
      highlightPosition: 'top-left',
    },
    {
      id: 2,
      title: 'Click on the Map',
      description: 'Click anywhere on the map to see details about the selected location.',
      highlightPosition: 'center',
    },
    {
      id: 3,
      title: 'Explore Other Minnesotans\' Posts',
      description: 'Click on pins and mentions on the map to explore posts from other Minnesotans.',
      highlightPosition: 'center',
    },
    {
      id: 4,
      title: 'Contribute to the Map',
      description: 'Click the camera button to capture and share your favorite places on the map.',
      highlightSelector: '[aria-label="Create"]',
      highlightPosition: 'bottom-left',
    },
    {
      id: 5,
      title: 'Additional Buttons',
      description: 'Use the Search, Analytics, and Information buttons to filter mentions, track views, and get help.',
      highlightSelector: '[data-middle-buttons-container]',
      highlightPosition: 'bottom-left',
    },
    {
      id: 6,
      title: 'Manage Account',
      description: 'Access your account settings and profile by clicking your profile photo on the bottom right.',
      highlightSelector: '[aria-label="Settings"]',
      highlightPosition: 'bottom-right',
    },
  ];

  // Filter steps based on onboarding status - Step 6 only shows if account is onboarded
  const steps = allSteps.filter(step => {
    if (step.id === 6) {
      return account?.onboarded === true;
    }
    return true;
  });

  // Ensure currentStep is within bounds if steps array changes
  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(Math.max(0, steps.length - 1));
    }
  }, [steps.length, currentStep]);

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
        // Handle special case for Create button which can be "Create" or "Add"
        let selector = currentStepData.highlightSelector;
        let element = document.querySelector(selector) as HTMLElement;
        
        // If looking for Create button, also try Add (for live page)
        if (selector === '[aria-label="Create"]' && !element) {
          element = document.querySelector('[aria-label="Add"]') as HTMLElement;
        }
        
        if (element) {
          // Add glowing blue border to element
          // Apply circular border-radius for circular buttons
          const isCircular = selector === '[aria-label="Settings"]' ||
                            selector === '[aria-label="Create"]' ||
                            selector === '[aria-label="Analytics"]' ||
                            selector === '[aria-label="Information"]' ||
                            selector === '[aria-label="Filter by mention type"]';
          element.style.boxShadow = '0 0 0 5px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.6)';
          if (isCircular) {
            element.style.borderRadius = '50%';
          } else {
            // Preserve existing border-radius for other elements (like containers)
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
      // Close modal when reaching the last step
      setIsVisible(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Check if username is the user's current username
  const isCurrentUsername = account?.username && username.toLowerCase() === account.username.toLowerCase();
  const [isEditingUsername, setIsEditingUsername] = useState(false);

  // Check username availability (only if not current username and editing)
  useEffect(() => {
    // Don't check if it's their current username
    if (isCurrentUsername || !isEditingUsername) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch('/api/accounts/username/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username }),
        });

        if (response.ok) {
          const data = await response.json();
          setUsernameAvailable(data.available);
        } else {
          setUsernameAvailable(null);
        }
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, isCurrentUsername, isEditingUsername]);


  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setImageError('You must be logged in to upload images');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be smaller than 5MB');
      return;
    }

    setUploadingImage(true);
    setImageError(null);

    try {
      if (!account?.id) {
        throw new Error('Account not found');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/accounts/image_url/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL');
      }

      // Update account
      const updatedAccount = await AccountService.updateCurrentAccount({
        image_url: urlData.publicUrl,
      }, account.id);

      await refreshAccount();
    } catch (err) {
      console.error('Error uploading image:', err);
      setImageError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setUsernameError('');
    setImageError('');

    // Only validate required fields if account is not onboarded
    const needsOnboarding = !account?.onboarded;

    if (needsOnboarding) {
      // Validate required fields for onboarding
      if (!account?.image_url) {
        setImageError('Please upload a profile photo');
        setSavingProfile(false);
        return;
      }

      if (!username.trim()) {
        setUsernameError('Please enter a username');
        setSavingProfile(false);
        return;
      }

      if (username.length < 3 || username.length > 30) {
        setUsernameError('Username must be between 3 and 30 characters');
        setSavingProfile(false);
        return;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        setUsernameError('Username can only contain letters, numbers, hyphens, and underscores');
        setSavingProfile(false);
        return;
      }

      // Only check availability if editing and not current username
      if (isEditingUsername && !isCurrentUsername && usernameAvailable === false) {
        setUsernameError('Username is not available. Please choose another.');
        setSavingProfile(false);
        return;
      }

      if (!firstName.trim() && !lastName.trim()) {
        setUsernameError('Please enter at least your first name or last name');
        setSavingProfile(false);
        return;
      }
    } else {
      // For already onboarded users, only validate username if provided
      if (username.trim()) {
        if (username.length < 3 || username.length > 30) {
          setUsernameError('Username must be between 3 and 30 characters');
          setSavingProfile(false);
          return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          setUsernameError('Username can only contain letters, numbers, hyphens, and underscores');
          setSavingProfile(false);
          return;
        }

        if (isEditingUsername && !isCurrentUsername && usernameAvailable === false) {
          setUsernameError('Username is not available. Please choose another.');
          setSavingProfile(false);
          return;
        }
      }
    }

    try {
      // Build update data
      const updateData: any = {};

      // Always include first_name and last_name (set to null if empty)
      updateData.first_name = firstName.trim() || null;
      updateData.last_name = lastName.trim() || null;

      // Only include username if it's different from current username
      // This prevents unique constraint violations when username hasn't changed
      const normalizedUsername = username.trim().toLowerCase();
      const currentUsername = account?.username?.toLowerCase();
      if (normalizedUsername && normalizedUsername !== currentUsername) {
        updateData.username = normalizedUsername;
      }

      console.log('[OnboardingDemo] Updating account with:', updateData);
      console.log('[OnboardingDemo] Current account before update:', account);

      // Update account with fields (always update, even if values are the same)
      const updatedAccount = await AccountService.updateCurrentAccount(updateData);
      console.log('[OnboardingDemo] Account updated response:', updatedAccount);

      // Small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 300));

      // Refresh account data to get latest state
      await refreshAccount();

      // Get fresh account data
      const freshAccount = await AccountService.getCurrentAccount();
      console.log('[OnboardingDemo] Fresh account after refresh:', freshAccount);

      // If onboarding, check completeness and set onboarded
      if (needsOnboarding) {
        // Check if profile is complete (photo, username, and at least first_name)
        const isComplete = freshAccount && isOnboardingProfileComplete(freshAccount);
        console.log('[OnboardingDemo] Profile complete check:', {
          hasImage: !!freshAccount?.image_url,
          hasUsername: !!freshAccount?.username,
          hasName: !!(freshAccount?.first_name || freshAccount?.last_name),
          isComplete,
          accountData: {
            image_url: freshAccount?.image_url,
            username: freshAccount?.username,
            first_name: freshAccount?.first_name,
            last_name: freshAccount?.last_name,
          }
        });

        if (isComplete) {
          // Profile is now complete - set onboarded
          console.log('[OnboardingDemo] Setting onboarded to true');
          try {
            const response = await fetch('/api/accounts/onboard', {
              method: 'POST',
              credentials: 'include',
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[OnboardingDemo] Failed to set onboarded:', response.status, errorText);
              throw new Error(`Failed to set onboarded: ${response.status} ${errorText}`);
            }

            const responseData = await response.json();
            console.log('[OnboardingDemo] Onboard API response:', responseData);

            // Wait for database to update
            await new Promise(resolve => setTimeout(resolve, 300));

            // Refresh account state multiple times with retries to ensure we get updated value
            let finalAccount = null;
            let retries = 0;
            const maxRetries = 5;
            
            while (retries < maxRetries && (!finalAccount || !finalAccount.onboarded)) {
              await refreshAccount();
              await new Promise(resolve => setTimeout(resolve, 200));
              
              finalAccount = await AccountService.getCurrentAccount();
              console.log(`[OnboardingDemo] Retry ${retries + 1}: Account onboarded status:`, finalAccount?.onboarded);
              
              if (finalAccount?.onboarded) {
                break;
              }
              
              retries++;
            }
            
            console.log('[OnboardingDemo] Final account after onboard:', finalAccount);
            console.log('[OnboardingDemo] Final onboarded status:', finalAccount?.onboarded);
            
            // Verify onboarded was set
            if (finalAccount?.onboarded) {
              // Update local account state
              if (account) {
                account.onboarded = true;
              }
              
              // Trigger confetti
              triggerConfetti();
              // Close modal after successful onboarding
              setIsVisible(false);
              setSavingProfile(false);
            } else {
              console.error('[OnboardingDemo] Onboarded flag not set after API call and retries');
              setUsernameError('Profile saved but failed to mark as onboarded. Please refresh the page.');
              setSavingProfile(false);
            }
          } catch (onboardError) {
            console.error('[OnboardingDemo] Error setting onboarded:', onboardError);
            setUsernameError('Failed to mark account as onboarded. Please try again.');
            setSavingProfile(false);
          }
        } else {
          console.error('[OnboardingDemo] Profile incomplete after save:', {
            account: freshAccount,
            missingFields: {
              image_url: !freshAccount?.image_url,
              username: !freshAccount?.username,
              name: !(freshAccount?.first_name || freshAccount?.last_name),
            }
          });
          setUsernameError('Profile is incomplete. Please ensure all required fields are filled.');
          setSavingProfile(false);
        }
      } else {
        // Already onboarded - just close modal
        console.log('[OnboardingDemo] Already onboarded, closing modal');
        setIsVisible(false);
        setSavingProfile(false);
      }
    } catch (error) {
      console.error('[OnboardingDemo] Error saving profile:', error);
      let errorMessage = 'Failed to save profile';
      if (error instanceof Error) {
        console.error('[OnboardingDemo] Error details:', error.message, error.stack);
        if (error.message.includes('username') || error.message.includes('unique')) {
          errorMessage = 'Username is already taken. Please choose another.';
        } else {
          errorMessage = error.message;
        }
      }
      setUsernameError(errorMessage);
      setSavingProfile(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  if (!isVisible) return null;

  if (!currentStepData) return null;

  return (
    <>
      {/* Step card - Centered on mobile, bottom left on desktop */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[202] bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm w-[calc(100%-2rem)]"
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
              onClick={() => {
                setIsVisible(false);
              }}
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
              className={`text-xs font-medium text-white bg-red-600 hover:bg-red-700 py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                currentStep > 0 ? 'flex-1' : 'w-full'
              }`}
            >
              {currentStep < steps.length - 1 ? (
                <>
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </>
              ) : (
                'Done'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

