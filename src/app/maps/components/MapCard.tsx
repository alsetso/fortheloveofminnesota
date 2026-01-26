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
  isPrimary?: boolean;
  variant?: 'default' | 'primary' | 'compact';
  onClick?: () => void;
}

export default function MapCard({ 
  map, 
  account: userAccount, 
  isFeatured = false, 
  isSmall = false, 
  showVisibility = false, 
  fullWidth = false,
  isPrimary = false,
  variant = 'default',
  onClick
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
    const width = 300;
    const height = 200;
    
    return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${MAP_CONFIG.MAPBOX_TOKEN}`;
  }, [map?.map_type, map?.thumbnail, map?.settings?.appearance?.map_style, map?.settings?.appearance?.meta?.center, map?.settings?.appearance?.meta?.zoom]);

  // Truncate description to 120 characters
  const truncatedDescription = useMemo(() => {
    if (!map.description) return null;
    if (map.description.length <= 120) return map.description;
    return map.description.substring(0, 120).trim() + '...';
  }, [map.description]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // For coming soon atlas maps, show coming soon modal
    if (isComingSoon) {
      e.preventDefault();
      openComingSoon(map.name || map.title || 'Map');
      return;
    }

    // For professional maps without access, redirect to billing
    if (map.requiresPro && !canAccess) {
      e.preventDefault();
      router.push('/billing');
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
  }, [isComingSoon, map.name, map.title, map.requiresPro, map.map_type, map.href, map.id, canAccess, openComingSoon, router]);

  // Determine variant based on props
  const cardVariant = variant === 'primary' || isPrimary ? 'primary' : variant === 'compact' ? 'compact' : 'default';
  const isPrimaryCard = cardVariant === 'primary';
  const isCompactCard = cardVariant === 'compact';

  // Removed - using aspect ratio instead for better responsive behavior

  const content = (
    <div 
      className={`bg-white border rounded-lg overflow-hidden transition-all cursor-pointer flex flex-col w-full h-full min-h-0 ${
        isPrimaryCard 
          ? 'border border-gray-200 shadow-md hover:shadow-lg hover:border-gray-300' 
          : 'border border-gray-200 hover:border-gray-300'
      } ${
        canAccess && !isComingSoon 
          ? 'hover:bg-gray-50' 
          : 'opacity-75'
      }`}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        } else {
          handleClick(e);
        }
      }}
    >
      {/* Map Preview - Fixed aspect ratio for consistent sizing */}
      {previewUrl && (
        <div className="w-full bg-white flex-shrink-0 p-1">
          <div className="w-full aspect-[4/3] bg-gray-100 relative overflow-hidden rounded-md border border-gray-200">
            {map.map_type === 'atlas' && map.thumbnail ? (
              // For atlas maps with thumbnail, use the icon directly
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <Image
                  src={previewUrl}
                  alt={map.name || map.title || 'Map preview'}
                  width={48}
                  height={48}
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <Image
                src={previewUrl || ''}
                alt={map.name || map.title || 'Map preview'}
                fill
                className="object-cover rounded-md"
                unoptimized
              />
            )}
            {/* Contributor Locked Overlay - Only for professional maps without access */}
            {map.requiresPro && !canAccess && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-md">
                <div className="flex flex-col items-center gap-1">
                  <LockClosedIcon className="w-5 h-5 text-white" />
                  <span className="text-[9px] font-medium text-white">Contributor</span>
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
            {/* Featured Badge - Top left for featured maps */}
            {(isPrimaryCard || map.settings?.presentation?.is_featured) && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-indigo-600 text-white rounded-md flex items-center gap-1 z-10">
                <span className="text-[10px] font-bold">FEATURED</span>
              </div>
            )}
            {/* Owner Badge - Floating label in top left (or top right if primary) */}
            {map.account && !map.settings?.presentation?.hide_creator && (
              <div className={`absolute ${isPrimaryCard ? 'top-2 right-2' : 'top-1 left-1'} px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded flex items-center gap-1 ${isPrimaryCard ? 'z-10' : ''}`}>
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
      
      {/* Content with responsive padding - flex to fill */}
      <div className="p-2 flex-1 flex flex-col min-h-0 justify-between">
        {/* Top Section */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Title */}
          <h3 className="text-xs font-semibold text-gray-900 mb-0.5 line-clamp-1">
            {map.name || map.title}
          </h3>
          
          {/* Description - Truncated to 120 characters */}
          {truncatedDescription && (
            <p className="text-xs text-gray-600 mb-1 line-clamp-2 flex-shrink-0">
              {truncatedDescription}
            </p>
          )}
        </div>
        
        {/* Bottom Section - Collection Type, Subscription, Views */}
        <div className="pt-1 border-t border-gray-200 space-y-1 flex-shrink-0">
          {/* Collection Type and Subscription Level */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Collection Type Badge */}
            {map.collection_type && map.collection_type !== 'community' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {map.collection_type === 'professional' ? 'Professional' : 
                 map.collection_type === 'gov' ? 'Government' : 
                 map.collection_type === 'atlas' ? 'Atlas' : 
                 map.collection_type === 'user' ? 'User' : map.collection_type}
              </span>
            )}
            {/* Subscription Level Badge */}
            {map.requiresPro && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                Contributor
              </span>
            )}
          </div>
          {/* Stats Row */}
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            {map.member_count !== undefined && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-gray-900">{map.member_count}</span>
                <span>members</span>
              </div>
            )}
            {map.view_count !== undefined && (
              <div className="flex items-center gap-1">
                <EyeIcon className="w-3 h-3" />
                <span>{map.view_count.toLocaleString()}</span>
              </div>
            )}
          </div>
          {/* Role Badge (for My Maps) */}
          {map.current_user_role && (
            <div className="mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 capitalize">
                {map.current_user_role}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Wrap in Link only if it has href and can access (for community/professional maps)
  // Atlas maps handle navigation in onClick handler
  // All cards same size regardless of variant - use fullWidth for grid layouts
  const containerClass = fullWidth
    ? 'w-full h-full' // Full width in grid, stretch to fill row
    : isSmall
    ? 'w-full lg:max-w-[120px] lg:flex-shrink-0'
    : 'w-full sm:max-w-[180px] md:max-w-[200px] lg:max-w-[220px] lg:flex-shrink-0'; // Fixed width for non-grid layouts

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

