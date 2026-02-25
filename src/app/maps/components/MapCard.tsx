'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { EyeIcon, UsersIcon, GlobeAltIcon, LockClosedIcon, StarIcon, ShieldCheckIcon, PencilIcon, MapIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from '../types';

type ViewAsRole = 'non-member' | 'member' | 'owner';

interface MapCardProps {
  map: MapItem;
  account: { plan?: string | null; id?: string } | null;
  onClick?: () => void;
  showRoleIcon?: boolean;
  viewAsRole?: ViewAsRole;
}

/**
 * Map card component following compact feed design system
 * Uses text-xs, gap-2, p-[10px] spacing, dark theme
 */
export default function MapCard({ 
  map, 
  account: userAccount, 
  onClick,
  showRoleIcon = false,
  viewAsRole = 'non-member'
}: MapCardProps) {
  const router = useRouter();
  const { openComingSoon } = useAppModalContextSafe();

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
    <article className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden hover:border-border-muted dark:hover:border-white/20 transition-colors group">
      {/* Map Preview Image */}
      <div className="w-full aspect-video bg-surface-accent relative overflow-hidden">
        {previewUrl ? (
          (map as any).map_type === 'atlas' && map.thumbnail ? (
            <div className="w-full h-full flex items-center justify-center bg-surface-accent">
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
            <MapIcon className="w-12 h-12 text-foreground-subtle" />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-[10px]">
        {/* Header: Role Badge + Title */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Role Badge */}
              {showRoleIcon && map.current_user_role && (
                <div className="flex items-center gap-1">
                  {map.current_user_role === 'owner' ? (
                    <StarIcon className="w-3 h-3 text-yellow-400" />
                  ) : map.current_user_role === 'manager' ? (
                    <ShieldCheckIcon className="w-3 h-3 text-blue-400" />
                  ) : (
                    <PencilIcon className="w-3 h-3 text-green-400" />
                  )}
                  <span className="text-xs text-foreground-muted capitalize">{map.current_user_role}</span>
                </div>
              )}
              {/* Visibility Icon */}
              {map.visibility && (
                <div className="flex items-center gap-1" title={map.visibility === 'public' ? 'Public map' : 'Private map'}>
                  {map.visibility === 'public' ? (
                    <GlobeAltIcon className="w-3 h-3 text-foreground-muted" />
                  ) : (
                    <LockClosedIcon className="w-3 h-3 text-foreground-muted" />
                  )}
                </div>
              )}
            </div>
            {/* Map Name */}
            <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-lake-blue transition-colors">
              {map.name}
            </h3>
          </div>
        </div>

        {/* Description */}
        {map.description && (
          <p className="text-xs text-foreground-muted mb-2 line-clamp-2">
            {map.description}
          </p>
        )}

        {/* Stats Footer */}
        <div className="flex items-center gap-3 pt-2 border-t border-border-muted dark:border-white/10">
          {map.view_count !== undefined && (
            <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
              <EyeIcon className="w-3 h-3" />
              <span>{map.view_count.toLocaleString()}</span>
            </div>
          )}
          {map.member_count !== undefined && (
            <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
              <UsersIcon className="w-3 h-3" />
              <span>{map.member_count}</span>
            </div>
          )}
          {map.pin_count !== undefined && (
            <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
              <MapIcon className="w-3 h-3" />
              <span>{map.pin_count}</span>
            </div>
          )}
        </div>
      </div>
    </article>
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
