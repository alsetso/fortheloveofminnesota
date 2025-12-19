'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { UserIcon, CameraIcon } from '@heroicons/react/24/outline';
import { useAuth, AccountService, Account, AccountTrait } from '@/features/auth';
import { supabase } from '@/lib/supabase';
import { TRAIT_OPTIONS } from '@/types/profile';

interface SettingsClientProps {
  initialAccount: Account;
  userEmail: string;
}

export default function SettingsClient({ initialAccount, userEmail }: SettingsClientProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [account, setAccount] = useState<Account>(initialAccount);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showTraitPicker, setShowTraitPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [username, setUsername] = useState(account.username || '');
  const [firstName, setFirstName] = useState(account.first_name || '');
  const [lastName, setLastName] = useState(account.last_name || '');
  const [phone, setPhone] = useState(account.phone || '');

  // Username validation state
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Sync form state when account updates
  useEffect(() => {
    setUsername(account.username || '');
    setFirstName(account.first_name || '');
    setLastName(account.last_name || '');
    setPhone(account.phone || '');
    // Reset username validation when account changes
    if (account.username) {
      setUsernameAvailable(true);
      setUsernameError(null);
    }
  }, [account]);

  // Check username availability
  const checkUsername = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    // Validate format
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setUsernameAvailable(false);
      setUsernameError('Username can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    // Validate length
    if (value.length < 3 || value.length > 30) {
      setUsernameAvailable(false);
      setUsernameError('Username must be between 3 and 30 characters');
      return;
    }

    // If username matches current account username, it's available (no change)
    if (value === account.username) {
      setUsernameAvailable(true);
      setUsernameError(null);
      return;
    }

    setCheckingUsername(true);
    setUsernameError(null);

    try {
      const response = await fetch('/api/accounts/username/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      });

      const data = await response.json();

      if (data.error) {
        setUsernameAvailable(false);
        setUsernameError(data.error);
      } else {
        setUsernameAvailable(data.available);
        setUsernameError(data.available ? null : 'This username is already taken');
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
      setUsernameError('Failed to check username availability');
    } finally {
      setCheckingUsername(false);
    }
  }, [account.username]);

  // Debounce username check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (username && username !== account.username) {
        checkUsername(username);
      } else if (username === account.username) {
        setUsernameAvailable(true);
        setUsernameError(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, account.username, checkUsername]);

  const handleSaveUsername = async () => {
    if (!username || username.length < 3 || usernameAvailable !== true) {
      return;
    }

    setIsSavingUsername(true);
    setUsernameError(null);

    try {
      const updatedAccount = await AccountService.updateCurrentAccount({
        username: username || null,
      });

      setAccount(updatedAccount);
      setUsernameAvailable(true);
    } catch (err: any) {
      console.error('Error updating username:', err);
      setUsernameError(err.message || 'Failed to update username');
      setUsernameAvailable(false);
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSignOutClick = () => {
    setShowSignOutConfirm(true);
  };

  const handleSignOutConfirm = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    setShowSignOutConfirm(false);
    
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setSignOutError('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOutCancel = () => {
    setShowSignOutConfirm(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSaveError('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image must be smaller than 5MB');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileName = `${account.id}/profile/${timestamp}-${random}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      
      if (!urlData?.publicUrl) throw new Error('Failed to get image URL');

      const updatedAccount = await AccountService.updateCurrentAccount({
        image_url: urlData.publicUrl,
      });

      setAccount(updatedAccount);
    } catch (err) {
      console.error('Error uploading photo:', err);
      setSaveError('Failed to upload photo');
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setIsSaving(true);
    setSaveError('');

    try {
      const updatedAccount = await AccountService.updateCurrentAccount({
        image_url: null,
      });

      setAccount(updatedAccount);
    } catch (err) {
      console.error('Error removing photo:', err);
      setSaveError('Failed to remove photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveField = async (field: string, value: string | null) => {
    setIsSaving(true);
    setSaveError('');

    try {
      const updateData: Record<string, string | null> = { [field]: value || null };
      const updatedAccount = await AccountService.updateCurrentAccount(updateData);
      setAccount(updatedAccount);
    } catch (err) {
      console.error(`Error updating ${field}:`, err);
      setSaveError(`Failed to update ${field}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTrait = async (traitId: AccountTrait) => {
    const currentTraits = account.traits || [];
    const newTraits = currentTraits.includes(traitId)
      ? currentTraits.filter(t => t !== traitId)
      : [...currentTraits, traitId];

    setIsSaving(true);
    setSaveError('');

    try {
      const updatedAccount = await AccountService.updateCurrentAccount({
        traits: newTraits.length > 0 ? newTraits : null,
      });

      setAccount(updatedAccount);
    } catch (err) {
      console.error('Error updating traits:', err);
      setSaveError('Failed to update traits');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-[10px] bg-white border border-gray-200 rounded-md">
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-gray-900">Settings</h1>
        </div>
        <p className="text-xs text-gray-600">Manage your account settings and preferences</p>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{saveError}</span>
        </div>
      )}

      {/* Profile Photo */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Profile Photo</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200 relative">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={AccountService.getDisplayName(account) || 'Profile'}
                  fill
                  sizes="64px"
                  className="object-cover rounded-full"
                  unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                />
              ) : (
                <UserIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              className="absolute bottom-0 right-0 w-5 h-5 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Change photo"
            >
              <CameraIcon className="w-3 h-3" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Uploading...' : 'Change photo'}
            </button>
            {account.image_url && (
              <button
                onClick={handleRemovePhoto}
                disabled={isSaving}
                className="block text-xs text-red-600 hover:text-red-700 transition-colors mt-1 disabled:opacity-50"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Username Form */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Username</h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
              Username
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError(null);
                  }}
                  disabled={isSavingUsername}
                  className={`w-full px-[10px] py-[10px] text-xs border rounded-md focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    usernameError || usernameAvailable === false
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : usernameAvailable === true && username !== account.username
                      ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                      : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900'
                  }`}
                  placeholder="Enter username"
                />
                {checkingUsername && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  </div>
                )}
                {!checkingUsername && username && username !== account.username && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {usernameAvailable === true && (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {usernameAvailable === false && (
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleSaveUsername}
                disabled={
                  isSavingUsername ||
                  checkingUsername ||
                  usernameAvailable !== true ||
                  username === account.username ||
                  !username ||
                  username.length < 3
                }
                className="px-[10px] py-[10px] text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isSavingUsername ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-1.5" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
            {usernameError && (
              <p className="text-xs text-red-600 mt-1">{usernameError}</p>
            )}
            {!usernameError && username && username.length >= 3 && usernameAvailable === true && username !== account.username && (
              <p className="text-xs text-green-600 mt-1">Username is available</p>
            )}
            {username && username.length > 0 && username.length < 3 && (
              <p className="text-xs text-gray-500 mt-1">Username must be at least 3 characters</p>
            )}
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Information</h3>
        <div className="space-y-3">

          {/* First Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => handleSaveField('first_name', firstName)}
              className="w-full px-[10px] py-[10px] text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Enter first name"
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={() => handleSaveField('last_name', lastName)}
              className="w-full px-[10px] py-[10px] text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Enter last name"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => handleSaveField('phone', phone)}
              className="w-full px-[10px] py-[10px] text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Enter phone number"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
              Email
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="w-full px-[10px] py-[10px] text-xs border border-gray-200 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Traits */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Traits</h3>
          <button
            onClick={() => setShowTraitPicker(!showTraitPicker)}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showTraitPicker ? 'Done' : 'Edit'}
          </button>
        </div>
        {showTraitPicker ? (
          <div className="flex flex-wrap gap-1.5">
            {TRAIT_OPTIONS.map(trait => {
              const isSelected = account.traits?.includes(trait.id as AccountTrait);
              return (
                <button
                  key={trait.id}
                  onClick={() => toggleTrait(trait.id as AccountTrait)}
                  disabled={isSaving}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors disabled:opacity-50 ${
                    isSelected
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {trait.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {account.traits && account.traits.length > 0 ? (
              account.traits.map(traitId => {
                const trait = TRAIT_OPTIONS.find(t => t.id === traitId);
                return trait ? (
                  <span key={traitId} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {trait.label}
                  </span>
                ) : null;
              })
            ) : (
              <span className="text-xs text-gray-500">No traits selected</span>
            )}
          </div>
        )}
      </div>

      {/* Account Actions */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Actions</h3>
        
        {signOutError && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{signOutError}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
          <div>
            <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Sign Out</h4>
            <p className="text-xs text-gray-600">Sign out of your account on this device</p>
          </div>
          <button
            onClick={handleSignOutClick}
            disabled={isSigningOut}
            className="flex items-center gap-1.5 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningOut ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing out...
              </>
            ) : (
              'Sign Out'
            )}
          </button>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4">
            <div className="p-[10px]">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 w-8 h-8 mx-auto bg-red-100 rounded-md flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                  Sign out of your account?
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  You&apos;ll need to sign in again to access your account.
                </p>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleSignOutCancel}
                    className="flex-1 px-[10px] py-[10px] text-xs font-medium text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSignOutConfirm}
                    disabled={isSigningOut}
                    className="flex-1 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
