'use client';

import { useEffect } from 'react';
import { XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useGuestAccountMerge } from '@/features/auth/hooks/useGuestAccountMerge';

interface GuestAccountMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuestAccountMergeModal({
  isOpen,
  onClose,
}: GuestAccountMergeModalProps) {
  const { state, mergeGuestAccount, dismissMerge } = useGuestAccountMerge();

  const handleMerge = async () => {
    try {
      await mergeGuestAccount(true);
      // Wait for merge to complete and state to update
      // The hook will clear hasGuestData when merge is successful
      // Close modal after a brief delay to allow state to update
      setTimeout(() => {
        if (!state.hasGuestData || state.pinCount === 0) {
          onClose();
        }
      }, 300);
    } catch (error) {
      // Error is handled by the hook, just keep modal open
      console.error('[GuestAccountMergeModal] Error merging account:', error);
    }
  };
  
  // Auto-close modal if merge completed successfully
  useEffect(() => {
    if (!state.hasGuestData && state.guestAccount === null && isOpen) {
      // Merge was successful, close modal
      const timeoutId = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [state.hasGuestData, state.guestAccount, isOpen, onClose]);

  const handleDismiss = () => {
    dismissMerge();
    onClose();
  };

  if (!isOpen || !state.hasGuestData || !state.guestAccount) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-md rounded-md bg-white border border-gray-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-[10px]">
          <h2 className="text-sm font-semibold text-gray-900">
            Merge Guest Account
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-600">
            We found {state.pinCount || 0} pin{state.pinCount !== 1 ? 's' : ''} from your guest session.
            Would you like to merge them into your account?
          </p>

          {state.guestAccount && (
            <div className="bg-gray-50 rounded-md p-3 space-y-1">
              <p className="text-xs font-medium text-gray-900">Guest Account</p>
              <p className="text-xs text-gray-600">
                Name: {state.guestAccount.first_name}
              </p>
              {state.pinCount !== null && (
                <p className="text-xs text-gray-600">
                  Pins: {state.pinCount}
                </p>
              )}
            </div>
          )}

          {state.mergeError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-xs text-red-800">{state.mergeError}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleDismiss}
              disabled={state.isMerging}
              className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dismiss
            </button>
            <button
              onClick={handleMerge}
              disabled={state.isMerging || state.pinCount === 0}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {state.isMerging ? (
                'Merging...'
              ) : (
                <>
                  Merge Pins
                  <ArrowRightIcon className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


