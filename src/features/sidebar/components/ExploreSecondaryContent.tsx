'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BuildingOffice2Icon,
  RectangleGroupIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface ExploreSecondaryContentProps {
  map?: MapboxMapInstance | null;
}

export default function ExploreSecondaryContent({ map }: ExploreSecondaryContentProps = {}) {
  const pathname = usePathname();

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
