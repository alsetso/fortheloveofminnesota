'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { EyeIcon, LockClosedIcon, ClockIcon, GlobeAltIcon, LinkIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { MapItem } from '../types';

interface MapCardProps {
  map: MapItem;
  account: { plan?: string | null; id?: string } | null;
  isFeatured?: boolean;
  isSmall?: boolean;
  showVisibility?: boolean;
  fullWidth?: boolean;
}

export default function MapCard({ map, account: userAccount, isFeatured = false, isSmall = false, showVisibility = false, fullWidth = false }: MapCardProps) {
  const router = useRouter();
  const { openUpgrade, openComingSoon } = useAppModalContextSafe();
  
  if (!map) return null;
  
  // Memoize canAccess to prevent recalculation
  const canAccess = useMemo(
    () => !map.requiresPro || userAccount?.plan === 'pro' || userAccount?.plan === 'plus',
    [map.requiresPro, userAccount?.plan]
  );

  // Check if atlas map is coming soon
  const isComingSoon = useMemo(
    () => map.map_type === 'atlas' && map.status === 'coming_soon',
    [map.map_type, map.status]
  );
  
  // Generate map preview URL using Mapbox Static Images API
  // Format: https://api.mapbox.com/styles/v1/mapbox/{style_id}/static/{lon},{lat},{zoom}/{width}x{height}@2x?access_token={token}
  const previewUrl = useMemo(() => {
    // For atlas maps, use thumbnail if available
    if (map.map_type === 'atlas' && map.thumbnail) {
      return map.thumbnail;
    }
    
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
  }, [map?.map_type, map?.thumbnail, map?.map_style, map?.meta?.center, map?.meta?.zoom]);

  // Truncate description to 90 characters
  const truncatedDescription = useMemo(() => {
    if (!map.description) return null;
    if (map.description.length <= 90) return map.description;
    return map.description.substring(0, 90).trim() + '...';
  }, [map.description]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // For coming soon atlas maps, show coming soon modal
    if (isComingSoon) {
      e.preventDefault();
      openComingSoon(map.title);
      return;
    }

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

    // For atlas maps, navigate to atlas map page
    if (map.map_type === 'atlas' && map.href) {
      e.preventDefault();
      router.push(map.href);
      return;
    }

    // For maps with href and access, let Link handle it
    if (map.href && canAccess) {
      return; // Let Link handle navigation
    }
  }, [isComingSoon, map.title, map.requiresPro, map.map_type, map.href, map.id, canAccess, openUpgrade, openComingSoon, router]);

  const content = (
    <div 
      className={`bg-white border border-gray-200 rounded-md overflow-hidden transition-colors cursor-pointer flex flex-col w-full ${
        canAccess && !isComingSoon ? 'hover:bg-gray-50' : 'opacity-75'
      }`}
      onClick={handleClick}
    >
      {/* Map Preview - Rectangle with compact padding */}
      {previewUrl && (
        <div className="w-full bg-white flex-shrink-0 p-1">
          <div className={`w-full ${isFeatured ? 'h-48' : isSmall ? 'h-16' : 'h-24'} bg-gray-100 relative overflow-hidden rounded-md border border-gray-200`}>
            {map.map_type === 'atlas' && map.thumbnail ? (
              // For atlas maps with thumbnail, use the icon directly
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <Image
                  src={previewUrl}
                  alt={map.title}
                  width={48}
                  height={48}
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <Image
                src={previewUrl}
                alt={map.title}
                fill
                className="object-cover rounded-md"
                unoptimized
              />
            )}
            {/* Pro Locked Overlay - Only for professional maps without access */}
            {map.requiresPro && !canAccess && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-md">
                <div className="flex flex-col items-center gap-1">
                  <LockClosedIcon className="w-5 h-5 text-white" />
                  <span className="text-[9px] font-medium text-white">Pro</span>
                </div>
              </div>
            )}
            {/* Coming Soon Overlay - For atlas maps with coming_soon status */}
            {isComingSoon && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-md">
                <div className="flex flex-col items-center gap-1">
                  <ClockIcon className="w-5 h-5 text-white" />
                  <span className="text-[9px] font-medium text-white">Coming Soon</span>
                </div>
              </div>
            )}
            {/* Owner Badge - Floating label in top left */}
            {map.account && (
              <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded flex items-center gap-1">
                {map.account.image_url ? (
                  <div className="w-3 h-3 rounded-full overflow-hidden flex-shrink-0 border border-white/20">
                    <Image
                      src={map.account.image_url}
                      alt={map.account.username || 'User'}
                      width={12}
                      height={12}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-3 h-3 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-[6px] text-white font-medium">
                      {(map.account.first_name?.[0] || map.account.username?.[0] || 'U').toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-[9px] font-medium text-white">
                  {map.account.username || 
                   (map.account.first_name && map.account.last_name 
                     ? `${map.account.first_name} ${map.account.last_name}`.trim()
                     : map.account.first_name || 'User')}
                </span>
              </div>
            )}
            {/* Visibility Badge - Floating label in bottom right */}
            {map.visibility && (
              <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 backdrop-blur-sm rounded flex items-center gap-1 ${
                map.visibility === 'public' 
                  ? 'bg-lime-500/90' 
                  : 'bg-black/70'
              }`}>
                {map.visibility === 'public' ? (
                  <>
                    <GlobeAltIcon className="w-2.5 h-2.5 text-white" />
                    <span className="text-[9px] font-medium text-white">Public</span>
                  </>
                ) : map.visibility === 'private' ? (
                  <>
                    <LockClosedIcon className="w-2.5 h-2.5 text-white" />
                    <span className="text-[9px] font-medium text-white">Private</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-2.5 h-2.5 text-white" />
                    <span className="text-[9px] font-medium text-white">Shared</span>
                  </>
                )}
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
        
        {/* Bottom Section - Views */}
        <div className="pt-1 border-t border-gray-200">
          {map.view_count !== undefined && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <EyeIcon className="w-3 h-3" />
              <span>{map.view_count.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Wrap in Link only if it has href and can access (for community/professional maps)
  // Atlas maps handle navigation in onClick handler
  const containerClass = fullWidth
    ? 'w-full'
    : isFeatured 
    ? 'w-full' 
    : isSmall
    ? 'w-full'
    : 'w-full';

  if (map.href && canAccess && map.map_type !== 'atlas') {
    return (
      <Link href={map.href} className={`block ${containerClass}`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={containerClass}>{content}</div>
  );
}

