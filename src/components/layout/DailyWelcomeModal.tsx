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
}

export default function DailyWelcomeModal({ isOpen, onClose, useBlurStyle = false }: DailyWelcomeModalProps) {
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
      sheetRef.current.style.transform = 'translateY(100%)';
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
      {/* Sheet - positioned at bottom on mobile and desktop, toast-like */}
      <div
        ref={sheetRef}
        className={`fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col pointer-events-none
          /* Mobile: bottom sheet */
          bottom-4 left-4 right-4 rounded-md
          /* Desktop: bottom sheet with 400px width, left side */
          xl:bottom-4 xl:left-4 xl:right-auto xl:w-[400px] xl:rounded-md
          ${useBlurStyle ? 'bg-transparent backdrop-blur-md' : 'bg-white'}`}
        style={{
          transform: 'translateY(calc(100% + 1rem))',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Content - compact toast style */}
        <div className="p-3 pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <ProfilePhoto account={account} size="sm" editable={false} />
            <div className="flex-1 min-w-0">
              <h3 className={`text-xs font-semibold truncate ${useBlurStyle ? 'text-white' : 'text-gray-900'}`}>
                Welcome back, {displayName.split(' ')[0]}
              </h3>
              <p className={`text-[10px] truncate ${useBlurStyle ? 'text-white/80' : 'text-gray-600'}`}>
                Explore what's happening across Minnesota
              </p>
            </div>
            <button
              onClick={handleClose}
              className={`flex-shrink-0 p-1 transition-colors rounded ${
                useBlurStyle 
                  ? 'text-white/80 hover:text-white hover:bg-white/10' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              aria-label="Close"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

