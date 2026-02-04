'use client';

import { useState, useEffect } from 'react';
import type { NearbyPin } from './types';

interface AllPinsSectionProps {
  /** Maximum number of pins to show */
  limit?: number;
}

export default function AllPinsSection({ limit = 50 }: AllPinsSectionProps) {
  const [pins, setPins] = useState<NearbyPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllPins = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/maps/live/mentions');
        if (response.ok) {
          const data = await response.json();
          // API returns array directly or wrapped in { mentions: [...] }
          const mentions = Array.isArray(data) ? data : (data.mentions || []);
          setPins(mentions.slice(0, limit) as NearbyPin[]);
        }
      } catch (err) {
        console.error('Error fetching all pins:', err);
        setPins([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPins();
  }, [limit]);

  if (pins.length === 0 && !loading) return null;

  return (
    <div 
      className="flex-1 px-[10px] py-3"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      <h3 className="text-xs font-semibold text-gray-900 mb-2">
        All Pins ({pins.length})
      </h3>
      {loading ? (
        <p className="text-xs text-gray-500">Loading pins…</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide">
          {pins.map((pin) => (
            <button
              key={pin.id}
              type="button"
              className="w-full flex items-start gap-2 p-2 rounded-md border border-gray-200 hover:bg-gray-50/50 text-left"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
              }}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('live-search-pin-select', {
                    detail: { lat: pin.lat, lng: pin.lng },
                  })
                );
              }}
            >
              {pin.mention_type?.emoji && (
                <span className="text-lg flex-shrink-0">{pin.mention_type.emoji}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900">
                  {pin.mention_type?.name || 'Pin'}
                </p>
                {pin.description && (
                  <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                    {pin.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
