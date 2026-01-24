'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { UserIcon, CameraIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { isPaidPlan } from '@/lib/billing/planHelpers';

interface ProfileCardProps {
  account: {
    id: string;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    cover_image_url?: string | null;
    bio?: string | null;
    traits?: string[] | null;
    plan?: string | null;
  };
  darkMode?: boolean;
  searchVisibility?: boolean;
  isUpdatingVisibility?: boolean;
  onToggleSearchVisibility?: () => void;
  onSaveTraits?: (traits: string[]) => Promise<void>;
  onSaveBio?: (bio: string) => Promise<void>;
  onCoverImageClick?: () => void;
  onProfileImageClick?: () => void;
  showViewButton?: boolean;
  showSearchToggle?: boolean;
}

export default function ProfileCard({
  account,
  darkMode = false,
  searchVisibility = false,
  isUpdatingVisibility = false,
  onToggleSearchVisibility,
  onSaveTraits,
  onSaveBio,
  onCoverImageClick,
  onProfileImageClick,
  showViewButton = true,
  showSearchToggle = true,
}: ProfileCardProps) {
  const [isEditingTraits, setIsEditingTraits] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedTraits, setEditedTraits] = useState<string[]>(account.traits || []);
  const [editedBio, setEditedBio] = useState(account.bio || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveTraits = async () => {
    if (!onSaveTraits || isSavingProfile) return;
    setIsSavingProfile(true);
    try {
      await onSaveTraits(editedTraits);
      setIsEditingTraits(false);
    } catch (error) {
      console.error('Error saving traits:', error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveBio = async () => {
    if (!onSaveBio || isSavingProfile) return;
    setIsSavingProfile(true);
    try {
      await onSaveBio(editedBio);
      setIsEditingBio(false);
    } catch (error) {
      console.error('Error saving bio:', error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className={`rounded-md overflow-hidden border ${
      darkMode ? 'border-white/20' : 'border-gray-200'
    }`}>
      {/* Cover Image */}
      <div
        onClick={onCoverImageClick}
        className={`relative w-full h-24 ${onCoverImageClick ? 'cursor-pointer group' : ''} ${
          darkMode ? 'bg-white/10' : 'bg-gray-100'
        }`}
      >
        {account.cover_image_url ? (
          <Image
            src={account.cover_image_url}
            alt="Cover"
            fill
            className="object-cover"
            unoptimized={account.cover_image_url.includes('supabase.co')}
          />
        ) : null}
        {onCoverImageClick && (
          <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
            darkMode ? 'bg-black/50' : 'bg-black/30'
          }`}>
            <CameraIcon className="w-5 h-5 text-white shrink-0" />
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className={`p-3 space-y-2 ${darkMode ? 'bg-black' : 'bg-white'}`}>
        {/* Profile Image & Username */}
        <div className="flex items-start gap-3">
          {/* Profile Image */}
          <div
            onClick={onProfileImageClick}
            className={`relative w-16 h-16 -mt-10 rounded-full overflow-hidden ${onProfileImageClick ? 'cursor-pointer group' : ''} ${
              isPaidPlan(account.plan)
                ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                : darkMode
                  ? 'border-4 border-black'
                  : 'border-4 border-white'
            }`}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-white">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={account.username || 'Profile'}
                  fill
                  className="object-cover rounded-full"
                  unoptimized={account.image_url.includes('supabase.co')}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center rounded-full ${
                  darkMode ? 'bg-white/20' : 'bg-gray-200'
                }`}>
                  <UserIcon className={`w-8 h-8 ${darkMode ? 'text-white/70' : 'text-gray-400'}`} />
                </div>
              )}
            </div>
            {onProfileImageClick && (
              <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full ${
                darkMode ? 'bg-black/50' : 'bg-black/30'
              }`}>
                <CameraIcon className="w-5 h-5 text-white shrink-0" />
              </div>
            )}
          </div>

          {/* Username & View Profile Button */}
          <div className="flex items-center gap-2 pt-1 min-w-0">
            <div className="flex flex-col min-w-0 flex-1">
              <span className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {account.username || 'No username'}
              </span>
              <span className={`text-xs ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
                @{account.username || 'username'}
              </span>
            </div>
            {showViewButton && account.username && (
              <Link
                href={`/profile/${account.username}`}
                className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded shrink-0 grow-0 basis-auto leading-none transition-colors ${
                  darkMode
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                View
              </Link>
            )}
          </div>
        </div>

        {/* Traits */}
        {onSaveTraits && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${darkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Traits
              </span>
            </div>
            {isEditingTraits ? (
              <div className="space-y-1">
                <input
                  type="text"
                  value={editedTraits.join(', ')}
                  onChange={(e) => setEditedTraits(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  className={`w-full px-2 py-1 text-xs rounded transition-colors ${
                    darkMode
                      ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/50'
                      : 'bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400'
                  }`}
                  placeholder="Enter traits, separated by commas"
                  disabled={isSavingProfile}
                />
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => {
                      setIsEditingTraits(false);
                      setEditedTraits(account.traits || []);
                    }}
                    className={`px-2 py-1 text-xs transition-colors rounded ${
                      darkMode
                        ? 'text-white/80 hover:bg-white/10'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    disabled={isSavingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTraits}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      darkMode
                        ? 'bg-white text-black hover:bg-white/90'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {(account.traits && account.traits.length > 0) ? (
                  account.traits.map((trait, index) => (
                    <span
                      key={index}
                      className={`px-2 py-0.5 text-xs rounded ${
                        darkMode
                          ? 'bg-white/10 text-white/80'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {trait}
                    </span>
                  ))
                ) : (
                  <span className={`text-xs ${darkMode ? 'text-white/50' : 'text-gray-400'}`}>
                    No traits yet
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bio */}
        {onSaveBio && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${darkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Bio
              </span>
            </div>
            {isEditingBio ? (
              <div className="space-y-1">
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  className={`w-full px-2 py-1 text-xs rounded resize-none transition-colors ${
                    darkMode
                      ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/50'
                      : 'bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400'
                  }`}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  maxLength={240}
                  disabled={isSavingProfile}
                />
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => {
                      setIsEditingBio(false);
                      setEditedBio(account.bio || '');
                    }}
                    className={`px-2 py-1 text-xs transition-colors rounded ${
                      darkMode
                        ? 'text-white/80 hover:bg-white/10'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    disabled={isSavingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBio}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      darkMode
                        ? 'bg-white text-black hover:bg-white/90'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-xs ${
                account.bio
                  ? darkMode ? 'text-white/80' : 'text-gray-700'
                  : darkMode ? 'text-white/50' : 'text-gray-400'
              }`}>
                {account.bio || 'No bio yet'}
              </p>
            )}
          </div>
        )}

        {/* Searchable Toggle */}
        {showSearchToggle && onToggleSearchVisibility && (
          <>
            <div className={`flex items-center justify-between pt-2 border-t ${
              darkMode ? 'border-white/20' : 'border-gray-200'
            }`}>
              <span className={`text-xs ${darkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Profile {searchVisibility ? 'searchable' : 'not searchable'}
              </span>
              <button
                onClick={onToggleSearchVisibility}
                disabled={isUpdatingVisibility}
                className="flex-shrink-0"
              >
                <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                  searchVisibility 
                    ? 'bg-green-500' 
                    : darkMode ? 'bg-white/30' : 'bg-gray-300'
                } ${isUpdatingVisibility ? 'opacity-50' : ''}`}>
                  <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform bg-white ${
                    searchVisibility ? 'translate-x-3.5' : 'translate-x-0'
                  }`} />
                </div>
              </button>
            </div>
            {/* Manage Settings Button */}
            <div className="pt-2">
              <Link
                href="/settings"
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  darkMode
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                <Cog6ToothIcon className="w-3 h-3" />
                Manage Settings
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
