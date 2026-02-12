'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import {
  CameraIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  PhotoIcon,
  VideoCameraIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';

interface Slide {
  id?: string;
  position: number;
  duration_seconds: number;
  expires_at: string;
  background_type: 'image' | 'video' | 'color';
  background_media_id?: string;
  background_media_url?: string;
  background_color?: string;
}

const DEFAULT_DURATION = 5; // 5 seconds per slide
const DEFAULT_EXPIRY_HOURS = 24;

/**
 * Story Composer - Manage slides for a story
 */
export default function StoryComposer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account, user } = useAuthStateSafe();
  const supabase = useSupabaseClient();
  
  const storyId = searchParams?.get('storyId');
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing slides if storyId is provided
  useEffect(() => {
    if (storyId && account) {
      loadSlides();
    }
  }, [storyId, account]);

  const loadSlides = async () => {
    if (!storyId || !account) return;

    setIsLoading(true);
    try {
      const { data, error: fetchError } = await (supabase as any)
        .schema('stories')
        .from('slides')
        .select('*')
        .eq('story_id', storyId)
        .order('position', { ascending: true });

      if (fetchError) throw fetchError;

      // Fetch media URLs for slides with background_media_id
      const slidesWithMedia = await Promise.all(
        (data || []).map(async (slide: any) => {
          if (slide.background_media_id) {
            // Get media URL from media table
            const { data: mediaData } = await (supabase as any)
              .schema('content')
              .from('media')
              .select('url')
              .eq('id', slide.background_media_id)
              .single();
            
            return {
              ...slide,
              background_media_url: mediaData?.url || null,
            };
          }
          return slide;
        })
      );

      setSlides(slidesWithMedia);
    } catch (err: any) {
      console.error('Error loading slides:', err);
      setError('Failed to load slides');
    } finally {
      setIsLoading(false);
    }
  };

  const addSlide = () => {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_EXPIRY_HOURS);

    const newSlide: Slide = {
      position: slides.length,
      duration_seconds: DEFAULT_DURATION,
      expires_at: expiresAt.toISOString(),
      background_type: 'color',
      background_color: '#000000',
    };

    setSlides([...slides, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  const deleteSlide = (index: number) => {
    const newSlides = slides.filter((_, i) => i !== index);
    // Reorder positions
    const reorderedSlides = newSlides.map((slide, i) => ({
      ...slide,
      position: i,
    }));
    setSlides(reorderedSlides);
    if (activeSlideIndex === index) {
      setActiveSlideIndex(null);
    } else if (activeSlideIndex !== null && activeSlideIndex > index) {
      setActiveSlideIndex(activeSlideIndex - 1);
    }
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === slides.length - 1)
    ) {
      return;
    }

    const newSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [
      newSlides[targetIndex],
      newSlides[index],
    ];

    // Update positions
    const reorderedSlides = newSlides.map((slide, i) => ({
      ...slide,
      position: i,
    }));

    setSlides(reorderedSlides);
    setActiveSlideIndex(targetIndex);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !account || !user) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setError('Please select an image or video file');
      return;
    }

    // Validate file size
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`${isVideo ? 'Video' : 'Image'} is too large (max ${maxSize / 1024 / 1024}MB)`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/stories/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('feed-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('feed-images')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Create media record
      const { data: mediaData, error: mediaError } = await (supabase as any)
        .schema('content')
        .from('media')
        .insert({
          url: urlData.publicUrl,
          type: isVideo ? 'video' : 'image',
          account_id: account.id,
        })
        .select('id')
        .single();

      if (mediaError) throw mediaError;

      // Add slide with media
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + DEFAULT_EXPIRY_HOURS);

      const newSlide: Slide = {
        position: slides.length,
        duration_seconds: DEFAULT_DURATION,
        expires_at: expiresAt.toISOString(),
        background_type: isVideo ? 'video' : 'image',
        background_media_id: mediaData.id,
        background_media_url: urlData.publicUrl,
      };

      setSlides([...slides, newSlide]);
      setActiveSlideIndex(slides.length);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateSlide = (index: number, updates: Partial<Slide>) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], ...updates };
    setSlides(newSlides);
  };

  const saveSlides = async () => {
    if (!storyId || !account || slides.length === 0) {
      setError('Please add at least one slide');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const slidesToSave = slides.map((slide) => ({
        position: slide.position,
        duration_seconds: slide.duration_seconds,
        expires_at: slide.expires_at,
        background_type: slide.background_type,
        background_media_id: slide.background_media_id || null,
        background_color: slide.background_color || null,
      }));

      const response = await fetch(`/api/stories/${storyId}/slides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(slidesToSave),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save slides');
      }

      // Redirect to stories list
      router.push('/stories');
    } catch (err: any) {
      console.error('Error saving slides:', err);
      setError(err.message || 'Failed to save slides');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || !account) {
    return (
      <div className="max-w-[1000px] mx-auto w-full px-4 py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
          <p className="text-sm text-white/60 mb-4">
            Please sign in to create stories
          </p>
        </div>
      </div>
    );
  }

  if (!storyId) {
    return (
      <div className="max-w-[1000px] mx-auto w-full px-4 py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">No Story Selected</h2>
          <p className="text-sm text-white/60 mb-4">
            Please create a story first
          </p>
          <button
            onClick={() => router.push('/stories/new')}
            className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors"
          >
            Create Story
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Story Composer</h1>
        <p className="text-sm text-white/60">
          Add slides to your story with photos, videos, or colors
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-md">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Slides Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`relative aspect-[9/16] rounded-md overflow-hidden border-2 cursor-pointer transition-colors ${
              activeSlideIndex === index
                ? 'border-lake-blue'
                : 'border-white/10 hover:border-white/20'
            }`}
            onClick={() => setActiveSlideIndex(index)}
          >
            {/* Slide Preview */}
            {slide.background_type === 'image' && slide.background_media_url && (
              <Image
                src={slide.background_media_url}
                alt={`Slide ${index + 1}`}
                fill
                className="object-cover"
              />
            )}
            {slide.background_type === 'video' && slide.background_media_url && (
              <video
                src={slide.background_media_url}
                className="w-full h-full object-cover"
                muted
              />
            )}
            {slide.background_type === 'color' && (
              <div
                className="w-full h-full"
                style={{ backgroundColor: slide.background_color }}
              />
            )}

            {/* Slide Number */}
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
              {index + 1}
            </div>

            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSlide(index);
              }}
              className="absolute top-2 right-2 p-1 bg-black/50 rounded hover:bg-black/70 transition-colors"
            >
              <TrashIcon className="w-4 h-4 text-white" />
            </button>
          </div>
        ))}

        {/* Add Slide Button */}
        <button
          onClick={addSlide}
          className="aspect-[9/16] rounded-md border-2 border-dashed border-white/20 hover:border-white/40 flex flex-col items-center justify-center gap-2 transition-colors"
        >
          <PlusIcon className="w-8 h-8 text-white/60" />
          <span className="text-xs text-white/60">Add Slide</span>
        </button>
      </div>

      {/* Slide Editor */}
      {activeSlideIndex !== null && slides[activeSlideIndex] && (
        <div className="bg-surface border border-white/10 rounded-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Edit Slide {activeSlideIndex + 1}
          </h3>

          <div className="space-y-4">
            {/* Background Type */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Background Type
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className={`px-4 py-2 rounded-md border transition-colors ${
                    slides[activeSlideIndex].background_type === 'image'
                      ? 'border-lake-blue bg-lake-blue/10 text-white'
                      : 'border-white/10 bg-surface-accent text-white/70 hover:border-white/20'
                  }`}
                >
                  <PhotoIcon className="w-4 h-4 inline mr-2" />
                  Image
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className={`px-4 py-2 rounded-md border transition-colors ${
                    slides[activeSlideIndex].background_type === 'video'
                      ? 'border-lake-blue bg-lake-blue/10 text-white'
                      : 'border-white/10 bg-surface-accent text-white/70 hover:border-white/20'
                  }`}
                >
                  <VideoCameraIcon className="w-4 h-4 inline mr-2" />
                  Video
                </button>
                <button
                  onClick={() =>
                    updateSlide(activeSlideIndex, {
                      background_type: 'color',
                      background_color: '#000000',
                    })
                  }
                  className={`px-4 py-2 rounded-md border transition-colors ${
                    slides[activeSlideIndex].background_type === 'color'
                      ? 'border-lake-blue bg-lake-blue/10 text-white'
                      : 'border-white/10 bg-surface-accent text-white/70 hover:border-white/20'
                  }`}
                >
                  <PaintBrushIcon className="w-4 h-4 inline mr-2" />
                  Color
                </button>
              </div>
            </div>

            {/* Color Picker */}
            {slides[activeSlideIndex].background_type === 'color' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Background Color
                </label>
                <input
                  type="color"
                  value={slides[activeSlideIndex].background_color || '#000000'}
                  onChange={(e) =>
                    updateSlide(activeSlideIndex, {
                      background_color: e.target.value,
                    })
                  }
                  className="w-full h-10 rounded-md cursor-pointer"
                />
              </div>
            )}

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Duration (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={slides[activeSlideIndex].duration_seconds}
                onChange={(e) =>
                  updateSlide(activeSlideIndex, {
                    duration_seconds: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 bg-surface-accent border border-white/10 rounded-md text-white"
              />
            </div>

            {/* Move Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => moveSlide(activeSlideIndex, 'up')}
                disabled={activeSlideIndex === 0}
                className="px-4 py-2 bg-surface-accent border border-white/10 rounded-md text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpIcon className="w-4 h-4 inline mr-2" />
                Move Up
              </button>
              <button
                onClick={() => moveSlide(activeSlideIndex, 'down')}
                disabled={activeSlideIndex === slides.length - 1}
                className="px-4 py-2 bg-surface-accent border border-white/10 rounded-md text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowDownIcon className="w-4 h-4 inline mr-2" />
                Move Down
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-surface-accent text-white/70 rounded-md hover:bg-surface-accent/80 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={saveSlides}
          disabled={isSaving || slides.length === 0}
          className="px-6 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSaving ? 'Saving...' : `Save Story (${slides.length} slide${slides.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  );
}
