'use client';

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import { AccountService, Account, useAuth, useAuthStateSafe } from '@/features/auth';
import { ArrowRightIcon, ArrowLeftIcon, CheckCircleIcon, UserIcon, PhotoIcon, MapIcon, UserPlusIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, ShareIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';
import type { OnboardingClientProps } from '../types';

type OnboardingStep = 'welcome' | 'name' | 'maps' | 'profile' | 'location';

export default function OnboardingClient({ initialAccount, redirectTo, onComplete, onWelcomeShown }: OnboardingClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshAccount } = useAuthStateSafe();
  const [account, setAccount] = useState<Account | null>(initialAccount);
  const [loading, setLoading] = useState(!initialAccount);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
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
  });
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySearchResults, setCitySearchResults] = useState<Array<{ id: string; name: string; ctu_class?: string }>>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showCityResults, setShowCityResults] = useState(false);
  const [selectedCityName, setSelectedCityName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [usernameEditing, setUsernameEditing] = useState(false);

  const totalSteps = 4;
  const stepIndexMap: Record<OnboardingStep, number> = {
    welcome: 0,
    name: 1,
    maps: 2,
    profile: 3,
    location: 4,
  };
  const stepIndex = stepIndexMap[currentStep];

  // Load account data if not provided
  // REMOVED: Client-side onboarding check - server component handles redirects
  // This prevents duplicate checks and potential loops
  useEffect(() => {
    if (initialAccount) {
      setAccount(initialAccount);
      setFormData({
        username: initialAccount.username || '',
        first_name: initialAccount.first_name || '',
        last_name: initialAccount.last_name || '',
        bio: initialAccount.bio || '',
        city_id: initialAccount.city_id || '',
      });
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
  }, [initialAccount]);

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

  // Typewriter effect for welcome step
  useEffect(() => {
    if (currentStep !== 'welcome') {
      setDisplayedText('');
      setIsStreamingComplete(false);
      setShowProfileCard(false);
      setShowContinueButton(false);
      return;
    }

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
  }, [currentStep, account?.username]);

  // Reset username read-only state when leaving profile step
  useEffect(() => {
    if (currentStep !== 'profile') setUsernameEditing(false);
  }, [currentStep]);

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

  // Check username availability
  const checkUsername = async (username: string) => {
    if (!username || username.length < 3) {
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
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Debounce username check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.username && formData.username !== account?.username) {
        checkUsername(formData.username);
      } else if (formData.username === account?.username) {
        setUsernameAvailable(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Validate required field
    if (!formData.username.trim()) {
      setError('Please enter a username');
      setSaving(false);
      return;
    }

    // Validate username
    if (formData.username.length < 3 || formData.username.length > 30) {
      setError('Username must be between 3 and 30 characters');
      setSaving(false);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      setError('Username can only contain letters, numbers, hyphens, and underscores');
      setSaving(false);
      return;
    }

    if (usernameAvailable === false) {
      setError('Username is not available. Please choose another.');
      setSaving(false);
      return;
    }

    try {
      // Update account using AccountService (handles auth, validation, error handling)
      // Ensure username is lowercase
      await AccountService.updateCurrentAccount({
        username: formData.username.trim().toLowerCase(),
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

      // Mark onboarding as complete and show welcome screen
      setOnboardingComplete(true);
      setShowWelcome(true);
      setSaving(false);
      
      // Notify parent that welcome screen is shown
      if (onWelcomeShown) {
        onWelcomeShown();
      }
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
    let normalizedValue = Array.isArray(value) ? value[0] || '' : value || '';
    
    // Convert username to lowercase
    if (field === 'username') {
      normalizedValue = normalizedValue.toLowerCase();
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: normalizedValue
    }));
    setError('');
    if (field === 'username') {
      setUsernameAvailable(null);
    }
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

      setAccount(updatedAccount);
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

  const handleNext = () => {
    const stepOrder: OnboardingStep[] = ['welcome', 'name', 'maps', 'profile'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepOrder: OnboardingStep[] = ['welcome', 'name', 'maps', 'profile'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="text-center">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-gray-600">Loading...</p>
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
              <CheckCircleIcon className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Onboarding Complete!</span>
            </div>
          )}
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Welcome to For the Love of Minnesota!</h2>
          <p className="text-xs text-gray-600">Get started by exploring these features</p>
        </div>

        {/* Info Cards */}
        <div className="space-y-2">
          {/* Card 1: Create Maps */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <MapIcon className="w-4 h-4 text-gray-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-gray-900 mb-0.5">Create Maps</h3>
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  Build your own custom maps and organize locations that matter to you.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Join Maps */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <UserPlusIcon className="w-4 h-4 text-gray-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-gray-900 mb-0.5">Join Maps</h3>
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  Discover and join maps created by others. Collaborate and explore together.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Share Profile */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <ArrowUpTrayIcon className="w-4 h-4 text-gray-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-gray-900 mb-0.5">Share Profile</h3>
                <p className="text-[10px] text-gray-600 leading-relaxed">
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
            className="w-full flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
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
              className="w-full flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
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
    <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="space-y-3">
        {/* Minnesota Time Display */}
        {currentTime && (
          <div className="text-center">
            <p className="text-[10px] text-gray-500">Minnesota Time</p>
            <p className="text-xs text-gray-700 font-medium">{currentTime}</p>
          </div>
        )}

        {/* Stepper Progress Indicator */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-all ${
                  i <= stepIndex ? 'bg-gray-900' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
      {currentStep === 'welcome' && (
        <div className="space-y-3">
          <div className="space-y-2">
            {account?.username && account?.image_url && (
              <div className="pb-2">
                <div className={`relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 ${getPaidPlanBorderClasses(account?.plan)}`}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-white">
                    <Image
                      src={account.image_url}
                      alt={account.username}
                      fill
                      className="object-cover rounded-full"
                      sizes="80px"
                      unoptimized={account.image_url.includes('supabase.co')}
                    />
                  </div>
                </div>
              </div>
            )}
            
            <h2 className="text-sm font-semibold text-gray-900">
              {account?.username 
                ? `Welcome Back @${account.username}`
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
                    {coleAccount.image_url ? (
                      <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-2 border-yellow-500">
                        <Image
                          src={coleAccount.image_url}
                          alt={coleAccount.username}
                          fill
                          className="object-cover"
                          sizes="32px"
                          unoptimized={coleAccount.image_url.includes('supabase.co')}
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border-2 border-yellow-500">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {coleAccount.first_name && coleAccount.last_name
                          ? `${coleAccount.first_name} ${coleAccount.last_name}`
                          : coleAccount.first_name || coleAccount.username}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-gray-500 truncate">
                          @{coleAccount.username}
                        </p>
                        {coleAccount.created_at && (
                          <>
                            <span className="text-[10px] text-gray-400">•</span>
                            <p className="text-[10px] text-gray-500">
                              Joined {new Date(coleAccount.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {coleAccount.bio && (
                    <p className="text-xs text-gray-600 text-left w-full mt-2 leading-relaxed">
                      {coleAccount.bio}
                    </p>
                  )}
                </div>
              </div>
            ) : null)}
          </div>

        </div>
      )}

      {currentStep === 'name' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Your name</h2>
          <p className="text-xs text-gray-600">First and last name help others recognize you.</p>
          <div className="space-y-2">
            <div>
              <label htmlFor="onboarding-first-name" className="block text-xs font-medium text-gray-500 mb-0.5">
                First name
              </label>
              <input
                id="onboarding-first-name"
                type="text"
                value={formData.first_name}
                onChange={(e) => handleFormChange('first_name', e.target.value)}
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-transparent"
                placeholder="First name"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label htmlFor="onboarding-last-name" className="block text-xs font-medium text-gray-500 mb-0.5">
                Last name
              </label>
              <input
                id="onboarding-last-name"
                type="text"
                value={formData.last_name}
                onChange={(e) => handleFormChange('last_name', e.target.value)}
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-transparent"
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>
          </div>
        </div>
      )}

      {currentStep === 'maps' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Live Map vs. Custom Maps</h2>

          <div className="space-y-4">
            {/* Live Map — main map for the site */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-gray-700" />
                <h3 className="text-xs font-semibold text-gray-900">Live Map</h3>
              </div>
              <div className="pl-6 space-y-2">
                <p className="text-xs text-gray-600 leading-relaxed">
                  The main map for loveofminnesota.com. Everyone uses the same shared map at <code className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">/live</code> — one place to explore and contribute to Minnesota together.
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded border border-gray-200">
                    One shared map
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded border border-gray-200">
                    /live
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Maps — private or published */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <GlobeAltIcon className="w-4 h-4 text-gray-700" />
                <h3 className="text-xs font-semibold text-gray-900">Custom Maps</h3>
              </div>
              <div className="pl-6 space-y-2">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Maps you create with your own settings. Keep them private, invite specific people, or publish to the community so others can discover and join. You control visibility and who can contribute.
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded border border-gray-200">
                    Private or published
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded border border-gray-200">
                    Custom settings
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded border border-gray-200">
                    Your collections
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'profile' && (
        <div>
          <form id="onboarding-profile-form" onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="px-[10px] py-[10px] rounded-md text-xs bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Profile Image */}
          <div className="flex flex-col items-center">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Profile Photo
            </label>
            <div className="relative group">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                {account?.image_url ? (
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
                  <UserIcon className="w-10 h-10 text-gray-400" />
                )}
              </div>
              
              {/* Hover Overlay */}
              <div
                onClick={() => !uploadingImage && fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100"
              >
                {uploadingImage ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PhotoIcon className="w-5 h-5 text-white" />
                )}
              </div>

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
              <p className="mt-1 text-xs text-red-600">{imageError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 text-center">
              Hover and click to upload or change photo
            </p>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-xs font-medium text-gray-500 mb-0.5">
              Username <span className="text-red-500">*</span>
            </label>
            {account?.username && account?.image_url && !usernameEditing ? (
              <div className="relative flex items-center w-full pl-7 pr-14 py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 bg-gray-50">
                <span className="absolute left-[10px] text-gray-400">@</span>
                <span>{account.username}</span>
                <button
                  type="button"
                  onClick={() => setUsernameEditing(true)}
                  className="absolute right-[10px] text-blue-600 hover:text-blue-700 hover:underline text-xs font-medium"
                >
                  Edit
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute left-[10px] top-1/2 -translate-y-1/2 text-xs text-gray-400">@</div>
                  <input
                    id="username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => handleFormChange('username', e.target.value)}
                    className={`w-full pl-7 pr-8 py-[10px] border rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 transition-colors bg-transparent ${
                      usernameAvailable === true
                        ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                        : usernameAvailable === false
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900'
                    }`}
                    placeholder="username"
                    disabled={saving}
                    pattern="[a-zA-Z0-9_-]+"
                    minLength={3}
                    maxLength={30}
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
                <p className="mt-1 text-xs text-gray-500">
                  {usernameAvailable === true
                    ? '✓ Username available'
                    : usernameAvailable === false
                    ? '✗ Username taken'
                    : '3-30 characters, letters, numbers, hyphens, and underscores'}
                </p>
                {formData.username && (
                  <p className="mt-0.5 text-xs text-gray-400">@{formData.username}</p>
                )}
              </>
            )}
          </div>
        </form>
        </div>
      )}
      </div>

      {/* OnboardingFooter — fixed to bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 z-40 w-full pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-gray-200 px-4">
        <OnboardingFooter
        currentStep={currentStep}
        onNext={handleNext}
        onBack={handleBack}
        isStreamingComplete={isStreamingComplete}
        showContinueButton={showContinueButton}
        saving={saving}
        usernameAvailable={usernameAvailable}
        checkingUsername={checkingUsername}
        profileFormId="onboarding-profile-form"
      />
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
  profileFormId,
}: {
  currentStep: OnboardingStep;
  onNext: () => void;
  onBack: () => void;
  isStreamingComplete: boolean;
  showContinueButton: boolean;
  saving: boolean;
  usernameAvailable: boolean | null;
  checkingUsername: boolean;
  profileFormId: string;
}) {
  if (currentStep === 'welcome') {
    if (!isStreamingComplete) return null;
    return (
      <footer className="pt-2">
        <div className={`flex justify-end transition-opacity duration-500 ${showContinueButton ? 'opacity-100' : 'opacity-0'}`}>
          <button
            type="button"
            onClick={onNext}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
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

  if (currentStep === 'name' || currentStep === 'maps') {
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 transition-colors"
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

  if (currentStep === 'profile') {
    return (
      <footer className="pt-2">
        <div className="flex items-center gap-2 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Back
          </button>
          <button
            type="submit"
            form={profileFormId}
            disabled={saving || usernameAvailable === false || checkingUsername}
            className="group inline-flex justify-center items-center px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save & Continue
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

