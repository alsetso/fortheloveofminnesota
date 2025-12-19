'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  UserGroupIcon,
  BriefcaseIcon,
  BuildingLibraryIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface CivicSecondaryContentProps {
  map?: MapboxMapInstance | null;
}

export default function CivicSecondaryContent({ map }: CivicSecondaryContentProps = {}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/civic') {
      return pathname === '/civic';
    }
    return pathname.startsWith(href);
  };

  // Notable leaders (most searched)
  const notableLeaders = [
    { name: 'Tim Walz', slug: 'tim-walz', title: 'Governor' },
    { name: 'Amy Klobuchar', slug: 'amy-klobuchar', title: 'U.S. Senator' },
    { name: 'Tina Smith', slug: 'tina-smith', title: 'U.S. Senator' },
    { name: 'Keith Ellison', slug: 'keith-ellison', title: 'Attorney General' },
  ];

  // Key positions
  const keyPositions = [
    { name: 'Governor', slug: 'governor' },
    { name: 'U.S. Senator', slug: 'us-senator' },
    { name: 'U.S. Representative', slug: 'us-representative' },
    { name: 'State Senator', slug: 'state-senator' },
    { name: 'State Representative', slug: 'state-representative' },
    { name: 'Attorney General', slug: 'attorney-general' },
    { name: 'Secretary of State', slug: 'secretary-of-state' },
  ];

  // Key jurisdictions
  const keyJurisdictions = [
    { name: 'Minnesota', slug: 'minnesota', type: 'State' },
    { name: 'Hennepin County', slug: 'hennepin', type: 'County' },
    { name: 'Ramsey County', slug: 'ramsey', type: 'County' },
    { name: 'Minneapolis', slug: 'minneapolis', type: 'City' },
    { name: 'St. Paul', slug: 'st-paul', type: 'City' },
  ];

  return (
    <div className="space-y-3">
      {/* Main Navigation */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Navigation</div>
        <div className="space-y-1">
          <Link
            href="/civic"
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
              ${isActive('/civic') && pathname === '/civic'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <HomeIcon className="w-4 h-4" />
            <span>Overview</span>
          </Link>
          <Link
            href="/civic/leaders"
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
              ${isActive('/civic/leaders')
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <UserGroupIcon className="w-4 h-4" />
            <span>Leaders</span>
          </Link>
          <Link
            href="/civic/positions"
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
              ${isActive('/civic/positions')
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <BriefcaseIcon className="w-4 h-4" />
            <span>Positions</span>
          </Link>
          <Link
            href="/civic/jurisdictions"
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
              ${isActive('/civic/jurisdictions')
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <BuildingLibraryIcon className="w-4 h-4" />
            <span>Jurisdictions</span>
          </Link>
        </div>
      </div>

      {/* Notable Leaders */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Notable Leaders</div>
        <div className="space-y-0.5">
          {notableLeaders.map((leader) => (
            <Link
              key={leader.slug}
              href={`/civic/leader/${leader.slug}`}
              className={`
                block px-2 py-1.5 rounded text-xs transition-colors
                ${pathname === `/civic/leader/${leader.slug}`
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
              title={leader.title}
            >
              <div className="font-medium">{leader.name}</div>
              <div className="text-[10px] text-gray-500">{leader.title}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Key Positions */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Key Positions</div>
        <div className="space-y-0.5">
          {keyPositions.map((position) => (
            <Link
              key={position.slug}
              href={`/civic/position/${position.slug}`}
              className={`
                block px-2 py-1.5 rounded text-xs transition-colors
                ${pathname === `/civic/position/${position.slug}`
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {position.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Key Jurisdictions */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Key Jurisdictions</div>
        <div className="space-y-0.5">
          {keyJurisdictions.map((jurisdiction) => (
            <Link
              key={jurisdiction.slug}
              href={`/civic/jurisdiction/${jurisdiction.slug}`}
              className={`
                block px-2 py-1.5 rounded text-xs transition-colors
                ${pathname === `/civic/jurisdiction/${jurisdiction.slug}`
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {jurisdiction.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
