'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserIcon, PhoneIcon, PencilIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName, formatJoinDate, TRAIT_OPTIONS } from '@/types/profile';
import { AccountService } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import ProfileEditModal from './ProfileEditModal';

interface ProfileCardProps {
  account: ProfileAccount;
  isOwnProfile: boolean;
}

export default function ProfileCard({ account: initialAccount, isOwnProfile }: ProfileCardProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [account, setAccount] = useState<ProfileAccount>(initialAccount);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  
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

        {/* Profile Photo - Overlapping Cover */}
        <div className="relative -mt-12">
          <div className="relative w-14 h-14 rounded-full bg-gray-100 border border-gray-200 overflow-hidden group">
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
            {isOwnProfile && (
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
            )}
          </div>
        </div>

        {/* Name and Username */}
        <div className="space-y-1">
          <h1 className="text-sm font-semibold text-gray-900 leading-tight">
            {displayName}
          </h1>
          {account.username && (
            <p className="text-xs text-gray-500">@{account.username}</p>
          )}
        </div>

        {/* Bio */}
        {account.bio && (
          <p className="text-xs text-gray-600 leading-relaxed">{account.bio}</p>
        )}

        {/* Traits */}
        <div className="pt-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            {selectedTraits.length > 0 ? (
              selectedTraits.filter(Boolean).map((trait) => (
                <span
                  key={trait!.id}
                  className="px-2 py-0.5 bg-white border border-gray-200 text-xs text-gray-900 rounded"
                >
                  {trait!.label}
                </span>
              ))
            ) : (
              isOwnProfile ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-gray-500">Let other Minnesotans know your vibe</span>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-2 py-0.5 text-xs font-medium text-gray-900 hover:bg-gray-100 rounded transition-colors border border-gray-300"
                  >
                    +add traits
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-400">No traits selected</span>
              )
            )}
          </div>
        </div>

        {/* Join Date */}
        <div className="text-[10px] text-gray-500">
          Joined {joinDate}
        </div>

        {/* Contact Info - Only for own profile */}
        {isOwnProfile && (
          <div className="space-y-1.5 pt-2">
            {account.phone && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <PhoneIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span>{account.phone}</span>
              </div>
            )}
          </div>
        )}

        {/* View Profile Button */}
        {account.username && !isOnProfilePage && (
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

        {/* Edit Button - Bottom Right */}
        {isOwnProfile && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="absolute bottom-2 right-2 p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors z-10"
            title="Edit Profile"
          >
            <PencilIcon className="w-3 h-3 text-gray-600" />
          </button>
        )}
      </div>

      {/* Profile Edit Modal */}
      {isOwnProfile && (
        <ProfileEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          account={account}
          onAccountUpdate={handleAccountUpdate}
        />
      )}
    </>
  );
}
