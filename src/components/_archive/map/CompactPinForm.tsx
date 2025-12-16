'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/features/ui/hooks/useToast';
import { Tag } from '@/features/tags/services/tagService';
import { PinMedia } from '@/features/pins/services/pinService';

interface CompactPinFormProps {
  coordinates: { lat: number; lng: number };
  address: string;
  isLoadingAddress: boolean;
  selectedTagId: string;
  emoji: string;
  tags: Tag[];
  isLoadingTags: boolean;
  onTagSelect: (tagId: string) => void;
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
    media?: PinMedia[] | null;
    files?: File[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function CompactPinForm({
  coordinates,
  address,
  isLoadingAddress,
  selectedTagId,
  emoji,
  tags,
  isLoadingTags,
  onTagSelect,
  onSave,
  onCancel,
}: CompactPinFormProps) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTagList, setShowTagList] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<Array<{ url: string; type: 'image' | 'video'; file: File }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagListRef = useRef<HTMLDivElement>(null);
  const { success, error } = useToast();

  const activeTags = tags.filter(tag => tag.entity_type === 'pin' && tag.is_active);

  // Close tag list when clicking outside
  useEffect(() => {
    if (!showTagList) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (tagListRef.current && !tagListRef.current.contains(event.target as Node)) {
        setShowTagList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagList]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const validFiles = newFiles.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        error('Invalid File', `${file.name} is not a valid image or video`);
        return false;
      }
      if (file.size > 100 * 1024 * 1024) {
        error('File Too Large', `${file.name} exceeds 100MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setSelectedFiles(prev => [...prev, ...validFiles]);

    // Create previews
    validFiles.forEach(file => {
      const isImage = file.type.startsWith('image/');
      const previewUrl = URL.createObjectURL(file);
      setMediaPreviews(prev => [...prev, {
        url: previewUrl,
        type: isImage ? 'image' : 'video',
        file,
      }]);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    // Revoke object URL
    URL.revokeObjectURL(mediaPreviews[index].url);
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
  };

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
        media: null, // Will be uploaded after pin creation
        files: selectedFiles, // Pass files for upload after pin creation
      });
      
      // Clean up preview URLs
      mediaPreviews.forEach(preview => URL.revokeObjectURL(preview.url));
      setSelectedFiles([]);
      setMediaPreviews([]);
      
      success('Pin Created', 'Your pin has been created successfully');
    } catch (err) {
      error('Create Failed', err instanceof Error ? err.message : 'Failed to create pin');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {showTagList ? (
        /* Tag List - Replaces form content */
        <div ref={tagListRef} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900">Select Tag</h3>
            <button
              type="button"
              onClick={() => setShowTagList(false)}
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="max-h-[250px] overflow-y-auto scrollbar-hide space-y-1">
            {isLoadingTags ? (
              <div className="text-center py-8">
                <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs text-gray-600">Loading tags...</p>
              </div>
            ) : activeTags.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-gray-600">No tags available</p>
              </div>
            ) : (
              activeTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    onTagSelect(tag.id);
                    setShowTagList(false);
                  }}
                  className={`
                    w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left
                    ${selectedTagId === tag.id
                      ? 'bg-white/40 text-gray-900 border border-white/30'
                      : 'bg-white/10 hover:bg-white/20 text-gray-700 border border-white/10'
                    }
                  `}
                >
                  <span className="text-lg flex-shrink-0">{tag.emoji}</span>
                  <span className="text-xs font-medium flex-1">{tag.label}</span>
                  {selectedTagId === tag.id && (
                    <CheckIcon className="w-4 h-4 text-gray-900 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Form Content */
        <>
          {/* Compact Header Row - Tag + Name inline */}
          <div className="flex items-center gap-2">
            {/* Tag Selector - Compact Button */}
            <button
              type="button"
              onClick={() => setShowTagList(true)}
              disabled={isSaving || isLoadingTags}
              className="w-10 h-9 rounded-lg bg-white/10 border border-white/20 text-lg hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title="Select tag"
            >
              {isLoadingTags ? (
                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                emoji
              )}
            </button>

            {/* Name Input - Compact */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pin name"
                className="w-full h-9 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all"
                disabled={isSaving}
                autoFocus
              />
            </div>

            {/* Save Button - Compact */}
            <button
              onClick={handleSave}
              disabled={!name.trim() || !selectedTagId || isSaving}
              className="flex-shrink-0 h-9 px-3 rounded-lg bg-gold-500/90 hover:bg-gold-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isSaving ? (
                <div className="w-3 h-3 border border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>

          {/* Location - Compact Glass Card */}
          <div className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20">
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] mt-0.5">📍</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-900 leading-tight truncate">
                  {isLoadingAddress ? 'Loading...' : address}
                </p>
                <p className="text-[9px] text-gray-600 font-mono mt-0.5">
                  {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {/* Description - Compact */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-[11px] text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 resize-none transition-all"
              disabled={isSaving}
            />
          </div>

          {/* Media Upload - Compact */}
          <div>
            <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 cursor-pointer transition-colors">
              <PhotoIcon className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-[10px] font-medium text-gray-700">Add Photo/Video</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={isSaving}
              />
            </label>
            
            {/* Media Previews */}
            {mediaPreviews.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {mediaPreviews.map((preview, index) => {
                  const isBlobUrl = preview.url?.startsWith('blob:');
                  return (
                  <div key={index} className="relative group">
                    {preview.type === 'image' ? (
                      <img
                        src={preview.url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg border border-white/20"
                      />
                    ) : (
                      <video
                        src={preview.url}
                        className="w-full h-20 object-cover rounded-lg border border-white/20"
                        controls={false}
                        playsInline
                        preload="metadata"
                        {...(!isBlobUrl && { crossOrigin: 'anonymous' })}
                        muted
                        onError={(e) => {
                          console.error('Pin preview video failed to load:', preview.url, e);
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={isSaving}
                    >
                      <XMarkIcon className="w-3 h-3 text-white" />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visibility Toggle - Compact */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setVisibility('public')}
              className={`flex-1 h-7 px-2 rounded-lg text-[10px] font-medium transition-all ${
                visibility === 'public'
                  ? 'bg-white/25 text-gray-900 border border-white/30'
                  : 'bg-white/5 text-gray-700 hover:bg-white/10 border border-white/10'
              }`}
              disabled={isSaving}
            >
              Public
            </button>
            <button
              onClick={() => setVisibility('private')}
              className={`flex-1 h-7 px-2 rounded-lg text-[10px] font-medium transition-all ${
                visibility === 'private'
                  ? 'bg-white/25 text-gray-900 border border-white/30'
                  : 'bg-white/5 text-gray-700 hover:bg-white/10 border border-white/10'
              }`}
              disabled={isSaving}
            >
              Private
            </button>
          </div>
        </>
      )}
    </div>
  );
}

