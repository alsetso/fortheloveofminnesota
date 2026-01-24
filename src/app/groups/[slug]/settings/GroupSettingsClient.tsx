'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Group } from '@/types/group';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeftIcon, 
  PhotoIcon,
  GlobeAltIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { STORAGE_BUCKETS } from '@/constants/storage';

interface GroupSettingsClientProps {
  initialGroup: Group;
}

export default function GroupSettingsClient({ initialGroup }: GroupSettingsClientProps) {
  const router = useRouter();
  const { account, user } = useAuthStateSafe();
  const supabase = useSupabaseClient();
  const [group, setGroup] = useState<Group>(initialGroup);
  const [name, setName] = useState(initialGroup.name);
  const [description, setDescription] = useState(initialGroup.description || '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialGroup.visibility);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(initialGroup.image_url);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    if (!user) {
      setError('You must be logged in to upload images');
      return;
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/groups/image_url/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.GROUP_IMAGES)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKETS.GROUP_IMAGES)
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL');
      }

      setImageUrl(urlData.publicUrl);
    } catch (err) {
      console.error('[GroupSettings] Error uploading image:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/groups/${group.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          image_url: imageUrl || null,
          visibility,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update group');
      }

      const { group: updatedGroup } = await response.json();
      setGroup(updatedGroup);
      
      // Redirect to group page
      router.push(`/groups/${group.slug}`);
    } catch (err) {
      console.error('[GroupSettings] Error updating group:', err);
      setError(err instanceof Error ? err.message : 'Failed to update group');
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/groups/${group.slug}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Group</span>
          </Link>
          <Link
            href="/feed"
            className="absolute left-1/2 transform -translate-x-1/2"
          >
            <Image
              src="/logo.png"
              alt="Love of Minnesota"
              width={32}
              height={32}
              className="w-8 h-8"
            />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Group Settings</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              maxLength={100}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {name.length >= 90 && (
              <div className="text-xs text-gray-500 mt-1">{100 - name.length} characters remaining</div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this group is about..."
              maxLength={1000}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {description.length >= 950 && (
              <div className="text-xs text-gray-500 mt-1">{1000 - description.length} characters remaining</div>
            )}
          </div>

          {/* Group Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Image (optional)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt="Group image"
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized={imageUrl.includes('supabase.co')}
                    />
                  ) : (
                    <PhotoIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                
                {/* Hover Overlay */}
                <div
                  onClick={() => !isUploadingImage && imageInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  {isUploadingImage ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PhotoIcon className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* Hidden File Input */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
              
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {imageUrl ? 'Change Image' : 'Upload Image'}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="ml-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Remove
                  </button>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  Max 5MB. JPG, PNG, GIF, or WEBP
                </div>
              </div>
            </div>
          </div>

          {/* Privacy/Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibility
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {visibility === 'public' ? (
                    <>
                      <GlobeAltIcon className="w-4 h-4" />
                      Public
                    </>
                  ) : (
                    <>
                      <LockClosedIcon className="w-4 h-4" />
                      Private
                    </>
                  )}
                </div>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPrivacyMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPrivacyMenu(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] w-full">
                    <button
                      type="button"
                      onClick={() => {
                        setVisibility('public');
                        setShowPrivacyMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                        visibility === 'public' ? 'bg-gray-50 font-medium' : ''
                      }`}
                    >
                      <GlobeAltIcon className="w-4 h-4" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Public</div>
                        <div className="text-xs text-gray-500">Anyone can find and join</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVisibility('private');
                        setShowPrivacyMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors border-t border-gray-100 ${
                        visibility === 'private' ? 'bg-gray-50 font-medium' : ''
                      }`}
                    >
                      <LockClosedIcon className="w-4 h-4" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Private</div>
                        <div className="text-xs text-gray-500">Only members can see posts</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <Link
              href={`/groups/${group.slug}`}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
