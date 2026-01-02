'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import AtlasMapBox from './components/AtlasMapBox';
import AtlasMapDetails from './components/AtlasMapDetails';
import type { AtlasType } from '@/features/atlas/services/atlasTypesService';

interface AtlasMapClientProps {
  atlasType: AtlasType;
}

export default function AtlasMapClient({ atlasType }: AtlasMapClientProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const [stats, setStats] = useState<{ total: number; withCoords: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [viewStats, setViewStats] = useState<{ total_views: number; unique_viewers: number } | null>(null);

  // Fetch stats for the atlas type
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [entitiesResponse, viewsResponse] = await Promise.all([
          fetch(`/api/atlas/${atlasType.slug}/entities?stats=true`),
          fetch(`/api/analytics/atlas-map-stats?table=${atlasType.slug}`),
        ]);

        if (entitiesResponse.ok) {
          const data = await entitiesResponse.json();
          setStats({
            total: data.total || 0,
            withCoords: data.withCoords || 0,
          });
        }

        if (viewsResponse.ok) {
          const viewsData = await viewsResponse.json();
          setViewStats({
            total_views: viewsData.stats?.total_views || 0,
            unique_viewers: viewsData.stats?.unique_viewers || 0,
          });
        }
      } catch (err) {
        console.error('Error fetching atlas stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [atlasType.slug]);

  // Listen for entity selection events from map
  useEffect(() => {
    const handleEntitySelect = (e: CustomEvent<{ entityId: string; tableName: string }>) => {
      if (e.detail.tableName === atlasType.slug) {
        setSelectedEntityId(e.detail.entityId);
      }
    };

    window.addEventListener('atlas-entity-select', handleEntitySelect as EventListener);
    return () => {
      window.removeEventListener('atlas-entity-select', handleEntitySelect as EventListener);
    };
  }, [atlasType.slug]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Map Section - Fixed 80vh */}
      <div className="relative" style={{ height: '80vh' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-600">Loading map...</p>
            </div>
          </div>
        )}

        {!loading && (
          <AtlasMapBox 
            tableName={atlasType.slug}
            mapStyle="street"
            iconPath={atlasType.icon_path}
            atlasName={atlasType.name}
          />
        )}
      </div>

      {/* Details Section - Scrollable */}
      {!loading && (
        <div className="bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-[10px] py-3">
            <AtlasMapDetails
              atlasType={atlasType}
              stats={stats}
              loading={loading}
              selectedEntityId={selectedEntityId}
              onBackToList={() => setSelectedEntityId(null)}
              viewStats={viewStats}
            />
          </div>
        </div>
      )}
    </div>
  );
}

