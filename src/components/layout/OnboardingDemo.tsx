'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon, CheckCircleIcon, PhotoIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe, AccountService, useAuth } from '@/features/auth';
import { supabase } from '@/lib/supabase';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import Image from 'next/image';
import Link from 'next/link';
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
  const [showSuccessStep, setShowSuccessStep] = useState(false);
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

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Search Locations',
      description: 'Type in the search bar to find addresses, places, and people across Minnesota.',
      highlightSelector: '[data-search-container]',
      highlightPosition: 'top-left',
    },
    {
      id: 2,
      title: 'Manage Account',
      description: 'Access your account settings and profile by clicking your profile photo on the bottom right.',
      highlightSelector: '[aria-label="Settings"]',
      highlightPosition: 'bottom-right',
    },
    {
      id: 3,
      title: 'Create Mentions',
      description: 'Click the camera button to capture and share your favorite places on the map.',
      highlightSelector: '[aria-label="Create"]',
      highlightPosition: 'bottom-left',
    },
    {
      id: 4,
      title: 'View Collections',
      description: 'Organize your mentions into collections using the folder icon.',
      highlightSelector: '[aria-label="Collections"]',
      highlightPosition: 'bottom-left',
    },
    {
      id: 5,
      title: 'Track Analytics',
      description: 'See how many people view your profile and mentions with the analytics icon.',
      highlightSelector: '[aria-label="Analytics"]',
      highlightPosition: 'bottom-left',
    },
    {
      id: 6,
      title: 'Get Help',
      description: 'Access information and help anytime using the info button.',
      highlightSelector: '[aria-label="Information"]',
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
          // Apply circular border-radius for circular buttons
          const isCircular = currentStepData.highlightSelector === '[aria-label="Settings"]' ||
                            currentStepData.highlightSelector === '[aria-label="Create"]' ||
                            currentStepData.highlightSelector === '[aria-label="Collections"]' ||
                            currentStepData.highlightSelector === '[aria-label="Analytics"]' ||
                            currentStepData.highlightSelector === '[aria-label="Information"]';
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
      // Move to step 7 (profile completion)
      setCurrentStep(steps.length);
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

  const handleComplete = async () => {
    // Always proceed to step 7 (profile completion)
    // Step 7 will handle checking completeness and setting onboarded
  };

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
              // Show success step
              setShowSuccessStep(true);
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
        // Already onboarded - just show success
        console.log('[OnboardingDemo] Already onboarded, showing success');
        triggerConfetti();
        setShowSuccessStep(true);
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

  // Show success step 9
  if (showSuccessStep && account) {
    const profileUrl = account.username ? `/profile/${account.username}` : '#';
    
    return (
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[202] bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm w-[calc(100%-2rem)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">
                Step 9 of 9
              </span>
            </div>
            <button
              onClick={() => {
                setIsVisible(false);
                setShowSuccessStep(false);
              }}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Success Content */}
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <CheckCircleIcon className="w-12 h-12 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Welcome to Love of Minnesota!
            </h3>
            <p className="text-sm text-gray-600">
              Your profile is set up and ready to go.
            </p>

            {/* Profile Preview */}
            <div className="bg-gray-50 rounded-md p-4 space-y-3 border border-gray-200">
              {account.image_url && (
                <div className="flex justify-center">
                  <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-300">
                    <Image
                      src={account.image_url}
                      alt="Profile"
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              )}
              {account.username && (
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    @{account.username}
                  </p>
                </div>
              )}
            </div>

            {/* View Profile Button */}
            {account.username && (
              <Link
                href={profileUrl}
                onClick={() => {
                  setIsVisible(false);
                  setShowSuccessStep(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                <span>View Profile</span>
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Progress dots - all complete */}
          <div className="flex items-center gap-1.5 pt-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className="h-1.5 w-1.5 rounded-full bg-gray-400"
              />
            ))}
            <div className="h-1.5 w-6 rounded-full bg-gray-900" />
          </div>
        </div>
      </div>
    );
  }

  // Show step 8 (profile completion) after step 7
  const isStep8 = currentStep >= steps.length;
  
  if (isStep8) {
    // If user is not authenticated, show sign-in prompt instead of profile form
    if (!user) {
      return (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[202] bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm w-[calc(100%-2rem)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">
                  Step 8 of 9
                </span>
              </div>
              <button
                onClick={() => {
                  setIsVisible(false);
                  setShowSuccessStep(false);
                }}
                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Sign-In Prompt */}
            <div className="space-y-3">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Sign In to Continue
                </h3>
                <p className="text-sm text-gray-600">
                  Create an account or sign in to complete your profile and start adding mentions to the map.
                </p>
              </div>

              {/* Sign In Button */}
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
              >
                Sign In
                <ArrowRightIcon className="w-4 h-4" />
              </Link>

              {/* Progress dots */}
              <div className="flex items-center gap-1.5 pt-2">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="h-1.5 w-1.5 rounded-full bg-gray-400"
                  />
                ))}
                <div className="h-1.5 w-6 rounded-full bg-gray-900" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Authenticated user - show profile completion form
    return (
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[202] bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm w-[calc(100%-2rem)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">
                Step 8 of 9
              </span>
            </div>
            <button
              onClick={() => {
                setIsVisible(false);
                setShowSuccessStep(false);
              }}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Complete Your Profile
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Add a profile photo, username, and your name to finish setting up your account.
              </p>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleProfileSubmit} className="space-y-3">
              {/* Profile Photo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Profile Photo <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                    {account?.image_url ? (
                      <Image
                        src={account.image_url}
                        alt="Profile"
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <PhotoIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="profile-photo-upload"
                    />
                    <label
                      htmlFor="profile-photo-upload"
                      className="inline-block text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {uploadingImage ? 'Uploading...' : account?.image_url ? 'Change Photo' : 'Upload Photo'}
                    </label>
                    {imageError && (
                      <p className="text-xs text-red-600 mt-1">{imageError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                {!isEditingUsername && account?.username ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-md text-gray-900">
                      {account.username}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingUsername(true);
                        setUsernameError('');
                      }}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      disabled={savingProfile}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value.toLowerCase());
                        setUsernameError('');
                      }}
                      placeholder="Choose a username"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      disabled={savingProfile}
                    />
                    {isEditingUsername && account?.username && (
                      <button
                        type="button"
                        onClick={() => {
                          setUsername(account.username || '');
                          setIsEditingUsername(false);
                          setUsernameError('');
                          setUsernameAvailable(null);
                        }}
                        className="text-xs text-gray-600 hover:text-gray-900 mt-1"
                      >
                        Cancel
                      </button>
                    )}
                    {checkingUsername && (
                      <p className="text-xs text-gray-500 mt-1">Checking availability...</p>
                    )}
                    {usernameAvailable === true && username.length >= 3 && !isCurrentUsername && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />
                        Username available
                      </p>
                    )}
                    {usernameAvailable === false && (
                      <p className="text-xs text-red-600 mt-1">Username is not available</p>
                    )}
                    {usernameError && (
                      <p className="text-xs text-red-600 mt-1">{usernameError}</p>
                    )}
                  </>
                )}
              </div>

              {/* First Name and Last Name - Side by Side */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="firstName" className="block text-xs font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setUsernameError('');
                    }}
                    placeholder="First name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    disabled={savingProfile}
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-xs font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setUsernameError('');
                    }}
                    placeholder="Last name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    disabled={savingProfile}
                  />
                </div>
              </div>

              {/* Back Button */}
              <button
                type="button"
                onClick={() => setCurrentStep(steps.length - 1)}
                className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50"
                disabled={savingProfile}
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Back
              </button>

              {/* Complete Button */}
              <button
                type="submit"
                disabled={
                  savingProfile ||
                  (isEditingUsername && checkingUsername) ||
                  (isEditingUsername && !isCurrentUsername && usernameAvailable === false) ||
                  !username.trim() ||
                  username.length < 3 ||
                  (!account?.onboarded && !account?.image_url) ||
                  (!account?.onboarded && !firstName.trim() && !lastName.trim())
                }
                className="w-full text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                {savingProfile ? (
                  'Saving...'
                ) : (
                  <>
                    Complete Setup
                    <ChevronRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Progress dots for step 8 */}
          <div className="flex items-center gap-1.5 pt-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="h-1.5 w-1.5 rounded-full bg-gray-400"
              />
            ))}
            <div className="h-1.5 w-6 rounded-full bg-gray-900" />
          </div>
        </div>
      </div>
    );
  }

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
                Step {currentStep + 1} of 7
              </span>
            </div>
            <button
              onClick={() => {
                setIsVisible(false);
                setShowSuccessStep(false);
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
            {/* Step 7 (profile) dot */}
            <div
              className={`h-1.5 rounded-full transition-all ${
                isStep8
                  ? 'bg-gray-900 w-6'
                  : currentStep > steps.length - 1
                  ? 'bg-gray-400 w-1.5'
                  : 'bg-gray-200 w-1.5'
              }`}
            />
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
                'Continue to Profile Setup'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

