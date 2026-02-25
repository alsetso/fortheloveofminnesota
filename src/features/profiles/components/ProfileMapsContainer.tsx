'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, MapIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import MapCard from '@/app/maps/components/MapCard';
import type { MapItem } from '@/app/maps/types';

interface ProfileMapsContainerProps {
  accountId: string;
  isOwnProfile: boolean;
  accountPlan?: string | null;
}

// Helper to check if plan is pro
const isProPlan = (plan: string | null | undefined): boolean => {
  return plan === 'contributor';
};

export default function ProfileMapsContainer({ accountId, isOwnProfile, accountPlan }: ProfileMapsContainerProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaps = async () => {
      setLoading(true);
      try {
        // Fetch all maps for this account (RLS will return all visibilities for owner)
        const response = await fetch(`/api/maps?account_id=${accountId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch maps: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.maps || data.maps.length === 0) {
          setMaps([]);
          setLoading(false);
          return;
        }

        // Transform maps and collect map IDs
        const transformedMaps = data.maps.map((map: any) => ({
          ...map,
          map_type: 'user' as const,
        }));

        const mapIds = transformedMaps.map((map: any) => map.id);

        // Fetch stats for all maps in batch
        if (mapIds.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
          if (!statsResponse.ok) {
            console.warn('Failed to fetch map stats, continuing without stats');
          }
          const statsData = await statsResponse.json();

          // Combine maps with stats
          const mapsWithStats = transformedMaps.map((map: any) => ({
            ...map,
            view_count: statsData.stats?.[map.id]?.total_views || 0,
          }));

          setMaps(mapsWithStats);
        } else {
          setMaps(transformedMaps);
        }
      } catch (err) {
        console.error('Error fetching maps:', err);
      } finally {
        setLoading(false);
      }
    };

    if (accountId) {
      fetchMaps();
    }
  }, [accountId]);

  const handleCreateMap = () => {
    // Check if current user (owner) has pro plan
    const currentUserIsPro = isProPlan(account?.plan);
    
    if (!currentUserIsPro) {
      // Redirect to billing if not pro
      router.push('/pricing');
      return;
    }
    
    router.push('/maps/new');
  };

  if (loading) {
    return (
      <div className="p-[10px]">
        <div className="flex items-center justify-center py-6">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (maps.length === 0) {
    const currentUserIsPro = isProPlan(account?.plan);
    
    return (
      <div className="p-[10px]">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <MapIcon className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No Maps Yet</h3>
          <p className="text-xs text-gray-600 mb-3">
            {isOwnProfile 
              ? (currentUserIsPro 
                  ? 'Create your first map to get started'
                  : 'Create custom maps to organize your highlights, collections, memories, and favorite locations. Set privacy controls and build your own communities. Upgrade to Contributor to get started.')
              : 'This user hasn\'t created any maps yet'}
          </p>
          {isOwnProfile && (
            currentUserIsPro ? (
              <button
                onClick={handleCreateMap}
                className="flex items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                Create Your First Map
              </button>
            ) : (
              <button
                onClick={handleCreateMap}
                className="flex items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                Upgrade to Contributor to Create Maps
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-[10px]">
      {/* Maps Grid - Responsive grid with better spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {maps.map((map) => (
          <MapCard key={map.id} map={map} account={account} />
        ))}
      </div>
    </div>
  );
}

