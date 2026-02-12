'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { UserIcon } from '@heroicons/react/24/outline';
import ProfileCardBlock from './ProfileCardBlock';
import ViewAsSelector from './ViewAsSelector';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName } from '@/types/profile';

const MOBILE_BREAKPOINT_PX = 656;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return isMobile;
}

export interface ProfileCardSlideDownProps {
  account: ProfileAccount;
  cityName?: string | null;
  isOwnProfile: boolean;
  isProfileOwner?: boolean;
  followSlot: React.ReactNode;
  /** When true, map click drops a temp pin and opens create-pin modal (owner only). */
  dropPinMode?: boolean;
  onDropPinModeChange?: (active: boolean) => void;
}

/**
 * iOS-style slide-down sheet for the profile card on mobile.
 * Renders inside the map container: trigger bar at top overlaying the map; sheet slides down from top when opened.
 */
export default function ProfileCardSlideDown({
  account,
  cityName,
  isOwnProfile,
  isProfileOwner,
  followSlot,
  dropPinMode = true,
  onDropPinModeChange,
}: ProfileCardSlideDownProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const displayName = getDisplayName(account);

  const close = useCallback(() => setOpen(false), []);

  if (!isMobile) return null;

  return (
    <>
      {/* Trigger: bar at top of map, overlaying */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-3 py-2.5 bg-white/95 dark:bg-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shadow-sm rounded-b-lg mx-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          aria-label="Open profile"
        >
          <div className="relative w-10 h-10 rounded-full bg-surface-accent dark:bg-white/10 overflow-hidden flex-shrink-0">
            {account.image_url ? (
              <Image
                src={account.image_url}
                alt=""
                fill
                className="object-cover"
                unoptimized={account.image_url.includes('supabase.co')}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-foreground-muted" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate block">{displayName}</span>
            {account.username && (
              <span className="text-xs text-foreground-muted truncate block">@{account.username}</span>
            )}
          </div>
        </button>
        {isProfileOwner && !open && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDropPinModeChange?.(!dropPinMode);
            }}
            className={`flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              dropPinMode
                ? 'bg-lake-blue text-white'
                : 'border border-gray-200 dark:border-white/20 text-foreground-muted'
            }`}
            aria-pressed={dropPinMode}
            aria-label={dropPinMode ? 'Drop Pin mode' : 'Draw Area mode'}
          >
            {dropPinMode ? 'Drop Pin' : 'Draw Area'}
          </button>
        )}
        <span className="text-foreground-muted flex-shrink-0 pointer-events-none" aria-hidden>
          ▼
        </span>
      </div>

      {/* Backdrop */}
      <div
        role="presentation"
        className={`absolute inset-0 z-20 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={close}
      />

      {/* Sheet: slides down from top, overlaying map; handle at bottom so user can push up to close */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex flex-col max-h-[85vh] rounded-b-2xl bg-white dark:bg-surface shadow-xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : '-translate-y-full'
        }`}
        aria-modal="true"
        aria-label="Profile"
      >
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 pt-4 space-y-3">
          {isProfileOwner && (
            <div className="flex-shrink-0 space-y-1">
              <p className="text-[10px] text-foreground-muted">Only you can see this</p>
              <div className="flex items-start gap-2 flex-wrap">
                <ViewAsSelector visible darkText />
                <p className="text-[10px] text-foreground-muted min-w-0 flex-1">
                  Your profile will show collections and pins list in the left sidebar on desktop.{' '}
                  <Link href="/settings" className="text-lake-blue hover:underline font-medium">
                    Manage settings
                  </Link>
                </p>
              </div>
            </div>
          )}
          <ProfileCardBlock
            account={account}
            cityName={cityName}
            isOwnProfile={isOwnProfile}
            isProfileOwner={isProfileOwner}
            followSlot={followSlot}
            showEditLink={isOwnProfile}
            noBorder
          />
        </div>
        {/* Handle at bottom: push up to close */}
        <button
          type="button"
          onClick={close}
          className="flex-shrink-0 flex justify-center py-3 pb-5 pt-1 touch-manipulation"
          aria-label="Close profile"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/30" aria-hidden />
        </button>
      </div>
    </>
  );
}
