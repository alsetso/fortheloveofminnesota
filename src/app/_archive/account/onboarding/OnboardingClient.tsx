'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AccountService, Account } from '@/features/auth';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import { ArrowRightIcon, CheckCircleIcon, CameraIcon } from '@heroicons/react/24/outline';

interface OnboardingClientProps {
  initialAccount: Account | null;
  redirectTo?: string;
  onComplete?: () => void | Promise<void>;
}

export default function OnboardingClient({ initialAccount, redirectTo, onComplete }: OnboardingClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState<Account | null>(initialAccount);
  const [loading, setLoading] = useState(!initialAccount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    image_url: null as string | null,
  });

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
        image_url: initialAccount.image_url,
      });
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
            image_url: accountData.image_url,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Validate required fields
    if (!formData.username.trim() || !formData.first_name.trim() || !formData.last_name.trim() || !formData.image_url) {
      setError('Please fill in all required fields');
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
      await AccountService.updateCurrentAccount({
        username: formData.username.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        image_url: formData.image_url,
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

      // Call onComplete callback if provided (for modal context)
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
    // For image_url, ensure we only use string | null (not string[])
    const normalizedValue = field === 'image_url' 
      ? (Array.isArray(value) ? value[0] || null : value)
      : (Array.isArray(value) ? value[0] || '' : value);
    
    setFormData(prev => ({
      ...prev,
      [field]: normalizedValue
    }));
    setError('');
    if (field === 'username') {
      setUsernameAvailable(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setIsUploadingImage(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileName = `${user.id}/accounts/profile/${timestamp}-${random}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL');
      }

      handleFormChange('image_url', urlData.publicUrl);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const displayName = formData.first_name && formData.last_name 
    ? `${formData.first_name} ${formData.last_name}`.trim()
    : formData.first_name || formData.last_name || 'Your Name';

  return (
    <div className="space-y-3">
      {/* Profile Card Style Form */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden relative">
        {/* Cover/Banner Area */}
        <div className="h-24 bg-gradient-to-r from-gray-50 to-gray-100 relative">
        </div>

        {/* Profile Content */}
        <div className="px-[10px] pb-[10px] pt-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="px-[10px] py-[10px] rounded-md text-xs bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 mb-3">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Profile Photo Upload - Circular Button */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Profile Photo <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploadingImage || saving}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage || saving}
                  className="relative w-20 h-20 rounded-full bg-gray-100 border-2 border-white overflow-hidden shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                >
                  {formData.image_url ? (
                    <>
                      <img
                        src={formData.image_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <CameraIcon className="w-5 h-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      {isUploadingImage ? (
                        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CameraIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </>
                  )}
                </button>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">
                    {formData.image_url ? 'Click to replace photo' : 'Click to upload photo'}
                  </p>
                  {isUploadingImage && (
                    <p className="text-xs text-gray-500 mt-0.5">Uploading...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Name Display - Profile Style */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">Name</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="first_name"
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => handleFormChange('first_name', e.target.value)}
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:border-gray-900 focus:ring-gray-900 transition-colors bg-transparent"
                    placeholder="First name"
                    disabled={saving}
                  />
                  <input
                    id="last_name"
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => handleFormChange('last_name', e.target.value)}
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:border-gray-900 focus:ring-gray-900 transition-colors bg-transparent"
                    placeholder="Last name"
                    disabled={saving}
                  />
                </div>
                {formData.first_name && formData.last_name && (
                  <p className="mt-1.5 text-sm font-semibold text-gray-900">{displayName}</p>
                )}
              </div>

              {/* Username - Profile Style */}
              <div>
                <label htmlFor="username" className="block text-xs font-medium text-gray-500 mb-0.5">
                  Username <span className="text-red-500">*</span>
                </label>
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
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 my-3"></div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={saving || usernameAvailable === false || checkingUsername}
                className="w-full flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    Save Profile
                    <ArrowRightIcon className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
