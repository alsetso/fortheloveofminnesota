'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import { 
  CameraIcon,
  LockClosedIcon,
  GlobeAltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

/**
 * Create Story Form - Simple form to create a new story
 */
export default function CreateStoryForm() {
  const router = useRouter();
  const { account, user } = useAuthStateSafe();
  const [visibility, setVisibility] = useState<'private' | 'public' | 'shared'>('private');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibilityOptions = [
    { value: 'private' as const, label: 'Private', icon: LockClosedIcon, description: 'Only you can see this story' },
    { value: 'public' as const, label: 'Public', icon: GlobeAltIcon, description: 'Anyone can view this story' },
    { value: 'shared' as const, label: 'Shared', icon: UserGroupIcon, description: 'People with permission can view' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !account) {
      setError('Please sign in to create stories');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          visibility,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to create story');
      }

      const data = await response.json();
      
      // Redirect to the composer page with storyId
      router.push(`/stories/new/composer?storyId=${data.id}`);
    } catch (err: any) {
      console.error('Error creating story:', err);
      setError(err.message || 'Failed to create story');
      setIsSubmitting(false);
    }
  };

  if (!user || !account) {
    return (
      <div className="max-w-[600px] mx-auto w-full px-4 py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
          <p className="text-sm text-white/60 mb-4">
            Please sign in to create stories
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Create New Story</h1>
        <p className="text-sm text-white/60">
          Create a new story to share moments and experiences
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Visibility
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {visibilityOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisibility(option.value)}
                  className={`p-3 rounded-md border-2 transition-colors text-left ${
                    visibility === option.value
                      ? 'border-lake-blue bg-lake-blue/10'
                      : 'border-white/10 bg-surface hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-white/70" />
                    <span className="text-sm font-medium text-white">{option.label}</span>
                  </div>
                  <p className="text-xs text-white/60">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div className="p-4 bg-surface-accent rounded-md border border-white/10">
          <div className="flex items-start gap-3">
            <CameraIcon className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-white/70">
              <p className="mb-2">After creating your story, you'll be able to add slides with photos, videos, and text.</p>
              <p>Stories are temporary and can be set to expire after 24 hours.</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? 'Creating...' : 'Create Story'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-surface-accent text-white/70 rounded-md hover:bg-surface-accent/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
