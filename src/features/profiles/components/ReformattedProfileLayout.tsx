'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { UserIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName, formatJoinDate, TRAIT_OPTIONS } from '@/types/profile';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';

interface ReformattedProfileLayoutProps {
  account: ProfileAccount;
  isOwnProfile: boolean;
  children: ReactNode;
  cityName?: string | null;
}

export default function ReformattedProfileLayout({
  account,
  isOwnProfile,
  children,
  cityName,
}: ReformattedProfileLayoutProps) {
  const displayName = getDisplayName(account);
  const joinDate = formatJoinDate(account.created_at);
  
  // Get selected trait labels
  const selectedTraits = account.traits
    ? account.traits
        .map(traitId => TRAIT_OPTIONS.find(opt => opt.id === traitId))
        .filter(Boolean)
    : [];

  return (
    <div className="w-full">
      {/* Cover Image Section */}
      <div className="relative w-full h-48 md:h-64 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 overflow-hidden">
        {account.cover_image_url ? (
          <Image
            src={account.cover_image_url}
            alt={`${displayName}'s cover`}
            fill
            className="object-cover"
            priority
            unoptimized={account.cover_image_url.includes('supabase.co')}
          />
        ) : null}
        
        {/* Profile Image - Positioned over cover */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-surface border-4 border-surface overflow-hidden ${getPaidPlanBorderClasses(account.plan)}`}>
            {account.image_url ? (
              <Image
                src={account.image_url}
                alt={displayName}
                fill
                className="object-cover"
                unoptimized={account.image_url.includes('supabase.co')}
              />
            ) : (
              <div className="w-full h-full bg-surface-accent flex items-center justify-center">
                <UserIcon className="w-12 h-12 md:w-16 md:h-16 text-foreground-muted" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Content Section */}
      <div className="pt-16 md:pt-20 px-4 sm:px-6 lg:px-8 pb-6 max-w-4xl mx-auto">
        {/* Header Info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
            {displayName}
          </h1>
          {account.username && (
            <p className="text-sm md:text-base text-foreground-muted mb-3">
              @{account.username}
            </p>
          )}

          {/* Meta Info Row */}
          <div className="flex items-center justify-center gap-4 flex-wrap text-xs md:text-sm text-foreground-muted mb-4">
            {cityName && (
              <div className="flex items-center gap-1.5">
                <MapPinIcon className="w-4 h-4" />
                <span>{cityName}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4" />
              <span>Joined {joinDate}</span>
            </div>
            {account.view_count !== undefined && account.view_count > 0 && (
              <div className="flex items-center gap-1.5">
                <span>{account.view_count.toLocaleString()} views</span>
              </div>
            )}
          </div>

          {/* Bio */}
          {account.bio && (
            <p className="text-sm md:text-base text-foreground-muted leading-relaxed max-w-2xl mx-auto mb-4">
              {account.bio}
            </p>
          )}

          {/* Traits */}
          {selectedTraits.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {selectedTraits.map((trait) => (
                <span
                  key={trait!.id}
                  className="px-3 py-1.5 bg-surface border border-border-muted dark:border-white/10 text-xs font-medium text-foreground rounded-full"
                >
                  {trait!.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
