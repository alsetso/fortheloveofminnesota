'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftIcon, XMarkIcon, CameraIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import { CollectionService } from '@/features/collections/services/collectionService';
import { useAuthStateSafe } from '@/features/auth';
import type { Mention } from '@/types/mention';
import type { Collection } from '@/types/collection';
import { supabase } from '@/lib/supabase';
import InlineMap from '@/components/map/InlineMap';

type MentionType = { id: string; emoji: string; name: string };

export default function EditMentionPage() {
  const router = useRouter();
  const params = useParams();
  const mentionId = params?.id as string;
  const { user, account, activeAccountId } = useAuthStateSafe();
  
  const [mention, setMention] = useState<Mention | null>(null);
  const [description, setDescription] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [selectedMentionTypeId, setSelectedMentionTypeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Media state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Location state
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [fullAddress, setFullAddress] = useState<string | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);

  // Load mention data
  useEffect(() => {
    if (!mentionId || !user) return;

    const loadMention = async () => {
      setLoading(true);
      try {
        const mentions = await MentionService.getMentions({ account_id: activeAccountId || undefined });
        const foundMention = mentions.find(m => m.id === mentionId);
        
        if (!foundMention) {
          setError('Mention not found');
          return;
        }

        // Check if user owns this mention
        if (foundMention.account_id !== activeAccountId) {
          setError('You do not have permission to edit this mention');
          return;
        }

        setMention(foundMention);
        setDescription(foundMention.description || '');
        setSelectedCollectionId(foundMention.collection_id || null);
        setSelectedMentionTypeId(foundMention.mention_type?.id || null);
        setLat(foundMention.lat.toString());
        setLng(foundMention.lng.toString());
        setImagePreview(foundMention.image_url || null);
      } catch (err) {
        console.error('[EditMentionPage] Error loading mention:', err);
        setError('Failed to load mention');
      } finally {
        setLoading(false);
      }
    };

    loadMention();
  }, [mentionId, user, activeAccountId]);

  // Load collections
  useEffect(() => {
    if (!activeAccountId) {
      setCollections([]);
      return;
    }

    const loadCollections = async () => {
      try {
        const data = await CollectionService.getCollections(activeAccountId);
        setCollections(data);
      } catch (err) {
        console.error('[EditMentionPage] Error loading collections:', err);
      }
    };

    loadCollections();
  }, [activeAccountId]);

  // Load mention types
  useEffect(() => {
    const loadMentionTypes = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');
        
        if (data) {
          setMentionTypes(data);
        }
      } catch (err) {
        console.error('[EditMentionPage] Error loading mention types:', err);
      }
    };

    loadMentionTypes();
  }, []);

  // Reverse geocode location when lat/lng changes
  useEffect(() => {
    if (!lat || !lng) return;

    const reverseGeocode = async () => {
      setIsReverseGeocoding(true);
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=place,neighborhood,address`
        );
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          setFullAddress(data.features[0].place_name);
        } else {
          setFullAddress(null);
        }
      } catch (error) {
        console.error('Failed to reverse geocode:', error);
        setFullAddress(null);
      } finally {
        setIsReverseGeocoding(false);
      }
    };

    reverseGeocode();
  }, [lat, lng]);

  // Handle image selection
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setError('Please sign in to upload images');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image must be smaller than 5MB');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload image to Supabase storage
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;

    setIsUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/mentions/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('mentions-media')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('mentions-media')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL');
      }

      return urlData.publicUrl;
    } catch (err) {
      console.error('[EditMentionPage] Error uploading image:', err);
      throw err;
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Handle location selection from map
  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setLat(lat.toString());
    setLng(lng.toString());
    setShowFullscreenMap(false);
  }, []);

  const handleOpenFullscreenMap = useCallback(() => {
    setShowFullscreenMap(true);
  }, []);

  const handleCloseFullscreenMap = useCallback(() => {
    setShowFullscreenMap(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentionId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload image if new one selected
      let imageUrl = mention?.image_url || null;
      if (imageFile) {
        imageUrl = await uploadImage();
      } else if (!imagePreview && mention?.image_url) {
        // Image was removed
        imageUrl = null;
      }

      // Update location if changed
      const locationChanged = lat && lng && 
        (parseFloat(lat) !== mention?.lat || parseFloat(lng) !== mention?.lng);

      // Build update data
      const updateData: any = {
        description: description.trim() || null,
        collection_id: selectedCollectionId,
      };

      // Update media if changed
      if (imageFile || (!imagePreview && mention?.image_url)) {
        updateData.image_url = imageUrl;
        updateData.video_url = null;
        updateData.media_type = imageUrl ? 'image' : 'none';
      }

      // Update location if changed
      if (locationChanged) {
        updateData.lat = parseFloat(lat);
        updateData.lng = parseFloat(lng);
        updateData.full_address = fullAddress;
      }

      await MentionService.updateMention(mentionId, updateData);

      // Update mention_type_id if changed
      if (selectedMentionTypeId !== mention?.mention_type?.id) {
        await supabase
          .from('map_pins')
          .update({ mention_type_id: selectedMentionTypeId })
          .eq('id', mentionId)
          .eq('is_active', true);
      }

      router.push(`/mention/${mentionId}`);
    } catch (err: any) {
      console.error('[EditMentionPage] Error updating mention:', err);
      setError(err.message || 'Failed to update mention');
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">Please sign in to edit mentions</p>
          <Link href="/" className="text-sm text-red-600 hover:text-red-700">
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xs text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error && !mention) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href={`/mention/${mentionId}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-900">Edit Mention</h1>
            <div className="w-16" />
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg border border-red-200 p-6">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link 
            href={`/mention/${mentionId}`} 
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-900">Edit Mention</h1>
          {account && (
            <div className={`w-8 h-8 rounded-full overflow-hidden ${
              (account.plan === 'contributor' || account.plan === 'plus')
                ? 'p-[1px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                : 'border border-gray-200'
            }`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-white">
                {account.image_url ? (
                  <Image
                    src={account.image_url}
                    alt={account.username || 'Account'}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-gray-500">
                      {account.username?.[0]?.toUpperCase() || account.first_name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Location Map */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Location
            </label>
            <div className="relative w-full h-32 rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
              {/* Green overlay when location is selected */}
              {lat && lng && (
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10">
                  <CheckCircleIcon className="w-12 h-12 text-green-600" />
                </div>
              )}
              
              <button
                type="button"
                onClick={handleOpenFullscreenMap}
                className={`relative z-20 flex items-center gap-2 px-4 py-2 text-xs border rounded-md shadow-sm transition-colors ${
                  lat && lng
                    ? 'bg-green-50 border-green-300 text-green-900 hover:bg-green-100'
                    : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
                }`}
              >
                {lat && lng && (
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                )}
                <span>Change Location</span>
              </button>
            </div>
            {(lat && lng) && (
              <div className="mt-1 space-y-0.5">
                {isReverseGeocoding ? (
                  <p className="text-[10px] text-gray-400">Loading address...</p>
                ) : fullAddress ? (
                  <p className="text-[10px] text-gray-600">{fullAddress}</p>
                ) : null}
                <p className="text-[10px] text-gray-500">
                  Coordinates: {lat}, {lng}
                </p>
              </div>
            )}
          </div>

          {/* Media */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Image
            </label>
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
                    unoptimized={imagePreview.includes('supabase.co')}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    aria-label="Remove image"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-gray-500 text-center">
                  {imageFile ? 'New image selected' : 'Current image'}
                </p>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <CameraIcon className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-500">Click to add image</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none"
              placeholder="What makes this place special?"
              maxLength={account?.plan === 'contributor' || account?.plan === 'plus' ? 10000 : 240}
            />
            <div className="mt-1 text-[10px] text-gray-500 text-right">
              {description.length} / {account?.plan === 'contributor' || account?.plan === 'plus' ? 10000 : 240}
            </div>
          </div>

          {/* Mention Type */}
          {mentionTypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={selectedMentionTypeId || ''}
                onChange={(e) => setSelectedMentionTypeId(e.target.value || null)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              >
                <option value="">No category</option>
                {mentionTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.emoji} {type.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Collection */}
          {collections.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Personal Collection
              </label>
              <select
                value={selectedCollectionId || ''}
                onChange={(e) => setSelectedCollectionId(e.target.value || null)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              >
                <option value="">No collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.emoji} {collection.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center gap-2 pt-4">
            <Link
              href={`/mention/${mentionId}`}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImage}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isUploadingImage ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Fullscreen Map Modal */}
      {showFullscreenMap && (
        <div 
          className="fixed inset-0 z-50 bg-white" 
          style={{ width: '100vw', height: '100vh' }}
        >
          <div className="relative w-full h-full">
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={handleCloseFullscreenMap}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
            </div>
            <InlineMap
              lat={lat || mention?.lat.toString()}
              lng={lng || mention?.lng.toString()}
              onLocationSelect={handleLocationSelect}
              fullscreen={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
