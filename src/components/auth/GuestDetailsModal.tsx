'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { XMarkIcon, PencilIcon, CheckIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { GuestAccountService, type GuestAccount } from '@/features/auth/services/guestAccountService';
import { useRouter } from 'next/navigation';
import { cleanAuthParams } from '@/lib/urlParams';

interface GuestDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onSignIn?: () => void;
}

type DangerAction = 'delete-pins' | 'delete-account' | 'start-fresh' | null;

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
  const [pendingAction, setPendingAction] = useState<DangerAction>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load guest data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadGuestData();
    }
  }, [isOpen]);

  const loadGuestData = async () => {
    setIsLoading(true);
    try {
      const guestId = GuestAccountService.getGuestId();
      const name = GuestAccountService.getGuestName() || '';
      setGuestName(name);

      // Try to get guest account from database
      const account = await GuestAccountService.getGuestAccountByGuestId(guestId);
      if (account) {
        setGuestAccount(account);
        const stats = await GuestAccountService.getGuestAccountStats(account.id);
        setPinCount(stats?.pin_count || 0);
      } else {
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
      
      // Create/update guest account in Supabase
      const account = await GuestAccountService.getOrCreateGuestAccount();
      setGuestAccount(account);
      await loadGuestData();
      
      setIsEditingName(false);
      
      // Notify parent if profile is now complete
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

  const handleDeleteAllPins = async () => {
    setIsProcessing(true);
    try {
      const result = await GuestAccountService.deleteAllPins();
      if (result.success) {
        setPinCount(0);
        setPendingAction(null);
      }
    } catch (error) {
      console.error('[GuestDetailsModal] Error deleting pins:', error);
      alert('Failed to delete pins. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsProcessing(true);
    try {
      await GuestAccountService.deleteAccount();
      window.location.reload();
    } catch (error) {
      console.error('[GuestDetailsModal] Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleStartFresh = async () => {
    setIsProcessing(true);
    try {
      await GuestAccountService.startFresh(true);
      window.location.reload();
    } catch (error) {
      console.error('[GuestDetailsModal] Error starting fresh:', error);
      alert('Failed to start fresh. Please try again.');
      setIsProcessing(false);
    }
  };

  const confirmAction = () => {
    switch (pendingAction) {
      case 'delete-pins':
        handleDeleteAllPins();
        break;
      case 'delete-account':
        handleDeleteAccount();
        break;
      case 'start-fresh':
        handleStartFresh();
        break;
    }
  };

  if (!isOpen) return null;

  // Check if profile is complete (has a name that's not "Guest")
  const isProfileComplete = guestName && guestName.trim() && guestName !== 'Guest';
  const buttonDisabled = isSaving || !guestName?.trim() || guestName === 'Guest';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto" />
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
                        if (e.key === 'Enter' && !buttonDisabled) {
                          handleSaveName();
                        }
                      }}
                      placeholder="Enter your name"
                      className="flex-1 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={buttonDisabled}
                      className="px-3 py-[10px] text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : <CheckIcon className="w-3 h-3" />}
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
              {pinCount !== null && pinCount > 0 && (
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
                  You&apos;re browsing as a guest. Your pins and activity are saved locally. 
                  Sign in to access additional features.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {!isProfileComplete ? (
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
                  >
                    Set Your Name
                  </button>
                ) : isEditingName ? (
                  <button
                    onClick={handleSaveName}
                    disabled={buttonDisabled}
                    className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save & Complete'}
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
                  >
                    Close
                  </button>
                )}
                
                {/* Sign In Button */}
                {onSignIn && (
                  <button
                    onClick={() => {
                      cleanAuthParams(router);
                      onSignIn();
                      onClose();
                    }}
                    className="w-full px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Sign In / Sign Up
                  </button>
                )}
                
                {/* Data Management Actions */}
                {isProfileComplete && guestAccount && (
                  <div className="pt-2 border-t border-gray-200 space-y-1.5">
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                      Data Management
                    </p>
                    
                    {/* Delete All Pins */}
                    {pinCount !== null && pinCount > 0 && (
                      <button
                        onClick={() => setPendingAction('delete-pins')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <TrashIcon className="w-3 h-3" />
                        Delete All Pins ({pinCount})
                      </button>
                    )}
                    
                    {/* Start Fresh - New ID */}
                    <button
                      onClick={() => setPendingAction('start-fresh')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <ArrowPathIcon className="w-3 h-3" />
                      Start Fresh (New Guest ID)
                    </button>
                    
                    {/* Delete Account */}
                    <button
                      onClick={() => setPendingAction('delete-account')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon className="w-3 h-3" />
                      Delete Account
                    </button>
                  </div>
                )}
              </div>

              {/* Confirmation Dialog */}
              {pendingAction && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md space-y-2">
                  <p className="text-xs font-medium text-red-900">
                    {pendingAction === 'delete-pins' && 'Delete all pins?'}
                    {pendingAction === 'delete-account' && 'Delete your guest account?'}
                    {pendingAction === 'start-fresh' && 'Start fresh with a new account?'}
                  </p>
                  <p className="text-xs text-red-700">
                    {pendingAction === 'delete-pins' && (
                      <>This will permanently delete all {pinCount} pins. Your account and guest ID will be kept.</>
                    )}
                    {pendingAction === 'delete-account' && (
                      <>This will permanently delete your account and all {pinCount || 0} pins. This cannot be undone.</>
                    )}
                    {pendingAction === 'start-fresh' && (
                      <>This will delete your current account and all pins, then create a new guest profile.</>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmAction}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setPendingAction(null)}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
