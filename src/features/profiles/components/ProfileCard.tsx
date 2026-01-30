'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserIcon, ArrowUpTrayIcon, EyeIcon, Cog6ToothIcon, MapIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName, formatJoinDate, TRAIT_OPTIONS } from '@/types/profile';
import { AccountService } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import SeeProfileImageModal from './SeeProfileImageModal';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';

interface ProfileCardProps {
  account: ProfileAccount;
  isOwnProfile: boolean;
  showViewProfile?: boolean;
  hideTopSection?: boolean;
  /** Show action buttons (View Profile, Settings) - default true for own profile */
  showActionButtons?: boolean;
  /** Show quick stats section - default true for own profile */
  showQuickStats?: boolean;
  /** Quick stats data (optional, will fetch if not provided) */
  quickStats?: {
    mapsCount?: number;
    mentionsCount?: number;
  };
}

export default function ProfileCard({ 
  account: initialAccount, 
  isOwnProfile, 
  showViewProfile = true, 
  hideTopSection = false,
  showActionButtons = isOwnProfile,
  showQuickStats = isOwnProfile,
  quickStats,
}: ProfileCardProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [account, setAccount] = useState<ProfileAccount>(initialAccount);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isProfileImageModalOpen, setIsProfileImageModalOpen] = useState(false);
  
  // Hide "View Profile" button if we're already on this account's profile page (/:username)
  const isOnProfilePage = !!(account?.username && pathname === `/${account.username}`);
  
  const coverInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  // Update local state when prop changes
  useEffect(() => {
    setAccount(initialAccount);
  }, [initialAccount]);

  const displayName = getDisplayName(account);
  const joinDate = formatJoinDate(account.created_at);
  
  // Get selected trait labels (only show selected traits)
  const selectedTraits = account.traits
    ? account.traits
        .map(traitId => TRAIT_OPTIONS.find(opt => opt.id === traitId))
        .filter(Boolean)
    : [];

  const handleImageUpload = async (
    file: File,
    field: 'image_url' | 'cover_image_url',
    setIsUploading: (value: boolean) => void
  ) => {
    if (!user) return;

    setIsUploading(true);
    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        showError('Error', 'Please select a valid image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showError('Error', 'Image must be smaller than 5MB');
        return;
      }

      // Determine bucket and path
      const bucket = field === 'cover_image_url' ? 'cover-photos' : 'profile-images';
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/accounts/${field}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL');
      }

      // Update account
      const updatedAccount = await AccountService.updateCurrentAccount({
        [field]: urlData.publicUrl,
      }, account.id);

      setAccount(updatedAccount);
      success('Updated', `${field === 'cover_image_url' ? 'Cover' : 'Profile'} image updated`);
    } catch (err) {
      console.error(`Error uploading ${field}:`, err);
      showError('Error', `Failed to upload ${field === 'cover_image_url' ? 'cover' : 'profile'} image`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAccountUpdate = (updatedAccount: ProfileAccount) => {
    setAccount(updatedAccount);
  };

  return (
    <>
      <div className="space-y-3 relative">
        {/* Profile Photo and Name/Username - Above Cover */}
        {!hideTopSection && (
          <div className="flex items-center gap-2">
            <div className={`relative w-14 h-14 rounded-full bg-gray-100 overflow-hidden group flex-shrink-0 ${getPaidPlanBorderClasses(account.plan)} ${!isOwnProfile && account.image_url ? 'cursor-pointer' : ''}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-white">
                {account.image_url ? (
                  <Image
                    src={account.image_url}
                    alt={displayName}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover rounded-full"
                    unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-full">
                    <UserIcon className="w-7 h-7 text-gray-400" />
                  </div>
                )}
              </div>
              {isOwnProfile ? (
                <>
                  <input
                    ref={profileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'image_url', setIsUploadingProfile);
                    }}
                  />
                  <button
                    onClick={() => profileInputRef.current?.click()}
                    disabled={isUploadingProfile}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100 rounded-full disabled:opacity-50"
                  >
                    {isUploadingProfile ? (
                      <div className="text-[10px] text-white">...</div>
                    ) : (
                      <ArrowUpTrayIcon className="w-3 h-3 text-white" />
                    )}
                  </button>
                </>
              ) : account.image_url ? (
                <button
                  onClick={() => setIsProfileImageModalOpen(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100 rounded-full"
                >
                  <EyeIcon className="w-4 h-4 text-white" />
                </button>
              ) : null}
            </div>
            
            {/* Name and Username - To the right of profile image */}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 leading-tight truncate">
                {displayName}
              </h1>
              {account.username && (
                <p className="text-xs text-gray-500 truncate">@{account.username}</p>
              )}
            </div>
          </div>
        )}

        {/* Cover Image */}
        <div className="relative h-32 bg-gradient-to-r from-gray-800 to-gray-900 rounded-md overflow-hidden group">
          {account.cover_image_url ? (
            <Image
              src={account.cover_image_url}
              alt="Cover"
              fill
              className="object-cover"
              unoptimized={account.cover_image_url.includes('supabase.co')}
            />
          ) : null}
          {isOwnProfile && (
            <>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, 'cover_image_url', setIsUploadingCover);
                }}
              />
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                {isUploadingCover ? (
                  <div className="text-xs text-white">Uploading...</div>
                ) : (
                  <ArrowUpTrayIcon className="w-4 h-4 text-white" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Account Plan */}
        {account.plan && (
          <div className="pt-2">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
              {account.plan === 'contributor' ? '⭐ Contributor' : account.plan === 'plus' ? '⭐ Plus' : account.plan}
            </span>
          </div>
        )}

        {/* Bio */}
        {account.bio && (
          <p className="text-xs text-gray-600 leading-relaxed">{account.bio}</p>
        )}

        {/* Traits */}
        <div className="pt-1">
          <div className="flex flex-wrap gap-1 items-center">
            {selectedTraits.length > 0 ? (
              selectedTraits.filter(Boolean).map((trait) => (
                <span
                  key={trait!.id}
                  className="px-1.5 py-0.5 bg-white border border-gray-200 text-[10px] text-gray-900 rounded"
                >
                  {trait!.label}
                </span>
              ))
            ) : (
              isOwnProfile ? (
                <span className="text-[10px] text-gray-500">Let other Minnesotans know your vibe</span>
              ) : (
                <span className="text-[10px] text-gray-400">No traits selected</span>
              )
            )}
          </div>
        </div>

        {/* Quick Stats (own profile only) — card style.
            Views: accounts.view_count; Maps: maps owned; Mentions: pins on live map. */}
        {showQuickStats && isOwnProfile && (
          <div className="border border-gray-200 rounded-md bg-gray-50 p-[10px]">
            <div className="grid grid-cols-3 gap-2">
              {account.view_count !== undefined && (
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-900">
                    {account.view_count.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500">Views</div>
                </div>
              )}
              {quickStats?.mapsCount !== undefined && (
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-900">
                    {quickStats.mapsCount}
                  </div>
                  <div className="text-[10px] text-gray-500">Maps</div>
                </div>
              )}
              {quickStats?.mentionsCount !== undefined && (
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-900">
                    {quickStats.mentionsCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500">Mentions</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Join Date */}
        <div className="text-[10px] text-gray-500">
          Joined {joinDate}
        </div>

        {/* Action Buttons */}
        {showActionButtons && isOwnProfile && account.username && !isOnProfilePage && (
          <div className="pt-2 space-y-2 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-2">
              {/* View Profile Button */}
              <Link
                href={`/${account.username}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors"
              >
                <EyeIcon className="w-3 h-3" />
                <span>View Profile</span>
              </Link>
              
              {/* Account Settings Button */}
              <Link
                href="/settings"
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Cog6ToothIcon className="w-3 h-3" />
                <span>Settings</span>
              </Link>
            </div>
          </div>
        )}

        {/* Legacy View Profile Button (for non-own profiles) */}
        {showViewProfile && !isOwnProfile && account.username && !isOnProfilePage && (
          <div className="pt-3 mt-3 border-t border-gray-200">
            <Link
              href={`/${account.username}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
            >
              <span>View Profile</span>
              <ArrowUpTrayIcon className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Profile Image View Modal */}
      {!isOwnProfile && account.image_url && (
        <SeeProfileImageModal
          isOpen={isProfileImageModalOpen}
          onClose={() => setIsProfileImageModalOpen(false)}
          imageUrl={account.image_url}
          displayName={displayName}
          username={account.username}
        />
      )}
    </>
  );
}
