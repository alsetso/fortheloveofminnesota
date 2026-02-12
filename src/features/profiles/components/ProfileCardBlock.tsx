'use client';

import Image from 'next/image';
import Link from 'next/link';
import { UserIcon, MapPinIcon, CalendarIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName, formatJoinDate, TRAIT_OPTIONS } from '@/types/profile';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';
import PostContent from '@/components/posts/PostContent';

export interface ProfileCardBlockProps {
  account: ProfileAccount;
  cityName?: string | null;
  isOwnProfile: boolean;
  isProfileOwner?: boolean;
  /** Follow/Following button (or null if not applicable). */
  followSlot: React.ReactNode;
  showEditLink?: boolean;
  /** When true, omit outer border (e.g. in mobile slide-down sheet). */
  noBorder?: boolean;
}

/**
 * Presentational profile card used in left sidebar and mobile slide-down sheet.
 * Matches the sidebar card: cover strip, avatar, name, username, location, joined, follow slot, bio, traits, edit link.
 */
export default function ProfileCardBlock({
  account,
  cityName,
  isOwnProfile,
  isProfileOwner,
  followSlot,
  showEditLink = false,
  noBorder = false,
}: ProfileCardBlockProps) {
  const displayName = getDisplayName(account);
  const joinDate = formatJoinDate(account.created_at);
  const selectedTraits = account.traits
    ? account.traits
        .map((traitId) => TRAIT_OPTIONS.find((opt) => opt.id === traitId))
        .filter(Boolean)
    : [];

  return (
    <div className={`rounded-md bg-white dark:bg-surface overflow-hidden flex-shrink-0 ${noBorder ? '' : 'border border-gray-200 dark:border-white/10'}`}>
      <div className="relative h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
        {account.cover_image_url ? (
          <Image
            src={account.cover_image_url}
            alt=""
            fill
            className="object-cover"
            unoptimized={account.cover_image_url.includes('supabase.co')}
          />
        ) : null}
      </div>
      <div className="p-3 -mt-8 relative">
        <div
          className={`relative w-14 h-14 rounded-full bg-surface border-2 border-white dark:border-surface overflow-hidden flex-shrink-0 ${getPaidPlanBorderClasses(account.plan)}`}
        >
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
              <UserIcon className="w-7 h-7 text-foreground-muted" />
            </div>
          )}
        </div>
        <h2 className="text-sm font-semibold text-foreground mt-2 truncate">{displayName}</h2>
        {account.username && (
          <p className="text-xs text-foreground-muted truncate">@{account.username}</p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-foreground-muted">
          {cityName && (
            <span className="flex items-center gap-0.5">
              <MapPinIcon className="w-3 h-3" />
              {cityName}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <CalendarIcon className="w-3 h-3" />
            Joined {joinDate}
          </span>
        </div>
        {followSlot ? <div className="mt-2">{followSlot}</div> : null}
        {account.bio && (
          <div className="text-xs text-foreground-muted mt-1.5 whitespace-pre-wrap break-words">
            <PostContent
              content={account.bio.length > 240 ? `${account.bio.slice(0, 240)}…` : account.bio}
              linkUnresolvedMentions
            />
          </div>
        )}
        {selectedTraits.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedTraits.slice(0, 4).map((t) => (
              <span
                key={t!.id}
                className="px-2 py-0.5 bg-surface border border-border-muted dark:border-white/10 text-[10px] font-medium text-foreground rounded-full"
              >
                {t!.label}
              </span>
            ))}
          </div>
        )}
        {showEditLink && (
          <Link
            href="/settings/account"
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-lake-blue hover:text-lake-blue/80 transition-colors"
          >
            <PencilSquareIcon className="w-3.5 h-3.5" />
            Edit profile
          </Link>
        )}
      </div>
    </div>
  );
}
