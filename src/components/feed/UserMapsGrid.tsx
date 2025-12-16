'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapIcon, PlusIcon } from '@heroicons/react/24/outline';
import { UserMapService } from '@/features/user-maps/services';
import type { UserMap } from '@/features/user-maps/types';
import { useAuth } from '@/features/auth';

export default function UserMapsGrid() {
  const { user } = useAuth();
  const [maps, setMaps] = useState<UserMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMaps = async () => {
      if (!user) {
        setMaps([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const userMaps = await UserMapService.getMaps();
        setMaps(userMaps);
      } catch (error) {
        console.error('[UserMapsGrid] Error loading maps:', error);
        setMaps([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMaps();
  }, [user]);

  // Don't render if user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="mt-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">My Maps</h3>
          <Link
            href="/map?create-new-map=true"
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            aria-label="Create new map"
          >
            <PlusIcon className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-4">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-gray-500">Loading maps...</p>
          </div>
        ) : maps.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-gray-600 mb-2">No maps yet</p>
            <Link
              href="/map?create-new-map=true"
              className="inline-flex items-center gap-1.5 px-[10px] py-[10px] text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Create Your First Map
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {maps.map((map) => (
              <Link
                key={map.id}
                href={`/map/${map.id}`}
                className="group relative aspect-square bg-gray-50 border border-gray-200 rounded-md p-[10px] hover:bg-gray-100 transition-colors flex flex-col"
              >
                <div className="flex-1 flex flex-col justify-center items-center text-center">
                  <MapIcon className="w-6 h-6 text-gray-500 group-hover:text-gray-700 mb-1.5 transition-colors" />
                  <h4 className="text-xs font-medium text-gray-900 group-hover:text-gray-700 line-clamp-2">
                    {map.title}
                  </h4>
                  {map.description && (
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">
                      {map.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

