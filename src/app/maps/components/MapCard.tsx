'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { EyeIcon, UsersIcon, GlobeAltIcon, LockClosedIcon, StarIcon, ShieldCheckIcon, PencilIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from '../types';

interface MapCardProps {
  map: MapItem;
  account: { plan?: string | null; id?: string } | null;
  onClick?: () => void;
  showRoleIcon?: boolean;
}

export default function MapCard({ 
  map, 
  account: userAccount, 
  onClick,
  showRoleIcon = false
}: MapCardProps) {
  const router = useRouter();
  const { openComingSoon } = useAppModalContextSafe();

  if (!map) return null;

  // Memoize canAccess to prevent recalculation
  const canAccess = useMemo(
    () => !map.requiresPro || userAccount?.plan === 'contributor' || userAccount?.plan === 'plus',
    [map.requiresPro, userAccount?.plan]
  );

  // Check if atlas map is coming soon
  const isComingSoon = useMemo(
    () => (map as any).map_type === 'atlas' && map.status === 'coming_soon',
    [(map as any).map_type, map.status]
  );

  // Generate map preview URL using Mapbox Static Images API - larger size for card
  const previewUrl = useMemo(() => {
    // For atlas maps, use thumbnail if available
    if ((map as any).map_type === 'atlas' && map.thumbnail) {
      return map.thumbnail;
    }
    
    if (!MAP_CONFIG?.MAPBOX_TOKEN) return null;
    
    const mapStyle = map.settings?.appearance?.map_style || 'street';
    let styleId = 'streets-v12';
    if (mapStyle === 'satellite') {
      styleId = 'satellite-v9';
    } else if (mapStyle === 'light') {
      styleId = 'light-v11';
    } else if (mapStyle === 'dark') {
      styleId = 'dark-v11';
    }
    
    // Use map-specific center/zoom from settings if available, otherwise use defaults
    const center = map.settings?.appearance?.meta?.center || MAP_CONFIG.DEFAULT_CENTER;
    const zoom = map.settings?.appearance?.meta?.zoom ?? MAP_CONFIG.DEFAULT_ZOOM;
    const [lng, lat] = center;
    const width = 400;
    const height = 240;
    
    return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${MAP_CONFIG.MAPBOX_TOKEN}`;
  }, [(map as any)?.map_type, map?.thumbnail, map?.settings?.appearance?.map_style, map?.settings?.appearance?.meta?.center, map?.settings?.appearance?.meta?.zoom]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
      return;
    }

    // For coming soon atlas maps, show coming soon modal
    if (isComingSoon) {
      e.preventDefault();
      openComingSoon(map.name);
      return;
    }

    // For professional maps without access, redirect to billing
    if (map.requiresPro && !canAccess) {
      e.preventDefault();
      router.push('/billing');
      return;
    }

    // For user-generated maps, navigate to map page
    if ((map as any).map_type === 'user' && !map.href) {
      e.preventDefault();
      router.push(getMapUrl(map));
      return;
    }

    // For atlas maps, navigate to atlas map page
    if ((map as any).map_type === 'atlas' && map.href) {
      e.preventDefault();
      router.push(map.href);
      return;
    }

    // For maps with href and access, let Link handle it
    if (map.href && canAccess) {
      return; // Let Link handle navigation
    }
  }, [isComingSoon, map.name, map.requiresPro, (map as any).map_type, map.href, map.id, canAccess, openComingSoon, router, onClick]);

  const content = (
    <div 
      className="bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer group overflow-hidden relative"
      onClick={handleClick}
    >
      {/* Large Map Preview Area - Full Card Height */}
      <div className="w-full h-48 bg-gray-100 relative overflow-hidden">
        {previewUrl ? (
          (map as any).map_type === 'atlas' && map.thumbnail ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <Image
                src={previewUrl}
                alt={map.name}
                width={400}
                height={240}
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <Image
              src={previewUrl}
              alt={map.name}
              fill
              className="object-cover"
              unoptimized
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl text-gray-400">🗺️</span>
          </div>
        )}
        
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
        
        {/* Overlay badges - Left side */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
          {/* Visibility Icon */}
          {map.visibility && (
            <div className="bg-white/90 backdrop-blur-sm rounded-md p-1" title={map.visibility === 'public' ? 'Public map' : 'Private map'}>
              {map.visibility === 'public' ? (
                <GlobeAltIcon className="w-3 h-3 text-gray-600" />
              ) : (
                <LockClosedIcon className="w-3 h-3 text-gray-600" />
              )}
            </div>
          )}
          
          {/* Role Icon (for My Maps view) */}
          {showRoleIcon && map.current_user_role && (
            <div className="bg-white/90 backdrop-blur-sm rounded-md p-1" title={`You are ${map.current_user_role}`}>
              {map.current_user_role === 'owner' ? (
                <StarIcon className="w-3 h-3 text-amber-500" />
              ) : map.current_user_role === 'manager' ? (
                <ShieldCheckIcon className="w-3 h-3 text-blue-500" />
              ) : (
                <PencilIcon className="w-3 h-3 text-gray-500" />
              )}
            </div>
          )}
        </div>

        {/* Role Label - Top Right */}
        {map.current_user_role && (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-white/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center justify-center">
              <span className="text-[10px] font-medium text-gray-700 capitalize text-center">
                {map.current_user_role}
              </span>
            </div>
          </div>
        )}

        {/* Info Section - Overlaid at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-[10px] space-y-1.5 z-10">
          {/* Map Name */}
          <h3 className="text-xs font-semibold text-white line-clamp-1 drop-shadow-sm">
            {map.name}
          </h3>

          {/* Map Description */}
          {map.description && (
            <p className="text-xs text-white/90 line-clamp-1 drop-shadow-sm">
              {map.description}
            </p>
          )}

          {/* Stats Row */}
          <div className="flex items-center gap-3 text-[10px] text-white/80">
            {map.member_count !== undefined && (
              <div className="flex items-center gap-1">
                <UsersIcon className="w-3 h-3" />
                <span>{map.member_count}</span>
              </div>
            )}
            {map.view_count !== undefined && (
              <div className="flex items-center gap-1">
                <EyeIcon className="w-3 h-3" />
                <span>{map.view_count.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Wrap in Link only if it has href and can access (for community/professional maps)
  if (map.href && canAccess && (map as any).map_type !== 'atlas' && !onClick) {
    return (
      <Link href={map.href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
