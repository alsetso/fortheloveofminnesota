'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import type { Mention } from '@/types/mention';
import { useAuthStateSafe } from '@/features/auth';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface CreateMentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates: { lat: number; lng: number } | null;
  onMentionCreated: (mention?: Mention) => void;
  onBack?: () => void;
  onVisibilityChange?: (visibility: 'public' | 'only_me') => void;
  map?: MapboxMapInstance | null;
}

export default function CreateMentionModal({
  isOpen,
  onClose,
  coordinates,
  onMentionCreated,
  onBack,
  onVisibilityChange,
}: CreateMentionModalProps) {
  const { user, account, activeAccountId } = useAuthStateSafe();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'only_me'>('public');

  // Notify parent when visibility changes
  useEffect(() => {
    if (isOpen && onVisibilityChange) {
      onVisibilityChange(visibility);
    }
  }, [visibility, isOpen, onVisibilityChange]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setError(null);
      setVisibility('public');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coordinates) return;

    if (!user) {
      setError('Please sign in to create mentions');
      return;
    }

    // Check if user is onboarded
    if (account && !account.onboarded) {
      setError('Please complete onboarding to create mentions');
      // Trigger onboarding demo to show
      window.dispatchEvent(new CustomEvent('show-onboarding-demo'));
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const mentionData = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        description: description.trim() || null,
        visibility,
      };

      const createdMention = await MentionService.createMention(mentionData, activeAccountId || undefined);
      onMentionCreated(createdMention);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create mention';
      console.error('[CreateMentionModal] Error creating mention:', errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end bg-black/50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-xl shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              disabled={isSubmitting}
            >
              <XMarkIcon className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-gray-900 flex-1 text-center">Create Mention</h2>
          <div className="w-8">
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors ml-auto"
              disabled={isSubmitting}
            >
              <XMarkIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="space-y-3 py-4">
            {/* Description */}
            <div>
              <textarea
                value={description}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 240) {
                    setDescription(value);
                  }
                }}
                maxLength={240}
                className="w-full px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none border border-gray-200 rounded-md"
                placeholder="What's going on here?"
                rows={4}
                autoFocus
                disabled={isSubmitting}
              />
              <div className="flex justify-end mt-1">
                <span className={`text-[10px] ${description.length >= 240 ? 'text-red-500' : 'text-gray-400'}`}>
                  {description.length}/240
                </span>
              </div>
            </div>

            {/* Visibility Toggle */}
            <div className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded-md">
              <span className={`text-[10px] ${visibility === 'public' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                Public
              </span>
              <button
                type="button"
                onClick={() => setVisibility(visibility === 'public' ? 'only_me' : 'public')}
                disabled={isSubmitting || !user}
                className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  visibility === 'only_me' ? 'bg-gray-700' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={visibility === 'only_me'}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    visibility === 'only_me' ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-[10px] ${visibility === 'only_me' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                Only Me
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !description.trim() || !user}
              className="w-full px-3 py-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
