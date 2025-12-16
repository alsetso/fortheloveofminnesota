'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/features/ui/hooks/useToast';
import { TagService, Tag } from '@/features/tags/services/tagService';

interface InlinePinCreationFormProps {
  coordinates: { lat: number; lng: number };
  address: string;
  isLoadingAddress: boolean;
  onSave: (data: {
    name: string;
    description: string;
    address: string;
    lat: number;
    lng: number;
    visibility: 'public' | 'private';
    emoji: string;
    tag_id: string;
    subcategory?: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

export function InlinePinCreationForm({
  coordinates,
  address,
  isLoadingAddress,
  onSave,
  onCancel,
}: InlinePinCreationFormProps) {
  const [name, setName] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [emoji, setEmoji] = useState('🏠');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { success, error } = useToast();

  // Load public tags for pins on mount
  useEffect(() => {
    const loadTags = async () => {
      setIsLoadingTags(true);
      try {
        const pinTags = await TagService.getPublicTagsByEntityType('pin');
        setTags(pinTags);
        // Auto-select first tag if available
        if (pinTags.length > 0) {
          setSelectedTagId(pinTags[0].id);
          setEmoji(pinTags[0].emoji);
        }
      } catch (err) {
        console.error('Error loading tags:', err);
      } finally {
        setIsLoadingTags(false);
      }
    };
    loadTags();
  }, []);

  // Update emoji when tag is selected
  useEffect(() => {
    if (selectedTagId && tags.length > 0) {
      const selectedTag = tags.find(t => t.id === selectedTagId);
      if (selectedTag) {
        setEmoji(selectedTag.emoji);
      }
    }
  }, [selectedTagId, tags]);

  const handleSave = async () => {
    if (!name.trim()) {
      error('Name Required', 'Please enter a name for your pin');
      return;
    }

    if (!selectedTagId) {
      error('Tag Required', 'Please select a tag');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || '',
        address,
        lat: coordinates.lat,
        lng: coordinates.lng,
        visibility,
        emoji,
        tag_id: selectedTagId,
      });
      success('Pin Created', 'Your pin has been created successfully');
    } catch (err) {
      error('Create Failed', err instanceof Error ? err.message : 'Failed to create pin');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[100] w-full max-w-sm pointer-events-auto">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Create Pin</h3>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {/* Tag Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Tag *</label>
            {isLoadingTags ? (
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                Loading tags...
              </div>
            ) : (
              <select
                value={selectedTagId}
                onChange={(e) => setSelectedTagId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50"
                disabled={isSaving}
              >
                <option value="">Select a tag</option>
                {tags.filter(tag => tag.entity_type === 'pin' && tag.is_active).map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.emoji} {tag.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Name Input */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pin name *"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50"
              disabled={isSaving}
              autoFocus
            />
          </div>

          {/* Location */}
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-gray-500 mt-0.5 text-xs">📍</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 leading-relaxed">{isLoadingAddress ? 'Loading...' : address}</p>
                <p className="text-[10px] text-gray-500 font-mono mt-1">
                  {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50 resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Visibility</label>
            <div className="flex gap-2">
              <button
                onClick={() => setVisibility('public')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  visibility === 'public'
                    ? 'bg-gold-500/80 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isSaving}
              >
                Public
              </button>
              <button
                onClick={() => setVisibility('private')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  visibility === 'private'
                    ? 'bg-gold-500/80 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isSaving}
              >
                Private
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !selectedTagId || isSaving}
              className="flex-1 px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? 'Saving...' : 'Create'}
              {!isSaving && <CheckIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
