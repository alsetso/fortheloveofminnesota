'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { XMarkIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline';
import { GuestAccountService, type GuestAccount } from '@/features/auth/services/guestAccountService';
import { useRouter } from 'next/navigation';
import { cleanAuthParams } from '@/lib/urlParams';

interface GuestDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onSignIn?: () => void;
}

export default function GuestDetailsModal({
  isOpen,
  onClose,
  onComplete,
  onSignIn,
}: GuestDetailsModalProps) {
  const router = useRouter();
  const [guestAccount, setGuestAccount] = useState<GuestAccount | null>(null);
  const [guestName, setGuestName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pinCount, setPinCount] = useState<number | null>(null);

  // Load guest data
  useEffect(() => {
    if (isOpen) {
      console.log('[GuestDetailsModal] Modal opened, loading guest data...');
      loadGuestData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadGuestData = async () => {
    setIsLoading(true);
    try {
      const guestId = GuestAccountService.getGuestId();
      const name = GuestAccountService.getGuestName() || '';
      setGuestName(name);

      console.log('[GuestDetailsModal] Loading guest data:', {
        guestId,
        name,
        nameValid: name && name.trim() && name !== 'Guest',
      });

      // Try to get guest account from database
      const account = await GuestAccountService.getGuestAccountByGuestId(guestId);
      if (account) {
        console.log('[GuestDetailsModal] Found guest account:', {
          accountId: account.id,
          guestId: account.guest_id,
          firstName: account.first_name,
        });
        setGuestAccount(account);
        // Get pin count
        const stats = await GuestAccountService.getGuestAccountStats(account.id);
        setPinCount(stats?.pin_count || 0);
      } else {
        console.log('[GuestDetailsModal] No guest account found in database for guestId:', guestId);
        setGuestAccount(null);
        setPinCount(0);
      }
    } catch (error) {
      console.error('[GuestDetailsModal] Error loading guest data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!guestName.trim() || guestName === 'Guest') {
      return;
    }

    setIsSaving(true);
    try {
      GuestAccountService.setGuestName(guestName.trim());
      
      // Create/update guest account in Supabase immediately
      const account = await GuestAccountService.getOrCreateGuestAccount();
      setGuestAccount(account);
      await loadGuestData();
      
      setIsEditingName(false);
      
      // If name is valid, mark as complete
      if (guestName.trim() && guestName !== 'Guest') {
        onComplete?.();
      }
    } catch (error) {
      console.error('[GuestDetailsModal] Error saving name:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setGuestName(GuestAccountService.getGuestName() || '');
    setIsEditingName(false);
  };

  if (!isOpen) return null;

  // Check if profile is complete (has a name that's not "Guest")
  const isProfileComplete = guestName && guestName.trim() && guestName !== 'Guest';
  
  // Debug button state - log every render when modal is open
  const buttonDisabled = isSaving || (!guestName || !guestName.trim() || guestName === 'Guest');
  
  // Log button state on every render (using console.log directly, not in useEffect to avoid hook issues)
  if (isOpen) {
    console.log('[GuestDetailsModal] Render state:', {
      isSaving,
      guestName,
      guestNameTrimmed: guestName?.trim(),
      isGuest: guestName === 'Guest',
      buttonDisabled,
      isProfileComplete,
      hasGuestAccount: !!guestAccount,
      guestAccountId: guestAccount?.id,
      guestId: typeof window !== 'undefined' ? GuestAccountService.getGuestId() : 'N/A',
      isLoading,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={isProfileComplete ? onClose : undefined}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-md rounded-md bg-white border border-gray-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-[10px]">
          <h2 className="text-sm font-semibold text-gray-900">
            Guest Account
          </h2>
          {isProfileComplete && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
                  {isLoading ? (
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-600">Loading...</p>
                    </div>
                  ) : (
                    <>
                      {/* Guest Image */}
                      <div className="flex justify-center mb-3">
                        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                          <Image
                            src="https://hfklpjuiuhbulztsqapv.supabase.co/storage/v1/object/public/logos/Guest%20Image.png"
                            alt="Guest"
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            priority
                            unoptimized
                          />
                        </div>
                      </div>

                      {/* Guest Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-gray-900">
                          Name {!isProfileComplete && <span className="text-red-500">*</span>}
                        </label>
                        {isEditingName ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={guestName}
                              onChange={(e) => setGuestName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && guestName.trim() && guestName !== 'Guest') {
                                  handleSaveName();
                                }
                              }}
                              placeholder="Enter your name"
                              className="flex-1 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500"
                              autoFocus
                            />
                            <button
                              onClick={handleSaveName}
                              disabled={isSaving || !guestName.trim() || guestName === 'Guest'}
                              className="px-3 py-[10px] text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? (
                                'Saving...'
                              ) : (
                                <CheckIcon className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={isSaving}
                              className="px-3 py-[10px] text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-[10px] py-[10px] bg-gray-50 border border-gray-200 rounded-md">
                            <span className="text-xs text-gray-900">
                              {guestName || 'Guest'}
                            </span>
                            <button
                              onClick={() => setIsEditingName(true)}
                              className="text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              <PencilIcon className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {!isProfileComplete && (
                          <p className="text-xs text-red-600">
                            Please enter a name to complete your profile
                          </p>
                        )}
                      </div>

                      {/* Guest ID */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-gray-900">
                          Guest ID
                        </label>
                        <div className="px-[10px] py-[10px] bg-gray-50 border border-gray-200 rounded-md">
                          <p className="text-xs text-gray-600 font-mono break-all">
                            {GuestAccountService.getGuestId()}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          Your unique guest identifier (stored locally)
                        </p>
                      </div>

                      {/* Pin Count */}
                      {pinCount !== null && (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-gray-900">
                            Pins Created
                          </label>
                          <div className="px-[10px] py-[10px] bg-gray-50 border border-gray-200 rounded-md">
                            <p className="text-xs text-gray-900 font-medium">
                              {pinCount} pin{pinCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Info Message */}
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                        <p className="text-xs text-gray-600">
                          You're browsing as a guest. Your pins and activity are saved locally on this device. 
                          Sign in to access additional features and manage your account.
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 space-y-2">
                        {!isProfileComplete ? (
                          // Show button to start editing if name is not set
                          <button
                            onClick={() => setIsEditingName(true)}
                            className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
                          >
                            Set Your Name
                          </button>
                        ) : isEditingName ? (
                          // Show save button when editing
                          <button
                            onClick={handleSaveName}
                            disabled={isSaving || !guestName.trim() || guestName === 'Guest'}
                            className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? 'Saving...' : 'Save & Complete'}
                          </button>
                        ) : (
                          // Show close button when profile is complete
                          <button
                            onClick={onClose}
                            className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
                          >
                            Close
                          </button>
                        )}
                        
                        {/* Sign In / Sign Up Button - Always visible */}
                        {onSignIn && (
                          <button
                            onClick={() => {
                              // Clean guest parameters before redirecting to sign in
                              cleanAuthParams(router);
                              onSignIn();
                              onClose(); // Close guest modal when opening sign-in
                            }}
                            className="w-full px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            Sign In / Sign Up
                          </button>
                        )}
                        
                        {/* Clear Guest Data Button - Only show if has pins or account exists */}
                        {isProfileComplete && (pinCount > 0 || guestAccount) && (
                          <button
                            onClick={() => {
                              if (confirm('Clear all guest data? This will remove your guest account and you\'ll start fresh.')) {
                                GuestAccountService.clearGuestData();
                                // Reload page to reset state
                                window.location.reload();
                              }
                            }}
                            className="w-full px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            Start Fresh (Clear Guest Data)
                          </button>
                        )}
                      </div>
                    </>
                  )}
        </div>
      </div>
    </div>
  );
}


