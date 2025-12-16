'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/features/ui/hooks/useToast';
import { EmojiSelectorPopup } from '@/features/ui/components/EmojiSelectorPopup';
import { Pin } from '@/features/pins/services/pinService';

interface InlinePinEditFormProps {
  pin: Pin;
  onSave: (pinId: string, data: {
    emoji?: string;
    name?: string;
    visibility?: 'public' | 'private';
    description?: string | null;
    tag_id?: string;
  }) => Promise<void>;
  onDelete: (pinId: string) => Promise<void>;
  onCancel: () => void;
}

export function InlinePinEditForm({
  pin,
  onSave,
  onDelete,
  onCancel,
}: InlinePinEditFormProps) {
  const [emoji, setEmoji] = useState(pin.emoji);
  const [name, setName] = useState(pin.name);
  const [visibility, setVisibility] = useState<'public' | 'private'>(pin.visibility);
  const [description, setDescription] = useState(pin.description || '');
  const [tagId, setTagId] = useState(pin.tag_id || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    setEmoji(pin.emoji);
    setName(pin.name);
    setVisibility(pin.visibility);
    setDescription(pin.description || '');
    setTagId(pin.tag_id || '');
  }, [pin]);

  const handleSave = async () => {
    if (!name.trim()) {
      error('Name Required', 'Please enter a name for your pin');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(pin.id, {
        emoji,
        name: name.trim(),
        visibility,
        description: description.trim() || null,
        tag_id: tagId || undefined,
      });
      success('Pin Updated', 'Your pin has been updated');
    } catch (err) {
      error('Update Failed', err instanceof Error ? err.message : 'Failed to update pin');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this pin?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(pin.id);
      success('Pin Deleted', 'Your pin has been deleted');
    } catch (err) {
      error('Delete Failed', err instanceof Error ? err.message : 'Failed to delete pin');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[100] w-full max-w-sm pointer-events-auto">
      <div className="bg-black/95 backdrop-blur-md rounded-2xl border border-header-focus shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-header-focus">
          <h3 className="text-sm font-semibold text-gray-100">Edit Pin</h3>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 rounded transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {/* Emoji and Name */}
          <div className="flex items-center gap-2">
            <EmojiSelectorPopup
              value={emoji}
              onChange={setEmoji}
              buttonSize="md"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pin name *"
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50"
              disabled={isSaving || isDeleting}
              autoFocus
            />
          </div>

          {/* Tag ID (read-only for now, could be made editable) */}
          {tagId && (
            <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Tag ID</p>
              <p className="text-xs text-gray-300 font-mono">{tagId}</p>
            </div>
          )}

          {/* Location */}
          <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5 text-xs">📍</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 leading-relaxed">{pin.address}</p>
                <p className="text-[10px] text-gray-500 font-mono mt-1">
                  {pin.lat.toFixed(6)}, {pin.long.toFixed(6)}
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
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50 resize-none"
              disabled={isSaving || isDeleting}
            />
          </div>

          {/* Visibility */}
          <div>
            <div className="flex gap-2">
              <button
                onClick={() => setVisibility('public')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  visibility === 'public'
                    ? 'bg-gold-500/80 text-black'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
                disabled={isSaving || isDeleting}
              >
                Public
              </button>
              <button
                onClick={() => setVisibility('private')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  visibility === 'private'
                    ? 'bg-gold-500/80 text-black'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
                disabled={isSaving || isDeleting}
              >
                Private
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={onCancel}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isSaving || isDeleting}
              className="flex-1 px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? 'Saving...' : 'Save'}
              {!isSaving && <CheckIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


