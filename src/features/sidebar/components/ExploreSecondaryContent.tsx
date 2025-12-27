'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BuildingOffice2Icon,
  RectangleGroupIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';

interface ExploreSecondaryContentProps {
  map?: MapboxMapInstance | null;
}

export default function ExploreSecondaryContent({ map }: ExploreSecondaryContentProps = {}) {
  const pathname = usePathname();

  // Atlas entity visibility
  const [atlasEntityVisibility, setAtlasEntityVisibility] = useState<Record<string, boolean>>({
    cities: true,
    neighborhoods: true,
    parks: true,
    schools: true,
    lakes: true,
    churches: true,
    hospitals: true,
    golf_courses: true,
    municipals: true,
  });

  // Atlas entity counts
  const [atlasEntityCounts, setAtlasEntityCounts] = useState<Record<string, number>>({});

  // Fetch atlas entity counts on mount
  useEffect(() => {
    const fetchCounts = async () => {
      const entityTypes = ['cities', 'neighborhoods', 'parks', 'schools', 'lakes', 'churches', 'hospitals', 'golf_courses', 'municipals'];
      
      try {
        const countPromises = entityTypes.map(async (tableName) => {
          const { count, error } = await supabase
            .from('atlas_entities')
            .select('*', { count: 'exact', head: true })
            .eq('table_name', tableName)
            .not('lat', 'is', null)
            .not('lng', 'is', null);
          
          if (error) {
            console.warn(`[Explore] Error fetching count for ${tableName}:`, error);
            return { tableName, count: 0 };
          }
          
          return { tableName, count: count || 0 };
        });

        const results = await Promise.all(countPromises);
        const counts = results.reduce((acc, { tableName, count }) => {
          acc[tableName] = count;
          return acc;
        }, {} as Record<string, number>);

        setAtlasEntityCounts(counts);
      } catch (error) {
        console.error('[Explore] Error fetching atlas entity counts:', error);
      }
    };

    fetchCounts();
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

  // Atlas entity configuration
  const atlasEntities = [
    { tableName: 'cities', label: 'Cities', icon: '/city.png' },
    { tableName: 'neighborhoods', label: 'Neighborhoods', icon: '/neighborhood.png' },
    { tableName: 'parks', label: 'Parks', icon: '/park_like.png' },
    { tableName: 'schools', label: 'Schools', icon: '/education.png' },
    { tableName: 'lakes', label: 'Lakes', icon: '/lakes.png' },
    { tableName: 'churches', label: 'Churches', icon: '/churches.png' },
    { tableName: 'hospitals', label: 'Hospitals', icon: '/hospital.png' },
    { tableName: 'golf_courses', label: 'Golf Courses', icon: '/golf courses.png' },
    { tableName: 'municipals', label: 'Municipals', icon: '/municiples.png' },
  ];

  const isActive = (href: string) => {
    if (href === '/explore') {
      return pathname === '/explore';
    }
    return pathname.startsWith(href);
  };

  // Top cities by population (most common searches)
  const topCities = [
    { name: 'Minneapolis', slug: 'minneapolis' },
    { name: 'St. Paul', slug: 'st-paul' },
    { name: 'Rochester', slug: 'rochester' },
    { name: 'Duluth', slug: 'duluth' },
    { name: 'Bloomington', slug: 'bloomington' },
    { name: 'Brooklyn Park', slug: 'brooklyn-park' },
    { name: 'Plymouth', slug: 'plymouth' },
    { name: 'St. Cloud', slug: 'st-cloud' },
  ];

  // Top counties by population
  const topCounties = [
    { name: 'Hennepin', slug: 'hennepin' },
    { name: 'Ramsey', slug: 'ramsey' },
    { name: 'Dakota', slug: 'dakota' },
    { name: 'Anoka', slug: 'anoka' },
    { name: 'Washington', slug: 'washington' },
  ];

  return (
    <div className="space-y-3">
      {/* Atlas Map Legend */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Atlas Layers</div>
        <div className="space-y-1">
          {atlasEntities.map((entity) => {
            const isVisible = atlasEntityVisibility[entity.tableName] ?? true;
            const count = atlasEntityCounts[entity.tableName] ?? 0;
            return (
              <button
                key={entity.tableName}
                onClick={() => toggleAtlasEntityVisibility(entity.tableName)}
                className={`
                  w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
                  ${isVisible
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <img 
                    src={entity.icon} 
                    alt={entity.label} 
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <span>{entity.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] text-gray-500">({count.toLocaleString()})</span>
                  )}
                </div>
                {isVisible ? (
                  <EyeIcon className="w-4 h-4" />
                ) : (
                  <EyeSlashIcon className="w-4 h-4" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Navigation */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Navigation</div>
        <div className="space-y-1">
          <Link
            href="/explore/cities"
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
              ${isActive('/explore/cities')
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <BuildingOffice2Icon className="w-4 h-4" />
            <span>Cities</span>
          </Link>
          <Link
            href="/explore/counties"
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
              ${isActive('/explore/counties')
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <RectangleGroupIcon className="w-4 h-4" />
            <span>Counties</span>
          </Link>
        </div>
      </div>

      {/* Top Cities */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Top Cities</div>
        <div className="space-y-0.5">
          {topCities.map((city) => (
            <Link
              key={city.slug}
              href={`/explore/city/${city.slug}`}
              className={`
                block px-2 py-1.5 rounded text-xs transition-colors
                ${pathname === `/explore/city/${city.slug}`
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {city.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Top Counties */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Top Counties</div>
        <div className="space-y-0.5">
          {topCounties.map((county) => (
            <Link
              key={county.slug}
              href={`/explore/county/${county.slug}`}
              className={`
                block px-2 py-1.5 rounded text-xs transition-colors
                ${pathname === `/explore/county/${county.slug}`
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {county.name} County
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
