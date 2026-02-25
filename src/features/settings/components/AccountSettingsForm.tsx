'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  UserIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AccountService, type AccountTrait } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import { useAuthStateSafe } from '@/features/auth/contexts/AuthStateContext';
import { TRAIT_OPTIONS, getDisplayName, type TraitId } from '@/types/profile';
import type { ProfileAccount } from '@/types/profile';

export interface AccountSettingsFormProps {
  initialAccount: ProfileAccount;
  userEmail: string;
  /** Show account switcher (admin users). Default true. */
  showAccountSwitcher?: boolean;
  /** Optional className for the root container (e.g. for sidebar compact layout). */
  className?: string;
  /** Called when account is updated (save, image upload, toggles). Use to sync parent state (e.g. for billing). */
  onAccountUpdate?: (account: ProfileAccount) => void;
}

export default function AccountSettingsForm({
  initialAccount,
  userEmail,
  showAccountSwitcher = true,
  className = '',
  onAccountUpdate,
}: AccountSettingsFormProps) {
  const { user } = useAuth();
  const { setActiveAccountId } = useAuthStateSafe();
  const { success, error: showError } = useToast();
  const [account, setAccount] = useState<ProfileAccount>({
    ...initialAccount,
    search_visibility: initialAccount.search_visibility ?? false,
    account_taggable: initialAccount.account_taggable ?? false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [showTraitsAccordion, setShowTraitsAccordion] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [showAccountSwitcherOpen, setShowAccountSwitcherOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<ProfileAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null);
  const [hasAdminAccount, setHasAdminAccount] = useState(false);
  const [checkingAdminStatus, setCheckingAdminStatus] = useState(true);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAccount({
      ...initialAccount,
      search_visibility: initialAccount.search_visibility ?? false,
      account_taggable: initialAccount.account_taggable ?? false,
    });
  }, [initialAccount]);

  const displayName = getDisplayName(account);
  const selectedTraits = account.traits
    ? account.traits
        .map((traitId) => TRAIT_OPTIONS.find((opt) => opt.id === traitId))
        .filter(Boolean)
    : [];

  useEffect(() => {
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
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [account.username, initialAccount.username]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/accounts', { method: 'GET', credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          const accounts = data.accounts || [];
          setHasAdminAccount(accounts.some((acc: ProfileAccount) => acc.role === 'admin'));
        }
      } catch {
        // ignore
      } finally {
        setCheckingAdminStatus(false);
      }
    };
    checkAdminStatus();
  }, []);

  const fetchAllAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch('/api/accounts', { method: 'GET', credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAllAccounts(data.accounts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === account.id) return;
    setSwitchingAccount(accountId);
    try {
      await setActiveAccountId(accountId);
      await new Promise((r) => setTimeout(r, 100));
      window.location.reload();
    } catch (err) {
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
      if (!file.type.startsWith('image/')) {
        showError('Error', 'Please select a valid image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showError('Error', 'Image must be smaller than 5MB');
        return;
      }
      const bucket = field === 'cover_image_url' ? 'cover-photos' : 'profile-images';
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/accounts/${field}/${Date.now()}-${Math.random().toString(36).slice(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      if (!urlData?.publicUrl) throw new Error('Failed to get URL');
      const updatedAccount = await AccountService.updateCurrentAccount({ [field]: urlData.publicUrl }, account.id);
      setAccount(updatedAccount);
      onAccountUpdate?.(updatedAccount);
      success('Updated', `${field === 'cover_image_url' ? 'Cover' : 'Profile'} image updated`);
    } catch (err) {
      showError('Error', `Failed to upload ${field === 'cover_image_url' ? 'cover' : 'profile'} image`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
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
        showError('Error', 'Username is not available.');
        return;
      }
    }
    setIsSaving(true);
    try {
      const updatedAccount = await AccountService.updateCurrentAccount(
        {
          first_name: account.first_name || null,
          last_name: account.last_name || null,
          username: account.username || null,
          bio: account.bio || null,
          traits: (account.traits ?? null) as AccountTrait[] | null,
          search_visibility: account.search_visibility ?? false,
          account_taggable: account.account_taggable ?? false,
        },
        account.id
      );
      const next = {
        ...updatedAccount,
        traits: updatedAccount.traits ?? null,
      } as unknown as ProfileAccount;
      setAccount(next);
      onAccountUpdate?.(next);
      setIsEditing(false);
      success('Updated', 'Profile updated successfully');
    } catch (err) {
      showError('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => setIsEditing(true);

  const handleCancel = () => {
    setAccount({
      ...initialAccount,
      search_visibility: initialAccount.search_visibility ?? false,
      account_taggable: initialAccount.account_taggable ?? false,
    });
    setIsEditing(false);
    setUsernameAvailable(null);
  };

  const toggleTrait = (traitId: TraitId) => {
    const currentTraits = account.traits || [];
    const newTraits = currentTraits.includes(traitId)
      ? currentTraits.filter((t) => t !== traitId)
      : [...currentTraits, traitId];
    setAccount((prev) => ({ ...prev, traits: newTraits }));
  };

  const showSwitcher = showAccountSwitcher && hasAdminAccount && !checkingAdminStatus;

  return (
    <div className={`space-y-3 ${className}`}>
      {showSwitcher && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <button
            type="button"
            onClick={() => {
              setShowAccountSwitcherOpen((o) => !o);
              if (!showAccountSwitcherOpen && allAccounts.length === 0) fetchAllAccounts();
            }}
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-900"
          >
            <span>Switch Account ({allAccounts.length > 0 ? allAccounts.length : '?'})</span>
            <span className="text-gray-400">{showAccountSwitcherOpen ? '−' : '+'}</span>
          </button>
          {showAccountSwitcherOpen && (
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
                      type="button"
                      onClick={() => handleSwitchAccount(acc.id)}
                      disabled={isActive || switchingAccount === acc.id}
                      className={`w-full px-2 py-2 text-xs text-left rounded-md border transition-colors flex items-center justify-between ${
                        isActive ? 'bg-gray-900 text-foreground border-gray-900 cursor-default' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{accDisplayName}</div>
                        {acc.username && <div className="text-[10px] text-gray-500 truncate">@{acc.username}</div>}
                      </div>
                      {switchingAccount === acc.id && (
                        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-2 flex-shrink-0" />
                      )}
                      {isActive && <CheckIcon className="w-3 h-3 ml-2 flex-shrink-0" />}
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

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="flex justify-end px-[10px] pt-2 pb-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs font-medium text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
            >
              Edit Account
            </button>
          )}
        </div>
        <div className="relative h-32 bg-gradient-to-r from-gray-800 to-gray-900 group">
          {account.cover_image_url ? (
            <Image src={account.cover_image_url} alt="Cover" fill className="object-cover" unoptimized={account.cover_image_url.includes('supabase.co')} />
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
            <div className="absolute inset-0 w-full h-full flex items-center justify-center" aria-hidden>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="w-full h-full min-w-full min-h-full flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                {isUploadingCover ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PencilIcon className="w-6 h-6 text-foreground" aria-hidden />
                )}
              </button>
            </div>
          )}
        </div>
        <div className="p-[10px] space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={`relative w-20 h-20 -mt-14 rounded-full bg-white overflow-hidden group flex-shrink-0 ${
                account.plan === 'contributor'
                  ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                  : 'border-4 border-white'
              }`}
            >
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
                <div className="absolute inset-0 w-full h-full rounded-full flex items-center justify-center" aria-hidden>
                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    disabled={isUploadingProfile}
                    className="w-full h-full min-w-full min-h-full flex items-center justify-center bg-black/0 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 rounded-full disabled:opacity-50"
                  >
                    {isUploadingProfile ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <PencilIcon className="w-5 h-5 text-foreground" aria-hidden />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">First Name</label>
              <input
                type="text"
                value={account.first_name || ''}
                onChange={(e) => setAccount((prev) => ({ ...prev, first_name: e.target.value }))}
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
                onChange={(e) => setAccount((prev) => ({ ...prev, last_name: e.target.value }))}
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
                onChange={(e) => setAccount((prev) => ({ ...prev, username: e.target.value }))}
                disabled={!isEditing}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="username"
              />
              {checkingUsername && <p className="text-[10px] text-gray-500 mt-1">Checking availability...</p>}
              {!checkingUsername && usernameAvailable === true && account.username !== initialAccount.username && (
                <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                  <CheckIcon className="w-3 h-3" /> Username available
                </p>
              )}
              {!checkingUsername && usernameAvailable === false && (
                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                  <XMarkIcon className="w-3 h-3" /> Username not available
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Bio</label>
            <textarea
              value={account.bio || ''}
              onChange={(e) => setAccount((prev) => ({ ...prev, bio: e.target.value.slice(0, 240) }))}
              disabled={!isEditing}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Tell other Minnesotans about yourself..."
              rows={3}
              maxLength={240}
            />
            <div className="text-[10px] text-gray-500 mt-1">{(account.bio || '').length}/240</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Traits</label>
            <div className="flex flex-wrap gap-1">
              {selectedTraits.length > 0 ? (
                selectedTraits.filter(Boolean).map((trait) => (
                  <span key={trait!.id} className="px-1.5 py-0.5 bg-white border border-gray-200 text-[10px] text-gray-900 rounded">
                    {trait!.label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">No traits selected</span>
              )}
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowTraitsAccordion((o) => !o)}
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
                      type="button"
                      onClick={() => toggleTrait(trait.id as TraitId)}
                      className={`w-full px-2 py-1.5 text-xs text-left rounded-md border transition-colors ${
                        isSelected ? 'bg-gray-900 text-foreground border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
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
    </div>
  );
}
