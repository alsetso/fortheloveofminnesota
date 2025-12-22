'use client';

import Image from 'next/image';
import { UserIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName, formatJoinDate, TRAIT_OPTIONS } from '@/types/profile';

interface ProfileCardProps {
  account: ProfileAccount;
  isOwnProfile: boolean;
}

export default function ProfileCard({ account, isOwnProfile }: ProfileCardProps) {
  const displayName = getDisplayName(account);
  const joinDate = formatJoinDate(account.created_at);
  
  // Get trait labels
  const traitLabels = account.traits
    ? account.traits
        .map(traitId => TRAIT_OPTIONS.find(opt => opt.id === traitId)?.label)
        .filter(Boolean)
    : [];

  return (
    <div className="space-y-3">
      {/* Cover Image */}
      <div className="relative h-32 bg-gradient-to-r from-gray-800 to-gray-900 rounded-md overflow-hidden">
        {account.cover_image_url ? (
          <Image
            src={account.cover_image_url}
            alt="Cover"
            fill
            className="object-cover"
            unoptimized={account.cover_image_url.includes('supabase.co')}
          />
        ) : null}
      </div>

      {/* Profile Photo - Overlapping Cover */}
      <div className="relative -mt-12">
        <div className="w-14 h-14 rounded-full bg-gray-100 border-2 border-white overflow-hidden">
          {account.image_url ? (
            <Image
              src={account.image_url}
              alt={displayName}
              width={56}
              height={56}
              className="w-full h-full object-cover"
              unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <UserIcon className="w-7 h-7 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Name and Username */}
      <div>
        <h1 className="text-sm font-semibold text-gray-900 leading-tight">
          {displayName}
        </h1>
        {account.username && (
          <p className="text-xs text-gray-500">@{account.username}</p>
        )}
      </div>

      {/* Bio */}
      {account.bio && (
        <div>
          <p className="text-xs text-gray-600 leading-relaxed">{account.bio}</p>
        </div>
      )}

      {/* Join Date */}
      <div className="text-[10px] text-gray-500">
        Joined {joinDate}
      </div>

      {/* Contact Info - Only for own profile */}
      {isOwnProfile && (
        <div className="space-y-1.5 pt-2">
          {account.email && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <EnvelopeIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span>{account.email}</span>
            </div>
          )}
          {account.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <PhoneIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span>{account.phone}</span>
            </div>
          )}
        </div>
      )}

        {/* Traits */}
        {traitLabels.length > 0 && (
          <div className="pt-2">
            <div className="flex flex-wrap gap-1.5">
              {traitLabels.map((label, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-black/20 text-xs text-gray-900 rounded"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}


