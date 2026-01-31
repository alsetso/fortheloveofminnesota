'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import CreatePostModal from './CreatePostModal';

type MentionType = { id: string; emoji: string; name: string; is_active?: boolean };

interface PostCreationFormProps {
  onPostCreated?: () => void;
  mapId?: string | null;
  /** Mode: 'post' creates posts, 'pin' creates map_pins. Default: 'pin' */
  createMode?: 'post' | 'pin';
}

export default function PostCreationForm({ onPostCreated, mapId, createMode: initialCreateMode = 'pin' }: PostCreationFormProps) {
  const { account } = useAuthStateSafe();
  const supabase = useSupabaseClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialAction, setInitialAction] = useState<'upload_photo' | 'upload_video' | 'mention' | null>(null);
  const [initialMentionTypeId, setInitialMentionTypeId] = useState<string | null>(null);
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [createMode, setCreateMode] = useState<'post' | 'pin'>(initialCreateMode);

  const accountName = account?.first_name || account?.username || 'User';

  const fetchMentionTypes = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('mention_types')
        .select('id, emoji, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setMentionTypes((data || []) as MentionType[]);
    } catch (err) {
      console.error('Failed to fetch mention types:', err);
    } finally {
      setLoadingTypes(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchMentionTypes();
  }, [fetchMentionTypes]);

  if (!account) {
    return null;
  }

  const openModal = (action: 'upload_photo' | 'upload_video' | 'mention' | null = null, mentionTypeId: string | null = null) => {
    setInitialAction(action);
    setInitialMentionTypeId(mentionTypeId);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setInitialAction(null);
    setInitialMentionTypeId(null);
  };

  const activeTypes = mentionTypes.filter((t) => t.is_active !== false);

  return (
    <>
      <div className="space-y-2">
        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateMode('pin')}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
              createMode === 'pin'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pin
          </button>
          <button
            type="button"
            onClick={() => setCreateMode('post')}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
              createMode === 'post'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Post
          </button>
        </div>

        {/* Input Field */}
        <button
          type="button"
          onClick={() => openModal()}
          className="w-full bg-white rounded-full px-4 py-2.5 text-left text-gray-500 hover:bg-gray-50 transition-colors border border-gray-200"
        >
          {createMode === 'pin' 
            ? `Add a pin to the map, ${accountName}?`
            : `What's on your mind, ${accountName}?`
          }
        </button>

        {/* Mention Types - Only show for pin mode */}
        {createMode === 'pin' && !loadingTypes && activeTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => openModal(null, type.id)}
                className="bg-white rounded-full px-3 py-1.5 text-left text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1.5 whitespace-nowrap border border-gray-200"
              >
                <span className="text-xs flex-shrink-0">{type.emoji}</span>
                <span className="text-xs font-medium">
                  {type.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onPostCreated={onPostCreated}
        initialAction={initialAction}
        initialMapId={mapId}
        initialMentionTypeId={initialMentionTypeId}
        createMode={createMode}
      />
    </>
  );
}
