'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { UserIcon } from '@heroicons/react/24/outline';
import { Account, AccountService } from '@/features/auth';
import { useAuth } from '@/features/auth';
import { supabase } from '@/lib/supabase';

interface AccountViewsCardProps {
  account?: Account | null;
}

export default function AccountViewsCard({ account }: AccountViewsCardProps) {
  const { user } = useAuth();
  
  // Use city string directly from account (no need to fetch)
  const cityName = account?.city || null;

  if (!user || !account) {
    return null;
  }

  const displayName = AccountService.getDisplayName(account) || 'User';
  const profileImage = account?.image_url || null;
  const bio = account?.bio || null;
  const coverImage = (account as { cover_image_url?: string | null })?.cover_image_url || null;

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {/* Cover Image/Banner */}
      <div className="h-16 bg-gray-100 relative overflow-hidden">
        {coverImage && (
          <Image
            src={coverImage}
            alt="Cover"
            fill
            className="object-cover"
            unoptimized={coverImage.includes('supabase.co')}
          />
        )}
      </div>

      {/* Profile Content - Compact Layout */}
      <div className="p-[10px]">
        {/* Profile Photo - Overlapping Cover */}
        <div className="relative -mt-8 mb-2">
          <div className="w-14 h-14 rounded-full bg-gray-100 border border-white overflow-hidden">
            {profileImage ? (
              <Image
                src={profileImage}
                alt={displayName}
                width={56}
                height={56}
                className="w-full h-full object-cover"
                unoptimized={profileImage.startsWith('data:') || profileImage.includes('supabase.co')}
              />
            ) : (
              <div className="w-14 h-14 bg-gray-200 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Profile Info - Left Aligned, Vertical Stack */}
        <div className="space-y-0.5">
          <Link href="/account/settings" className="block hover:opacity-90 transition-opacity">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-gray-900">
                {displayName}
              </h3>
              {account?.plan === 'pro' && (
                <span className="px-1.5 py-0.5 bg-[#D4AF37] text-white text-[10px] font-semibold rounded uppercase tracking-wide" title="Pro Member">
                  Pro
                </span>
              )}
            </div>
          </Link>
          {bio && (
            <p className="text-xs text-gray-600 line-clamp-2">
              {bio}
            </p>
          )}
          {cityName && (
            <p className="text-xs text-gray-500">
              {cityName}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Profile Viewers Section */}
      <div className="px-[10px] py-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Profile viewers</span>
          <Link href="/account/analytics" className="text-xs font-medium text-gray-700 hover:text-gray-900">
            0
          </Link>
        </div>
        <Link 
          href="/account/analytics"
          className="text-xs text-gray-600 hover:text-gray-900 hover:underline mt-0.5 block"
        >
          View all analytics
        </Link>
      </div>
    </div>
  );
}

