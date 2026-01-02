'use client';

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import { AccountService, Account, useAuth, useAuthStateSafe } from '@/features/auth';
import { ArrowRightIcon, CheckCircleIcon, UserIcon, PhotoIcon, MapIcon, UserPlusIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';

interface CreateAccountClientProps {
  onComplete?: () => void | Promise<void>;
  onWelcomeShown?: () => void;
}

export default function CreateAccountClient({ onComplete, onWelcomeShown }: CreateAccountClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshAccount, setActiveAccountId } = useAuthStateSafe();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    username: '',
  });

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
      // Create new account
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username.trim().toLowerCase(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create account');
      }

      const newAccount = await response.json();
      let finalAccount = newAccount as Account;

      // Upload pending image if one was selected
      if (pendingImageFile) {
        try {
          finalAccount = await uploadImageToAccount(newAccount.id, pendingImageFile);
          setPendingImageFile(null);
          setPreviewImageUrl(null);
        } catch (err) {
          console.error('Error uploading image after account creation:', err);
          // Continue even if image upload fails
        }
      }

      setAccount(finalAccount);

      // Set as active account
      if (setActiveAccountId) {
        await setActiveAccountId(finalAccount.id);
      }

      // Refresh auth state to ensure account is loaded
      if (refreshAccount) {
        await refreshAccount();
      }

      // Mark account as created and show welcome screen
      setAccountCreated(true);
      setShowWelcome(true);
      setSaving(false);
      
      // Notify parent that welcome screen is shown
      if (onWelcomeShown) {
        onWelcomeShown();
      }
    } catch (error) {
      console.error('Error creating account:', error);
      
      let errorMessage = 'Failed to create account';
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

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
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

    setImageError(null);
    setPendingImageFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImageUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImageToAccount = async (accountId: string, file: File) => {
    if (!user) {
      throw new Error('You must be logged in to upload images');
    }

    setUploadingImage(true);
    setImageError(null);

    try {
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
      }, accountId);

      setAccount(updatedAccount);
      return updatedAccount;
    } catch (err) {
      console.error('Error uploading image:', err);
      setImageError(err instanceof Error ? err.message : 'Failed to upload image');
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  // Trigger confetti when welcome screen appears
  useEffect(() => {
    if (showWelcome && accountCreated) {
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
  }, [showWelcome, accountCreated]);

  const handleGetStarted = async () => {
    try {
      // Refresh auth state to get updated account list
      if (refreshAccount) {
        await refreshAccount();
      }

      // Also fetch the latest account data
      if (account?.id) {
        const latestAccount = await AccountService.getCurrentAccount();
        if (latestAccount) {
          setAccount(latestAccount);
        }
      }

      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 300));

      // Call onComplete callback if provided
      if (onComplete) {
        await onComplete();
      }

      // Refresh the page to update state
      router.refresh();
    } catch (error) {
      console.error('Error completing account creation:', error);
      if (onComplete) {
        await onComplete();
      }
      router.refresh();
    }
  };

  // Welcome Screen
  if (showWelcome) {
    return (
      <div className="space-y-3">
        <div className="text-center mb-3">
          {accountCreated && (
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <CheckCircleIcon className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Account Created!</span>
            </div>
          )}
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Welcome to Your New Account!</h2>
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
            <a
              href={`/profile/${account.username}`}
              className="w-full flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
            >
              <UserIcon className="w-3 h-3" />
              Go to Profile
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <form onSubmit={handleSubmit} className="space-y-3">
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
                ) : previewImageUrl ? (
                  <Image
                    src={previewImageUrl}
                    alt="Profile preview"
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <UserIcon className="w-10 h-10 text-gray-400" />
                )}
              </div>
              
              {/* Hover Overlay */}
              <div
                onClick={() => !uploadingImage && !saving && fileInputRef.current?.click()}
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
                onChange={handleImageSelect}
                className="hidden"
                disabled={uploadingImage || saving}
              />
            </div>
            {imageError && (
              <p className="mt-1 text-xs text-red-600">{imageError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 text-center">
              {pendingImageFile ? 'Photo will be uploaded after account creation' : 'Hover and click to select photo'}
            </p>
          </div>

          {/* Username */}
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
                  Creating...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRightIcon className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

