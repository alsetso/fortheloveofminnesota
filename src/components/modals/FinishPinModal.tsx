'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  XMarkIcon,
  PhotoIcon,
  UserPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { useAuthStateSafe } from '@/features/auth';
import { parseAndResolveUsernames } from '@/lib/posts/parseUsernames';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import { CollectionService } from '@/features/collections/services/collectionService';

interface FinishPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  pin: ProfilePin;
  accountId: string;
  address?: string | null;
  onPinUpdated: (pin: ProfilePin) => void;
  collections?: Collection[];
}

export default function FinishPinModal({
  isOpen,
  onClose,
  pin,
  accountId,
  address,
  onPinUpdated,
  collections: initialCollections = [],
}: FinishPinModalProps) {
  const { user, activeAccountId } = useAuthStateSafe();
  const [description, setDescription] = useState(pin.description ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(pin.image_url ?? null);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(pin.collection_id ?? null);
  const [visibility, setVisibility] = useState<'public' | 'only_me'>(pin.visibility ?? 'public');
  const [showMore, setShowMore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && pin) {
      setDescription(pin.description ?? '');
      setImagePreview(pin.image_url ?? null);
      setImageFile(null);
      setTagInput('');
      setSelectedCollectionId(pin.collection_id ?? null);
      setVisibility(pin.visibility ?? 'public');
      setShowMore(false);
      setError(null);
      // Auto-focus description after render
      requestAnimationFrame(() => descRef.current?.focus());
    }
  }, [isOpen, pin]);

  useEffect(() => {
    if (!isOpen || !activeAccountId || initialCollections.length > 0) return;
    CollectionService.getCollections(activeAccountId).then(setCollections).catch(() => {});
  }, [isOpen, activeAccountId, initialCollections.length]);

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return pin.image_url ?? null;

    const fileExt = imageFile.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/mentions/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('mentions-media')
      .upload(fileName, imageFile, { cacheControl: '3600', upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from('mentions-media').getPublicUrl(fileName);
    return urlData?.publicUrl ?? null;
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      let imageUrl = pin.image_url ?? null;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const taggedAccountIds = tagInput.trim()
        ? await parseAndResolveUsernames(supabase, tagInput)
        : null;

      const res = await fetch(`/api/accounts/${accountId}/pins/${pin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: description.trim() || null,
          image_url: imageUrl,
          media_type: imageUrl ? 'image' : 'none',
          collection_id: selectedCollectionId,
          visibility,
          full_address: address ?? null,
          tagged_account_ids: taggedAccountIds && taggedAccountIds.length > 0 ? taggedAccountIds : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to update pin');
      }

      const { pin: updatedPin } = await res.json();
      onPinUpdated(updatedPin);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }
    setImageFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  };

  if (!isOpen) return null;

  const displayAddress = address ?? (pin.lat != null && pin.lng != null ? `${Number(pin.lat).toFixed(5)}, ${Number(pin.lng).toFixed(5)}` : null);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2100] flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-[500px] mx-2 mb-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface shadow-sm overflow-hidden flex flex-col max-h-[80vh]"
        role="dialog"
        aria-labelledby="finish-pin-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-white/10 flex-shrink-0">
          <div />
          <h2 id="finish-pin-title" className="text-sm font-semibold text-gray-900 dark:text-foreground">
            Add details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 -mr-1 text-gray-500 hover:text-gray-700 dark:text-foreground-muted dark:hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Address context */}
        {displayAddress && (
          <div className="px-3 pt-2 flex items-center gap-1.5">
            <MapPinIcon className="w-3 h-3 text-gray-400 dark:text-foreground-muted flex-shrink-0" />
            <p className="text-[10px] text-gray-500 dark:text-foreground-muted truncate">
              {displayAddress}
            </p>
          </div>
        )}

        {/* Form */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {/* Description */}
          <div>
            <label htmlFor="finish-pin-desc" className="block text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              ref={descRef}
              id="finish-pin-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this place special?"
              rows={3}
              className="w-full px-2.5 py-2 text-xs border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20 text-gray-900 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-foreground-muted resize-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wide mb-1">
              Photo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative rounded-md overflow-hidden border border-gray-200 dark:border-white/10 aspect-video bg-gray-50 dark:bg-white/5">
                <Image
                  src={imagePreview}
                  alt="Pin preview"
                  fill
                  className="object-cover"
                  unoptimized={imagePreview.startsWith('data:') || imagePreview.includes('supabase.co')}
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  aria-label="Remove photo"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-gray-200 dark:border-white/10 rounded-md text-gray-500 dark:text-foreground-muted hover:text-gray-700 dark:hover:text-foreground hover:border-gray-400 dark:hover:border-white/20 transition-colors text-xs"
              >
                <PhotoIcon className="w-4 h-4" />
                Add photo
              </button>
            )}
          </div>

          {/* More options disclosure */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 dark:text-foreground-muted dark:hover:text-foreground transition-colors"
          >
            <ChevronDownIcon
              className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`}
            />
            More options
          </button>

          {showMore && (
            <div className="space-y-3">
              {/* Tag friends */}
              <div>
                <label htmlFor="finish-pin-tags" className="block text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wide mb-1">
                  <UserPlusIcon className="w-3 h-3 inline-block mr-1 align-middle" />
                  Tag friends
                </label>
                <input
                  id="finish-pin-tags"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="@username"
                  className="w-full px-2.5 py-2 text-xs border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20 text-gray-900 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-foreground-muted"
                />
              </div>

              {/* Collection */}
              {collections.length > 0 && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wide mb-1">
                    Collection
                  </label>
                  <select
                    value={selectedCollectionId ?? ''}
                    onChange={(e) => setSelectedCollectionId(e.target.value || null)}
                    className="w-full px-2.5 py-2 text-xs border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20 text-gray-900 dark:text-foreground"
                  >
                    <option value="">None</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Visibility */}
              <div>
                <label className="block text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wide mb-1">
                  Visibility
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded border transition-colors ${
                      visibility === 'public'
                        ? 'border-lake-blue bg-lake-blue/10 text-lake-blue'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-foreground-muted hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility('only_me')}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded border transition-colors ${
                      visibility === 'only_me'
                        ? 'border-lake-blue bg-lake-blue/10 text-lake-blue'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-foreground-muted hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    Only me
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Action */}
        <div className="p-3 border-t border-gray-200 dark:border-white/10 flex-shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-md text-white bg-lake-blue hover:bg-lake-blue/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {isSaving ? (
              'Saving…'
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
