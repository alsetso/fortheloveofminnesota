'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { EyeIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { MapItem } from '../types';

interface MapCardProps {
  map: MapItem;
  account: { plan?: string | null } | null;
}

export default function MapCard({ map, account: userAccount }: MapCardProps) {
  const router = useRouter();
  const { openUpgrade } = useAppModalContextSafe();
  
  if (!map) return null;
  
  // Memoize canAccess to prevent recalculation
  const canAccess = useMemo(
    () => !map.requiresPro || userAccount?.plan === 'pro' || userAccount?.plan === 'plus',
    [map.requiresPro, userAccount?.plan]
  );
  
  // Generate map preview URL using Mapbox Static Images API
  // Format: https://api.mapbox.com/styles/v1/mapbox/{style_id}/static/{lon},{lat},{zoom}/{width}x{height}@2x?access_token={token}
  const previewUrl = useMemo(() => {
    if (!MAP_CONFIG?.MAPBOX_TOKEN) return null;
    
    const mapStyle = map.map_style || 'street';
    let styleId = 'streets-v12';
    if (mapStyle === 'satellite') {
      styleId = 'satellite-v9';
    } else if (mapStyle === 'light') {
      styleId = 'light-v11';
    } else if (mapStyle === 'dark') {
      styleId = 'dark-v11';
    }
    
    // Use map-specific center/zoom from meta if available, otherwise use defaults
    const center = map.meta?.center || MAP_CONFIG.DEFAULT_CENTER;
    const zoom = map.meta?.zoom ?? MAP_CONFIG.DEFAULT_ZOOM;
    const [lng, lat] = center;
    const width = 300;
    const height = 200;
    
    return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${MAP_CONFIG.MAPBOX_TOKEN}`;
  }, [map?.map_style, map?.meta?.center, map?.meta?.zoom]);

  // Truncate description to 90 characters
  const truncatedDescription = useMemo(() => {
    if (!map.description) return null;
    if (map.description.length <= 90) return map.description;
    return map.description.substring(0, 90).trim() + '...';
  }, [map.description]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // For professional maps without access, show upgrade modal
    if (map.requiresPro && !canAccess) {
      e.preventDefault();
      openUpgrade('professional-maps');
      return;
    }

    // For user-generated maps, navigate to map page
    if (map.map_type === 'user' && !map.href) {
      e.preventDefault();
      router.push(`/map/${map.id}`);
      return;
    }

    // For maps with href and access, let Link handle it
    if (map.href && canAccess) {
      return; // Let Link handle navigation
    }
  }, [map.requiresPro, map.map_type, map.href, map.id, canAccess, openUpgrade, router]);

  const content = (
    <div 
      className={`bg-white border border-gray-200 rounded-md overflow-hidden transition-colors cursor-pointer flex flex-col w-full ${
        canAccess ? 'hover:bg-gray-50' : 'opacity-75'
      }`}
      onClick={handleClick}
    >
      {/* Map Preview - Rectangle with compact padding */}
      {previewUrl && (
        <div className="w-full bg-white flex-shrink-0 p-1">
          <div className="w-full h-24 bg-gray-100 relative overflow-hidden rounded-md border border-gray-200">
            <Image
              src={previewUrl}
              alt={map.title}
              fill
              className="object-cover rounded-md"
              unoptimized
            />
            {/* Pro Locked Overlay - Only for professional maps without access */}
            {map.requiresPro && !canAccess && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-md">
                <div className="flex flex-col items-center gap-1">
                  <LockClosedIcon className="w-5 h-5 text-white" />
                  <span className="text-[9px] font-medium text-white">Pro</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Content with compact padding */}
      <div className="p-2 flex-1 flex flex-col min-h-0">
        {/* Title */}
        <h3 className="text-xs font-semibold text-gray-900 mb-0.5 line-clamp-1">{map.title}</h3>
        
        {/* Description - Truncated to 90 characters */}
        {truncatedDescription && (
          <p className="text-xs text-gray-600 mb-1 line-clamp-2">{truncatedDescription}</p>
        )}
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Bottom Section - Views and Account */}
        <div className="space-y-1 pt-1 border-t border-gray-200">
          {/* View Count */}
          {map.view_count !== undefined && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <EyeIcon className="w-3 h-3" />
              <span>{map.view_count.toLocaleString()} {map.view_count === 1 ? 'view' : 'views'}</span>
            </div>
          )}

          {/* Account Profile - Show for all maps with account data */}
          {map.account && (
            <div className="flex items-center gap-1">
              {map.account.image_url ? (
                <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                  <Image
                    src={map.account.image_url}
                    alt={map.account.username || 'User'}
                    width={16}
                    height={16}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] text-gray-500">
                    {(map.account.first_name?.[0] || map.account.username?.[0] || 'U').toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-[10px] text-gray-500 truncate">
                {map.account.username || 
                 (map.account.first_name && map.account.last_name 
                   ? `${map.account.first_name} ${map.account.last_name}`.trim()
                   : map.account.first_name || 'User')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Wrap in Link only if it has href and can access (for community maps)
  if (map.href && canAccess) {
    return (
      <Link href={map.href} className="block w-full sm:w-[150px] sm:flex-shrink-0">
        {content}
      </Link>
    );
  }

  return <div className="w-full sm:w-[150px] sm:flex-shrink-0">{content}</div>;
}

