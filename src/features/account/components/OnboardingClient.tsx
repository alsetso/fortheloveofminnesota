'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import { AccountService, Account, useAuth, useAuthStateSafe, type AccountTrait } from '@/features/auth';
import { ArrowRightIcon, ArrowLeftIcon, CheckCircleIcon, UserIcon, PhotoIcon, MapIcon, UserPlusIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, ShareIcon, GlobeAltIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';
import type { OnboardingClientProps } from '../types';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';
import { TRAIT_OPTIONS, type TraitId } from '@/types/profile';
import PlanSelectorStepper from '@/components/onboarding/PlanSelectorStepper';
import { type OnboardingStep, determineOnboardingStep, hasCompletedMandatorySteps } from '@/lib/onboardingService';

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
  
  // Use service to determine initial step based on account state
  const getInitialStep = (): OnboardingStep => {
    // URL params take precedence
    if (urlStep === 'plans') return 'plans';
    
    // Otherwise use service to determine from account state
    if (initialAccount) {
      const onboardingState = determineOnboardingStep(initialAccount);
      return onboardingState.currentStep;
    }
    
    return 'profile_photo';
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
  const [coleAccount, setColeAccount] = useState<{
    username: string;
    image_url: string | null;
    first_name: string | null;
    last_name: string | null;
    bio: string | null;
    created_at: string | null;
  } | null>(null);
  const [loadingCole, setLoadingCole] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isStreamingComplete, setIsStreamingComplete] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showContinueButton, setShowContinueButton] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    bio: '',
    city_id: '',
    traits: [] as string[],
    owns_business: null as boolean | null,
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
  const [ensureCustomerLoading, setEnsureCustomerLoading] = useState(false);
  const [ensureCustomerError, setEnsureCustomerError] = useState<string | null>(null);
  const [onboardingPlans, setOnboardingPlans] = useState<PlanWithFeatures[]>([]);
  const [onboardingPlansLoading, setOnboardingPlansLoading] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);
  const [planStepperComplete, setPlanStepperComplete] = useState(false);

  const totalSteps = 11;
  const stepIndexMap: Record<OnboardingStep, number> = {
    profile_photo: 0,
    username: 1,
    plans: 2,
    name: 3,
    bio: 4,
    traits: 5,
    owns_business: 6,
    contact: 7,
    maps: 8,
    location: 9,
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

  // Fetch Cole's account for welcome step
  useEffect(() => {
    const fetchColeAccount = async () => {
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('username, image_url, first_name, last_name, bio, created_at')
          .eq('username', 'cole')
          .single();

        if (!error && data) {
          setColeAccount({
            username: data.username || 'cole',
            image_url: data.image_url,
            first_name: data.first_name,
            last_name: data.last_name,
            bio: data.bio ?? null,
            created_at: data.created_at,
          });
        }
      } catch (error) {
        console.error('Error fetching Cole account:', error);
      } finally {
        setLoadingCole(false);
      }
    };

    fetchColeAccount();
  }, []);

  // Removed welcome step logic
  useEffect(() => {
    if (false) {
      // Check if account already exists (has username)
      const accountExists = !!account?.username;

      const fullText = accountExists
        ? `If you are reading this message, we have made important updates to our platform.

Hopefully making it easier and more powerful to interact and engage with Minnesotans.

As we finalize our iOS application, you can still continue to enjoy For the Love of Minnesota on mobile or web.

And to continue, to checkout what we've been up to.`
        : `For the Love of Minnesota isn't about perfection, performance, or posting for attention.

It's about noticing what matters — places, people, moments — and choosing to care enough to mark them.

This is a living map of appreciation.

A shared record of what Minnesotans love, protect, build, and believe in — across towns, neighborhoods, and generations.

You don't need to post often.

You don't need the right words.

You just need to be honest.

What you add here becomes part of Minnesota's story — visible, grounded, and real.

Take a moment. Set up your account.

And when you're ready, place your first pin — for the love of Minnesota.`;

      let currentIndex = 0;
      setDisplayedText('');
      setIsStreamingComplete(false);

      const streamInterval = setInterval(() => {
        if (currentIndex < fullText.length) {
          setDisplayedText(fullText.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsStreamingComplete(true);
          clearInterval(streamInterval);
          // Fade in profile card after text completes
          setTimeout(() => {
            setShowProfileCard(true);
            // Fade in continue button after profile card
            setTimeout(() => {
              setShowContinueButton(true);
            }, 300);
          }, 200);
        }
      }, 20); // Adjust speed here (lower = faster)

      return () => {
        clearInterval(streamInterval);
        setShowProfileCard(false);
        setShowContinueButton(false);
      };
    } else {
      setDisplayedText('');
      setIsStreamingComplete(true);
      setShowProfileCard(false);
      setShowContinueButton(false);
    }
  }, [currentStep, account?.username]);

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
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: 'contributor',
          period: 'monthly',
          returnUrl: '/onboarding',
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
        // Fetch all CTU boundaries (no filter) and do client-side fuzzy search
        const response = await fetch('/api/civic/ctu-boundaries?limit=1000');
        
        if (response.ok) {
          const data = await response.json();
          const allCTUs = Array.isArray(data) ? data : [];
          
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
        }
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
  
  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (pendingPhotoPreview) {
        URL.revokeObjectURL(pendingPhotoPreview);
      }
    };
  }, [pendingPhotoPreview]);

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

    // Validate required field
    if (!formData.username.trim()) {
      setError('Please enter a username');
      setSaving(false);
      return;
    }

    // Validate username format
    const trimmedUsername = formData.username.trim();
    if (!trimmedUsername) {
      setError('Please enter a username');
      setSaving(false);
      return;
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      setError('Username must be between 3 and 30 characters');
      setSaving(false);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, hyphens, and underscores');
      setSaving(false);
      return;
    }

    // Validate availability (must be checked and available)
    if (usernameAvailable === false) {
      setError('Username is not available. Please choose another.');
      setSaving(false);
      return;
    }

    if (usernameAvailable === null && trimmedUsername !== account?.username) {
      setError('Please wait for username availability check to complete');
      setSaving(false);
      return;
    }

    try {
      // Update account with profile card details (username, name, bio, traits, contact)
      await AccountService.updateCurrentAccount({
        username: formData.username.trim().toLowerCase(),
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        bio: formData.bio || null,
        traits: formData.traits.length > 0 ? (formData.traits as AccountTrait[]) : null,
        owns_business: formData.owns_business,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
      });

      // Set onboarded flag (use existing account.id if available, otherwise fetch)
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

      // Refresh account data to get updated username
      const updatedAccount = await AccountService.getCurrentAccount();
      if (updatedAccount) {
        setAccount(updatedAccount);
      }

      setSaving(false);

      // Go right to the homepage (skip welcome screen)
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
      console.error('Error saving account:', error);
      
      // Handle specific error cases
      let errorMessage = 'Failed to save account';
      if (error instanceof Error) {
        if (error.message.includes('username') || error.message.includes('unique')) {
          errorMessage = 'Username is already taken. Please choose another.';
        } else if (error.message.includes('constraint')) {
          errorMessage = 'Invalid data provided. Please check your inputs.';
        } else {
          errorMessage = error.message;
        }
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
    setFormData(prev => ({
      ...prev,
      traits: prev.traits.includes(traitId)
        ? prev.traits.filter(t => t !== traitId)
        : [...prev.traits, traitId],
    }));
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

  // Helper to update URL when step changes
  const updateStepUrl = (step: OnboardingStep) => {
    if (step === 'plans') {
      // Keep existing substep param if present, otherwise don't add step param
      // (substep changes are handled by PlanSelectorStepper)
      const currentSubstep = searchParams.get('substep');
      if (currentSubstep) {
        router.replace(`/onboarding?step=plans&substep=${currentSubstep}`, { scroll: false });
      } else {
        router.replace('/onboarding?step=plans&substep=1', { scroll: false });
      }
    } else {
      // For non-plans steps, just set step param
      router.replace(`/onboarding?step=${step}`, { scroll: false });
    }
  };

  const handleNext = () => {
    const stepOrder: OnboardingStep[] = ['profile_photo', 'username', 'plans', 'name', 'bio', 'traits', 'owns_business', 'contact', 'maps', 'location', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    // Prevent skipping to step 4+ if mandatory steps (1-3) are incomplete
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      const nextIndex = stepOrder.indexOf(nextStep);
      
      // If trying to go to step 4+ (index 3+), check if mandatory steps are complete
      if (nextIndex >= 3 && !hasCompletedMandatorySteps(account)) {
        // Block navigation - user must complete steps 1-3 first
        return;
      }
      
      setCurrentStep(nextStep);
      updateStepUrl(nextStep);
    }
  };

  const handleBack = () => {
    const stepOrder: OnboardingStep[] = ['profile_photo', 'username', 'plans', 'name', 'bio', 'traits', 'owns_business', 'contact', 'maps', 'location', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
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
      {false && (currentStep as string) === 'welcome' && (
        <div className="space-y-3">
          <div className="space-y-2">
            {account?.username && account?.image_url && (
              <div className="pb-2">
                <div className={`relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 ${getPaidPlanBorderClasses(account?.plan)}`}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-white">
                    <Image
                      src={account?.image_url || ''}
                      alt={account?.username || ''}
                      fill
                      className="object-cover rounded-full"
                      sizes="80px"
                      unoptimized={(account?.image_url || '').includes('supabase.co')}
                    />
                  </div>
                </div>
              </div>
            )}
            
            <h2 className="text-sm font-semibold text-gray-900">
              {account?.username 
                ? `Welcome Back @${account?.username || ''}`
                : "Welcome. I'm glad you're here."}
            </h2>
            
            <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line min-h-[200px]">
              {displayedText}
              {!isStreamingComplete && <span className="animate-pulse">|</span>}
            </div>

            {/* Sincerely and Cole's Profile Card - Fade in after streaming complete */}
            {isStreamingComplete && (loadingCole ? (
              <div className={`pt-0 transition-opacity duration-500 ${showProfileCard ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-xs text-gray-600 mb-2">Sincerely,</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                    <div className="h-2 w-12 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ) : coleAccount ? (
              <div className={`pt-0 transition-opacity duration-500 ${showProfileCard ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-xs text-gray-600 mb-2">Sincerely,</p>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                  <div className="flex items-start gap-2">
                    {coleAccount?.image_url ? (
                      <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-2 border-yellow-500">
                        <Image
                          src={coleAccount?.image_url || ''}
                          alt={coleAccount?.username || ''}
                          fill
                          className="object-cover"
                          sizes="32px"
                          unoptimized={(coleAccount?.image_url || '').includes('supabase.co')}
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border-2 border-yellow-500">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {coleAccount?.first_name && coleAccount?.last_name
                          ? `${coleAccount?.first_name || ''} ${coleAccount?.last_name || ''}`
                          : coleAccount?.first_name || coleAccount?.username || ''}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-gray-500 truncate">
                          @{coleAccount?.username || ''}
                        </p>
                        {coleAccount?.created_at && (
                          <>
                            <span className="text-[10px] text-gray-400">•</span>
                            <p className="text-[10px] text-gray-500">
                              Joined {new Date(coleAccount?.created_at || '').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {coleAccount?.bio && (
                    <p className="text-xs text-gray-600 text-left w-full mt-2 leading-relaxed">
                      {coleAccount?.bio || ''}
                    </p>
                  )}
                </div>
              </div>
            ) : null)}
          </div>

        </div>
      )}

      {currentStep === 'plans' && (
        <PlanSelectorStepper
          account={account}
          plans={onboardingPlans}
          plansLoading={onboardingPlansLoading}
          onBillingSetup={ensureBilling}
          ensureCustomerLoading={ensureCustomerLoading}
          ensureCustomerError={ensureCustomerError}
          onComplete={() => setPlanStepperComplete(true)}
          refreshAccount={refreshAccount}
          onSubStepChange={handlePlanSubStepChange}
        />
      )}

      {currentStep === 'name' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Your name</h2>
          <p className="text-xs text-neutral-400">First and last name help others recognize you.</p>
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
          </div>
        </div>
      )}

      {currentStep === 'bio' && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white">Bio</h2>
          <p className="text-xs text-neutral-400">A short bio helps others get to know you. Optional.</p>
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
          </div>
        </div>
      )}

      {currentStep === 'traits' && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white">Traits</h2>
          <p className="text-xs text-neutral-400">Pick traits that describe you. Optional.</p>
          <div className="flex flex-wrap gap-1 max-h-[280px] overflow-y-auto">
            {TRAIT_OPTIONS.map((trait) => {
              const isSelected = formData.traits.includes(trait.id);
              return (
                <button
                  key={trait.id}
                  type="button"
                  onClick={() => toggleTrait(trait.id as TraitId)}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                    isSelected
                      ? 'bg-white text-black border-white/20'
                      : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  {trait.label}
                </button>
              );
            })}
          </div>
          {formData.traits.length > 0 && (
            <p className="text-[10px] text-neutral-500">{formData.traits.length} selected</p>
          )}
        </div>
      )}

      {currentStep === 'owns_business' && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white">Do you own a business?</h2>
          <p className="text-xs text-neutral-400">Optional.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, owns_business: true }))}
              className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium transition-colors ${
                formData.owns_business === true
                  ? 'bg-white text-black border-white/20'
                  : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-600'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, owns_business: false }))}
              className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium transition-colors ${
                formData.owns_business === false
                  ? 'bg-white text-black border-white/20'
                  : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-600'
              }`}
            >
              No
            </button>
          </div>
        </div>
      )}

      {currentStep === 'contact' && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white">Contact information</h2>
          <p className="text-xs text-neutral-400">Phone and email from your account. Optional.</p>
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
          </div>
        </div>
      )}

      {currentStep === 'maps' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Live Map vs. Custom Maps</h2>

          <div className="space-y-4">
            {/* Live Map — main map for the site */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-neutral-200" />
                <h3 className="text-xs font-semibold text-white">Live Map</h3>
              </div>
              <div className="pl-6 space-y-2">
                <p className="text-xs text-neutral-200 leading-relaxed">
                  The main map for loveofminnesota.com. Everyone uses the same shared map at <code className="px-1 py-0.5 bg-neutral-800 rounded text-[10px]">/live</code> — one place to explore and contribute to Minnesota together.
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-neutral-800 text-neutral-200 text-[10px] rounded border border-neutral-700">
                    One shared map
                  </span>
                  <span className="px-2 py-0.5 bg-neutral-800 text-neutral-200 text-[10px] rounded border border-neutral-700">
                    /live
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Maps — private or published */}
            <div className="space-y-2 pt-2 border-t border-neutral-700">
              <div className="flex items-center gap-2">
                <GlobeAltIcon className="w-4 h-4 text-neutral-200" />
                <h3 className="text-xs font-semibold text-white">Custom Maps</h3>
              </div>
              <div className="pl-6 space-y-2">
                <p className="text-xs text-neutral-200 leading-relaxed">
                  Maps you create with your own settings. Keep them private, invite specific people, or publish to the community so others can discover and join. You control visibility and who can contribute.
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-neutral-800 text-neutral-200 text-[10px] rounded border border-neutral-700">
                    Private or published
                  </span>
                  <span className="px-2 py-0.5 bg-neutral-800 text-neutral-200 text-[10px] rounded border border-neutral-700">
                    Custom settings
                  </span>
                  <span className="px-2 py-0.5 bg-neutral-800 text-neutral-200 text-[10px] rounded border border-neutral-700">
                    Your collections
                  </span>
                </div>
              </div>
            </div>
          </div>
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
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-0.5">Username</p>
              <p className="text-xs text-white">@{formData.username || account?.username || 'Not set'}</p>
            </div>

            {/* Name */}
            {(formData.first_name || formData.last_name) && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Name</p>
                <p className="text-xs text-white">
                  {[formData.first_name, formData.last_name].filter(Boolean).join(' ') || 'Not set'}
                </p>
              </div>
            )}

            {/* Bio */}
            {formData.bio && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Bio</p>
                <p className="text-xs text-white">{formData.bio}</p>
              </div>
            )}

            {/* Traits */}
            {formData.traits.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Traits</p>
                <div className="flex flex-wrap gap-1">
                  {formData.traits.map((trait) => {
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
            {formData.owns_business !== null && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Business Owner</p>
                <p className="text-xs text-white">{formData.owns_business ? 'Yes' : 'No'}</p>
              </div>
            )}

            {/* Contact */}
            {(formData.email || formData.phone) && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Contact</p>
                {formData.email && <p className="text-xs text-white">Email: {formData.email}</p>}
                {formData.phone && <p className="text-xs text-white">Phone: {formData.phone}</p>}
              </div>
            )}

            {/* Location */}
            {selectedCityName && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Location</p>
                <p className="text-xs text-white">{selectedCityName}</p>
              </div>
            )}

            {/* Plan */}
            {selectedPlanSlug && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Plan</p>
                <p className="text-xs text-white capitalize">{selectedPlanSlug}</p>
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
      {/* Hide footer when account is set up (stripe_customer_id exists) - PlanSelectorStepper handles its own navigation */}
      {!(currentStep === 'plans' && account?.stripe_customer_id) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 w-full flex justify-center">
          <div className="w-full max-w-[500px] bg-neutral-900 rounded-t-[10px] pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] px-4">
            <OnboardingFooter
              currentStep={currentStep}
              onNext={handleNext}
              onBack={handleBack}
              isStreamingComplete={isStreamingComplete}
              showContinueButton={showContinueButton}
              saving={saving}
              usernameAvailable={usernameAvailable}
              checkingUsername={checkingUsername}
              usernameSaved={usernameSaved}
              savingUsername={savingUsername}
              photoConfirmed={photoConfirmed}
              profileFormId="onboarding-profile-form"
              plansStepContinueDisabled={!planStepperComplete}
              plansStepButtonLabel="Continue"
              traitsStepContinueDisabled={formData.traits.length === 0}
              selectedPlanSlug={selectedPlanSlug}
              onCheckout={handleCheckout}
              isProcessingCheckout={isProcessingCheckout}
              account={account}
              formData={formData}
              onComplete={handleSubmit}
            />
          </div>
        </div>
      )}
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
    email: string;
    phone: string;
  };
  onComplete?: () => void;
}) {
  if (currentStep === 'plans') {
    const disabled = plansStepContinueDisabled ?? false;
    const label = plansStepButtonLabel ?? 'Continue';
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
            className="inline-flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
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
        {isContributorSelected && (
          <p className="text-xs text-neutral-500 text-center">
            7-day free trial • Cancel anytime
          </p>
        )}
      </footer>
    );
  }

  if (currentStep === 'name' || currentStep === 'bio' || currentStep === 'traits' || currentStep === 'owns_business' || currentStep === 'contact' || currentStep === 'maps') {
    const traitsBlocked = currentStep === 'traits' && (traitsStepContinueDisabled ?? false);
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={traitsBlocked}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue
            <span className="inline-flex items-center overflow-hidden max-w-0 group-hover:max-w-[1.125rem] group-focus-visible:max-w-[1.125rem] transition-[max-width] duration-200">
              <span className="min-w-[6px] flex-shrink-0" />
              <ArrowRightIcon className="w-3 h-3 flex-shrink-0" />
            </span>
          </button>
        </div>
      </footer>
    );
  }

  if (currentStep === 'profile_photo') {
    // Disabled if no photo, not confirmed, or if they declined (need to upload again)
    const disabled = !account?.image_url || !photoConfirmed;
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onNext}
            disabled={disabled}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue
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
            className="inline-flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={disabled}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue
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
    const disabled = saving || !formData?.username?.trim();
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-neutral-200 bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
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
                Saving...
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

