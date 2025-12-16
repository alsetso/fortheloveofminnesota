'use client';

import { useState, useCallback, useMemo } from 'react';
import { MapPinIcon, ListBulletIcon, MapIcon } from '@heroicons/react/24/outline';

export type MapDialogAction = 'pin' | 'filter' | 'location' | null;

interface MapDialogProps {
  onActionSelect: (action: MapDialogAction) => void;
  activeAction: MapDialogAction;
  content?: React.ReactNode;
  canCreatePin: boolean;
  userLocation?: {
    lat: number;
    lng: number;
    address?: string;
  } | null;
}

export function MapDialog({
  onActionSelect,
  activeAction,
  content,
  canCreatePin,
  userLocation,
}: MapDialogProps) {
  const hasContent = !!content;

  // Memoize action handlers
  const handlePinClick = useCallback(() => {
    onActionSelect(activeAction === 'pin' ? null : 'pin');
  }, [activeAction, onActionSelect]);


  const handleFilterClick = useCallback(() => {
    onActionSelect(activeAction === 'filter' ? null : 'filter');
  }, [activeAction, onActionSelect]);

  const handleLocationClick = useCallback(() => {
    onActionSelect(activeAction === 'location' ? null : 'location');
  }, [activeAction, onActionSelect]);

  // Memoize container styles - match ProfileTypesTopbar style
  // Fixed width to maintain consistency across all states
  const containerStyle = useMemo(() => ({
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
    width: hasContent ? '20rem' : 'fit-content',
    minWidth: hasContent ? '20rem' : 'auto',
  }), [hasContent]);

  // Memoize content area styles - match ProfileTypesTopbar expanded style
  const contentAreaStyle = useMemo(() => ({
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: '100%',
  }), []);

  return (
    <div 
      className="absolute top-4 right-4 z-[101] pointer-events-auto"
      role="toolbar"
      aria-label="Map actions"
    >
      <div 
        className="rounded-2xl border shadow-xl overflow-visible transition-all duration-200"
        style={containerStyle}
      >
        {/* Icon Bar - Four Icons - Compact Style */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* Pins Icon */}
          <button
            onClick={handlePinClick}
            disabled={!canCreatePin}
            aria-label={canCreatePin ? 'Create Pin' : 'Zoom to 15x or more to create pins'}
            aria-disabled={!canCreatePin}
            className={`
              flex items-center justify-center px-2.5 py-1 rounded-lg font-medium text-xs transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-transparent
              ${activeAction === 'pin'
                ? 'bg-white/40 text-gray-900 shadow-sm'
                : 'bg-white/10 text-gray-700 hover:bg-white/20'
              }
              ${!canCreatePin ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
            `}
          >
            <MapPinIcon className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* List Icon */}
          <button
            onClick={handleFilterClick}
            aria-label="Filters"
            aria-pressed={activeAction === 'filter'}
            className={`
              flex items-center justify-center px-2.5 py-1 rounded-lg font-medium text-xs transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-transparent
              ${activeAction === 'filter'
                ? 'bg-white/40 text-gray-900 shadow-sm'
                : 'bg-white/10 text-gray-700 hover:bg-white/20'
              }
              cursor-pointer active:scale-95
            `}
          >
            <ListBulletIcon className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Location Icon */}
          <button
            onClick={handleLocationClick}
            aria-label="Find My Location"
            aria-pressed={activeAction === 'location'}
            className={`
              flex items-center justify-center px-2.5 py-1 rounded-lg font-medium text-xs transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-transparent
              ${activeAction === 'location'
                ? 'bg-white/40 text-gray-900 shadow-sm'
                : 'bg-white/10 text-gray-700 hover:bg-white/20'
              }
              cursor-pointer active:scale-95
            `}
          >
            <MapIcon className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Area - Below Icons - Compact Glass Design */}
        {content && (
          <div 
            className="px-3 pb-3 max-h-[300px] overflow-y-auto overflow-x-visible border-t border-white/20 transition-opacity duration-200 scrollbar-hide"
            style={contentAreaStyle}
            role="region"
            aria-label="Action content"
          >
            <div className="pt-2.5 relative">
              {content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

