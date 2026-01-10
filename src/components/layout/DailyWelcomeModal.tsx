'use client';

import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { getDisplayName } from '@/types/profile';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface DailyWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  useBlurStyle?: boolean;
  showTextOnly?: boolean;
}

export default function DailyWelcomeModal({ isOpen, onClose, useBlurStyle = false, showTextOnly = false }: DailyWelcomeModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { account, isLoading: authLoading } = useAuthStateSafe();

  useEffect(() => {
    if (isOpen) {
      // Don't prevent body scroll for toast-like behavior
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transform = 'translateY(0)';
        }
      });
    }
  }, [isOpen]);

  const handleClose = () => {
    if (sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(-100%)';
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!isOpen) return null;
  
  // Wait for account to load (don't show if still loading or no account)
  if (authLoading || !account) {
    return null;
  }

  const displayName = getDisplayName(account);

  return (
    <>
      {/* Sheet - positioned at top right, toast-like */}
      <div
        ref={sheetRef}
        className={`fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col pointer-events-none
          /* Top right positioning, auto width */
          top-4 right-4 left-auto w-auto max-w-fit rounded-md
          ${useBlurStyle ? 'bg-transparent backdrop-blur-md' : 'bg-white'}`}
        style={{
          transform: 'translateY(calc(-100% - 1rem))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Content - compact toast style */}
        <div className="p-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            {!showTextOnly && <ProfilePhoto account={account} size="sm" editable={false} />}
            <div className="min-w-0">
              <h3 className={`text-xs font-semibold whitespace-nowrap ${useBlurStyle ? 'text-white' : 'text-gray-900'}`}>
                Welcome back, {displayName.split(' ')[0]}
              </h3>
            </div>
            {!showTextOnly && (
              <button
                onClick={handleClose}
                className={`flex-shrink-0 p-0.5 transition-colors rounded ${
                  useBlurStyle 
                    ? 'text-white/80 hover:text-white hover:bg-white/10' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="Close"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

