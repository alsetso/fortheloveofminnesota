'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftIcon, XMarkIcon, CameraIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import { supabase } from '@/lib/supabase';
import { useAuthStateSafe } from '@/features/auth';
import InlineMap from '@/components/map/InlineMap';

type MentionType = { id: string; emoji: string; name: string };
type Collection = { id: string; emoji: string; title: string };

interface EditMentionFormProps {
  mention: {
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    image_url: string | null;
    video_url: string | null;
    media_type: 'image' | 'video' | 'none' | null;
    full_address: string | null;
    account_id: string | null;
    mention_type?: { id: string; emoji: string; name: string } | null;
    accounts?: {
      id: string;
      username: string | null;
      first_name: string | null;
      image_url: string | null;
    } | null;
  };
  mentionTypes: MentionType[];
  collections: Collection[];
  accountPlan: string | null;
}

export default function EditMentionForm({
  mention,
  mentionTypes,
  collections,
  accountPlan,
}: EditMentionFormProps) {
  const router = useRouter();
  const { user } = useAuthStateSafe();

  // Form state — initialized from server-fetched props (no client fetch)
  const [description, setDescription] = useState(mention.description || '');
  const [selectedMentionTypeId, setSelectedMentionTypeId] = useState<string | null>(
    mention.mention_type?.id || null
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Location state
  const [lat, setLat] = useState(mention.lat.toString());
  const [lng, setLng] = useState(mention.lng.toString());
  const [fullAddress, setFullAddress] = useState<string | null>(mention.full_address);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);

  // Track whether user changed location (guards reverse geocode from firing on mount)
  const locationChangedByUser = useRef(false);

  // Media state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(mention.image_url || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charLimit = accountPlan === 'contributor' ? 10000 : 240;

  // ── Location ──

  const handleLocationSelect = useCallback((newLat: number, newLng: number) => {
    locationChangedByUser.current = true;
    setLat(newLat.toString());
    setLng(newLng.toString());
    setShowFullscreenMap(false);

    // Reverse geocode only on user-initiated location change
    (async () => {
      setIsReverseGeocoding(true);
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${newLng},${newLat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=place,neighborhood,address`
        );
        const data = await res.json();
        setFullAddress(data.features?.[0]?.place_name ?? null);
      } catch {
        setFullAddress(null);
      } finally {
        setIsReverseGeocoding(false);
      }
    })();
  }, []);

  // ── Media ──

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    setIsUploadingImage(true);
    try {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/mentions/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('mentions-media')
        .upload(path, imageFile, { cacheControl: '3600', upsert: false });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data: urlData } = supabase.storage.from('mentions-media').getPublicUrl(path);
      if (!urlData?.publicUrl) throw new Error('Failed to get image URL');
      return urlData.publicUrl;
    } finally {
      setIsUploadingImage(false);
    }
  };

  // ── Submit ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Upload new image if selected
      let imageUrl = mention.image_url;
      if (imageFile) {
        imageUrl = await uploadImage();
      } else if (!imagePreview && mention.image_url) {
        imageUrl = null; // Image was removed
      }

      // Build unified update payload
      const updateData: Parameters<typeof MentionService.updateMention>[1] = {
        description: description.trim() || null,
      };

      // Media
      if (imageFile || (!imagePreview && mention.image_url)) {
        updateData.image_url = imageUrl;
        updateData.video_url = null;
        updateData.media_type = imageUrl ? 'image' : 'none';
      }

      // Location
      const newLat = parseFloat(lat);
      const newLng = parseFloat(lng);
      if (newLat !== mention.lat || newLng !== mention.lng) {
        updateData.lat = newLat;
        updateData.lng = newLng;
        updateData.full_address = fullAddress;
      }

      // Mention type
      if (selectedMentionTypeId !== (mention.mention_type?.id ?? null)) {
        updateData.mention_type_id = selectedMentionTypeId;
      }

      // Collection (passed through; service ignores if maps.pins doesn't support it)
      updateData.collection_id = selectedCollectionId;

      // Single service call — handles dual-write to maps.pins + public.map_pins
      await MentionService.updateMention(mention.id, updateData);

      router.push(`/mention/${mention.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update mention');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* ── Header card ── */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] flex items-center gap-2">
          <Link
            href={`/mention/${mention.id}`}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            <span>Back</span>
          </Link>
          <div className="flex-1 text-center">
            <h1 className="text-xs font-semibold text-gray-900">Edit Mention</h1>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || isUploadingImage}
            className="px-2.5 py-1 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || isUploadingImage ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-[10px]">
            <p className="text-[10px] text-red-600">{error}</p>
          </div>
        )}

        {/* ── Card: Location ── */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide">Location</label>
          <div className="relative w-full h-28 rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
            {lat && lng && (
              <div className="absolute inset-0 bg-green-500/15 flex items-center justify-center z-10">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowFullscreenMap(true)}
              className={`relative z-20 flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded transition-colors ${
                lat && lng
                  ? 'bg-green-50 border-green-300 text-green-900 hover:bg-green-100'
                  : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
              }`}
            >
              {lat && lng && <CheckCircleIcon className="w-3 h-3 text-green-600" />}
              <span>Change Location</span>
            </button>
          </div>
          {lat && lng && (
            <div className="space-y-0.5">
              {isReverseGeocoding ? (
                <p className="text-[10px] text-gray-400">Loading address...</p>
              ) : fullAddress ? (
                <p className="text-[10px] text-gray-600">{fullAddress}</p>
              ) : null}
              <p className="text-[10px] text-gray-500 font-mono">{lat}, {lng}</p>
            </div>
          )}
        </div>

        {/* ── Card: Image ── */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide">Image</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative">
              <div className="relative w-full aspect-video rounded-md border border-gray-200 overflow-hidden bg-gray-100">
                <Image
                  src={imagePreview}
                  alt="Mention image"
                  fill
                  className="object-cover"
                  unoptimized={imagePreview.includes('supabase.co') || imagePreview.startsWith('data:')}
                />
                {/* Overlay actions: replace + remove */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-1.5 py-0.5 bg-black/50 hover:bg-black/70 rounded text-[10px] font-medium text-white transition-colors"
                    aria-label="Replace image"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    aria-label="Remove image"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-gray-500 text-center">
                {imageFile ? 'New image selected' : 'Current image'}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 border border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <CameraIcon className="w-4 h-4 text-gray-400" />
              <span className="text-[10px] text-gray-500">Click to add image</span>
            </button>
          )}
        </div>

        {/* ── Card: Description ── */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none"
            placeholder="What makes this place special?"
            maxLength={charLimit}
          />
          <div className="text-[10px] text-gray-500 text-right">{description.length} / {charLimit}</div>
        </div>

        {/* ── Card: Category + Collection ── */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          {mentionTypes.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide">Category</label>
              <select
                value={selectedMentionTypeId || ''}
                onChange={(e) => setSelectedMentionTypeId(e.target.value || null)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              >
                <option value="">No category</option>
                {mentionTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </select>
            </div>
          )}

          {collections.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide">Collection</label>
              <select
                value={selectedCollectionId || ''}
                onChange={(e) => setSelectedCollectionId(e.target.value || null)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              >
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Card: Actions ── */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] flex items-center gap-2">
          <Link
            href={`/mention/${mention.id}`}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || isUploadingImage}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || isUploadingImage ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* ── Fullscreen Map Modal ── */}
      {showFullscreenMap && (
        <div className="fixed inset-0 z-50 bg-white" style={{ width: '100vw', height: '100vh' }}>
          <div className="relative w-full h-full">
            <div className="absolute top-4 left-4 z-10">
              <button
                type="button"
                onClick={() => setShowFullscreenMap(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
            </div>
            <InlineMap
              lat={lat}
              lng={lng}
              onLocationSelect={handleLocationSelect}
              fullscreen
            />
          </div>
        </div>
      )}
    </>
  );
}
