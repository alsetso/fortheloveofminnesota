'use client';

import { MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getLayerConfigBySlug } from '@/features/map/config/layersConfig';

interface LayerDetailRightSidebarProps {
  layerSlug: string;
  /** Selected from useExploreRecord—details already in boundary.details */
  selectedBoundary: {
    layer: 'state' | 'county' | 'ctu' | 'district';
    id: string;
    name: string;
    lat?: number;
    lng?: number;
    details?: Record<string, unknown>;
  } | null;
  /** Hovered only; no API fetch—just show name */
  hoveredBoundary?: { layer: string; id: string; name: string } | null;
  /** Loading state from parent (useExploreRecord) */
  loading?: boolean;
  onClearSelection: () => void;
}

/**
 * Right Sidebar for Layer Detail Page
 * Shows details from selected boundary (single fetch from parent, no duplicate API calls)
 */
export default function LayerDetailRightSidebar({
  layerSlug,
  selectedBoundary,
  hoveredBoundary = null,
  loading = false,
  onClearSelection,
}: LayerDetailRightSidebarProps) {
  const layerConfig = getLayerConfigBySlug(layerSlug);
  const Icon = layerConfig?.icon ?? MapPinIcon;

  const displayBoundary = selectedBoundary || hoveredBoundary;

  if (!displayBoundary) {
    return (
      <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
        <div className="p-[10px] border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">Click a list item or hover over the map</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Icon className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
            <p className="text-xs text-foreground-muted">No area selected</p>
            <p className="text-[10px] text-foreground-subtle mt-1">Click a list item or hover over a boundary</p>
          </div>
        </div>
      </div>
    );
  }

  const displayData = selectedBoundary?.details ?? {};
  const showFullDetails = Boolean(selectedBoundary);
  const displayName = displayBoundary.name;

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-lake-blue" />
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
          </div>
          <button
            onClick={onClearSelection}
            className="p-1 hover:bg-surface-accent rounded transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4 text-foreground-muted" />
          </button>
        </div>
        <p className="text-xs font-medium text-foreground">{displayName}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-[10px] space-y-3">
        {!showFullDetails ? (
          <p className="text-xs text-foreground-muted">Click to view details</p>
        ) : loading ? (
          <div className="text-xs text-foreground-muted">Loading details...</div>
        ) : (
          <>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">Information</h3>
              <div className="space-y-1.5">
                {displayData.feature_name && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">Name</div>
                    <div className="text-xs text-foreground">{String(displayData.feature_name)}</div>
                  </div>
                )}
                {displayData.county_name && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">County</div>
                    <div className="text-xs text-foreground">{String(displayData.county_name)}</div>
                  </div>
                )}
                {displayData.ctu_class && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">Type</div>
                    <div className="text-xs text-foreground">{String(displayData.ctu_class)}</div>
                  </div>
                )}
                {displayData.district_number != null && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">District Number</div>
                    <div className="text-xs text-foreground">{String(displayData.district_number)}</div>
                  </div>
                )}
                {displayData.county_code && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">County Code</div>
                    <div className="text-xs text-foreground">{String(displayData.county_code)}</div>
                  </div>
                )}
                {typeof displayData.population === 'number' && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">Population</div>
                    <div className="text-xs text-foreground">{displayData.population.toLocaleString()}</div>
                  </div>
                )}
                {typeof displayData.acres === 'number' && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">Acres</div>
                    <div className="text-xs text-foreground">{displayData.acres.toLocaleString()}</div>
                  </div>
                )}
                {displayData.description && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">Description</div>
                    <div className="text-xs text-foreground">{String(displayData.description)}</div>
                  </div>
                )}
                {displayData.publisher && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">Source</div>
                    <div className="text-xs text-foreground">{String(displayData.publisher)}</div>
                  </div>
                )}
                {displayData.source_date && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">Source Date</div>
                    <div className="text-xs text-foreground">{String(displayData.source_date)}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-border">
              <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">Location</h3>
              <div className="space-y-1.5">
                <div>
                  <div className="text-[10px] text-foreground-subtle">Latitude</div>
                  <div className="text-xs text-foreground font-mono">
                    {selectedBoundary && typeof selectedBoundary.lat === 'number' && !Number.isNaN(selectedBoundary.lat)
                      ? selectedBoundary.lat.toFixed(6)
                      : String(selectedBoundary?.lat ?? '—')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-foreground-subtle">Longitude</div>
                  <div className="text-xs text-foreground font-mono">
                    {selectedBoundary && typeof selectedBoundary.lng === 'number' && !Number.isNaN(selectedBoundary.lng)
                      ? selectedBoundary.lng.toFixed(6)
                      : String(selectedBoundary?.lng ?? '—')}
                  </div>
                </div>
                {displayData.id && (
                  <div>
                    <div className="text-[10px] text-foreground-subtle">ID</div>
                    <div className="text-xs text-foreground font-mono">{String(displayData.id)}</div>
                  </div>
                )}
              </div>
            </div>

            {Object.keys(displayData).length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border">
                <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">Additional Data</h3>
                <div className="space-y-1.5">
                  {Object.entries(displayData)
                    .filter(
                      ([key]) =>
                        ![
                          'geometry',
                          'id',
                          'feature_name',
                          'county_name',
                          'ctu_class',
                          'district_number',
                          'county_code',
                          'population',
                          'acres',
                          'description',
                          'publisher',
                          'source_date',
                        ].includes(key)
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <div className="text-[10px] text-foreground-subtle capitalize">{key.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-foreground">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
