'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, MapPinIcon, CheckIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import type { Mention } from '@/types/mention';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { Account } from '@/features/auth';
import Link from 'next/link';

interface LocationMentionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  /** Radius in kilometers for fetching nearby mentions */
  radius?: number;
  /** Optional mention ID to highlight in the list */
  selectedMentionId?: string | null;
}

/**
 * Slide-up sheet component for displaying mentions at a specific location
 * 
 * Fetches mentions within a radius of the given coordinates and displays them
 * in a scrollable list. Similar to MapEntitySlideUp but for multiple mentions.
 */
export default function LocationMentionsSheet({
  isOpen,
  onClose,
  lat,
  lng,
  radius = 0.5, // 500 meters default radius
  selectedMentionId,
}: LocationMentionsSheetProps) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedMentionRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch mentions when sheet opens or location changes
  useEffect(() => {
    if (!isOpen || !lat || !lng) {
      setMentions([]);
      return;
    }

    const fetchMentions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Calculate bounding box from center point and radius
        // Approximate: 1 degree latitude ≈ 111 km
        // Longitude varies by latitude, but for Minnesota (~45°N) ≈ 78 km
        const latDelta = radius / 111;
        const lngDelta = radius / 78; // Approximate for Minnesota latitude

        const bbox = {
          minLat: lat - latDelta,
          maxLat: lat + latDelta,
          minLng: lng - lngDelta,
          maxLng: lng + lngDelta,
        };

        const fetchedMentions = await MentionService.getMentions({ bbox });
        
        // If selectedMentionId is provided, move it to the top and highlight it
        let sortedMentions: Mention[];
        if (selectedMentionId) {
          const selectedMention = fetchedMentions.find(m => m.id === selectedMentionId);
          const otherMentions = fetchedMentions.filter(m => m.id !== selectedMentionId);
          
          // Sort others by distance
          const sortedOthers = otherMentions.sort((a, b) => {
            const distA = Math.sqrt(
              Math.pow(a.lat - lat, 2) + Math.pow(a.lng - lng, 2)
            );
            const distB = Math.sqrt(
              Math.pow(b.lat - lat, 2) + Math.pow(b.lng - lng, 2)
            );
            return distA - distB;
          });
          
          // Put selected mention first
          sortedMentions = selectedMention 
            ? [selectedMention, ...sortedOthers]
            : sortedOthers;
        } else {
          // Sort by distance from center (closest first)
          sortedMentions = fetchedMentions.sort((a, b) => {
            const distA = Math.sqrt(
              Math.pow(a.lat - lat, 2) + Math.pow(a.lng - lng, 2)
            );
            const distB = Math.sqrt(
              Math.pow(b.lat - lat, 2) + Math.pow(b.lng - lng, 2)
            );
            return distA - distB;
          });
        }

        setMentions(sortedMentions);
      } catch (err) {
        console.error('Error fetching location mentions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load mentions');
        setMentions([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to ensure map has zoomed before fetching
    const timeoutId = setTimeout(() => {
      fetchMentions();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [isOpen, lat, lng, radius, selectedMentionId]);

  // iOS-style slide-up animation
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (popupRef.current) {
          popupRef.current.style.transform = 'translate(-50%, 0)';
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      // Reset transform when closed
      if (popupRef.current) {
        popupRef.current.style.transform = 'translate(-50%, 100%)';
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Scroll to selected mention when sheet opens and mentions are loaded
  useEffect(() => {
    if (isOpen && selectedMentionId && selectedMentionRef.current && mentions.length > 0) {
      // Small delay to ensure sheet is fully rendered
      setTimeout(() => {
        selectedMentionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    }
  }, [isOpen, selectedMentionId, mentions.length]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - iOS style */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-up Panel - iOS style */}
      <div
        ref={popupRef}
        className="fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-3xl bg-white"
        style={{
          transform: 'translate(-50%, 100%)',
          maxWidth: '750px',
          width: 'calc(100% - 2rem)',
          minHeight: '40vh',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-1.5 pb-0.5">
          <div className="w-10 h-0.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header - Compact */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200">
          <div className="flex items-center gap-1.5">
            <MapPinIcon className="w-3.5 h-3.5 text-gray-600" />
            <h3 className="text-xs font-medium text-gray-900">
              Mentions
            </h3>
            {mentions.length > 0 && (
              <span className="text-[10px] text-gray-500">
                {mentions.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-0.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-[10px] py-3 space-y-2" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-xs text-red-600 text-center py-4">
              {error}
            </div>
          ) : mentions.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">
              No mentions found at this location
            </div>
          ) : (
            <div className="space-y-2">
              {mentions.map((mention) => {
                const isSelected = mention.id === selectedMentionId;
                return (
                  <div
                    key={mention.id}
                    ref={isSelected ? selectedMentionRef : null}
                  >
                    <Link
                      href={`/mention/${mention.id}`}
                      className={`block rounded-md p-[10px] transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                  <div className="flex items-start gap-2">
                    {/* Mention Type Emoji */}
                    {mention.mention_type && (
                      <div className="flex-shrink-0 text-sm text-gray-600 leading-none mt-0.5">
                        {mention.mention_type.emoji}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {mention.mention_type && (
                          <div className="text-xs font-medium text-gray-600">
                            {mention.mention_type.name}
                          </div>
                        )}
                        {isSelected && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-medium">
                            <CheckIcon className="w-3 h-3" />
                            <span>Selected</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-900 line-clamp-2">
                        {mention.description || 'No description'}
                      </p>
                      
                      {/* Account Info */}
                      {mention.account && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <ProfilePhoto
                            account={mention.account as unknown as Account}
                            size="xs"
                            editable={false}
                          />
                          <span className="text-[10px] text-gray-500">
                            @{mention.account.username}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Image Thumbnail (if available) */}
                    {mention.image_url && (
                      <div className="flex-shrink-0">
                        <img
                          src={mention.image_url}
                          alt="Mention"
                          className="w-10 h-10 rounded-md object-cover border border-gray-200"
                        />
                      </div>
                    )}
                  </div>
                </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
