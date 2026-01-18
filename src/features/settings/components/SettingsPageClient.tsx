'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeftIcon, 
  UserIcon, 
  ArrowUpTrayIcon,
  CreditCardIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { AccountService } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import { useAuthStateSafe } from '@/features/auth/contexts/AuthStateContext';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { TRAIT_OPTIONS, getDisplayName, type TraitId } from '@/types/profile';
import type { ProfileAccount } from '@/types/profile';

interface SettingsPageClientProps {
  account: ProfileAccount;
  userEmail: string;
}

export default function SettingsPageClient({ account: initialAccount, userEmail }: SettingsPageClientProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { setActiveAccountId } = useAuthStateSafe();
  const { success, error: showError } = useToast();
  const { openUpgrade } = useAppModalContextSafe();
  const [account, setAccount] = useState<ProfileAccount>({
    ...initialAccount,
    search_visibility: initialAccount.search_visibility ?? false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showTraitsAccordion, setShowTraitsAccordion] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [allAccounts, setAllAccounts] = useState<ProfileAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null);
  const [hasAdminAccount, setHasAdminAccount] = useState(false);
  const [checkingAdminStatus, setCheckingAdminStatus] = useState(true);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  // Sync account state when initialAccount prop changes
  useEffect(() => {
    setAccount(initialAccount);
  }, [initialAccount]);

  const displayName = getDisplayName(account);

  // Get selected trait labels
  const selectedTraits = account.traits
    ? account.traits
        .map(traitId => TRAIT_OPTIONS.find(opt => opt.id === traitId))
        .filter(Boolean)
    : [];

  // Check username availability
  useEffect(() => {
    // Don't check if it's their current username
    if (account.username === initialAccount.username) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    if (!account.username || account.username.length < 3) {
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
          body: JSON.stringify({ username: account.username }),
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
  }, [account.username, initialAccount.username]);

  // Check if user has at least one admin account on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/accounts', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const accounts = data.accounts || [];
          // Check if any account has admin role
          const hasAdmin = accounts.some((acc: ProfileAccount) => acc.role === 'admin');
          setHasAdminAccount(hasAdmin);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      } finally {
        setCheckingAdminStatus(false);
      }
    };

    checkAdminStatus();
  }, []);

  // Fetch all accounts for admin users
  useEffect(() => {
    if (hasAdminAccount && showAccountSwitcher && allAccounts.length === 0) {
      fetchAllAccounts();
    }
  }, [hasAdminAccount, showAccountSwitcher]);

  const fetchAllAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch('/api/accounts', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAllAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === account.id) return;
    
    setSwitchingAccount(accountId);
    try {
      // Use the proper context method which handles:
      // - Setting the cookie
      // - Setting localStorage
      // - Verifying user owns the account
      // - Dispatching events
      // - Loading the new account data
      await setActiveAccountId(accountId);
      
      // Small delay to ensure cookie is fully set before reload
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Full page reload to ensure server components fetch new account data
      window.location.reload();
    } catch (err) {
      console.error('Error switching account:', err);
      showError('Error', err instanceof Error ? err.message : 'Failed to switch account');
      setSwitchingAccount(null);
    }
  };

  const handleImageUpload = async (
    file: File,
    field: 'image_url' | 'cover_image_url',
    setIsUploading: (value: boolean) => void
  ) => {
    if (!user) return;

    setIsUploading(true);
    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        showError('Error', 'Please select a valid image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showError('Error', 'Image must be smaller than 5MB');
        return;
      }

      // Determine bucket and path
      const bucket = field === 'cover_image_url' ? 'cover-photos' : 'profile-images';
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/accounts/${field}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL');
      }

      // Update account
      const updatedAccount = await AccountService.updateCurrentAccount({
        [field]: urlData.publicUrl,
      }, account.id);

      setAccount(updatedAccount);
      success('Updated', `${field === 'cover_image_url' ? 'Cover' : 'Profile'} image updated`);
    } catch (err) {
      console.error(`Error uploading ${field}:`, err);
      showError('Error', `Failed to upload ${field === 'cover_image_url' ? 'cover' : 'profile'} image`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Validate username if changed
    if (account.username !== initialAccount.username) {
      if (!account.username || account.username.length < 3 || account.username.length > 30) {
        showError('Error', 'Username must be between 3 and 30 characters');
        return;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(account.username)) {
        showError('Error', 'Username can only contain letters, numbers, hyphens, and underscores');
        return;
      }

      if (usernameAvailable === false) {
        showError('Error', 'Username is not available. Please choose another.');
        return;
      }
    }

    setIsSaving(true);

    try {
      const updatedAccount = await AccountService.updateCurrentAccount({
        first_name: account.first_name || null,
        last_name: account.last_name || null,
        username: account.username || null,
        bio: account.bio || null,
        traits: account.traits && account.traits.length > 0 ? (account.traits as any) : null,
        search_visibility: account.search_visibility ?? false,
      }, account.id);

      setAccount(updatedAccount);
      setIsEditing(false);
      success('Updated', 'Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      showError('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setAccount({
      ...initialAccount,
      search_visibility: initialAccount.search_visibility ?? false,
    });
    setIsEditing(false);
    setUsernameAvailable(null);
  };

  const toggleTrait = (traitId: TraitId) => {
    const currentTraits = account.traits || [];
    const newTraits = currentTraits.includes(traitId)
      ? currentTraits.filter(t => t !== traitId)
      : [...currentTraits, traitId];
    
    setAccount({ ...account, traits: newTraits });
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

  const handleManageBilling = () => {
    openUpgrade();
  };

  // Determine billing status
  const isProUser = account.plan === 'pro' || account.plan === 'plus';
  const isActive = account.subscription_status === 'active' || account.subscription_status === 'trialing';
  const isTrial = account.billing_mode === 'trial' || account.subscription_status === 'trialing';
  const planDisplayName = account.plan === 'plus' ? 'Pro+' : account.plan === 'pro' ? 'Pro' : 'Hobby';
  const planPrice = account.plan === 'plus' ? '$80/month' : account.plan === 'pro' ? '$20/month' : 'Free';

  // Get subscription status display
  const getStatusDisplay = () => {
    if (!account.subscription_status) return null;
    if (account.subscription_status === 'active') return { text: 'Active', color: 'bg-green-100 text-green-800' };
    if (account.subscription_status === 'trialing') return { text: 'Trial', color: 'bg-blue-100 text-blue-800' };
    if (account.subscription_status === 'past_due') return { text: 'Past Due', color: 'bg-yellow-100 text-yellow-800' };
    if (account.subscription_status === 'canceled') return { text: 'Canceled', color: 'bg-gray-100 text-gray-800' };
    return { text: account.subscription_status, color: 'bg-gray-100 text-gray-800' };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Back
          </Link>
          <h1 className="text-sm font-semibold text-gray-900">Settings</h1>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={isEditing ? handleSave : handleEdit}
              disabled={isSaving}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                isEditing 
                  ? 'text-white bg-gray-900 hover:bg-gray-800'
                  : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : isEditing ? (
                <>
                  <CheckIcon className="w-3 h-3" />
                  Save
                </>
              ) : (
                <>
                  <PencilIcon className="w-3 h-3" />
                  Edit
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">
        {/* Account Switcher - Show if user has at least one admin account */}
        {hasAdminAccount && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <button
              onClick={() => {
                setShowAccountSwitcher(!showAccountSwitcher);
                if (!showAccountSwitcher && allAccounts.length === 0) {
                  fetchAllAccounts();
                }
              }}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-900"
            >
              <span>Switch Account ({allAccounts.length > 0 ? allAccounts.length : '?'})</span>
              <span className="text-gray-400">{showAccountSwitcher ? '−' : '+'}</span>
            </button>
            
            {showAccountSwitcher && (
              <div className="mt-3 space-y-1">
                {loadingAccounts ? (
                  <p className="text-xs text-gray-500">Loading accounts...</p>
                ) : allAccounts.length > 0 ? (
                  allAccounts.map((acc) => {
                    const accDisplayName = getDisplayName(acc);
                    const isActive = acc.id === account.id;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => handleSwitchAccount(acc.id)}
                        disabled={isActive || switchingAccount === acc.id}
                        className={`w-full px-2 py-2 text-xs text-left rounded-md border transition-colors flex items-center justify-between ${
                          isActive
                            ? 'bg-gray-900 text-white border-gray-900 cursor-default'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{accDisplayName}</div>
                          {acc.username && (
                            <div className="text-[10px] text-gray-500 truncate">@{acc.username}</div>
                          )}
                        </div>
                        {switchingAccount === acc.id && (
                          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-2 flex-shrink-0"></div>
                        )}
                        {isActive && (
                          <CheckIcon className="w-3 h-3 ml-2 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-500">No accounts found</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Profile Section */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          {/* Cover Image */}
          <div className="relative h-32 bg-gradient-to-r from-gray-800 to-gray-900 group">
            {account.cover_image_url ? (
              <Image
                src={account.cover_image_url}
                alt="Cover"
                fill
                className="object-cover"
                unoptimized={account.cover_image_url.includes('supabase.co')}
              />
            ) : null}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, 'cover_image_url', setIsUploadingCover);
              }}
            />
            {isEditing && (
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                {isUploadingCover ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-white font-medium">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ArrowUpTrayIcon className="w-6 h-6 text-white" />
                    <span className="text-xs text-white font-medium">Edit Cover</span>
                  </div>
                )}
              </button>
            )}
          </div>

          {/* Profile Content */}
          <div className="p-[10px] space-y-3">
            {/* Profile Image */}
            <div className="flex items-start gap-3">
              <div className={`relative w-20 h-20 -mt-14 rounded-full bg-white overflow-hidden group flex-shrink-0 ${
                (account.plan === 'pro' || account.plan === 'plus')
                  ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                  : 'border-4 border-white'
              }`}>
                <div className="w-full h-full rounded-full overflow-hidden bg-white">
                  {account.image_url ? (
                    <Image
                      src={account.image_url}
                      alt={displayName}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover rounded-full"
                      unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-full">
                      <UserIcon className="w-9 h-9 text-gray-400" />
                    </div>
                  )}
                </div>
                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'image_url', setIsUploadingProfile);
                  }}
                />
                {isEditing && (
                  <button
                    onClick={() => profileInputRef.current?.click()}
                    disabled={isUploadingProfile}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 rounded-full disabled:opacity-50"
                  >
                    {isUploadingProfile ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <ArrowUpTrayIcon className="w-5 h-5 text-white" />
                        <span className="text-[10px] text-white font-medium mt-0.5">Edit</span>
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Name Fields */}
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">First Name</label>
                <input
                  type="text"
                  value={account.first_name || ''}
                  onChange={(e) => setAccount({ ...account, first_name: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Last Name</label>
                <input
                  type="text"
                  value={account.last_name || ''}
                  onChange={(e) => setAccount({ ...account, last_name: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Last name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Username</label>
                <input
                  type="text"
                  value={account.username || ''}
                  onChange={(e) => setAccount({ ...account, username: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="username"
                />
                {checkingUsername && (
                  <p className="text-[10px] text-gray-500 mt-1">Checking availability...</p>
                )}
                {!checkingUsername && usernameAvailable === true && account.username !== initialAccount.username && (
                  <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                    <CheckIcon className="w-3 h-3" />
                    Username available
                  </p>
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                    <XMarkIcon className="w-3 h-3" />
                    Username not available
                  </p>
                )}
              </div>
              
              {/* Search Visibility Toggle */}
              <div className="py-2">
                <label className="text-xs font-medium text-gray-700 block mb-0.5">
                  Profile is searchable
                </label>
                <p className="text-[10px] text-gray-500 mb-2">
                  Allow others to find you in @ mention searches
                </p>
                <button
                  type="button"
                  onClick={() => setAccount({ ...account, search_visibility: !account.search_visibility })}
                  disabled={!isEditing}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    account.search_visibility ? 'bg-gray-900' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={account.search_visibility}
                  aria-label="Toggle profile searchability"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      account.search_visibility ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                    style={{ marginTop: '2px' }}
                  />
                </button>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Bio</label>
              <textarea
                value={account.bio || ''}
                onChange={(e) => setAccount({ ...account, bio: e.target.value.slice(0, 240) })}
                disabled={!isEditing}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Tell other Minnesotans about yourself..."
                rows={3}
                maxLength={240}
              />
              <div className="text-[10px] text-gray-500 mt-1">{(account.bio || '').length}/240</div>
            </div>

            {/* Selected Traits Display */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Traits</label>
              <div className="flex flex-wrap gap-1">
                {selectedTraits.length > 0 ? (
                  selectedTraits.filter(Boolean).map((trait) => (
                    <span
                      key={trait!.id}
                      className="px-1.5 py-0.5 bg-white border border-gray-200 text-[10px] text-gray-900 rounded"
                    >
                      {trait!.label}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">No traits selected</span>
                )}
              </div>
            </div>

            {/* Traits Selector Accordion */}
            <div>
              <button
                onClick={() => setShowTraitsAccordion(!showTraitsAccordion)}
                disabled={!isEditing}
                className="w-full flex items-center justify-between text-xs font-medium text-gray-700 mb-2 disabled:text-gray-400"
              >
                <span>Manage Traits ({selectedTraits.length} selected)</span>
                <span className="text-gray-400">{showTraitsAccordion ? '−' : '+'}</span>
              </button>
              
              {showTraitsAccordion && (
                <div className="space-y-1">
                  {TRAIT_OPTIONS.map((trait) => {
                    const isSelected = account.traits?.includes(trait.id);
                    return (
                      <button
                        key={trait.id}
                        onClick={() => toggleTrait(trait.id as TraitId)}
                        className={`w-full px-2 py-1.5 text-xs text-left rounded-md border transition-colors ${
                          isSelected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {trait.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manage Billing Section */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Manage Billing</h3>
          <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="text-xs font-semibold text-gray-900">{planDisplayName}</h4>
                {isTrial && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Trial
                  </span>
                )}
                {statusDisplay && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusDisplay.color}`}>
                    {statusDisplay.text}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                {isProUser 
                  ? isActive 
                    ? `${planPrice} • Active subscription`
                    : account.subscription_status === 'canceled'
                    ? 'Subscription canceled'
                    : account.subscription_status === 'past_due'
                    ? 'Payment required'
                    : 'Subscription inactive'
                  : 'Upgrade to unlock Pro features'
                }
              </p>
            </div>
            <button
              onClick={handleManageBilling}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors flex-shrink-0"
            >
              <CreditCardIcon className="w-3 h-3" />
              <span>{isProUser ? 'Manage' : 'Upgrade'}</span>
            </button>
          </div>
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
