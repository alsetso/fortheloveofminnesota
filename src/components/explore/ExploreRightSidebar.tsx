'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  MapPinIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

/**
 * Right Sidebar for Explore page
 * Featured content and quick links
 */
export default function ExploreRightSidebar() {
  const [featuredCities, setFeaturedCities] = useState<Array<{
    id?: string;
    name: string;
    slug: string;
    pinCount: number;
    postCount: number;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch top cities (cities only, sorted by population)
        const { data: citiesData } = await fetch('/api/civic/ctu-boundaries?limit=100&ctu_class=CITY')
          .then(res => res.ok ? res.json() : [])
          .catch(() => []);

        // Sort by population and take top 4
        const sortedCities = (citiesData || [])
          .filter((city: any) => city.population)
          .sort((a: any, b: any) => (b.population || 0) - (a.population || 0))
          .slice(0, 4);

        const citiesWithCounts = sortedCities.map((city: any) => ({
          id: city.id,
          name: city.feature_name || 'Unknown',
          slug: (city.feature_name || 'unknown').toLowerCase().replace(/\s+/g, '-'),
          pinCount: 0,
          postCount: 0,
        }));

        setFeaturedCities(citiesWithCounts);
      } catch (error) {
        console.error('Error fetching sidebar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Featured</h2>
        <p className="text-[10px] text-foreground-muted mt-0.5">Popular destinations</p>
      </div>

      {/* Featured Cities */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <h3 className="text-xs font-semibold text-foreground mb-2">Top Cities</h3>
        {loading ? (
          <div className="text-xs text-foreground-muted py-2">Loading...</div>
        ) : featuredCities.length > 0 ? (
          <div className="space-y-2">
            {featuredCities.map((city, idx) => (
              <Link
                key={city.id || city.slug || idx}
                href={city.id ? `/explore/cities-and-towns/${city.id}` : '/explore/cities-and-towns'}
                className="block p-2 rounded-md bg-surface-accent hover:bg-surface transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-lake-blue" />
                    <span className="text-xs font-medium text-foreground">{city.name}</span>
                  </div>
                </div>
                {(city.pinCount > 0 || city.postCount > 0) && (
                  <div className="flex items-center gap-3 text-[10px] text-foreground-muted">
                    {city.pinCount > 0 && (
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="w-3 h-3" />
                        {city.pinCount.toLocaleString()}
                      </span>
                    )}
                    {city.postCount > 0 && (
                      <span className="flex items-center gap-1">
                        <PhotoIcon className="w-3 h-3" />
                        {city.postCount.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-xs text-foreground-muted py-2">No cities found</div>
        )}
      </div>


      {/* Quick Links */}
      <div className="p-[10px] border-t border-border flex-shrink-0">
        <h3 className="text-xs font-semibold text-foreground mb-2">Quick Links</h3>
        <div className="space-y-1">
          <Link
            href="/explore/cities-and-towns"
            className="block px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
          >
            Browse All Cities
          </Link>
          <Link
            href="/explore/counties"
            className="block px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
          >
            Browse All Counties
          </Link>
        </div>
      </div>
    </div>
  );
}
