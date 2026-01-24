'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { STORAGE_BUCKETS } from '@/constants/storage';
import Image from 'next/image';

export default function NewGroupPage() {
  const router = useRouter();
  const { account, user } = useAuthStateSafe();
  const supabase = useSupabaseClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPayingUser = account?.plan === 'contributor' || account?.plan === 'professional' || account?.plan === 'business';

  // Auto-generate slug from name
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (value) {
      const generatedSlug = generateSlug(value);
      setSlug(generatedSlug);
      setSlugError(null);
    } else {
      setSlug('');
    }
  };

  const checkSlugAvailability = async (slugToCheck: string) => {
    if (!slugToCheck || slugToCheck.length < 1) {
      setSlugAvailable(null);
      return;
    }

    setIsCheckingSlug(true);
    try {
      const response = await fetch(`/api/groups/${slugToCheck}`, {
        method: 'HEAD',
        credentials: 'include',
      });

      // If group exists (200 or 404 but found), slug is taken
      if (response.ok) {
        setSlugAvailable(false);
        setSlugError('This group URL is already taken');
      } else if (response.status === 404) {
        setSlugAvailable(true);
        setSlugError(null);
      } else {
        // Other errors - don't block, but don't mark as available
        setSlugAvailable(null);
      }
    } catch (err) {
      console.error('Error checking slug availability:', err);
      setSlugAvailable(null);
    } finally {
      setIsCheckingSlug(false);
    }
  };

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleaned);
    setSlugAvailable(null);
    
    // Clear previous timeout
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }
    
    // Validate slug format
    if (cleaned && !/^[a-z0-9-]+$/.test(cleaned)) {
      setSlugError('Slug can only contain lowercase letters, numbers, and hyphens');
      setSlugAvailable(null);
    } else if (cleaned && cleaned.startsWith('-')) {
      setSlugError('Slug cannot start with a hyphen');
      setSlugAvailable(null);
    } else if (cleaned && cleaned.endsWith('-')) {
      setSlugError('Slug cannot end with a hyphen');
      setSlugAvailable(null);
    } else if (cleaned && cleaned.length >= 1) {
      setSlugError(null);
      // Debounce slug availability check
      slugCheckTimeoutRef.current = setTimeout(() => {
        checkSlugAvailability(cleaned);
      }, 500);
    } else {
      setSlugError(null);
      setSlugAvailable(null);
    }
  };

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
      console.error('[NewGroupPage] Error uploading image:', err);
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (slugCheckTimeoutRef.current) {
        clearTimeout(slugCheckTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    if (!slug.trim()) {
      setError('Group slug is required');
      return;
    }

    if (slugError) {
      setError(slugError);
      return;
    }

    if (slugAvailable === false) {
      setError('This group URL is already taken. Please choose a different one.');
      return;
    }

    if (isCheckingSlug) {
      setError('Please wait while we check if the URL is available...');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          image_url: imageUrl || null,
          visibility,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create group');
      }

      const data = await response.json();
      router.push(`/groups/${data.group.slug}`);
    } catch (err) {
      console.error('[NewGroupPage] Error creating group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create group');
      setIsSubmitting(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to create a group</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700">
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  if (!isPayingUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <p className="text-gray-600 mb-4">
            Group creation requires a Contributor plan or higher. Upgrade to create groups.
          </p>
          <Link
            href="/billing"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/groups" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
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
          <h1 className="text-lg font-semibold text-gray-900">Create Group</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[600px] mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter group name"
              maxLength={100}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {name.length >= 90 && (
              <div className="text-xs text-gray-500 mt-1">{100 - name.length} characters remaining</div>
            )}
          </div>

          {/* Group Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group URL *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">loveofminnesota.com/groups/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="group-slug"
                maxLength={100}
                required
                pattern="[a-z0-9-]+"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isCheckingSlug && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span>Checking availability...</span>
                </div>
              )}
              {!isCheckingSlug && slugAvailable === true && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Available</span>
                </div>
              )}
              {!isCheckingSlug && slugAvailable === false && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>Already taken</span>
                </div>
              )}
            </div>
            {slugError && (
              <div className="text-xs text-red-600 mt-1">{slugError}</div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Only lowercase letters, numbers, and hyphens allowed
            </div>
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Public
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
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
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
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
              href="/groups"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!name.trim() || !slug.trim() || !!slugError || slugAvailable === false || isCheckingSlug || isSubmitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
