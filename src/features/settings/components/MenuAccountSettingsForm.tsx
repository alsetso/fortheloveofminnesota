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
import { TRAIT_OPTIONS, type TraitId } from '@/types/profile';
import type { ProfileAccount } from '@/types/profile';

const inputClass =
  'w-full px-2 py-1.5 text-xs rounded-md border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed';
const labelClass = 'text-xs font-medium text-gray-400 mb-1 block';

export interface MenuAccountSettingsFormProps {
  initialAccount: ProfileAccount;
  userEmail: string;
  onAccountUpdate?: (account: ProfileAccount) => void;
}

export default function MenuAccountSettingsForm({
  initialAccount,
  userEmail,
  onAccountUpdate,
}: MenuAccountSettingsFormProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [account, setAccount] = useState<ProfileAccount>({
    ...initialAccount,
    search_visibility: initialAccount.search_visibility ?? false,
    account_taggable: initialAccount.account_taggable ?? false,
  });
  const [isUpdatingSearchable, setIsUpdatingSearchable] = useState(false);
  const [isUpdatingTaggable, setIsUpdatingTaggable] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [showTraitsAccordion, setShowTraitsAccordion] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAccount({
      ...initialAccount,
      search_visibility: initialAccount.search_visibility ?? false,
      account_taggable: initialAccount.account_taggable ?? false,
    });
  }, [initialAccount]);

  const selectedTraits = account.traits
    ? account.traits.map((traitId) => TRAIT_OPTIONS.find((opt) => opt.id === traitId)).filter(Boolean)
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
        } else setUsernameAvailable(null);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [account.username, initialAccount.username]);

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setIsUploadingProfile(true);
    try {
      if (!file.type.startsWith('image/')) {
        showError('Error', 'Please select a valid image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showError('Error', 'Image must be smaller than 5MB');
        return;
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/accounts/image_url/${Date.now()}-${Math.random().toString(36).slice(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(fileName);
      if (!urlData?.publicUrl) throw new Error('Failed to get URL');
      const updatedAccount = await AccountService.updateCurrentAccount({ image_url: urlData.publicUrl }, account.id);
      setAccount(updatedAccount);
      onAccountUpdate?.(updatedAccount);
      success('Updated', 'Profile image updated');
    } catch (err) {
      showError('Error', 'Failed to upload profile image');
    } finally {
      setIsUploadingProfile(false);
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
      success('Updated', 'Profile updated');
    } catch (err) {
      showError('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setAccount({
      ...initialAccount,
      search_visibility: initialAccount.search_visibility ?? false,
      account_taggable: initialAccount.account_taggable ?? false,
    });
    setIsEditing(false);
    setUsernameAvailable(null);
  };

  const handleToggleSearchable = async () => {
    if (isUpdatingSearchable) return;
    setIsUpdatingSearchable(true);
    try {
      const newSearchable = !account.search_visibility;
      await AccountService.updateCurrentAccount({ search_visibility: newSearchable }, account.id);
      const next = { ...account, search_visibility: newSearchable };
      setAccount(next);
      onAccountUpdate?.(next);
      success('Updated', newSearchable ? 'Searchable' : 'Not searchable');
    } catch (err) {
      showError('Error', 'Failed to update');
    } finally {
      setIsUpdatingSearchable(false);
    }
  };

  const handleToggleTaggable = async () => {
    if (isUpdatingTaggable) return;
    setIsUpdatingTaggable(true);
    try {
      const newTaggable = !account.account_taggable;
      await AccountService.updateCurrentAccount({ account_taggable: newTaggable }, account.id);
      const next = { ...account, account_taggable: newTaggable };
      setAccount(next);
      onAccountUpdate?.(next);
      success('Updated', newTaggable ? 'Tagging on' : 'Tagging off');
    } catch (err) {
      showError('Error', 'Failed to update');
    } finally {
      setIsUpdatingTaggable(false);
    }
  };

  const toggleTrait = (traitId: TraitId) => {
    const currentTraits = account.traits || [];
    const newTraits = currentTraits.includes(traitId)
      ? currentTraits.filter((t) => t !== traitId)
      : [...currentTraits, traitId];
    setAccount((prev) => ({ ...prev, traits: newTraits }));
  };

  return (
    <div className="space-y-3">
      {/* Edit / Save / Cancel */}
      <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-2">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs font-medium text-gray-400 hover:text-white focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs font-medium text-white hover:underline focus:outline-none disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-medium text-white hover:underline focus:outline-none"
          >
            Edit account
          </button>
        )}
      </div>

      {/* Profile photo + fields */}
      <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-white/10">
            {account.image_url ? (
              <Image
                src={account.image_url}
                alt=""
                width={48}
                height={48}
                className="w-full h-full object-cover"
                unoptimized={account.image_url.includes('supabase.co')}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/60">
                <UserIcon className="w-6 h-6" />
              </div>
            )}
            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
            {isEditing && (
              <button
                type="button"
                onClick={() => profileInputRef.current?.click()}
                disabled={isUploadingProfile}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 rounded-md disabled:opacity-50"
              >
                {isUploadingProfile ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PencilIcon className="w-4 h-4 text-white" />
                )}
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <label className={labelClass}>First name</label>
              <input
                type="text"
                value={account.first_name || ''}
                onChange={(e) => setAccount((prev) => ({ ...prev, first_name: e.target.value }))}
                disabled={!isEditing}
                className={inputClass}
                placeholder="First name"
              />
            </div>
            <div>
              <label className={labelClass}>Last name</label>
              <input
                type="text"
                value={account.last_name || ''}
                onChange={(e) => setAccount((prev) => ({ ...prev, last_name: e.target.value }))}
                disabled={!isEditing}
                className={inputClass}
                placeholder="Last name"
              />
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>Username</label>
          <input
            type="text"
            value={account.username || ''}
            onChange={(e) => setAccount((prev) => ({ ...prev, username: e.target.value }))}
            disabled={!isEditing}
            className={inputClass}
            placeholder="username"
          />
          {checkingUsername && <p className="text-[10px] text-gray-500 mt-1">Checking...</p>}
          {!checkingUsername && usernameAvailable === true && account.username !== initialAccount.username && (
            <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
              <CheckIcon className="w-3 h-3" /> Available
            </p>
          )}
          {!checkingUsername && usernameAvailable === false && (
            <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
              <XMarkIcon className="w-3 h-3" /> Not available
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>Bio</label>
          <textarea
            value={account.bio || ''}
            onChange={(e) => setAccount((prev) => ({ ...prev, bio: e.target.value.slice(0, 240) }))}
            disabled={!isEditing}
            className={`${inputClass} resize-none`}
            placeholder="About you..."
            rows={2}
            maxLength={240}
          />
          <p className="text-[10px] text-gray-500 mt-1">{(account.bio || '').length}/240</p>
        </div>
        <div>
          <label className={labelClass}>Traits</label>
          <div className="flex flex-wrap gap-1">
            {selectedTraits.length > 0 ? (
              selectedTraits.filter(Boolean).map((trait) => (
                <span
                  key={trait!.id}
                  className="inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300"
                >
                  {trait!.label}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-gray-500">None</span>
            )}
          </div>
          {isEditing && (
            <>
              <button
                type="button"
                onClick={() => setShowTraitsAccordion((o) => !o)}
                className="mt-2 w-full flex items-center justify-between text-xs font-medium text-gray-400 hover:text-white"
              >
                <span>Manage traits ({selectedTraits.length})</span>
                <span>{showTraitsAccordion ? '−' : '+'}</span>
              </button>
              {showTraitsAccordion && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {TRAIT_OPTIONS.map((trait) => {
                    const isSelected = account.traits?.includes(trait.id);
                    return (
                      <button
                        key={trait.id}
                        type="button"
                        onClick={() => toggleTrait(trait.id as TraitId)}
                        className={`w-full px-2 py-1.5 text-xs text-left rounded-md border transition-colors ${
                          isSelected
                            ? 'border-white/30 bg-white/10 text-white'
                            : 'border-white/10 bg-transparent text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {trait.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Privacy toggles */}
      <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white">Searchable</p>
            <p className="text-[10px] text-gray-500">Find you in @ searches</p>
          </div>
          <button
            type="button"
            onClick={handleToggleSearchable}
            disabled={isUpdatingSearchable}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 ${
              account.search_visibility ? 'bg-green-500' : 'bg-white/10'
            }`}
            role="switch"
            aria-checked={account.search_visibility}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded bg-white shadow transition-transform ${
                account.search_visibility ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white">Taggable</p>
            <p className="text-[10px] text-gray-500">Others can tag you</p>
          </div>
          <button
            type="button"
            onClick={handleToggleTaggable}
            disabled={isUpdatingTaggable}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 ${
              account.account_taggable ? 'bg-green-500' : 'bg-white/10'
            }`}
            role="switch"
            aria-checked={account.account_taggable}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded bg-white shadow transition-transform ${
                account.account_taggable ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
