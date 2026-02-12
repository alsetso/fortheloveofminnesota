'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RectangleStackIcon } from '@heroicons/react/24/outline';
import { LAYERS_CONFIG } from '@/features/map/config/layersConfig';

/** Map layers table name to API count key */
const TABLE_TO_COUNT_KEY: Record<string, string> = {
  state: 'state',
  counties: 'counties',
  cities_and_towns: 'cities_and_towns',
  districts: 'districts',
  water: 'water',
};

/**
 * Explore Content - Layer cards driven by LAYERS_CONFIG
 * No category filter — links to /explore/[table]
 */
export default function ExploreContent() {
  const [layersCounts, setLayersCounts] = useState<Record<string, number> | null>(null);
  const [layersLoading, setLayersLoading] = useState(true);

  useEffect(() => {
    const fetchLayersCounts = async () => {
      setLayersLoading(true);
      try {
        const res = await fetch('/api/civic/layers');
        const data = res.ok ? await res.json() : {};
        setLayersCounts(data);
      } catch (error) {
        console.error('Error fetching layers counts:', error);
        setLayersCounts({});
      } finally {
        setLayersLoading(false);
      }
    };

    fetchLayersCounts();
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Explore Minnesota</h1>
        <p className="text-sm text-foreground-muted">
          Geographic and political boundaries of Minnesota
        </p>
      </div>

      {/* Layer cards */}
      {layersLoading ? (
        <div className="text-center py-12">
          <div className="text-sm text-foreground-muted">Loading layers...</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LAYERS_CONFIG.filter((config) => {
              const count = layersCounts?.[TABLE_TO_COUNT_KEY[config.table]];
              return count != null && count > 0;
            }).map((config) => {
              const Icon = config.icon;
              const count = layersCounts?.[TABLE_TO_COUNT_KEY[config.table]] ?? 0;
              return (
                <Link
                  key={config.id}
                  href={`/explore/${config.slug}`}
                  className="p-4 rounded-md bg-surface hover:bg-surface-accent transition-colors border border-border"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-6 h-6 text-lake-blue" />
                    <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
                  </div>
                  <p className="text-xs text-foreground-muted mb-1">{config.description}</p>
                  <p className="text-xs text-foreground-subtle">
                    {count.toLocaleString()} {config.countLabel}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Info Section */}
          <div className="p-4 rounded-md bg-surface-accent border border-border">
            <div className="flex items-start gap-3">
              <RectangleStackIcon className="w-5 h-5 text-lake-blue mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-1">About Layers</h4>
                <p className="text-xs text-foreground-muted">
                  Layers are geographic and political boundaries that can be overlaid on maps.
                  Click any layer to view it on the map. These boundaries help you explore
                  Minnesota&apos;s geography and understand how locations relate to administrative
                  regions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
