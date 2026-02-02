'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import { AccountService, Account, useAuth, useAuthStateSafe, type AccountTrait } from '@/features/auth';
import { ArrowRightIcon, ArrowLeftIcon, CheckCircleIcon, UserIcon, PhotoIcon, MapIcon, UserPlusIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, ShareIcon, GlobeAltIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';
import type { OnboardingClientProps } from '../types';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';
import { TRAIT_OPTIONS, type TraitId } from '@/types/profile';
import PlanSelectorStepper from '@/components/onboarding/PlanSelectorStepper';
import { type OnboardingStep, determineOnboardingStep, hasCompletedMandatorySteps } from '@/lib/onboardingService';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';

type PlanWithFeatures = BillingPlan & {
  features: (BillingFeature & {
    isInherited: boolean;
    limit_value?: number | null;
    limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  })[];
};

export default function OnboardingClient({ initialAccount, redirectTo, onComplete, onWelcomeShown, onStepperChange }: OnboardingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { refreshAccount } = useAuthStateSafe();
  const [account, setAccount] = useState<Account | null>(initialAccount);
  const [loading, setLoading] = useState(!initialAccount);
  
  // Determine initial step from URL params or account state
  const urlStep = searchParams.get('step');
  const urlSubstep = searchParams.get('substep');
  const checkoutParam = searchParams.get('checkout');
  
  // Use service to determine initial step based on account state
  const getInitialStep = (): OnboardingStep => {
    // Review step ONLY shows when returning from Stripe checkout success
    if (checkoutParam === 'success' && urlStep === 'review') {
      return 'review';
    }
    
    // URL params take precedence (but review is only allowed with checkout=success)
    if (urlStep && urlStep !== 'review') {
      // Validate step is a valid OnboardingStep
      const validSteps: OnboardingStep[] = ['welcome', 'profile_photo', 'username', 'location', 'name', 'bio', 'traits', 'owns_business', 'contact', 'plans'];
      if (validSteps.includes(urlStep as OnboardingStep)) {
        return urlStep as OnboardingStep;
      }
    }
    
    // Otherwise use service to determine from account state
    if (initialAccount) {
      const onboardingState = determineOnboardingStep(initialAccount);
      return onboardingState.currentStep;
    }
    
    return 'welcome';
  };
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(getInitialStep());
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameFormatValid, setUsernameFormatValid] = useState<boolean | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameSaveError, setUsernameSaveError] = useState<string | null>(null);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    bio: '',
    city_id: '',
    traits: [] as string[],
    owns_business: null as boolean | null,
    business_name: '',
    email: '',
    phone: '',
  });
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySearchResults, setCitySearchResults] = useState<Array<{ id: string; name: string; ctu_class?: string }>>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showCityResults, setShowCityResults] = useState(false);
  const [selectedCityName, setSelectedCityName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [usernameEditing, setUsernameEditing] = useState(false);
  
  // Individual save states for each step
  const [nameSaved, setNameSaved] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameSaveError, setNameSaveError] = useState<string | null>(null);
  const [nameEditing, setNameEditing] = useState(false);
  
  const [bioSaved, setBioSaved] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [bioSaveError, setBioSaveError] = useState<string | null>(null);
  const [bioEditing, setBioEditing] = useState(false);
  
  const [traitsSaved, setTraitsSaved] = useState(false);
  const [savingTraits, setSavingTraits] = useState(false);
  const [traitsSaveError, setTraitsSaveError] = useState<string | null>(null);
  const [traitsEditing, setTraitsEditing] = useState(false);
  
  const [ownsBusinessSaved, setOwnsBusinessSaved] = useState(false);
  const [savingOwnsBusiness, setSavingOwnsBusiness] = useState(false);
  const [ownsBusinessSaveError, setOwnsBusinessSaveError] = useState<string | null>(null);
  const [ownsBusinessEditing, setOwnsBusinessEditing] = useState(false);
  
  const [contactSaved, setContactSaved] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaveError, setContactSaveError] = useState<string | null>(null);
  const [contactEditing, setContactEditing] = useState(false);
  
  const [locationSaved, setLocationSaved] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaveError, setLocationSaveError] = useState<string | null>(null);
  const [locationEditing, setLocationEditing] = useState(false);
  
  const [ensureCustomerLoading, setEnsureCustomerLoading] = useState(false);
  const [ensureCustomerError, setEnsureCustomerError] = useState<string | null>(null);
  const [onboardingPlans, setOnboardingPlans] = useState<PlanWithFeatures[]>([]);
  const [onboardingPlansLoading, setOnboardingPlansLoading] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);
  const [planStepperComplete, setPlanStepperComplete] = useState(false);
  
  // Map state for location step
  const locationMapContainerRef = useRef<HTMLDivElement>(null);
  const locationMapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [locationMapLoaded, setLocationMapLoaded] = useState(false);

  const totalSteps = 11;
  const stepIndexMap: Record<OnboardingStep, number> = {
    welcome: 0,
    profile_photo: 1,
    username: 2,
    name: 3,
    bio: 4,
    traits: 5,
    owns_business: 6,
    contact: 7,
    location: 8,
    plans: 9,
    review: 10,
  };
  const stepIndex = stepIndexMap[currentStep];

  // Update stepper state when step changes
  useEffect(() => {
    if (onStepperChange) {
      onStepperChange(stepIndex, totalSteps, currentStep);
    }
  }, [stepIndex, totalSteps, currentStep, onStepperChange]);

  // Load account data if not provided and ensure step is correct
  useEffect(() => {
    if (initialAccount) {
      setAccount(initialAccount);
      setFormData({
        username: initialAccount.username || '',
        first_name: initialAccount.first_name || '',
        last_name: initialAccount.last_name || '',
        bio: initialAccount.bio || '',
        city_id: initialAccount.city_id || '',
        traits: initialAccount.traits ?? [],
        owns_business: initialAccount.owns_business ?? null,
        business_name: initialAccount.business_name || '',
        email: initialAccount.email || '',
        phone: initialAccount.phone || '',
      });
      
      // Ensure we're on the correct step based on account state (only if no URL params)
      // This runs once when account loads, not on every currentStep change
      if (!urlStep) {
        const onboardingState = determineOnboardingStep(initialAccount);
        // Only update if different to avoid unnecessary re-renders
        setCurrentStep(prevStep => {
          return prevStep !== onboardingState.currentStep ? onboardingState.currentStep : prevStep;
        });
      }
      
      // Fetch city name if city_id exists
      if (initialAccount.city_id) {
        fetch(`/api/civic/ctu-boundaries?id=${initialAccount.city_id}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && (data.feature_name || data.name)) {
              setSelectedCityName(data.feature_name || data.name);
              setCitySearchQuery(data.feature_name || data.name);
            }
          })
          .catch(() => {});
      }
      setLoading(false);
      return;
    }
    
    // Only fetch if not provided (shouldn't happen, but handle gracefully)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const loadAccount = async () => {
      try {
        const accountData = await AccountService.getCurrentAccount();
        if (accountData) {
          setAccount(accountData);
          setFormData({
            username: accountData.username || '',
            first_name: accountData.first_name || '',
            last_name: accountData.last_name || '',
            bio: accountData.bio || '',
            city_id: accountData.city_id || '',
            traits: accountData.traits ?? [],
            owns_business: accountData.owns_business ?? null,
            business_name: accountData.business_name || '',
            email: accountData.email || '',
            phone: accountData.phone || '',
          });
        }
      } catch (error) {
        console.error('Error loading account:', error);
        setError('Failed to load account information');
      } finally {
        setLoading(false);
      }
    };

    loadAccount();
  }, [initialAccount, urlStep]);


  // Reset username editing state when leaving username step
  useEffect(() => {
    if (currentStep !== 'username') {
      setUsernameEditing(false);
      // If account.username exists and we're leaving, ensure saved state is maintained
      if (account?.username && formData.username === account.username) {
        setUsernameSaved(true);
      }
    }
  }, [currentStep, account?.username, formData.username]);

  const ensureBilling = useCallback(async () => {
    if (!account?.id) return;
    setEnsureCustomerError(null);
    setEnsureCustomerLoading(true);
    try {
      const response = await fetch('/api/billing/ensure-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEnsureCustomerError(data.error || 'Failed to set up billing');
        return;
      }
      if (data.customerId && refreshAccount) {
        await refreshAccount();
        const updated = await AccountService.getCurrentAccount();
        if (updated) setAccount(updated);
      }
    } catch (err) {
      setEnsureCustomerError(err instanceof Error ? err.message : 'Failed to set up billing');
    } finally {
      setEnsureCustomerLoading(false);
    }
  }, [account?.id, refreshAccount]);

  // Reset plan stepper when leaving plans step
  useEffect(() => {
    if (currentStep !== 'plans') {
      setPlanStepperComplete(false);
    }
  }, [currentStep]);

  // Ensure Stripe customer when entering plans step (for billing setup)
  useEffect(() => {
    if (currentStep !== 'plans' || !account?.id) return;
    if (account.stripe_customer_id) {
      setEnsureCustomerError(null);
      return;
    }
    ensureBilling();
  }, [currentStep, account?.id, account?.stripe_customer_id, ensureBilling]);

  // Handle checkout flow for free trial
  const handleCheckout = async () => {
    if (!account || isProcessingCheckout) return;

    setIsProcessingCheckout(true);
    try {
      // Return URL should go directly to review step after checkout success
      // The checkout API will append &checkout=success to this URL
      const returnUrl = `/onboarding?step=review`;
      
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: 'contributor',
          period: 'monthly',
          returnUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
      setIsProcessingCheckout(false);
    }
  };

  // Fetch Hobby and Contributor plans for step two (plus testing plan for admins)
  useEffect(() => {
    if (currentStep !== 'plans') return;
    setOnboardingPlansLoading(true);
    fetch('/api/billing/plans')
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data: { plans?: PlanWithFeatures[] }) => {
        const plans = data.plans || [];
        const isAdmin = account?.role === 'admin';
        const hobbyAndContributor = plans.filter(
          (p) => {
            const slug = p.slug?.toLowerCase();
            return slug === 'hobby' || 
                   slug === 'contributor' || 
                   (isAdmin && slug === 'testing');
          }
        );
        setOnboardingPlans(hobbyAndContributor);
      })
      .catch(() => setOnboardingPlans([]))
      .finally(() => setOnboardingPlansLoading(false));
  }, [currentStep, account?.role]);

  // Fuzzy search for cities/townships
  useEffect(() => {
    if (currentStep !== 'location') return;

    const searchCities = async () => {
      if (!citySearchQuery.trim() || citySearchQuery.length < 2) {
        setCitySearchResults([]);
        setShowCityResults(false);
        return;
      }

      setLoadingCities(true);
      try {
        // Use cached CTU boundaries from liveBoundaryCache instead of making duplicate API call
        // This prevents duplicate requests and uses the same data source as the map layer
        const { getCTUBoundaries } = await import('@/features/map/services/liveBoundaryCache');
        const allCTUs = await getCTUBoundaries();
        
        // Fuzzy search: match if query appears anywhere in the name (case-insensitive)
        const query = citySearchQuery.toLowerCase().trim();
        const filtered = allCTUs
          .filter((ctu: any) => {
            const name = (ctu.feature_name || ctu.name || '').toLowerCase();
            return name.includes(query);
          })
          .map((ctu: any) => ({
            id: ctu.id,
            name: ctu.feature_name || ctu.name,
            ctu_class: ctu.ctu_class,
          }))
          .sort((a, b) => {
            // Sort by relevance: exact matches first, then by name
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aExact = aName === query;
            const bExact = bName === query;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
            if (!aName.startsWith(query) && bName.startsWith(query)) return 1;
            return a.name.localeCompare(b.name);
          })
          .slice(0, 20); // Limit to top 20 results

        setCitySearchResults(filtered);
        setShowCityResults(true);
      } catch (error) {
        console.error('Error searching cities:', error);
        setCitySearchResults([]);
      } finally {
        setLoadingCities(false);
      }
    };

    const debounceTimer = setTimeout(searchCities, 300);
    return () => clearTimeout(debounceTimer);
  }, [citySearchQuery, currentStep]);

  // Update current time in CST
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const cstTime = now.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setCurrentTime(cstTime);
    };

    // Update immediately
    updateTime();

    // Update every second
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Validate username format
  const validateUsernameFormat = (username: string): boolean => {
    if (!username || username.length < 3 || username.length > 30) {
      return false;
    }
    return /^[a-zA-Z0-9_-]+$/.test(username);
  };

  // Check username availability
  const checkUsername = async (username: string) => {
    // Validate format first
    const isValidFormat = validateUsernameFormat(username);
    setUsernameFormatValid(isValidFormat ? true : (username.length > 0 ? false : null));

    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // Don't check availability if format is invalid
    if (!isValidFormat) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch('/api/accounts/username/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Handle validation errors from API
        if (response.status === 400 && errorData.error) {
          setUsernameFormatValid(false);
          setUsernameAvailable(null);
          return;
        }
        throw new Error(errorData.error || 'Failed to check username');
      }
      
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Save username when valid and available
  const saveUsername = async (username: string) => {
    if (!account?.id) return;
    
    setSavingUsername(true);
    setUsernameSaveError(null);
    
    try {
      await AccountService.updateCurrentAccount({
        username: username.trim().toLowerCase(),
      }, account.id);
      
      // Refresh account to get updated username
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
        setUsernameSaved(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save username';
      setUsernameSaveError(errorMessage);
      setUsernameSaved(false);
    } finally {
      setSavingUsername(false);
    }
  };

  // Save functions for each step
  const saveName = async (firstName: string, lastName: string) => {
    if (!account?.id) return;
    
    // Validate: at least first_name OR last_name required
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst && !trimmedLast) {
      setNameSaveError('Please enter at least a first name or last name');
      return;
    }
    
    setSavingName(true);
    setNameSaveError(null);
    
    try {
      await AccountService.updateCurrentAccount({
        first_name: trimmedFirst || null,
        last_name: trimmedLast || null,
      }, account.id);
      
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
        setNameSaved(true);
        setNameEditing(false);
      }
    } catch (err) {
      setNameSaveError(err instanceof Error ? err.message : 'Failed to save name');
      setNameSaved(false);
    } finally {
      setSavingName(false);
    }
  };

  const saveBio = async (bio: string) => {
    if (!account?.id) return;
    
    // Validate: bio is required
    const trimmedBio = bio.trim();
    if (!trimmedBio) {
      setBioSaveError('Please enter a bio');
      return;
    }
    
    setSavingBio(true);
    setBioSaveError(null);
    
    try {
      await AccountService.updateCurrentAccount({
        bio: trimmedBio,
      }, account.id);
      
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
        setBioSaved(true);
        setBioEditing(false);
      }
    } catch (err) {
      setBioSaveError(err instanceof Error ? err.message : 'Failed to save bio');
      setBioSaved(false);
    } finally {
      setSavingBio(false);
    }
  };

  const saveTraits = async (traits: string[]) => {
    if (!account?.id) return;
    
    setSavingTraits(true);
    setTraitsSaveError(null);
    
    try {
      await AccountService.updateCurrentAccount({
        traits: traits.length > 0 ? (traits as AccountTrait[]) : null,
      }, account.id);
      
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
        setTraitsSaved(true);
        setTraitsEditing(false);
      }
    } catch (err) {
      setTraitsSaveError(err instanceof Error ? err.message : 'Failed to save traits');
      setTraitsSaved(false);
    } finally {
      setSavingTraits(false);
    }
  };

  const saveOwnsBusiness = async (ownsBusiness: boolean | null, businessName: string) => {
    if (!account?.id) return;
    
    setSavingOwnsBusiness(true);
    setOwnsBusinessSaveError(null);
    
    // Validation: if owns_business is true, business_name is required
    if (ownsBusiness === true && !businessName.trim()) {
      setOwnsBusinessSaveError('Please enter your business name or website');
      setSavingOwnsBusiness(false);
      return;
    }
    
    try {
      await AccountService.updateCurrentAccount({
        owns_business: ownsBusiness,
        business_name: ownsBusiness === true ? businessName.trim() || null : null,
      }, account.id);
      
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
        setOwnsBusinessSaved(true);
        setOwnsBusinessEditing(false);
      }
    } catch (err) {
      setOwnsBusinessSaveError(err instanceof Error ? err.message : 'Failed to save business status');
      setOwnsBusinessSaved(false);
    } finally {
      setSavingOwnsBusiness(false);
    }
  };

  const saveContact = async (email: string, phone: string) => {
    if (!account?.id) return;
    
    const emailTrimmed = email.trim();
    const phoneTrimmed = phone.trim();
    
    // Validate: at least email OR phone required
    if (!emailTrimmed && !phoneTrimmed) {
      setContactSaveError('Please enter an email address or phone number');
      return;
    }
    
    // Validate email format if provided
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setContactSaveError('Please enter a valid email address');
      return;
    }
    
    // Validate phone format if provided
    if (phoneTrimmed && !/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(phoneTrimmed)) {
      setContactSaveError('Please enter a valid phone number');
      return;
    }
    
    setSavingContact(true);
    setContactSaveError(null);
    
    try {
      await AccountService.updateCurrentAccount({
        email: emailTrimmed || null,
        phone: phoneTrimmed || null,
      }, account.id);
      
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
        setContactSaved(true);
        setContactEditing(false);
      }
    } catch (err) {
      setContactSaveError(err instanceof Error ? err.message : 'Failed to save contact information');
      setContactSaved(false);
    } finally {
      setSavingContact(false);
    }
  };

  const saveLocation = async (cityId: string) => {
    if (!account?.id) return;
    
    // Validate: city_id is required
    if (!cityId || !cityId.trim()) {
      setLocationSaveError('Please select a location');
      return;
    }
    
    setSavingLocation(true);
    setLocationSaveError(null);
    
    try {
      await AccountService.updateCurrentAccount({
        city_id: cityId.trim(),
      }, account.id);
      
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
        setLocationSaved(true);
        setLocationEditing(false);
        // Update selected city name if available
        if (cityId && citySearchResults.length > 0) {
          const city = citySearchResults.find(c => c.id === cityId);
          if (city) {
            setSelectedCityName(city.name);
          }
        }
      }
    } catch (err) {
      setLocationSaveError(err instanceof Error ? err.message : 'Failed to save location');
      setLocationSaved(false);
    } finally {
      setSavingLocation(false);
    }
  };

  // Initialize username state when entering username step
  useEffect(() => {
    if (currentStep === 'username') {
      // If account.username exists, always show it in confirmed state (force confirmed view)
      if (account?.username) {
        // Sync formData with account.username
        setFormData(prev => {
          // Only update if different to avoid unnecessary re-renders
          if (prev.username !== account.username) {
            return { ...prev, username: account.username || '' };
          }
          return prev;
        });
        // Force confirmed state - user must click Edit to modify
        setUsernameSaved(true);
        setUsernameAvailable(true);
        setUsernameFormatValid(true);
        setUsernameEditing(false);
        // Clear any errors
        setUsernameSaveError(null);
      } else {
        // Reset saved state when entering step without existing username
        setUsernameSaved(false);
        setUsernameEditing(false);
      }
    }
  }, [currentStep, account?.username]);

  // Validate format and check availability on username change
  // Only run when user is actively editing (not in confirmed state)
  useEffect(() => {
    // Skip validation if we're in confirmed state (not editing)
    if (currentStep !== 'username' || (usernameSaved && account?.username && !usernameEditing)) {
      return;
    }

    const username = formData.username.trim();
    
    // Reset states when username is cleared
    if (!username) {
      setUsernameFormatValid(null);
      setUsernameAvailable(null);
      // Only reset saved if we're editing (not in confirmed state)
      if (usernameEditing) {
        setUsernameSaved(false);
      }
      setUsernameSaveError(null);
      return;
    }

    // Immediate format validation
    const isValidFormat = validateUsernameFormat(username);
    setUsernameFormatValid(isValidFormat ? true : false);

    // Debounce availability check
    const timer = setTimeout(() => {
      // Only check if username is different from saved username
      if (username && username !== account?.username) {
        checkUsername(username);
      } else if (username === account?.username && usernameEditing) {
        // If editing and matches account username, mark as available
        // but don't auto-save - require explicit confirmation
        setUsernameAvailable(true);
        setUsernameFormatValid(true);
        setUsernameSaved(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username, account?.username, currentStep, usernameSaved, usernameEditing]);

  // Don't auto-save - require explicit "Confirm Username" button click

  // Initialize photo confirmation state - only confirm if photo exists in account (saved to DB)
  useEffect(() => {
    if (currentStep === 'profile_photo') {
      // Only mark as confirmed if photo exists in account (was saved via API)
      // Don't auto-confirm pending previews
      if (account?.image_url && !pendingPhotoPreview) {
        setPhotoConfirmed(true);
      } else if (pendingPhotoPreview) {
        // If there's a pending preview, it's not confirmed yet
        setPhotoConfirmed(false);
      }
    }
  }, [currentStep, account?.image_url, pendingPhotoPreview]);

  // Cleanup checkout param after review step is shown (only when checkout=success)
  useEffect(() => {
    if (currentStep === 'review') {
      const checkoutParam = searchParams.get('checkout');
      if (checkoutParam === 'success') {
        // Delay cleanup to allow review step to render
        setTimeout(() => {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('checkout');
          router.replace(newUrl.pathname + newUrl.search, { scroll: false });
        }, 500);
      }
    }
  }, [currentStep, searchParams, router]);
  
  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (pendingPhotoPreview) {
        URL.revokeObjectURL(pendingPhotoPreview);
      }
    };
  }, [pendingPhotoPreview]);

  // Initialize name step
  useEffect(() => {
    if (currentStep === 'name') {
      if (account?.first_name || account?.last_name) {
        setFormData(prev => ({
          ...prev,
          first_name: account.first_name || '',
          last_name: account.last_name || '',
        }));
        setNameSaved(true);
        setNameEditing(false);
      } else {
        setNameSaved(false);
        setNameEditing(false);
      }
    }
  }, [currentStep, account?.first_name, account?.last_name]);

  // Initialize bio step
  useEffect(() => {
    if (currentStep === 'bio') {
      if (account?.bio) {
        setFormData(prev => ({
          ...prev,
          bio: account.bio || '',
        }));
        setBioSaved(true);
        setBioEditing(false);
      } else {
        setBioSaved(false);
        setBioEditing(false);
      }
    }
  }, [currentStep, account?.bio]);

  // Initialize traits step
  useEffect(() => {
    if (currentStep === 'traits') {
      if (account?.traits && account.traits.length > 0) {
        setFormData(prev => ({
          ...prev,
          traits: account.traits || [],
        }));
        setTraitsSaved(true);
        setTraitsEditing(false);
      } else {
        setTraitsSaved(false);
        setTraitsEditing(false);
      }
    }
  }, [currentStep, account?.traits]);

  // Initialize owns_business step
  useEffect(() => {
    if (currentStep === 'owns_business') {
      if (account?.owns_business !== null && account?.owns_business !== undefined) {
        const ownsBusiness = account.owns_business;
        setFormData(prev => ({
          ...prev,
          owns_business: ownsBusiness,
          business_name: account.business_name || '',
        }));
        setOwnsBusinessSaved(true);
        setOwnsBusinessEditing(false);
      } else {
        setOwnsBusinessSaved(false);
        setOwnsBusinessEditing(false);
      }
    }
  }, [currentStep, account?.owns_business, account?.business_name]);

  // Initialize contact step
  useEffect(() => {
    if (currentStep === 'contact') {
      if (account?.email || account?.phone) {
        setFormData(prev => ({
          ...prev,
          email: account.email || '',
          phone: account.phone || '',
        }));
        setContactSaved(true);
        setContactEditing(false);
      } else {
        setContactSaved(false);
        setContactEditing(false);
      }
    }
  }, [currentStep, account?.email, account?.phone]);


  // Initialize location step
  useEffect(() => {
    if (currentStep === 'location') {
      if (account?.city_id) {
        setFormData(prev => ({
          ...prev,
          city_id: account.city_id || '',
        }));
        setLocationSaved(true);
        setLocationEditing(false);
        // Fetch city name if needed
        if (account.city_id && !selectedCityName) {
          fetch(`/api/civic/ctu-boundaries?id=${account.city_id}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data && (data.feature_name || data.name)) {
                setSelectedCityName(data.feature_name || data.name);
                setCitySearchQuery(data.feature_name || data.name);
              }
            })
            .catch(() => {});
        }
      } else {
        setLocationSaved(false);
        setLocationEditing(false);
      }
    }
  }, [currentStep, account?.city_id, selectedCityName]);

  // Reset editing states when leaving steps
  useEffect(() => {
    if (currentStep !== 'name') setNameEditing(false);
    if (currentStep !== 'bio') setBioEditing(false);
    if (currentStep !== 'traits') setTraitsEditing(false);
    if (currentStep !== 'owns_business') setOwnsBusinessEditing(false);
    if (currentStep !== 'contact') setContactEditing(false);
    if (currentStep !== 'location') setLocationEditing(false);
  }, [currentStep]);

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault();
      // Only submit when user explicitly clicks the Complete button, not on Enter key
      const submitEvent = e.nativeEvent as SubmitEvent;
      if (submitEvent.submitter == null) {
        return;
      }
    }
    setSaving(true);
    setError('');

    // Validate mandatory steps are complete
    if (!account?.image_url) {
      setError('Please complete your profile photo');
      setSaving(false);
      return;
    }

    if (!account?.username) {
      setError('Please complete your username');
      setSaving(false);
      return;
    }

    try {
      // Only set onboarded flag - all data is already saved individually
      const supabase = (await import('@/lib/supabase')).supabase;
      const accountId = account?.id;
      
      if (!accountId) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          throw new Error('Not authenticated');
        }
        const { data: accountRecord } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', authUser.id)
          .limit(1)
          .single();
        if (!accountRecord) {
          throw new Error('Account not found');
        }
        const { error: onboardError } = await supabase
          .from('accounts')
          .update({ onboarded: true })
          .eq('id', accountRecord.id);
        if (onboardError) throw onboardError;
      } else {
        const { error: onboardError } = await supabase
          .from('accounts')
          .update({ onboarded: true })
          .eq('id', accountId);
        if (onboardError) throw onboardError;
      }

      // Refresh account data
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
      }

      setSaving(false);

      // Refresh and redirect
      if (refreshAccount) {
        await refreshAccount();
      }
      const latestAccount = await AccountService.getCurrentAccount();
      if (latestAccount) {
        setAccount(latestAccount);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (onComplete) {
        await onComplete();
      }
      router.push(redirectTo || '/');
      router.refresh();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      
      let errorMessage = 'Failed to complete onboarding';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setSaving(false);
    }
  };

  const handleFormChange = (field: keyof typeof formData, value: string | string[] | null) => {
    if (field === 'traits') {
      setFormData(prev => ({ ...prev, traits: Array.isArray(value) ? value : [] }));
      return;
    }
    let normalizedValue = Array.isArray(value) ? value[0] || '' : value || '';
    if (field === 'username') {
      normalizedValue = normalizedValue.toLowerCase();
      // Reset validation and save states when username changes
      setUsernameAvailable(null);
      setUsernameFormatValid(null);
      setUsernameSaved(false);
      setUsernameSaveError(null);
    }
    setFormData(prev => ({ ...prev, [field]: normalizedValue }));
    setError('');
  };

  const toggleTrait = (traitId: TraitId) => {
    setFormData(prev => {
      const isCurrentlySelected = prev.traits.includes(traitId);
      
      // If deselecting, allow it
      if (isCurrentlySelected) {
        return {
          ...prev,
          traits: prev.traits.filter(t => t !== traitId),
        };
      }
      
      // If selecting, check max limit (5)
      if (prev.traits.length >= 5) {
        return prev; // Don't allow selecting more than 5
      }
      
      // Allow selection
      return {
        ...prev,
        traits: [...prev.traits, traitId],
      };
    });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    // Create preview URL (doesn't save to database yet)
    const previewUrl = URL.createObjectURL(file);
    setPendingPhotoFile(file);
    setPendingPhotoPreview(previewUrl);
    setPhotoConfirmed(false);
    setImageError(null);
    
    // Clean up file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save photo to database when confirmed
  const confirmPhoto = async () => {
    if (!pendingPhotoFile || !user || !account?.id) return;

    setUploadingImage(true);
    setImageError(null);

    try {
      // Generate unique filename
      const fileExt = pendingPhotoFile.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/accounts/image_url/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, pendingPhotoFile, {
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

      // POST to API to save photo
      const updatedAccount = await AccountService.updateCurrentAccount({
        image_url: urlData.publicUrl,
      }, account.id);

      // Update local account state with API response
      setAccount(updatedAccount);
      
      // Mark as confirmed only after successful API save
      setPhotoConfirmed(true);
      
      // Clean up preview URL (local state)
      if (pendingPhotoPreview) {
        URL.revokeObjectURL(pendingPhotoPreview);
      }
      setPendingPhotoFile(null);
      setPendingPhotoPreview(null);
    } catch (err) {
      console.error('Error uploading image:', err);
      setImageError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Cancel pending photo
  const cancelPhoto = () => {
    if (pendingPhotoPreview) {
      URL.revokeObjectURL(pendingPhotoPreview);
    }
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    setPhotoConfirmed(false);
    setImageError(null);
  };


  // Trigger confetti when welcome screen appears
  useEffect(() => {
    if (showWelcome && onboardingComplete) {
      // Trigger confetti animation
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
    }
  }, [showWelcome, onboardingComplete]);

  const handleGetStarted = async () => {
    try {
      // Refresh auth state to get updated account with username
      if (refreshAccount) {
        await refreshAccount();
      }

      // Also fetch account directly to ensure we have the latest data
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
      }

      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 300));

      // Call onComplete callback if provided (for modal context)
      // This will trigger the modal to refresh and close
      if (onComplete) {
        await onComplete();
      }

      // Use Next.js router with revalidation for clean state (only if redirectTo is provided)
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        // Just refresh the page to update state
        router.refresh();
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still try to complete even if refresh fails
      if (onComplete) {
        await onComplete();
      }
      router.refresh();
    }
  };

  // Memoized callback for plan substep changes to prevent infinite loops
  const handlePlanSubStepChange = useCallback((subStep: number, stepName: string) => {
    if (onStepperChange) {
      // Pass the substep info as a custom step name
      onStepperChange(stepIndex, totalSteps, `plans_${subStep}_${stepName}`);
    }
  }, [onStepperChange, stepIndex, totalSteps]);

  // Helper to update URL when step changes - preserves checkout param
  const updateStepUrl = (step: OnboardingStep, substep?: number) => {
    const currentUrl = new URL(window.location.href);
    const checkoutParam = currentUrl.searchParams.get('checkout');
    
    if (step === 'plans') {
      // Use provided substep or keep existing, preserve checkout param
      const currentSubstep = searchParams.get('substep');
      const substepValue = substep !== undefined ? String(substep) : (currentSubstep || '1');
      const params = new URLSearchParams({ step: 'plans', substep: substepValue });
      if (checkoutParam) {
        params.set('checkout', checkoutParam);
      }
      router.replace(`/onboarding?${params.toString()}`, { scroll: false });
    } else {
      // For non-plans steps, preserve checkout param if present
      const params = new URLSearchParams({ step });
      if (checkoutParam) {
        params.set('checkout', checkoutParam);
      }
      router.replace(`/onboarding?${params.toString()}`, { scroll: false });
    }
  };

  // Unified step completion validation
  const isStepComplete = (step: OnboardingStep): boolean => {
    if (!account) {
      // Welcome step is always complete (no validation needed)
      return step === 'welcome';
    }
    
    switch (step) {
      case 'welcome':
        // Welcome step is always complete (informational only)
        return true;
      case 'profile_photo':
        return !!account.image_url && photoConfirmed;
      case 'username':
        return !!account.username && usernameSaved;
      case 'name':
        return nameSaved && !!(account.first_name || account.last_name);
      case 'bio':
        return bioSaved && !!account.bio && account.bio.trim().length > 0;
      case 'traits':
        return !!traitsSaved && !!account.traits && Array.isArray(account.traits) && account.traits.length >= 1 && account.traits.length <= 5;
      case 'owns_business':
        return ownsBusinessSaved && account.owns_business !== null && account.owns_business !== undefined && 
               (account.owns_business === false || (account.owns_business === true && !!account.business_name));
      case 'contact':
        return contactSaved && !!(account.email || account.phone);
      case 'location':
        return locationSaved && !!account.city_id;
      case 'plans':
        // Plans step is complete when:
        // 1. Has stripe_customer_id (billing set up)
        // 2. Has a plan selected (not null and not 'hobby' unless explicitly set)
        // 3. For paid plans: has active/trialing subscription OR planStepperComplete (completed flow)
        // 4. For hobby/free: planStepperComplete (completed flow)
        if (!account.stripe_customer_id) return false;
        if (!account.plan || account.plan === 'hobby') {
          // For hobby plan, require planStepperComplete to ensure user went through the flow
          return planStepperComplete;
        }
        // For paid plans, check subscription status or planStepperComplete
        const hasActiveSubscription = 
          account.subscription_status === 'active' || 
          account.subscription_status === 'trialing';
        return hasActiveSubscription || planStepperComplete;
      case 'review':
        // Review is complete when all previous steps are complete
        const stepOrder: OnboardingStep[] = ['welcome', 'profile_photo', 'username', 'location', 'name', 'bio', 'traits', 'owns_business', 'contact', 'plans'];
        return stepOrder.every(s => isStepComplete(s));
      default:
        return false;
    }
  };

  const handleNext = () => {
    const stepOrder: OnboardingStep[] = ['welcome', 'profile_photo', 'username', 'location', 'name', 'bio', 'traits', 'owns_business', 'contact', 'plans', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    // Can only proceed if current step is complete
    if (!isStepComplete(currentStep)) {
      return;
    }
    
    // Special handling: plans step never auto-advances to review
    // Review step only shows after Stripe checkout success
    if (currentStep === 'plans') {
      // Plans step handles its own navigation via PlanSelectorStepper
      // Don't auto-advance to review
      return;
    }
    
    // Can only proceed to next step if it exists
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      // Skip review step unless explicitly navigating to it with checkout=success
      if (nextStep === 'review') {
        const checkoutParam = searchParams.get('checkout');
        if (checkoutParam !== 'success') {
          // Don't navigate to review unless checkout=success is present
          return;
        }
      }
      setCurrentStep(nextStep);
      updateStepUrl(nextStep);
    }
  };

  const handleBack = () => {
    const stepOrder: OnboardingStep[] = ['welcome', 'profile_photo', 'username', 'location', 'name', 'bio', 'traits', 'owns_business', 'contact', 'plans', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    // Special handling: if on review step, go back to plans step substep 3
    // This preserves context since user was on payment/terms step before Stripe checkout
    if (currentStep === 'review') {
      setCurrentStep('plans');
      updateStepUrl('plans', 3); // Preserve substep 3 context
      return;
    }
    
    if (currentIndex > 0) {
      const prevStep = stepOrder[currentIndex - 1];
      setCurrentStep(prevStep);
      updateStepUrl(prevStep);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="text-center">
          <div className="w-4 h-4 border-2 border-neutral-700 border-t-neutral-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Welcome Screen (after completion)
  if (showWelcome) {
    return (
      <div className="space-y-3">
        <div className="text-center mb-3">
          {onboardingComplete && (
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-green-500">Onboarding Complete!</span>
            </div>
          )}
          <h2 className="text-sm font-semibold text-white mb-1">Welcome to For the Love of Minnesota!</h2>
          <p className="text-xs text-neutral-400">Get started by exploring these features</p>
        </div>

        {/* Info Cards */}
        <div className="space-y-2">
          {/* Card 1: Create Maps */}
          <div className="bg-neutral-900 rounded-md border border-neutral-700 p-[10px]">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                <MapIcon className="w-4 h-4 text-neutral-200" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-white mb-0.5">Create Maps</h3>
                <p className="text-[10px] text-neutral-400 leading-relaxed">
                  Build your own custom maps and organize locations that matter to you.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Join Maps */}
          <div className="bg-neutral-900 rounded-md border border-neutral-700 p-[10px]">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                <UserPlusIcon className="w-4 h-4 text-neutral-200" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-white mb-0.5">Join Maps</h3>
                <p className="text-[10px] text-neutral-400 leading-relaxed">
                  Discover and join maps created by others. Collaborate and explore together.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Share Profile */}
          <div className="bg-neutral-900 rounded-md border border-neutral-700 p-[10px]">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                <ArrowUpTrayIcon className="w-4 h-4 text-neutral-200" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-white mb-0.5">Share Profile</h3>
                <p className="text-[10px] text-neutral-400 leading-relaxed">
                  Share your profile and maps with others. Connect with the Minnesota community.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Get Started Button */}
        <div className="pt-2">
          <button
            onClick={handleGetStarted}
            className="w-full flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-black bg-white hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            Get Started
            <ArrowRightIcon className="w-3 h-3" />
          </button>
        </div>

        {/* Go to Profile Button */}
        {account?.username && (
          <div className="pt-1">
            <Link
              href={`/${account.username}`}
              className="w-full flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-neutral-700 rounded-md text-xs font-medium text-neutral-200 bg-neutral-900 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
            >
              <UserIcon className="w-3 h-3" />
              Go to Profile
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex ${currentStep === 'plans' ? 'items-start' : 'items-center'} justify-center bg-transparent`}>
      <div className="w-full max-w-[500px] px-4 space-y-3">
        {/* Step Content */}
      {currentStep === 'welcome' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center space-y-4">
            {/* Heart Emoji */}
            <div className="flex justify-center">
              <span className="text-8xl">❤️</span>
            </div>

            {/* Description Text */}
            <div className="text-center">
              <p className="text-xs text-neutral-300 leading-relaxed">
                For the Love of Minnesota is a map-based platform that brings our state to life through real places, real stories, and real recommendations. Instead of posts floating in a feed, everything is anchored to the locations that matter—lakes, towns, neighborhoods, businesses, projects, and moments—showing why Minnesota is one of the best places to live, work, and build community.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'plans' && (
        <div className="space-y-3">
          <PlanSelectorStepper
            account={account}
            plans={onboardingPlans}
            plansLoading={onboardingPlansLoading}
            onBillingSetup={ensureBilling}
            ensureCustomerLoading={ensureCustomerLoading}
            ensureCustomerError={ensureCustomerError}
            onComplete={() => {
              setPlanStepperComplete(true);
              // Refresh account to get latest plan/subscription data
              refreshAccount?.().then(() => {
                AccountService.getCurrentAccount().then(updatedAccount => {
                  if (updatedAccount) {
                    setAccount(updatedAccount);
                  }
                });
              });
            }}
            refreshAccount={refreshAccount}
            onSubStepChange={handlePlanSubStepChange}
          />
        </div>
      )}

      {currentStep === 'name' && (
        <div className="space-y-3">
          {nameSaved && account?.first_name && !nameEditing ? (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={`${account.first_name || ''} ${account.last_name || ''}`.trim()}
                  disabled
                  className="w-full pl-3 pr-20 py-3 border-2 border-green-500/60 rounded-lg text-sm text-white bg-neutral-800/50 cursor-not-allowed shadow-sm ring-1 ring-green-500/20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
                  <CheckCircleIcon className="w-5 h-5 text-green-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setNameEditing(true);
                      setNameSaved(false);
                    }}
                    className="text-[#007AFF] hover:text-[#0066D6] hover:underline text-xs font-semibold transition-colors px-2 py-1 rounded hover:bg-[#007AFF]/10"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label htmlFor="onboarding-first-name" className="block text-sm font-medium text-neutral-500 mb-0.5">
                  First name
                </label>
                <input
                  id="onboarding-first-name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleFormChange('first_name', e.target.value)}
                  className="w-full px-[10px] py-[10px] border border-neutral-700 rounded-md text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors bg-neutral-800 hover:bg-neutral-700"
                  placeholder="First name"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label htmlFor="onboarding-last-name" className="block text-sm font-medium text-neutral-500 mb-0.5">
                  Last name
                </label>
                <input
                  id="onboarding-last-name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleFormChange('last_name', e.target.value)}
                  className="w-full px-[10px] py-[10px] border border-neutral-700 rounded-md text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors bg-neutral-800 hover:bg-neutral-700"
                  placeholder="Last name"
                  autoComplete="family-name"
                />
              </div>
              {nameSaveError && (
                <div className="rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-4 py-3 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{nameSaveError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 'bio' && (
        <div className="space-y-2">
          {bioSaved && account?.bio && !bioEditing ? (
            <div className="relative">
              <textarea
                value={account.bio}
                disabled
                className="w-full px-3 py-3 border-2 border-green-500/60 rounded-lg text-xs text-white bg-neutral-800/50 cursor-not-allowed shadow-sm ring-1 ring-green-500/20 resize-none"
                rows={3}
              />
              <div className="absolute right-3 top-3 flex items-center gap-2.5">
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
                <button
                  type="button"
                  onClick={() => {
                    setBioEditing(true);
                    setBioSaved(false);
                  }}
                  className="text-[#007AFF] hover:text-[#0066D6] hover:underline text-xs font-semibold transition-colors px-2 py-1 rounded hover:bg-[#007AFF]/10"
                >
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="onboarding-bio" className="block text-sm font-medium text-neutral-500 mb-0.5">
                About you
              </label>
              <textarea
                id="onboarding-bio"
                value={formData.bio}
                onChange={(e) => handleFormChange('bio', e.target.value.slice(0, 240))}
                className="w-full px-2 py-1.5 border border-neutral-700 rounded-md text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors bg-neutral-800 hover:bg-neutral-700 resize-none"
                placeholder="Tell other Minnesotans about yourself..."
                rows={3}
                maxLength={240}
              />
              <p className="text-[10px] text-neutral-500 mt-1">{formData.bio.length}/240</p>
              {bioSaveError && (
                <div className="mt-2 rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-4 py-3 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{bioSaveError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 'traits' && (
        <div className="space-y-2">
          {traitsSaved && account?.traits && account.traits.length > 0 && !traitsEditing ? (
            <div className="space-y-3">
              <div className="relative">
                <div className="border-2 border-green-500/60 rounded-lg p-3 bg-neutral-800/50 shadow-sm ring-1 ring-green-500/20 min-h-[60px]">
                  <div className="flex flex-wrap gap-1.5">
                    {account.traits.map((traitId) => {
                      const trait = TRAIT_OPTIONS.find(t => t.id === traitId);
                      if (!trait) return null;
                      return (
                        <span
                          key={traitId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-white text-[10px] rounded border border-white/20"
                        >
                          {trait.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="absolute right-3 top-3 flex items-center gap-2.5">
                  <CheckCircleIcon className="w-5 h-5 text-green-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setTraitsEditing(true);
                      setTraitsSaved(false);
                    }}
                    className="text-[#007AFF] hover:text-[#0066D6] hover:underline text-xs font-semibold transition-colors px-2 py-1 rounded hover:bg-[#007AFF]/10"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Selected traits - above heading */}
              {formData.traits.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.traits.map((traitId) => {
                    const trait = TRAIT_OPTIONS.find(t => t.id === traitId);
                    if (!trait) return null;
                    return (
                      <div
                        key={traitId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-xs text-white"
                      >
                        <span>{trait.label}</span>
                        <button
                          type="button"
                          onClick={() => toggleTrait(trait.id as TraitId)}
                          className="ml-0.5 hover:bg-neutral-700 rounded p-0.5 transition-colors"
                          aria-label={`Remove ${trait.label}`}
                        >
                          <XMarkIcon className="w-3.5 h-3.5 text-neutral-400 hover:text-white" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {formData.traits.length >= 5 && (
                <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/20 backdrop-blur-sm px-3 py-2 text-xs text-yellow-300 flex items-start gap-2 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Maximum of 5 traits selected. Remove one to select another.</span>
                </div>
              )}
              
              {formData.traits.length === 0 && (
                <div className="rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-3 py-2 text-xs text-red-300 flex items-start gap-2 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Please select at least 1 trait.</span>
                </div>
              )}
              
              <div className="flex flex-wrap gap-1 max-h-[280px] overflow-y-auto scrollbar-hide">
                {TRAIT_OPTIONS.map((trait) => {
                  const isSelected = formData.traits.includes(trait.id);
                  const isDisabled = !isSelected && formData.traits.length >= 5;
                  return (
                    <button
                      key={trait.id}
                      type="button"
                      onClick={() => toggleTrait(trait.id as TraitId)}
                      disabled={isDisabled}
                      className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                        isSelected
                          ? 'bg-green-500/20 text-green-400 border-green-500/60'
                          : isDisabled
                          ? 'bg-neutral-800/50 text-neutral-500 border-neutral-800 cursor-not-allowed opacity-50'
                          : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-600'
                      }`}
                    >
                      {trait.label}
                    </button>
                  );
                })}
              </div>
              {traitsSaveError && (
                <div className="rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-4 py-3 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{traitsSaveError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 'owns_business' && (
        <div className="space-y-3">
          {ownsBusinessSaved && account?.owns_business !== null && account?.owns_business !== undefined && !ownsBusinessEditing ? (
            <div className="relative">
              <div className="border-2 border-green-500/60 rounded-lg p-[10px] bg-neutral-800/50 shadow-sm ring-1 ring-green-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      account.owns_business 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/40' 
                        : 'bg-neutral-700 text-neutral-300 border border-neutral-600'
                    }`}>
                      {account.owns_business ? '✓' : '—'}
                    </div>
                    <div>
                      <span className="text-sm text-white font-medium block">
                        {account.owns_business ? 'Yes, I own a business' : 'No, I don\'t own a business'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-400" />
                    <button
                      type="button"
                      onClick={() => {
                        setOwnsBusinessEditing(true);
                        setOwnsBusinessSaved(false);
                      }}
                      className="text-[#007AFF] hover:text-[#0066D6] text-xs font-semibold transition-colors px-2 py-1 rounded hover:bg-[#007AFF]/10"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                {account.owns_business && account.business_name && (
                  <div className="pt-2 border-t border-neutral-700">
                    <p className="text-[10px] text-neutral-400 mb-1 font-medium">Business Name</p>
                    <p className="text-xs text-white font-medium">{account.business_name}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, owns_business: true as boolean | null }))}
                  className={`px-4 py-3 rounded-lg border-2 text-xs font-semibold transition-all ${
                    formData.owns_business === true
                      ? 'bg-[#007AFF]/10 border-[#007AFF] text-[#007AFF] ring-2 ring-[#007AFF]/20'
                      : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-750'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      formData.owns_business === true
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-neutral-700 text-neutral-400'
                    }`}>
                      ✓
                    </div>
                    <span>Yes</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, owns_business: false, business_name: '' }))}
                  className={`px-4 py-3 rounded-lg border-2 text-xs font-semibold transition-all ${
                    formData.owns_business === false
                      ? 'bg-[#007AFF]/10 border-[#007AFF] text-[#007AFF] ring-2 ring-[#007AFF]/20'
                      : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-750'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      formData.owns_business === false
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-neutral-700 text-neutral-400'
                    }`}>
                      —
                    </div>
                    <span>No</span>
                  </div>
                </button>
              </div>
              
              {formData.owns_business === true && (
                <div className="space-y-2 pt-1">
                  <label htmlFor="onboarding-business-name" className="block text-xs font-semibold text-white">
                    What's your business name or website?
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <input
                    id="onboarding-business-name"
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => handleFormChange('business_name', e.target.value)}
                    className={`w-full px-[10px] py-[10px] border rounded-md text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 transition-colors ${
                      formData.business_name.trim() 
                        ? 'border-green-500/40 bg-neutral-800 focus:ring-green-500/20' 
                        : 'border-red-500/40 bg-neutral-800 focus:ring-red-500/20'
                    }`}
                    placeholder="Enter business name or website"
                    autoComplete="organization"
                    required
                  />
                  {!formData.business_name.trim() && (
                    <div className="flex items-start gap-1.5 text-[10px] text-red-400">
                      <ExclamationCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>Business name is required when you own a business</span>
                    </div>
                  )}
                </div>
              )}
              
              {formData.owns_business === null && (
                <div className="rounded-md border border-red-500/40 bg-red-900/10 backdrop-blur-sm px-3 py-2 text-xs text-red-300 flex items-start gap-2 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Please select Yes or No.</span>
                </div>
              )}
              
              {ownsBusinessSaveError && (
                <div className="rounded-md border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-3 py-2.5 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{ownsBusinessSaveError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 'contact' && (
        <div className="space-y-2">
          {contactSaved && (account?.email || account?.phone) && !contactEditing ? (
            <div className="space-y-2">
              <div className="relative">
                <div className="border-2 border-green-500/60 rounded-lg p-3 bg-neutral-800/50 shadow-sm ring-1 ring-green-500/20 space-y-2">
                  {account.email && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-neutral-400 mb-0.5">Email</p>
                        <p className="text-xs text-white">{account.email}</p>
                      </div>
                    </div>
                  )}
                  {account.phone && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-neutral-400 mb-0.5">Phone</p>
                        <p className="text-xs text-white">{account.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="absolute right-3 top-3 flex items-center gap-2.5">
                  <CheckCircleIcon className="w-5 h-5 text-green-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setContactEditing(true);
                      setContactSaved(false);
                    }}
                    className="text-[#007AFF] hover:text-[#0066D6] hover:underline text-xs font-semibold transition-colors px-2 py-1 rounded hover:bg-[#007AFF]/10"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label htmlFor="onboarding-email" className="block text-sm font-medium text-neutral-500 mb-0.5">
                  Email
                </label>
                <input
                  id="onboarding-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  className="w-full px-2 py-1.5 border border-neutral-700 rounded-md text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors bg-neutral-800 hover:bg-neutral-700"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="onboarding-phone" className="block text-sm font-medium text-neutral-500 mb-0.5">
                  Phone
                </label>
                <input
                  id="onboarding-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                  className="w-full px-2 py-1.5 border border-neutral-700 rounded-md text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors bg-neutral-800 hover:bg-neutral-700"
                  placeholder="+1 (555) 000-0000"
                  autoComplete="tel"
                />
              </div>
              {contactSaveError && (
                <div className="rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-4 py-3 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{contactSaveError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 'location' && (
        <div className="space-y-3">
          {locationSaved && account?.city_id && selectedCityName && !locationEditing ? (
            <div className="relative">
              <div className="border-2 border-green-500/60 rounded-lg p-[10px] bg-neutral-800/50 shadow-sm ring-1 ring-green-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-neutral-400 mb-0.5 font-medium">City</p>
                    <p className="text-xs text-white font-medium">{selectedCityName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-400" />
                    <button
                      type="button"
                      onClick={() => {
                        setLocationEditing(true);
                        setLocationSaved(false);
                      }}
                      className="text-[#007AFF] hover:text-[#0066D6] text-xs font-semibold transition-colors px-2 py-1 rounded hover:bg-[#007AFF]/10"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search Input */}
              <div className="relative">
                <label htmlFor="onboarding-city-search" className="block text-xs font-semibold text-white mb-1">
                  Search for your city
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    id="onboarding-city-search"
                    type="text"
                    value={citySearchQuery}
                    onChange={(e) => {
                      setCitySearchQuery(e.target.value);
                      setShowCityResults(true);
                    }}
                    onFocus={() => {
                      if (citySearchResults.length > 0) {
                        setShowCityResults(true);
                      }
                    }}
                    className="w-full pl-8 pr-2 py-[10px] border border-neutral-700 rounded-md text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors bg-neutral-800 hover:bg-neutral-700"
                    placeholder="Search for your city..."
                    autoComplete="off"
                  />
                  {loadingCities && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                
                {showCityResults && citySearchResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg max-h-48 overflow-y-auto scrollbar-hide">
                    {citySearchResults.map((city) => (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, city_id: city.id }));
                          setCitySearchQuery(city.name);
                          setSelectedCityName(city.name);
                          setShowCityResults(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-white hover:bg-neutral-800 transition-colors border-b border-neutral-800 last:border-b-0"
                      >
                        {city.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {locationSaveError && (
                <div className="rounded-md border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-3 py-2.5 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
                  <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{locationSaveError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 'profile_photo' && (
        <div className="space-y-4">
          {/* Profile Image */}
          <div className="flex flex-col items-center">
            <label className="block text-sm font-semibold text-neutral-300 mb-1.5 px-4">
              Profile Photo <span className="text-red-400 font-bold">*</span>
            </label>
            <div className="relative group">
              <div className={`relative w-20 h-20 rounded-full overflow-hidden bg-neutral-800 border-2 flex items-center justify-center shadow-sm transition-all ${
                pendingPhotoPreview 
                  ? 'border-[#007AFF]/60 ring-2 ring-[#007AFF]/30' 
                  : photoConfirmed 
                  ? 'border-green-500/60 ring-1 ring-green-500/20' 
                  : 'border-neutral-700 hover:border-neutral-600'
              }`}>
                {pendingPhotoPreview ? (
                  // Show pending preview
                  <img
                    src={pendingPhotoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : account?.image_url ? (
                  <Image
                    src={account.image_url}
                    alt="Profile"
                    fill
                    sizes="80px"
                    className="object-cover"
                    onError={() => setImageError('Failed to load image')}
                    unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                  />
                ) : (
                  <UserIcon className="w-10 h-10 text-neutral-500" />
                )}
              </div>
              
              {/* Hover Overlay - Only show when not pending and not uploading */}
              {!pendingPhotoPreview && !uploadingImage && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                >
                  <PhotoIcon className="w-6 h-6 text-white" />
                </div>
              )}
              {uploadingImage && (
                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploadingImage}
              />
            </div>
            {imageError && (
              <div className="mt-3 px-4 py-3 rounded-lg text-xs bg-red-900/20 backdrop-blur-sm border border-red-600/50 text-red-300 flex items-start gap-2.5 shadow-sm">
                <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{imageError}</span>
              </div>
            )}
            
            {/* Confirmed state */}
            {photoConfirmed && account?.image_url && !pendingPhotoPreview && (
              <div className="flex items-center gap-2 mt-3 text-green-400 justify-center py-2.5 px-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <CheckCircleIcon className="w-4 h-4" />
                <p className="text-xs font-semibold">Photo confirmed</p>
              </div>
            )}
            
            {/* Pending confirmation */}
            {pendingPhotoPreview && (
              <div className="space-y-2.5 mt-3 pt-3 border-t border-neutral-700">
                <p className="text-xs text-neutral-400 text-center font-medium px-4">Review your photo</p>
                <button
                  type="button"
                  onClick={confirmPhoto}
                  disabled={uploadingImage}
                  className="w-full px-4 py-3 border border-transparent rounded-lg text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] active:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {uploadingImage ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Confirm Photo'
                  )}
                </button>
                <button
                  type="button"
                  onClick={cancelPhoto}
                  disabled={uploadingImage}
                  className="w-full px-4 py-3 border border-neutral-700 rounded-lg text-xs font-semibold text-neutral-300 bg-transparent hover:bg-neutral-800/50 active:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Nope
                </button>
              </div>
            )}
            
            {/* Initial upload prompt */}
            {!pendingPhotoPreview && !account?.image_url && (
              <div className="mt-3 px-4 py-2 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
                <p className="text-xs text-neutral-400 text-center font-medium px-2">
                  Hover and click to upload photo
                </p>
              </div>
            )}
            
            {/* Existing photo, no pending change */}
            {!pendingPhotoPreview && account?.image_url && !photoConfirmed && (
              <div className="mt-3 px-4 py-2 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
                <p className="text-xs text-neutral-400 text-center font-medium px-2">
                  Click photo to change
                </p>
              </div>
            )}
          </div>

          {/* Error Messages */}
          {error && (
            <div className="px-4 py-3 rounded-lg text-xs bg-red-900/20 backdrop-blur-sm border border-red-600/50 text-red-300 flex items-start gap-2.5 shadow-sm">
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </div>
      )}

      {currentStep === 'username' && (
        <div className="space-y-4">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-neutral-300 mb-1.5">
              Username <span className="text-red-400 font-bold">*</span>
            </label>
            
            {/* Confirmed state - disabled input with checkmark */}
            {usernameSaved && account?.username && !usernameEditing ? (
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 z-10 font-medium">@</div>
                <input
                  type="text"
                  value={account.username}
                  disabled
                  className="w-full pl-8 pr-20 py-3 border-2 border-green-500/60 rounded-lg text-sm text-white bg-neutral-800/50 cursor-not-allowed shadow-sm ring-1 ring-green-500/20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
                  <CheckCircleIcon className="w-5 h-5 text-green-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameEditing(true);
                      setUsernameSaved(false);
                    }}
                    className="text-[#007AFF] hover:text-[#0066D6] hover:underline text-xs font-semibold transition-colors px-2 py-1 rounded hover:bg-[#007AFF]/10"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 z-10 font-medium">@</div>
                  <input
                    id="username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => handleFormChange('username', e.target.value)}
                    className={`w-full pl-8 pr-12 py-3 border-2 rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${
                      usernameFormatValid === false
                        ? 'border-red-500/60 ring-1 ring-red-500/20 bg-neutral-800/50 hover:bg-neutral-800/70'
                        : usernameAvailable === true
                        ? 'border-[#007AFF]/60 ring-1 ring-[#007AFF]/20 bg-neutral-800/50 hover:bg-neutral-800/70'
                        : usernameSaved
                        ? 'border-green-500/60 ring-1 ring-green-500/20 bg-neutral-800/50'
                        : 'border-neutral-700 hover:border-neutral-600 bg-neutral-800/50 hover:bg-neutral-800/70 focus:ring-white/20'
                    }`}
                    placeholder="username"
                    disabled={saving || savingUsername}
                    pattern="[a-zA-Z0-9_-]+"
                    minLength={3}
                    maxLength={30}
                  />
                  {checkingUsername && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-neutral-400 border-t-white rounded-full animate-spin"></div>
                    </div>
                  )}
                  {!checkingUsername && usernameAvailable === true && !usernameSaved && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircleIcon className="w-5 h-5 text-[#007AFF]" />
                    </div>
                  )}
                  {usernameSaved && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircleIcon className="w-5 h-5 text-green-400" />
                    </div>
                  )}
                </div>
                
                {/* Status Messages */}
                <div className="space-y-1.5 pt-1">
                  {usernameFormatValid === false && formData.username.length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-red-400 bg-red-900/10 rounded-md px-2.5 py-2 border border-red-500/20">
                      <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        {formData.username.length < 3
                          ? 'Must be at least 3 characters'
                          : formData.username.length > 30
                          ? 'Must be 30 characters or less'
                          : 'Only letters, numbers, hyphens, and underscores'}
                      </span>
                    </div>
                  )}
                  
                  {usernameFormatValid !== false && formData.username.length > 0 && (
                    <div className={`flex items-center gap-2 text-xs rounded-md px-2.5 py-2 ${
                      usernameAvailable === true
                        ? 'text-[#007AFF] bg-[#007AFF]/10 border border-[#007AFF]/20'
                        : usernameAvailable === false
                        ? 'text-red-400 bg-red-900/10 border border-red-500/20'
                        : checkingUsername
                        ? 'text-neutral-300 bg-neutral-800/30 border border-neutral-700/50'
                        : 'text-neutral-400 bg-neutral-800/20 border border-neutral-700/30'
                    }`}>
                      {checkingUsername && (
                        <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {!checkingUsername && usernameAvailable === true && (
                        <CheckCircleIcon className="w-4 h-4" />
                      )}
                      {!checkingUsername && usernameAvailable === false && (
                        <ExclamationCircleIcon className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {checkingUsername
                          ? 'Checking availability...'
                          : usernameAvailable === true
                          ? 'Available'
                          : usernameAvailable === false
                          ? 'Try another username'
                          : '3-30 characters, letters, numbers, hyphens, and underscores'}
                      </span>
                    </div>
                  )}
                  
                  {formData.username && usernameFormatValid !== false && usernameAvailable !== false && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800/30 rounded-md border border-neutral-700/50">
                      <span className="text-xs text-neutral-400 font-medium">Preview:</span>
                      <span className="text-xs text-neutral-200 font-semibold">@{formData.username}</span>
                    </div>
                  )}
                </div>
                
                {/* Save Status */}
                {savingUsername && (
                  <div className="flex items-center gap-2.5 mt-3 text-neutral-300 justify-center py-2.5 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
                    <div className="w-4 h-4 border-2 border-neutral-400 border-t-white rounded-full animate-spin"></div>
                    <p className="text-xs font-medium">Saving username...</p>
                  </div>
                )}
                
                {usernameSaveError && (
                  <div className="mt-3 px-4 py-3 rounded-lg text-xs bg-red-900/20 backdrop-blur-sm border border-red-600/50 text-red-300 flex items-start gap-2.5 shadow-sm">
                    <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{usernameSaveError}</span>
                  </div>
                )}
                
                {usernameSaved && !savingUsername && !usernameSaveError && (
                  <div className="flex items-center gap-2 mt-3 text-green-400 justify-center py-2.5 bg-green-500/10 rounded-lg border border-green-500/20">
                    <CheckCircleIcon className="w-4 h-4" />
                    <p className="text-xs font-semibold">Username confirmed</p>
                  </div>
                )}
                
                {/* Confirm Username Button */}
                {usernameAvailable === true && !usernameSaved && !savingUsername && usernameFormatValid !== false && (
                  <div className="space-y-2.5 mt-3 pt-3 border-t border-neutral-700">
                    <p className="text-xs text-neutral-400 text-center font-medium">Review your username</p>
                    <button
                      type="button"
                      onClick={async () => {
                        const username = formData.username.trim();
                        if (validateUsernameFormat(username)) {
                          await saveUsername(username);
                        }
                      }}
                      disabled={!validateUsernameFormat(formData.username.trim()) || savingUsername}
                      className="w-full px-4 py-3 border border-transparent rounded-lg text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] active:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      Confirm Username
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Error Messages */}
          {error && (
            <div className="px-4 py-3 rounded-lg text-xs bg-red-900/20 backdrop-blur-sm border border-red-600/50 text-red-300 flex items-start gap-2.5 shadow-sm">
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </div>
      )}

      {currentStep === 'review' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white mb-3">Review Your Account</h2>
          
          <div className="bg-neutral-900 border border-neutral-700 rounded-md p-[10px] space-y-3">
            {/* Profile Image */}
            {account?.image_url && (
              <div className="flex items-center gap-2">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700">
                  <Image
                    src={account.image_url}
                    alt="Profile"
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized={account.image_url.includes('supabase.co')}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-white">Profile Photo</p>
                  <p className="text-xs text-neutral-500">Uploaded</p>
                </div>
              </div>
            )}

            {/* Username */}
            {account?.username && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Username</p>
                <p className="text-xs text-white">@{account.username}</p>
              </div>
            )}

            {/* Name */}
            {(account?.first_name || account?.last_name) && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Name</p>
                <p className="text-xs text-white">
                  {[account.first_name, account.last_name].filter(Boolean).join(' ') || 'Not set'}
                </p>
              </div>
            )}

            {/* Bio */}
            {account?.bio && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Bio</p>
                <p className="text-xs text-white">{account.bio}</p>
              </div>
            )}

            {/* Traits */}
            {account?.traits && account.traits.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Traits</p>
                <div className="flex flex-wrap gap-1">
                  {account.traits.map((trait) => {
                    const traitOption = TRAIT_OPTIONS.find((t) => t.id === trait);
                    return traitOption ? (
                      <span
                        key={trait}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[10px] text-neutral-200"
                      >
                        <span>{traitOption.label.split(' ')[0]}</span>
                        <span>{traitOption.label.split(' ').slice(1).join(' ')}</span>
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Business */}
            {account?.owns_business !== null && account?.owns_business !== undefined && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Business Owner</p>
                <p className="text-xs text-white">{account.owns_business ? 'Yes' : 'No'}</p>
                {account.owns_business && account.business_name && (
                  <p className="text-xs text-neutral-400 mt-0.5">{account.business_name}</p>
                )}
              </div>
            )}

            {/* Contact */}
            {(account?.email || account?.phone) && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Contact</p>
                {account.email && <p className="text-xs text-white">Email: {account.email}</p>}
                {account.phone && <p className="text-xs text-white">Phone: {account.phone}</p>}
              </div>
            )}

            {/* Location */}
            {account?.city_id && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Location</p>
                <p className="text-xs text-white">{selectedCityName || 'City selected'}</p>
              </div>
            )}

            {/* Plan */}
            {account?.plan && account.plan !== 'hobby' && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Plan</p>
                <p className="text-xs text-white capitalize">{account.plan}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="px-[10px] py-[10px] rounded-md text-xs bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
      </div>

      {/* OnboardingFooter — floating container at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 w-full flex justify-center">
        <div className="w-full max-w-[500px] bg-neutral-900 rounded-t-[10px] pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] px-4">
          <OnboardingFooter
              currentStep={currentStep}
              onNext={handleNext}
              onBack={handleBack}
              isStreamingComplete={true}
              showContinueButton={true}
              saving={saving}
              usernameAvailable={usernameAvailable}
              checkingUsername={checkingUsername}
              usernameSaved={usernameSaved}
              savingUsername={savingUsername}
              photoConfirmed={photoConfirmed}
              profileFormId="onboarding-profile-form"
              plansStepContinueDisabled={!isStepComplete('plans')}
              plansStepButtonLabel="Next"
              traitsStepContinueDisabled={formData.traits.length === 0}
              selectedPlanSlug={selectedPlanSlug}
              onCheckout={handleCheckout}
              isProcessingCheckout={isProcessingCheckout}
              account={account}
              formData={formData}
              onComplete={handleSubmit}
              isStepComplete={isStepComplete}
              planStepperComplete={planStepperComplete}
              // Individual save states
              nameSaved={nameSaved}
              savingName={savingName}
              nameEditing={nameEditing}
              bioSaved={bioSaved}
              savingBio={savingBio}
              bioEditing={bioEditing}
              traitsSaved={traitsSaved}
              savingTraits={savingTraits}
              traitsEditing={traitsEditing}
              ownsBusinessSaved={ownsBusinessSaved}
              savingOwnsBusiness={savingOwnsBusiness}
              ownsBusinessEditing={ownsBusinessEditing}
              contactSaved={contactSaved}
              savingContact={savingContact}
              contactEditing={contactEditing}
              locationSaved={locationSaved}
              savingLocation={savingLocation}
              locationEditing={locationEditing}
              // Save functions
              onSaveName={() => saveName(formData.first_name, formData.last_name)}
              onSaveBio={() => saveBio(formData.bio)}
              onSaveTraits={() => saveTraits(formData.traits)}
              onSaveOwnsBusiness={() => saveOwnsBusiness(formData.owns_business, formData.business_name)}
              onSaveContact={() => saveContact(formData.email, formData.phone)}
              onSaveLocation={() => saveLocation(formData.city_id)}
            />
        </div>
      </div>
    </div>
  );
}

function OnboardingFooter({
  currentStep,
  onNext,
  onBack,
  isStreamingComplete,
  showContinueButton,
  saving,
  usernameAvailable,
  checkingUsername,
  usernameSaved,
  savingUsername,
  photoConfirmed,
  profileFormId,
  plansStepContinueDisabled,
  plansStepButtonLabel,
  traitsStepContinueDisabled,
  selectedPlanSlug,
  onCheckout,
  isProcessingCheckout,
  account,
  formData,
  onComplete,
  // Individual save states
  nameSaved,
  savingName,
  nameEditing,
  bioSaved,
  savingBio,
  bioEditing,
  traitsSaved,
  savingTraits,
  traitsEditing,
  ownsBusinessSaved,
  savingOwnsBusiness,
  ownsBusinessEditing,
  contactSaved,
  savingContact,
  contactEditing,
  locationSaved,
  savingLocation,
  locationEditing,
  // Save functions
  onSaveName,
  onSaveBio,
  onSaveTraits,
  onSaveOwnsBusiness,
  onSaveContact,
  onSaveLocation,
  isStepComplete,
  planStepperComplete,
}: {
  currentStep: OnboardingStep;
  onNext: () => void;
  onBack: () => void;
  isStreamingComplete: boolean;
  showContinueButton: boolean;
  saving: boolean;
  usernameAvailable: boolean | null;
  checkingUsername: boolean;
  usernameSaved: boolean;
  savingUsername: boolean;
  photoConfirmed: boolean;
  profileFormId: string;
  plansStepContinueDisabled?: boolean;
  plansStepButtonLabel?: string;
  traitsStepContinueDisabled?: boolean;
  selectedPlanSlug?: string | null;
  onCheckout?: () => void;
  isProcessingCheckout?: boolean;
  account?: Account | null;
  formData?: {
    username: string;
    first_name: string;
    last_name: string;
    bio: string;
    city_id: string;
    traits: string[];
    owns_business: boolean | null;
    business_name: string;
    email: string;
    phone: string;
  };
  onComplete?: () => void;
  // Individual save states
  nameSaved?: boolean;
  savingName?: boolean;
  nameEditing?: boolean;
  bioSaved?: boolean;
  savingBio?: boolean;
  bioEditing?: boolean;
  traitsSaved?: boolean;
  savingTraits?: boolean;
  traitsEditing?: boolean;
  ownsBusinessSaved?: boolean;
  savingOwnsBusiness?: boolean;
  ownsBusinessEditing?: boolean;
  contactSaved?: boolean;
  savingContact?: boolean;
  contactEditing?: boolean;
  locationSaved?: boolean;
  savingLocation?: boolean;
  locationEditing?: boolean;
  // Save functions
  onSaveName?: () => void;
  onSaveBio?: () => void;
  onSaveTraits?: () => void;
  onSaveOwnsBusiness?: () => void;
  onSaveContact?: () => void;
  onSaveLocation?: () => void;
  isStepComplete?: (step: OnboardingStep) => boolean;
  planStepperComplete?: boolean;
}) {
  // Welcome step footer - show Next button
  if (currentStep === 'welcome') {
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onNext}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
          >
            Next
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <span className="min-w-[6px] flex-shrink-0" />
              <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
            </span>
          </button>
        </div>
      </footer>
    );
  }

  if (currentStep === 'plans') {
    // Enforce plan selection: must have a plan set in account (not null, not 'hobby' unless explicitly confirmed)
    // OR must have completed the plan stepper flow
    const hasPlan = account?.plan && account.plan !== 'hobby';
    const hasHobbyPlanConfirmed = account?.plan === 'hobby' && planStepperComplete;
    const hasActiveSubscription = 
      account?.subscription_status === 'active' || 
      account?.subscription_status === 'trialing';
    const canContinue = (hasPlan && (hasActiveSubscription || planStepperComplete)) || hasHobbyPlanConfirmed;
    
    const disabled = plansStepContinueDisabled ?? !canContinue;
    const label = plansStepButtonLabel ?? 'Next';
    const isContributorSelected = selectedPlanSlug === 'contributor';
    
    return (
      <footer className="pt-2 space-y-2">
        {isContributorSelected && onCheckout && (
          <button
            type="button"
            onClick={onCheckout}
            disabled={isProcessingCheckout || !account}
            className="w-full px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessingCheckout ? 'Processing...' : 'Start Free Trial'}
          </button>
        )}
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={disabled}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {label}
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <span className="min-w-[6px] flex-shrink-0" />
              <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
            </span>
          </button>
        </div>
        {isContributorSelected && canContinue && (
          <p className="text-xs text-neutral-500 text-center">
            7-day free trial • Cancel anytime
          </p>
        )}
      </footer>
    );
  }

  // Individual step handlers
  if (currentStep === 'name') {
    const isEditing = nameEditing || !nameSaved;
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={onSaveName}
              disabled={savingName}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingName ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Confirm Name'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
            >
              Next
              <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
                <span className="min-w-[6px] flex-shrink-0" />
                <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
              </span>
            </button>
          )}
        </div>
      </footer>
    );
  }

  if (currentStep === 'bio') {
    const isEditing = bioEditing || !bioSaved;
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={onSaveBio}
              disabled={savingBio}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingBio ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Confirm Bio'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
            >
              Next
              <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
                <span className="min-w-[6px] flex-shrink-0" />
                <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
              </span>
            </button>
          )}
        </div>
      </footer>
    );
  }

  if (currentStep === 'traits') {
    const isEditing = traitsEditing || !traitsSaved;
    const traitsCount = formData?.traits?.length || 0;
    const canConfirm = traitsCount >= 1 && traitsCount <= 5;
    
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={onSaveTraits}
              disabled={savingTraits || !canConfirm}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingTraits ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Confirm Traits'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
            >
              Next
              <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
                <span className="min-w-[6px] flex-shrink-0" />
                <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
              </span>
            </button>
          )}
        </div>
      </footer>
    );
  }

  if (currentStep === 'owns_business') {
    const isEditing = ownsBusinessEditing || !ownsBusinessSaved;
    const hasSelection = formData?.owns_business !== null;
    // Enforce business name when Yes is selected
    const canConfirm = hasSelection && (
      formData?.owns_business === false || 
      (formData?.owns_business === true && formData?.business_name?.trim().length > 0)
    );
    
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={onSaveOwnsBusiness}
              disabled={savingOwnsBusiness || !canConfirm}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingOwnsBusiness ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Confirm Business Status'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
            >
              Next
              <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
                <span className="min-w-[6px] flex-shrink-0" />
                <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
              </span>
            </button>
          )}
        </div>
      </footer>
    );
  }

  if (currentStep === 'contact') {
    const isEditing = contactEditing || !contactSaved;
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={onSaveContact}
              disabled={savingContact}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingContact ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Confirm Contact'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
            >
              Next
              <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
                <span className="min-w-[6px] flex-shrink-0" />
                <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
              </span>
            </button>
          )}
        </div>
      </footer>
    );
  }

  if (currentStep === 'location') {
    const isEditing = locationEditing || !locationSaved;
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          {isEditing && formData?.city_id ? (
            <button
              type="button"
              onClick={onSaveLocation}
              disabled={savingLocation}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingLocation ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Confirm Location'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
            >
              Next
              <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
                <span className="min-w-[6px] flex-shrink-0" />
                <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
              </span>
            </button>
          )}
        </div>
      </footer>
    );
  }

  if (currentStep === 'profile_photo') {
    // Disabled if no photo, not confirmed, or if they declined (need to upload again)
    const disabled = !account?.image_url || !photoConfirmed;
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={disabled}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <span className="min-w-[6px] flex-shrink-0" />
              <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
            </span>
          </button>
        </div>
      </footer>
    );
  }

  if (currentStep === 'username') {
    const username = formData?.username?.trim() || '';
    const isValidFormat = username.length >= 3 && username.length <= 30 && /^[a-zA-Z0-9_-]+$/.test(username);
    const isCurrentUsername = username === account?.username;
    
    // Disable if:
    // - No username entered
    // - Format is invalid
    // - Currently checking availability or saving
    // - Username is unavailable (and not current username)
    // - Username availability hasn't been checked yet (and not current username)
    // - Username hasn't been saved/confirmed yet
    const disabled = 
      !username || 
      !isValidFormat || 
      checkingUsername || 
      savingUsername ||
      (!isCurrentUsername && usernameAvailable === false) ||
      (!isCurrentUsername && usernameAvailable === null && username.length >= 3) ||
      (!usernameSaved && !isCurrentUsername);
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={disabled}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <span className="min-w-[6px] flex-shrink-0" />
              <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
            </span>
          </button>
        </div>
      </footer>
    );
  }

  if (currentStep === 'review') {
    // Require all steps to be complete - check via account state and props
    const stepOrder: OnboardingStep[] = ['profile_photo', 'username', 'location', 'name', 'bio', 'traits', 'owns_business', 'contact', 'plans'];
    // Check each step's completion state
    const allStepsComplete = 
      !!account?.image_url && photoConfirmed && // profile_photo
      !!account?.username && usernameSaved && // username
      locationSaved && !!account?.city_id && // location
      nameSaved && !!(account?.first_name || account?.last_name) && // name
      bioSaved && !!account?.bio && account.bio.trim().length > 0 && // bio
      !!traitsSaved && !!account?.traits && Array.isArray(account.traits) && account.traits.length >= 1 && account.traits.length <= 5 && // traits
      ownsBusinessSaved && account.owns_business !== null && account.owns_business !== undefined && 
        (account.owns_business === false || (account.owns_business === true && !!account.business_name)) && // owns_business
      contactSaved && !!(account?.email || account?.phone) && // contact
      (planStepperComplete ?? false); // plans
    const disabled = saving || !allStepsComplete;
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <ArrowLeftIcon className="w-3 h-3 flex-shrink-0" />
              <span className="min-w-[6px] flex-shrink-0" />
            </span>
            Back
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={disabled}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Completing...
              </>
            ) : (
              <>
                Complete
                <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
                  <span className="min-w-[6px] flex-shrink-0" />
                  <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
                </span>
              </>
            )}
          </button>
        </div>
      </footer>
    );
  }

  return null;
}

