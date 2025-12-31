'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';

interface ExploreSecondaryContentProps {
  map?: MapboxMapInstance | null;
}

export default function ExploreSecondaryContent({ map }: ExploreSecondaryContentProps = {}) {
  // Atlas entity visibility
  const [atlasEntityVisibility, setAtlasEntityVisibility] = useState<Record<string, boolean>>({});

  // Atlas entity counts
  const [atlasEntityCounts, setAtlasEntityCounts] = useState<Record<string, number>>({});
  
  // Atlas types from database
  const [atlasTypes, setAtlasTypes] = useState<Array<{ slug: string; name: string; icon_path: string | null; status: string }>>([]);

  // Fetch atlas types and counts on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch visible atlas types (both active and coming_soon)
        const { data: types, error: typesError } = await (supabase as any)
          .schema('atlas')
          .from('atlas_types')
          .select('slug, name, icon_path, status')
          .eq('is_visible', true)
          .in('status', ['active', 'coming_soon'])
          .order('display_order', { ascending: true });
        
        if (typesError) {
          console.error('[Explore] Error fetching atlas types:', typesError);
        } else if (types) {
          setAtlasTypes(types);
          
          // Initialize visibility only for active types (coming_soon types are not toggleable)
          const visibility: Record<string, boolean> = {};
          types.forEach((type: { slug: string; status: string }) => {
            if (type.status === 'active') {
            visibility[type.slug] = true;
            }
          });
          setAtlasEntityVisibility(visibility);
          
          // Dispatch initial visibility state
          const visibleTables = Object.entries(visibility)
            .filter(([, visible]) => visible)
            .map(([name]) => name);
          
          window.dispatchEvent(new CustomEvent('atlas-visibility-change', {
            detail: { visibleTables }
          }));
          
          // Fetch counts only for active types
          const activeTypes = types.filter((type: { status: string }) => type.status === 'active');
          const countPromises = activeTypes.map(async (type: { slug: string }) => {
            const { count, error } = await supabase
              .from('atlas_entities')
              .select('*', { count: 'exact', head: true })
              .eq('table_name', type.slug)
              .not('lat', 'is', null)
              .not('lng', 'is', null);
            
            if (error) {
              console.warn(`[Explore] Error fetching count for ${type.slug}:`, error);
              return { tableName: type.slug, count: 0 };
            }
            
            return { tableName: type.slug, count: count || 0 };
          });

          const results = await Promise.all(countPromises);
          const counts = results.reduce((acc, { tableName, count }) => {
            acc[tableName] = count;
            return acc;
          }, {} as Record<string, number>);

          setAtlasEntityCounts(counts);
        }
      } catch (error) {
        console.error('[Explore] Error fetching atlas data:', error);
      }
    };

    fetchData();
  }, []);

  // Atlas entity visibility toggle
  const toggleAtlasEntityVisibility = (tableName: string) => {
    if (!map) return;
    
    const newVisibility = !atlasEntityVisibility[tableName];
    const updatedVisibility = {
      ...atlasEntityVisibility,
      [tableName]: newVisibility,
    };
    
    setAtlasEntityVisibility(updatedVisibility);

    // Dispatch event for AtlasLayer to sync visibility
    const visibleTables = Object.entries(updatedVisibility)
      .filter(([, visible]) => visible)
      .map(([name]) => name);
    
    window.dispatchEvent(new CustomEvent('atlas-visibility-change', {
      detail: { visibleTables }
    }));

    const mapboxMap = map as any;
    const pointLayerId = 'atlas-layer-point';
    const labelLayerId = 'atlas-layer-label';

    try {
      // Get current filter for point layer
      const pointLayer = mapboxMap.getLayer(pointLayerId);
      const labelLayer = mapboxMap.getLayer(labelLayerId);
      
      if (!pointLayer || !labelLayer) return;

      // Build new filter: show all visible entities
      const visibleEntities = Object.entries(updatedVisibility)
        .filter(([, visible]) => visible)
        .map(([name]) => name);

      // Create filter: ['any', ['==', ['get', 'table_name'], 'cities'], ['==', ['get', 'table_name'], 'lakes'], ...]
      const newFilter = visibleEntities.length > 0
        ? ['any', ...visibleEntities.map(name => ['==', ['get', 'table_name'], name])]
        : ['literal', false]; // Hide all if none visible

      // Apply filter to both layers
      mapboxMap.setFilter(pointLayerId, newFilter);
      mapboxMap.setFilter(labelLayerId, newFilter);
    } catch (e) {
      console.warn('[Explore] Error toggling atlas entity visibility:', e);
    }
  };

  return (
    <div className="space-y-3">
      {/* Atlas Map Legend */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Atlas Layers</div>
        <div className="space-y-0.5">
          {atlasTypes.map((type) => {
            const isActive = type.status === 'active';
            const isVisible = atlasEntityVisibility[type.slug] ?? true;
            const count = atlasEntityCounts[type.slug] ?? 0;
            return (
              <button
                key={type.slug}
                onClick={() => isActive && toggleAtlasEntityVisibility(type.slug)}
                disabled={!isActive}
                className={`
                  w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
                  ${!isActive
                    ? 'opacity-50 cursor-not-allowed text-gray-500'
                    : isVisible
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  {type.icon_path && (
                    <img 
                      src={type.icon_path} 
                      alt={type.name} 
                      className="w-4 h-4 flex-shrink-0"
                    />
                  )}
                  <span>{type.name}</span>
                  {isActive && count > 0 && (
                    <span className="text-[10px] text-gray-500">({count.toLocaleString()})</span>
                  )}
                  {!isActive && (
                    <span className="text-[10px] text-gray-400">(Coming Soon)</span>
                  )}
                </div>
                {isActive && (
                  isVisible ? (
                  <EyeIcon className="w-4 h-4" />
                ) : (
                  <EyeSlashIcon className="w-4 h-4" />
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* See More Button */}
      <div className="border-t border-gray-200 pt-3">
          <Link
          href="/explore"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          See More
            </Link>
      </div>
    </div>
  );
}
