'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { EyeIcon, InformationCircleIcon, UsersIcon, GlobeAltIcon, LockClosedIcon, StarIcon, ShieldCheckIcon, PencilIcon, EllipsisVerticalIcon, MapPinIcon, Square3Stack3DIcon, DocumentTextIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from '../types';

interface MapListItemProps {
  map: MapItem;
  account: { plan?: string | null; id?: string } | null;
  onClick?: () => void;
  showRoleIcon?: boolean;
}

export default function MapListItem({ 
  map, 
  account: userAccount, 
  onClick,
  showRoleIcon = false
}: MapListItemProps) {
  const router = useRouter();
  const { openComingSoon } = useAppModalContextSafe();
  const [showDescription, setShowDescription] = useState(false);
  const [showDetailsMenu, setShowDetailsMenu] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close description popup when clicking outside
  useEffect(() => {
    if (!showDescription) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        infoButtonRef.current &&
        !infoButtonRef.current.contains(event.target as Node) &&
        descriptionRef.current &&
        !descriptionRef.current.contains(event.target as Node)
      ) {
        setShowDescription(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDescription]);

  // Close details menu when clicking outside
  useEffect(() => {
    if (!showDetailsMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setShowDetailsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDetailsMenu]);

  // Format relative time
  const formatTimeAgo = useCallback((dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffSeconds < 60) return 'just now';
      if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return '';
    }
  }, []);

  if (!map) return null;

  // Memoize canAccess to prevent recalculation
  const canAccess = useMemo(
    () => !map.requiresPro || userAccount?.plan === 'contributor',
    [map.requiresPro, userAccount?.plan]
  );

  // Check if atlas map is coming soon
  const isComingSoon = useMemo(
    () => (map as any).map_type === 'atlas' && map.status === 'coming_soon',
    [(map as any).map_type, map.status]
  );

  // Generate map preview URL using Mapbox Static Images API
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
    const width = 200;
    const height = 120;
    
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
      router.push('/pricing');
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
      className="bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors p-[10px] cursor-pointer group"
      onClick={handleClick}
    >
      <div className="flex items-center gap-2">
        {/* Map Screenshot Thumbnail */}
        <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border border-gray-200 bg-gray-100 relative">
          {previewUrl ? (
            (map as any).map_type === 'atlas' && map.thumbnail ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <Image
                  src={previewUrl}
                  alt={map.name}
                  width={48}
                  height={48}
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
              <span className="text-xs text-gray-400">🗺️</span>
            </div>
          )}
        </div>

        {/* Map Name and Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[2.5rem]">
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-gray-900 truncate">
                {map.name}
              </h3>
              
              {/* Visibility Icon */}
              {map.visibility && (
                <div className="flex-shrink-0" title={map.visibility === 'public' ? 'Public map' : 'Private map'}>
                  {map.visibility === 'public' ? (
                    <GlobeAltIcon className="w-3 h-3 text-gray-400" />
                  ) : (
                    <LockClosedIcon className="w-3 h-3 text-gray-400" />
                  )}
                </div>
              )}
              
              {/* Role Icon (for My Maps view) */}
              {showRoleIcon && map.current_user_role && (
                <div className="flex-shrink-0" title={`You are ${map.current_user_role}`}>
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
          </div>
        </div>

        {/* Members and View Count */}
        <div className="flex-shrink-0 flex items-center gap-3 text-[10px] text-gray-500">
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
          
          {/* Info Icon for Description */}
          <div className="relative flex-shrink-0">
            <button
              ref={infoButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowDescription(!showDescription);
              }}
              className="p-0.5 transition-colors text-blue-600 hover:text-blue-700"
              aria-label="Show description"
            >
              <InformationCircleIcon className="w-3 h-3" />
            </button>
            {showDescription && (
              <div
                ref={descriptionRef}
                className="absolute top-full right-0 mt-1 z-50 rounded-md shadow-lg p-2 min-w-[200px] max-w-[280px] bg-white border border-gray-200"
              >
                {map.description ? (
                  <p className="text-xs text-gray-600">
                    {map.description}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">No description available</p>
                )}
              </div>
            )}
          </div>
          
          {/* Three-dot menu (only show in My Maps view) */}
          {showRoleIcon && (
            <div className="relative flex-shrink-0">
              <button
                ref={menuButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetailsMenu(!showDetailsMenu);
                }}
                className="p-0.5 transition-colors text-gray-400 hover:text-gray-600"
                aria-label="Map details"
              >
                <EllipsisVerticalIcon className="w-3.5 h-3.5" />
              </button>
              {showDetailsMenu && (
                <div
                  ref={menuRef}
                  className="absolute top-full right-0 mt-1 z-50 rounded-md shadow-lg p-2 min-w-[240px] max-w-[320px] bg-white border border-gray-200"
                >
                  <div className="space-y-2">
                    {/* Role */}
                    {map.current_user_role && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Role:</span>
                        <span className="font-medium text-gray-900 capitalize">{map.current_user_role}</span>
                      </div>
                    )}
                    
                    {/* Visibility */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Visibility:</span>
                      <div className="flex items-center gap-1">
                        {map.visibility === 'public' ? (
                          <>
                            <GlobeAltIcon className="w-3 h-3 text-gray-400" />
                            <span className="font-medium text-gray-900">Public</span>
                          </>
                        ) : (
                          <>
                            <LockClosedIcon className="w-3 h-3 text-gray-400" />
                            <span className="font-medium text-gray-900">Private</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Featured */}
                    {map.settings?.presentation?.is_featured && (
                      <div className="flex items-center gap-2 text-xs">
                        <SparklesIcon className="w-3 h-3 text-amber-500" />
                        <span className="text-gray-900">Featured map</span>
                      </div>
                    )}
                    
                    {/* Collaboration Settings */}
                    {map.visibility === 'public' && map.settings?.collaboration && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-500 mb-1.5">Collaboration</div>
                        <div className="space-y-1">
                          {map.settings.collaboration.allow_pins && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <MapPinIcon className="w-3 h-3 text-green-500" />
                              <span>Pins enabled</span>
                            </div>
                          )}
                          {map.settings.collaboration.allow_areas && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Square3Stack3DIcon className="w-3 h-3 text-blue-500" />
                              <span>Areas enabled</span>
                            </div>
                          )}
                          {map.settings.collaboration.allow_posts && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <DocumentTextIcon className="w-3 h-3 text-purple-500" />
                              <span>Posts enabled</span>
                            </div>
                          )}
                          {!map.settings.collaboration.allow_pins && 
                           !map.settings.collaboration.allow_areas && 
                           !map.settings.collaboration.allow_posts && (
                            <div className="text-xs text-gray-500">No collaboration enabled</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Map Style */}
                    {map.settings?.appearance?.map_style && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Style:</span>
                        <span className="font-medium text-gray-900 capitalize">
                          {map.settings.appearance.map_style}
                        </span>
                      </div>
                    )}
                    
                    {/* Last Updated */}
                    {(map as any).updated_at && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          Updated {formatTimeAgo((map as any).updated_at)}
                        </div>
                      </div>
                    )}
                    
                    {/* Created */}
                    {(map as any).created_at && (
                      <div className="text-xs text-gray-500">
                        Created {formatTimeAgo((map as any).created_at)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
