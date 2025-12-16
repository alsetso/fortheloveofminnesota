'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { UserMapService } from '@/features/user-maps/services';
import { useAuth } from '@/features/auth';

interface CreateMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMapCreated?: (mapId: string) => void;
}

export default function CreateMapModal({
  isOpen,
  onClose,
  onMapCreated,
}: CreateMapModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setError(null);
      // Focus title input when modal opens
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be signed in to create a map');
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const map = await UserMapService.createMap({
        title: title.trim(),
        description: description.trim() || undefined,
      });

      // Reset form
      setTitle('');
      setDescription('');

      // Call callback if provided
      if (onMapCreated) {
        onMapCreated(map.id);
      } else {
        // Navigate to the map page
        router.push(`/map/${map.id}`);
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error creating map:', err);
      setError(err instanceof Error ? err.message : 'Failed to create map');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-md shadow-xl w-full max-w-md mx-4 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-[10px] py-[10px] border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Create New Map</h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-[10px] space-y-3">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-xs font-medium text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter map title"
              disabled={isSubmitting}
              className="w-full px-[10px] py-[10px] text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-500 text-[10px]">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter map description"
              disabled={isSubmitting}
              rows={3}
              className="w-full px-[10px] py-[10px] text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-[10px] py-[10px] bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-[10px] py-[10px] text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-1 px-[10px] py-[10px] text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Map'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

