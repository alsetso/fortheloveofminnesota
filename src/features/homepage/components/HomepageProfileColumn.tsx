'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useAccountData } from '@/features/account/hooks/useAccountData';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName } from '@/types/profile';

export default function HomepageProfileColumn() {
  const { account, userEmail } = useAccountData(true, 'profile');

  // Convert Account to ProfileAccount format
  const profileAccount: ProfileAccount | null = useMemo(() => {
    if (!account) return null;
    
    return {
      id: account.id,
      username: account.username,
      first_name: account.first_name,
      last_name: account.last_name,
      email: userEmail,
      phone: account.phone,
      image_url: account.image_url,
      cover_image_url: account.cover_image_url,
      bio: account.bio,
      city_id: account.city_id,
      view_count: account.view_count || 0,
      traits: account.traits,
      user_id: account.user_id,
      created_at: account.created_at,
    };
  }, [account, userEmail]);

  if (!profileAccount) {
    return (
      <div className="bg-gray-100 border border-gray-200 rounded-md p-2">
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Sign in to view your profile</p>
        </div>
      </div>
    );
  }

  const displayName = getDisplayName(profileAccount);
  const profileLink = profileAccount.username 
    ? `/profile/${profileAccount.username}` 
    : null;

  return (
    <div className="space-y-2">
      {/* Profile Card */}
      <div className="bg-gray-100 border border-gray-200 rounded-md p-2 space-y-2">
        {/* Profile Image and Name */}
        <div className="flex items-center gap-2">
          {profileAccount.image_url ? (
            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
              <Image
                src={profileAccount.image_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="40px"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border border-gray-200">
              <span className="text-xs font-medium text-gray-500">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">
              {displayName}
            </p>
            {profileAccount.username && (
              <p className="text-[10px] text-gray-500 truncate">
                @{profileAccount.username}
              </p>
            )}
          </div>
        </div>

        {/* Bio */}
        {profileAccount.bio && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {profileAccount.bio}
          </p>
        )}

        {/* View Profile Link */}
        {profileLink && (
          <Link
            href={profileLink}
            className="block w-full px-2 py-1.5 text-xs font-medium text-center text-gray-700 bg-white hover:bg-gray-50 rounded border border-gray-200 transition-colors"
          >
            View Profile
          </Link>
        )}
      </div>

      {/* 2026 Elections Section */}
      <div className="bg-white border border-gray-200 rounded-md p-2 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <BuildingOfficeIcon className="w-3 h-3 text-gray-700" />
            <h3 className="text-xs font-semibold text-gray-900">2026 Elections</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            2026 is an important year for Minnesota government elections. Stay informed about candidates, voting, and how government works.
          </p>
        </div>
        <Link
          href="/gov"
          className="block w-full px-2 py-1.5 text-xs font-medium text-center text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
        >
          View Minnesota Gov
        </Link>
      </div>
    </div>
  );
}

