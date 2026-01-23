'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserIcon, Cog6ToothIcon, ArrowUpTrayIcon, EyeIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName, formatJoinDate, TRAIT_OPTIONS } from '@/types/profile';
import { AccountService } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import SeeProfileImageModal from './SeeProfileImageModal';

interface ProfileCardProps {
  account: ProfileAccount;
  isOwnProfile: boolean;
  showViewProfile?: boolean;
  hideTopSection?: boolean;
}

export default function ProfileCard({ account: initialAccount, isOwnProfile, showViewProfile = true, hideTopSection = false }: ProfileCardProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [account, setAccount] = useState<ProfileAccount>(initialAccount);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isProfileImageModalOpen, setIsProfileImageModalOpen] = useState(false);
  
  // Hide "View Profile" button if we're already on the profile page
  const isOnProfilePage = pathname?.startsWith('/profile/');
  
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
            <div className={`relative w-14 h-14 rounded-full bg-gray-100 overflow-hidden group flex-shrink-0 ${
              (account.plan === 'contributor' || account.plan === 'plus')
                ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                : 'border border-gray-200'
            } ${!isOwnProfile && account.image_url ? 'cursor-pointer' : ''}`}>
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
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-gray-500">Let other Minnesotans know your vibe</span>
                  <Link
                    href="/settings"
                    className="px-1.5 py-0.5 text-[10px] font-medium text-gray-900 hover:bg-gray-100 rounded transition-colors border border-gray-300"
                  >
                    +add traits
                  </Link>
                </div>
              ) : (
                <span className="text-[10px] text-gray-400">No traits selected</span>
              )
            )}
          </div>
        </div>

        {/* Join Date */}
        <div className="text-[10px] text-gray-500">
          Joined {joinDate}
        </div>

        {/* View Profile Button */}
        {showViewProfile && account.username && !isOnProfilePage && (
          <div className="pt-3 mt-3 border-t border-gray-200">
            <Link
              href={`/profile/${account.username}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
            >
              <span>View Profile</span>
              <ArrowUpTrayIcon className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Settings Button - Bottom Right */}
        {isOwnProfile && (
          <Link
            href="/settings"
            className="absolute bottom-2 right-2 p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors z-10"
            title="Settings"
          >
            <Cog6ToothIcon className="w-3 h-3 text-gray-600" />
          </Link>
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
