'use client';

import { useState } from 'react';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import CreateAccountClient from './CreateAccountClient';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateAccountModal({ isOpen, onClose }: CreateAccountModalProps) {
  const { refreshAccount } = useAuthStateSafe();
  const [showWelcome, setShowWelcome] = useState(false);

  const handleClose = () => {
    if (!showWelcome) {
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-[10px]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={showWelcome ? handleClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-md border border-gray-200 flex flex-col">
        {/* Header - Hide when welcome screen is shown */}
        {!showWelcome && (
          <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="For the Love of Minnesota"
                  width={24}
                  height={24}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold text-gray-900">Create New Account</h2>
                <p className="text-[10px] text-gray-500">Set up a new account profile</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[10px]">
          <CreateAccountClient 
            onWelcomeShown={() => setShowWelcome(true)}
            onComplete={async () => {
              // Refresh account data after completion
              try {
                // Refresh auth state first to ensure account is updated
                if (refreshAccount) {
                  await refreshAccount();
                }

                // Dispatch custom event to notify AccountDropdown to refresh
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('account-created', {
                    detail: { timestamp: Date.now() }
                  }));
                }

                // Close the modal after a brief delay
                setTimeout(() => {
                  onClose();
                }, 500);
              } catch (error) {
                console.error('Error refreshing account after completion:', error);
                // Still close even if refresh fails
                setTimeout(() => {
                  onClose();
                }, 500);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

