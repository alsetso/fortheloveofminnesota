'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { MentionService } from '@/features/mentions/services/mentionService';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import FirstMentionModal from '@/components/modals/FirstMentionModal';
import { supabase } from '@/lib/supabase';

interface CreateMentionContentProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  initialCoordinates?: { lat: number; lng: number } | null;
  initialAtlasMeta?: Record<string, any> | null;
  onMentionCreated?: () => void;
}

export default function CreateMentionContent({ 
  map, 
  mapLoaded,
  initialCoordinates,
  initialAtlasMeta,
  onMentionCreated 
}: CreateMentionContentProps) {
  const { user, account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'only_me'>('public');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(initialCoordinates || null);
  const [showFirstMentionModal, setShowFirstMentionModal] = useState(false);

  // Use initialCoordinates if provided, otherwise get map center coordinates
  useEffect(() => {
    if (initialCoordinates) {
      setCoordinates(initialCoordinates);
      setError(null);
    } else if (map && mapLoaded) {
      const mapboxMap = map as any;
      const center = mapboxMap.getCenter();
      if (center) {
        const lat = center.lat;
        const lng = center.lng;
        
        // Check if within Minnesota bounds
        if (MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
          setCoordinates({ lat, lng });
        } else {
          setCoordinates(null);
          setError('Map center is outside Minnesota');
        }
      }
    }
  }, [map, mapLoaded, initialCoordinates]);

  // Listen for map movement to update coordinates (only if no initialCoordinates provided)
  useEffect(() => {
    if (!map || !mapLoaded || initialCoordinates) return;

    const mapboxMap = map as any;
    const updateCoordinates = () => {
      const center = mapboxMap.getCenter();
      if (center) {
        const lat = center.lat;
        const lng = center.lng;
        
        if (MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
          setCoordinates({ lat, lng });
          setError(null);
        } else {
          setCoordinates(null);
          setError('Map center is outside Minnesota');
        }
      }
    };

    mapboxMap.on('moveend', updateCoordinates);
    
    return () => {
      mapboxMap.off('moveend', updateCoordinates);
    };
  }, [map, mapLoaded, initialCoordinates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      openWelcome();
      return;
    }

    if (!coordinates) {
      setError('Please center the map on a location in Minnesota');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const mentionData = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        description: description.trim() || null,
        visibility,
        atlas_meta: initialAtlasMeta || null,
      };

      const createdMention = await MentionService.createMention(mentionData, activeAccountId || undefined);
      
      // Check if this is the user's first mention
      if (activeAccountId) {
        try {
          const { count, error: countError } = await supabase
            .from('mentions')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', activeAccountId)
            .eq('archived', false);

          if (!countError && count === 1) {
            // This is the first mention!
            setShowFirstMentionModal(true);
          }
        } catch (err) {
          console.error('[CreateMentionContent] Error checking mention count:', err);
          // Continue even if check fails
        }
      }
      
      // Reset form
      setDescription('');
      setVisibility('public');
      
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('mention-created'));
      
      if (onMentionCreated) {
        onMentionCreated();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create mention';
      console.error('[CreateMentionContent] Error creating mention:', errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-xs text-gray-600">
          Sign in to create mentions on the map.
        </p>
        <button
          onClick={openWelcome}
          className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
      {/* Atlas Entity Label */}
      {initialAtlasMeta && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
          {initialAtlasMeta.icon_path && (
            <Image
              src={initialAtlasMeta.icon_path}
              alt={initialAtlasMeta.name || 'Entity'}
              width={20}
              height={20}
              className="w-5 h-5 object-contain flex-shrink-0"
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900">
              {initialAtlasMeta.name || 'Atlas Entity'}
            </div>
            {initialAtlasMeta.table_name && (
              <div className="text-[10px] text-gray-500 capitalize">
                {initialAtlasMeta.table_name.replace('_', ' ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <textarea
          value={description}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= 240) {
              setDescription(value);
            }
          }}
          maxLength={240}
          className="w-full px-0 py-0 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none bg-transparent"
          placeholder="What's going on here?"
          rows={4}
          disabled={isSubmitting || !coordinates}
        />
        <div className="flex items-center justify-end gap-2 mt-1">
          <span className={`text-[10px] ${description.length >= 240 ? 'text-red-500' : 'text-gray-400'}`}>
            {description.length}/240
          </span>
          {/* Submit Button - Only show if description has at least 1 character */}
          {description.trim().length > 0 && (
            <button
              type="submit"
              disabled={isSubmitting || !coordinates || !description.trim()}
              className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Create Mention"
            >
              {isSubmitting ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      </form>
      <FirstMentionModal
        isOpen={showFirstMentionModal}
        onClose={() => setShowFirstMentionModal(false)}
      />
    </>
  );
}

