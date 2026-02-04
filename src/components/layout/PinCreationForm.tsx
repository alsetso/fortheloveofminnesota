'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { MapInfoLocation } from './MapInfo';

type MentionType = { id: string; emoji: string; name: string };

interface PinCreationFormProps {
  location: MapInfoLocation;
  onClose: () => void;
  onSubmit: (data: { description: string; mentionTypeId: string }) => void;
  initialMentionTypeId?: string;
}

export default function PinCreationForm({
  location,
  onClose,
  onSubmit,
  initialMentionTypeId,
}: PinCreationFormProps) {
  const supabase = useSupabaseClient();
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedMentionTypeId, setSelectedMentionTypeId] = useState<string | null>(
    initialMentionTypeId || null
  );
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch mention types
  useEffect(() => {
    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (err) {
        console.error('Failed to fetch mention types:', err);
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchMentionTypes();
  }, [supabase]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedMentionTypeId || isSubmitting) return;

      setIsSubmitting(true);
      onSubmit({
        description: description.trim(),
        mentionTypeId: selectedMentionTypeId,
      });
    },
    [description, selectedMentionTypeId, onSubmit, isSubmitting]
  );

  const canSubmit = selectedMentionTypeId && !isSubmitting;

  return (
    <div className="p-[10px] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-900">Create Pin</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 flex items-center justify-center p-1 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Location info */}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
          Location
        </div>
        <div className="text-xs text-gray-900 break-words">
          {location.address || `${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}`}
        </div>
      </div>

      {/* Mention type selection */}
      <div className="space-y-2">
        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
          Select Tag
        </div>
        {loadingTypes ? (
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[28px] w-24 bg-gray-100 rounded-full animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {mentionTypes.map((type) => {
              const isSelected = selectedMentionTypeId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedMentionTypeId(type.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm">{type.emoji}</span>
                  <span>{type.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Description input */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label htmlFor="description" className="sr-only">
            What's going on here
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's going on here"
            rows={3}
            className="w-full px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
            canSubmit
              ? 'bg-gray-900 text-white hover:bg-gray-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Creating...' : 'Create Pin'}
        </button>
      </form>
    </div>
  );
}
