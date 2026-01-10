'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount } from '@/types/profile';
import { TRAIT_OPTIONS, type TraitId } from '@/types/profile';
import { AccountService } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: ProfileAccount;
  onAccountUpdate: (account: ProfileAccount) => void;
}

export default function ProfileEditModal({
  isOpen,
  onClose,
  account: initialAccount,
  onAccountUpdate,
}: ProfileEditModalProps) {
  const { success, error: showError } = useToast();
  const [account, setAccount] = useState<ProfileAccount>(initialAccount);
  const [isSaving, setIsSaving] = useState(false);
  const [showTraitsAccordion, setShowTraitsAccordion] = useState(false);
  
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local state when prop changes
  useEffect(() => {
    setAccount(initialAccount);
  }, [initialAccount]);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen && firstNameInputRef.current) {
      setTimeout(() => firstNameInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const updatedAccount = await AccountService.updateCurrentAccount({
        first_name: account.first_name || null,
        last_name: account.last_name || null,
        username: account.username || null,
        bio: account.bio || null,
        traits: account.traits && account.traits.length > 0 ? (account.traits as any) : null,
      }, account.id);

      onAccountUpdate(updatedAccount);
      success('Updated', 'Profile updated successfully');
      onClose();
    } catch (err) {
      console.error('Error updating profile:', err);
      showError('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTrait = (traitId: TraitId) => {
    const currentTraits = account.traits || [];
    const newTraits = currentTraits.includes(traitId)
      ? currentTraits.filter(t => t !== traitId)
      : [...currentTraits, traitId];
    
    setAccount({ ...account, traits: newTraits });
  };

  const selectedTraits = account.traits
    ? account.traits
        .map(traitId => TRAIT_OPTIONS.find(opt => opt.id === traitId))
        .filter(Boolean)
    : [];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div
          className="bg-white rounded-md border border-gray-200 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-[10px] py-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Edit Profile</h2>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-[10px] space-y-3">
            {/* First Name */}
            <div>
              <label htmlFor="first-name" className="block text-xs font-medium text-gray-700 mb-0.5">
                First Name
              </label>
              <input
                id="first-name"
                ref={firstNameInputRef}
                type="text"
                value={account.first_name || ''}
                onChange={(e) => setAccount({ ...account, first_name: e.target.value || null })}
                className="w-full text-xs text-gray-900 border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="First name"
              />
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="last-name" className="block text-xs font-medium text-gray-700 mb-0.5">
                Last Name
              </label>
              <input
                id="last-name"
                ref={lastNameInputRef}
                type="text"
                value={account.last_name || ''}
                onChange={(e) => setAccount({ ...account, last_name: e.target.value || null })}
                className="w-full text-xs text-gray-900 border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="Last name"
              />
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-0.5">
                Username
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">@</span>
                <input
                  id="username"
                  ref={usernameInputRef}
                  type="text"
                  value={account.username || ''}
                  onChange={(e) => setAccount({ ...account, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') || null })}
                  className="flex-1 text-xs text-gray-500 border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="username"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-xs font-medium text-gray-700 mb-0.5">
                Bio
              </label>
              <textarea
                id="bio"
                ref={bioTextareaRef}
                value={account.bio || ''}
                onChange={(e) => setAccount({ ...account, bio: e.target.value || null })}
                className="w-full text-xs text-gray-600 leading-relaxed border border-gray-300 rounded px-1.5 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                rows={4}
                placeholder="Tell us about yourself..."
              />
            </div>

            {/* Traits */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-700">
                Traits
              </label>
                {selectedTraits.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowTraitsAccordion(!showTraitsAccordion)}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <span>Set traits</span>
                    {showTraitsAccordion ? (
                      <ChevronUpIcon className="w-3 h-3" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              
              {/* Selected Traits */}
              {selectedTraits.length > 0 && (
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedTraits.filter(Boolean).map((trait) => (
                    <span
                      key={trait!.id}
                        className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 text-[10px] text-gray-900 rounded"
                    >
                      {trait!.label}
                    </span>
                  ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTraitsAccordion(!showTraitsAccordion)}
                    className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <span>{showTraitsAccordion ? 'Hide' : 'Show'} all traits</span>
                    {showTraitsAccordion ? (
                      <ChevronUpIcon className="w-3 h-3" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
              
              {/* All Traits Accordion */}
              {(showTraitsAccordion || selectedTraits.length === 0) && (
                <div className="flex flex-wrap gap-1">
                {TRAIT_OPTIONS.map((trait) => {
                  const isSelected = account.traits?.includes(trait.id) || false;
                  return (
                    <button
                      key={trait.id}
                      type="button"
                      onClick={() => toggleTrait(trait.id)}
                        className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                        isSelected
                          ? 'bg-gray-700 text-white hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {trait.label}
                    </button>
                  );
                })}
              </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

