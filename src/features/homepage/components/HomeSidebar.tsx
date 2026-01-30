'use client';

import { memo } from 'react';
import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { getMapUrl } from '@/lib/maps/urls';
import MentionTypeCards from './MentionTypeCards';
import type { FeedMap } from '@/app/api/feed/pin-activity/route';
import { useAuthStateSafe } from '@/features/auth';

interface HomeSidebarProps {
  maps: FeedMap[];
  loading?: boolean;
}

/**
 * Left sidebar for homepage on large screens
 * Contains "Feed from" and "What you can post" sections
 */
const HomeSidebar = memo(function HomeSidebar({ maps, loading }: HomeSidebarProps) {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';

  return (
    <aside className="w-full bg-white overflow-y-auto scrollbar-hide">
      <div className="p-4 space-y-6">
        {/* Feed from: maps as list cards */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Feed from</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-md p-[10px] h-12 animate-pulse" />
              ))}
            </div>
          ) : maps.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md p-[10px]">
              <p className="text-xs text-gray-500">No maps yet. Join or create a map to see pin activity.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {maps.map((map) => (
                <Link
                  key={map.id}
                  href={getMapUrl({ id: map.id, slug: map.slug ?? undefined })}
                  className="block bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-900">{map.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* What you can post */}
        <MentionTypeCards isAdmin={isAdmin} />
      </div>
    </aside>
  );
});

HomeSidebar.displayName = 'HomeSidebar';

export default HomeSidebar;
