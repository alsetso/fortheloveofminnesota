'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { XMarkIcon, PhotoIcon, UserPlusIcon, CheckIcon } from '@heroicons/react/24/outline';
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
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && pin) {
      setDescription(pin.description ?? '');
      setImagePreview(pin.image_url ?? null);
      setImageFile(null);
      setTagInput('');
      setSelectedCollectionId(pin.collection_id ?? null);
      setVisibility(pin.visibility ?? 'public');
      setError(null);
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

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col rounded-t-2xl sm:rounded-xl bg-surface border border-border-muted dark:border-white/10 shadow-xl"
        role="dialog"
        aria-labelledby="finish-pin-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border-muted dark:border-white/10 flex-shrink-0">
          <h2 id="finish-pin-title" className="text-sm font-semibold text-foreground">
            Pin added
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface-accent dark:hover:bg-white/10 transition-colors text-foreground-muted hover:text-foreground"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Congratulation */}
        <div className="px-3 pt-2 pb-1">
          <p className="text-xs text-foreground-muted">
            Nice work. Add a description, photo, or tag friends to make it shine.
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {/* Description */}
          <div>
            <label htmlFor="finish-pin-desc" className="block text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              id="finish-pin-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this place special?"
              rows={3}
              className="w-full px-2.5 py-2 text-xs border border-border-muted dark:border-white/10 rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-lake-blue/30 text-foreground placeholder:text-foreground-muted resize-none"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-1">
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
              <div className="relative rounded-md overflow-hidden border border-border-muted dark:border-white/10 aspect-video bg-surface-accent dark:bg-white/5">
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
                className="w-full flex items-center justify-center gap-2 px-3 py-4 border border-dashed border-border-muted dark:border-white/10 rounded-md text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-colors text-xs"
              >
                <PhotoIcon className="w-4 h-4" />
                Add photo
              </button>
            )}
          </div>

          {/* Tag users */}
          <div>
            <label htmlFor="finish-pin-tags" className="block text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-1">
              <UserPlusIcon className="w-3 h-3 inline-block mr-1 align-middle" />
              Tag friends
            </label>
            <input
              id="finish-pin-tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="@username"
              className="w-full px-2.5 py-2 text-xs border border-border-muted dark:border-white/10 rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-lake-blue/30 text-foreground placeholder:text-foreground-muted"
            />
          </div>

          {/* Collection */}
          {collections.length > 0 && (
            <div>
              <label className="block text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-1">
                Collection
              </label>
              <select
                value={selectedCollectionId ?? ''}
                onChange={(e) => setSelectedCollectionId(e.target.value || null)}
                className="w-full px-2.5 py-2 text-xs border border-border-muted dark:border-white/10 rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-lake-blue/30 text-foreground"
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
            <label className="block text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-1">
              Visibility
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded border transition-colors ${
                  visibility === 'public'
                    ? 'border-lake-blue bg-lake-blue/10 text-lake-blue'
                    : 'border-border-muted dark:border-white/10 text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/5'
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
                    : 'border-border-muted dark:border-white/10 text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/5'
                }`}
              >
                Only me
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-border-muted dark:border-white/10 flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 text-xs font-medium text-foreground-muted border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent dark:hover:bg-white/5 transition-colors"
          >
            Done
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-lake-blue rounded-md hover:bg-lake-blue/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
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

  return createPortal(modalContent, document.body);
}
