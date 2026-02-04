'use client';

import type { NearbyPin } from './types';

interface NearbyPinsSectionProps {
  pins: NearbyPin[];
  loading: boolean;
}

/**
 * Nearby pins section - displays pins near the current map center
 */
export default function NearbyPinsSection({ pins, loading }: NearbyPinsSectionProps) {
  if (pins.length === 0 && !loading) return null;

  return (
    <div 
      className="p-[10px] border-b border-gray-200"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Nearby ({pins.length})
      </h3>
      {loading ? (
        <p className="text-xs text-gray-500">Loading nearby pins…</p>
      ) : (
        <ul className="space-y-2">
          {pins.map((pin) => (
            <li
              key={pin.id}
              className="flex items-start gap-2 p-2 rounded-md border border-gray-200 hover:bg-gray-50/50"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
