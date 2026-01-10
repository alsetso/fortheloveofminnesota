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

  // Calculate position: search input container is at top-3 (12px)
  // Search input has py-2 (8px top/bottom) + content height (~32px) = ~48px total
  // Bottom row has space-y-1.5 (6px gap) below search
  // Bottom row starts at: 12px (top-3) + 48px (search height) + 6px (gap) = 66px
  // Map settings button is in bottom row, so align toast at same vertical position
  const topPosition = '4.125rem'; // 66px = 4.125rem

  return (
    <>
      {/* Sheet - positioned below search input, across from map settings */}
      <div
        ref={sheetRef}
        className={`fixed z-[60] shadow-lg transition-all duration-300 ease-out flex flex-col pointer-events-none
          /* Positioned below search input, on the right side, aligned with map settings */
          right-3 left-auto w-auto max-w-fit rounded-md
          ${useBlurStyle ? 'bg-transparent backdrop-blur-md border-2 border-transparent' : 'bg-white border border-gray-200'}`}
        style={{
          top: topPosition,
          transform: 'translateY(calc(-100% - 1rem))',
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

