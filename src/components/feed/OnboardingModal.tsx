'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth, AccountService, Account } from '@/features/auth';
import { isAccountComplete } from '@/lib/accountCompleteness';
import { checkOnboardingStatus } from '@/lib/onboardingCheck';
import OnboardingClient from '@/app/account/onboarding/OnboardingClient';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountComplete, setAccountComplete] = useState(true);

  // Fetch account data when modal opens - use centralized check
  useEffect(() => {
    if (isOpen && user) {
      const fetchAccount = async () => {
        setLoading(true);
        try {
          // Use centralized onboarding check (ensures account exists)
          const { account: accountData } = await checkOnboardingStatus();
          setAccount(accountData);
          const complete = accountData ? isAccountComplete(accountData) : false;
          setAccountComplete(complete);
        } catch (error) {
          console.error('Error fetching account data:', error);
          setAccountComplete(false);
        } finally {
          setLoading(false);
        }
      };

      fetchAccount();
    } else if (isOpen && !user) {
      // If no user, close modal (shouldn't happen, but handle gracefully)
      onClose();
    }
  }, [isOpen, user, onClose]);

  // Prevent closing if account is incomplete
  const handleClose = () => {
    if (!accountComplete) {
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-[10px]">
      {/* Backdrop - No click to close if incomplete */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={accountComplete ? handleClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-md border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="MNUDA"
                width={24}
                height={24}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold text-gray-900">Complete Your Profile</h2>
              {!accountComplete && (
                <p className="text-[10px] text-gray-500">Please complete your profile to continue</p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={!accountComplete}
            className={`p-1 transition-colors ${
              accountComplete 
                ? 'text-gray-500 hover:text-gray-700' 
                : 'text-gray-300 cursor-not-allowed'
            }`}
            aria-label="Close"
            title={!accountComplete ? 'Please complete your profile to continue' : 'Close'}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[10px]">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : (
            <OnboardingClient 
              initialAccount={account} 
              redirectTo={undefined}
              onComplete={async () => {
                // Refresh account data after completion
                try {
                  const accountData = await AccountService.getCurrentAccount();
                  setAccount(accountData);
                  const complete = isAccountComplete(accountData);
                  setAccountComplete(complete);
                  
                  // If now complete, allow closing
                  if (complete) {
                    // Small delay to show success state
                    setTimeout(() => {
                      onClose();
                    }, 500);
                  }
                } catch (error) {
                  console.error('Error refreshing account after completion:', error);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
