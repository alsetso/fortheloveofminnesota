'use client';

import { useState, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import EmojiPicker from './EmojiPicker';

interface MapPin {
  id: string;
  map_id: string;
  emoji: string | null;
  caption: string | null;
  image_url: string | null;
  video_url: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

interface MapPinFormProps {
  isOpen: boolean;
  lat: number;
  lng: number;
  mapId: string;
  onClose: () => void;
  onSubmit: (data: { emoji: string | null; caption: string | null; image_url: string | null; video_url: string | null }) => Promise<void>;
  onPinCreated?: (pinId: string) => void;
}

export default function MapPinForm({ isOpen, lat, lng, mapId, onClose, onSubmit, onPinCreated }: MapPinFormProps) {
  const [emoji, setEmoji] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSubmit({
        emoji: emoji.trim() || null,
        caption: caption.trim() || null,
        image_url: null,
        video_url: null,
      });
      
      // Reset form
      setEmoji('');
      setCaption('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pin');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmoji('');
    setCaption('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4 p-[10px] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Add Pin</h3>
          <button
            onClick={handleClose}
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[10px] text-gray-500">
          Location: {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="relative">
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
              Emoji
            </label>
            <div className="relative">
              <div className="flex items-center gap-1">
                <input
                  ref={emojiInputRef}
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="📍"
                  className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-lg hover:opacity-80 transition-opacity px-2 py-1.5 border border-gray-200 rounded-md bg-white"
                  aria-label="Open emoji picker"
                >
                  {emoji || '📍'}
                </button>
              </div>
              {showEmojiPicker && (
                <EmojiPicker
                  isOpen={showEmojiPicker}
                  onClose={() => setShowEmojiPicker(false)}
                  onSelect={(selectedEmoji) => {
                    setEmoji(selectedEmoji);
                    setShowEmojiPicker(false);
                  }}
                  triggerRef={emojiInputRef as React.RefObject<HTMLElement>}
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
              Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              rows={3}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
            />
          </div>


          {error && (
            <div className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-md p-1.5">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md py-1.5 px-3 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md py-1.5 px-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Pin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

