'use client';

import { useState, useEffect } from 'react';
import { Pin } from '@/features/pins/services/pinService';
import { PencilIcon, TrashIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/features/ui/hooks/useToast';
import { EmojiSelectorPopup } from '@/features/ui/components/EmojiSelectorPopup';

interface PinSidebarProps {
  pin: Pin | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (pinId: string, data: {
    emoji?: string;
    name?: string;
    visibility?: 'public' | 'private';
    description?: string | null;
  }) => Promise<void>;
  onDelete: (pin: Pin) => void;
}

export function PinSidebar({
  pin,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: PinSidebarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [emoji, setEmoji] = useState(pin?.emoji || '');
  const [name, setName] = useState(pin?.name || '');
  const [description, setDescription] = useState(pin?.description || '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(pin?.visibility || 'public');
  const [isSaving, setIsSaving] = useState(false);
  const { success, error } = useToast();

  // Reset form when pin changes
  useEffect(() => {
    if (pin) {
      setEmoji(pin.emoji || '');
      setName(pin.name || '');
      setDescription(pin.description || '');
      setVisibility(pin.visibility || 'public');
      setIsEditing(false);
    }
  }, [pin]);

  if (!pin) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      error('Name Required', 'Please enter a name for your pin');
      return;
    }

    setIsSaving(true);
    try {
      await onEdit(pin.id, {
        emoji,
        name: name.trim(),
        visibility,
        description: description.trim() || null,
      });
      setIsEditing(false);
      success('Pin Updated', 'Your pin has been updated');
    } catch (err) {
      error('Update Failed', err instanceof Error ? err.message : 'Failed to update pin');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    if (pin) {
      setEmoji(pin.emoji || '');
      setName(pin.name || '');
      setDescription(pin.description || '');
      setVisibility(pin.visibility || 'public');
    }
    setIsEditing(false);
  };

  // Parse media if it's a string (JSONB can come as string from Supabase)
  let media = pin.media;
  if (typeof media === 'string') {
    try {
      media = JSON.parse(media);
    } catch (e) {
      console.warn('Failed to parse media JSON:', e);
      media = null;
    }
  }

  return (
    <div className={`absolute left-0 top-0 h-full w-96 bg-white shadow-xl z-[1500] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <EmojiSelectorPopup
                value={emoji}
                onChange={setEmoji}
                buttonSize="sm"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Pin name"
                autoFocus
              />
            </div>
          ) : (
            <h2 className="text-xl font-black text-black">{pin.name}</h2>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Media - At the top */}
          {media && Array.isArray(media) && media.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Media</h3>
              <div className="grid grid-cols-2 gap-2">
                {media.map((item: { url?: string; type?: string; [key: string]: unknown }, index: number) => {
                  const isBlobUrl = item.url?.startsWith('blob:');
                  return (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.filename || `Media ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                        {...(!isBlobUrl && { crossOrigin: 'anonymous' })}
                        onError={(e) => {
                          console.error('Pin video failed to load:', item.url, e);
                        }}
                      />
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {isEditing ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Description</h3>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="Description (optional)"
              />
            </div>
          ) : (
            pin.description && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Description</h3>
                <p className="text-gray-700">{pin.description}</p>
              </div>
            )
          )}

          {pin.address && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Address</h3>
              <p className="text-gray-700">{pin.address}</p>
            </div>
          )}

          {pin.tag && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Tag</h3>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{pin.tag.emoji}</span>
                <span className="text-gray-700">{pin.tag.label}</span>
              </div>
            </div>
          )}

          {/* Visibility */}
          {isEditing ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Visibility</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setVisibility('public')}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    visibility === 'public'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Public
                </button>
                <button
                  onClick={() => setVisibility('private')}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    visibility === 'private'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Private
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Visibility</h3>
              <p className="text-gray-700 capitalize">{pin.visibility}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Coordinates</h3>
            <p className="text-gray-700 text-sm">
              {pin.lat?.toFixed(6)}, {pin.lng?.toFixed(6) ?? pin.long?.toFixed(6)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-4 space-y-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <PencilIcon className="w-5 h-5" />
                <span>Edit Pin</span>
              </button>
              <button
                onClick={() => onDelete(pin)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              >
                <TrashIcon className="w-5 h-5" />
                <span>Delete Pin</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
