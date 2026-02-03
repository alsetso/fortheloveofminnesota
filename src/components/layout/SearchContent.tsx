'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import type { PinData } from './types';

type PinPeriod = '24h' | '7d' | 'all';

interface SearchContentProps {
  /** Callback when a pin is clicked */
  onPinClick?: (pin: { lat: number; lng: number }) => void;
}

/**
 * Search content component - displays pin period filter and search results
 */
export default function SearchContent({ onPinClick }: SearchContentProps) {
  const pathname = usePathname();
  const [searchPins, setSearchPins] = useState<PinData[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState<string | null>(null);
  const [pinPeriod, setPinPeriod] = useState<PinPeriod>('all');

  const fetchLivePins = useCallback(async () => {
    setPinsLoading(true);
    setPinsError(null);
    try {
      const params = new URLSearchParams();
      if (pinPeriod !== 'all') params.set('period', pinPeriod);
      const res = await fetch(`/api/maps/live/pins${params.toString() ? `?${params}` : ''}`, { credentials: 'include' });
      if (!res.ok) {
        setPinsError('Failed to load pins');
        setSearchPins([]);
        return;
      }
      const data = await res.json();
      setSearchPins(data.pins ?? []);
    } catch {
      setPinsError('Failed to load pins');
      setSearchPins([]);
    } finally {
      setPinsLoading(false);
    }
  }, [pinPeriod]);

  useEffect(() => {
    fetchLivePins();
  }, [fetchLivePins]);

  const getRelativeTime = (date: string): string => {
    const now = new Date();
    const then = new Date(date);
    const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 604800)}w ago`;
    if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffSeconds / 31536000)}y ago`;
  };

  const pinTitle = (pin: PinData): string => {
    const text = (pin.caption ?? pin.description ?? pin.full_address ?? '').trim();
    return text || 'Pin';
  };

  const handlePinClick = (pin: PinData) => {
    if (typeof pin.lat !== 'number' || typeof pin.lng !== 'number') return;
    
    const url = `${pathname}${typeof window !== 'undefined' ? window.location.search : ''}`;
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', url);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      onPinClick?.({ lat: pin.lat, lng: pin.lng });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Pin period filter */}
      <div className="flex-shrink-0 border-b border-gray-200 p-2 bg-gray-50">
        <div className="flex gap-1 rounded-md bg-gray-100 p-0.5">
          {(['24h', '7d', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPinPeriod(p)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                pinPeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p === '24h' ? '24h' : p === '7d' ? '7 day' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {/* Pins list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 bg-gray-50">
        {pinsLoading && (
          <div className="p-[10px] border border-gray-200 rounded-md bg-white">
            <p className="text-xs text-gray-500">Loading…</p>
          </div>
        )}
        {!pinsLoading && pinsError && (
          <div className="p-[10px] border border-gray-200 rounded-md bg-white">
            <p className="text-xs text-gray-500">{pinsError}</p>
          </div>
        )}
        {!pinsLoading && !pinsError && searchPins.length === 0 && (
          <div className="p-[10px] border border-gray-200 rounded-md bg-white">
            <p className="text-xs text-gray-500">No pins in this period.</p>
          </div>
        )}
        {!pinsLoading && !pinsError && searchPins.length > 0 && searchPins.map((pin) => {
          const mediaImageUrl = pin.image_url ?? pin.media_url ?? null;
          const hasLocation = typeof pin.lat === 'number' && typeof pin.lng === 'number';
          
          return (
            <button
              key={pin.id}
              type="button"
              onClick={() => handlePinClick(pin)}
              disabled={!hasLocation}
              className="w-full flex items-center gap-2 p-[10px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                {mediaImageUrl ? (
                  <img
                    src={mediaImageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MapPinIcon className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {pinTitle(pin)}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {pin.account?.username ? (
                    <>@{pin.account.username}</>
                  ) : null}
                  {pin.account?.username ? ' · ' : null}
                  Live map · {getRelativeTime(pin.created_at)}
                  {typeof pin.view_count === 'number' && pin.view_count >= 0 && (
                    <> · {pin.view_count} {pin.view_count === 1 ? 'view' : 'views'}</>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
