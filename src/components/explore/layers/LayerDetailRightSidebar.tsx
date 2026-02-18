'use client';

import Link from 'next/link';
import { MapPinIcon, XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getEntityConfig } from '@/features/explore/config/entityRegistry';
import type { ChildFeature } from '@/features/map/components/ChildPinsLayer';

interface BoundarySelection {
  layer: string;
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  details?: Record<string, unknown>;
}

interface LayerDetailRightSidebarProps {
  layerSlug: string;
  selectedBoundary: BoundarySelection | null;
  hoveredBoundary?: { layer: string; id: string; name: string } | null;
  loading?: boolean;
  onClearSelection: () => void;
  /** Child features loaded by map ChildPinsLayer */
  childFeatures?: ChildFeature[];
}

export default function LayerDetailRightSidebar({
  layerSlug,
  selectedBoundary,
  hoveredBoundary = null,
  loading = false,
  onClearSelection,
  childFeatures,
}: LayerDetailRightSidebarProps) {
  const entityConfig = getEntityConfig(layerSlug);
  const Icon = entityConfig?.icon ?? MapPinIcon;
  const displayBoundary = selectedBoundary || hoveredBoundary;

  /* ── empty state ── */
  if (!displayBoundary) {
    return (
      <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
        <div className="p-[10px] border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">
            Select a record to view details
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Icon className="w-10 h-10 text-foreground-subtle mx-auto mb-2" />
            <p className="text-xs text-foreground-muted">No area selected</p>
            <p className="text-[10px] text-foreground-subtle mt-0.5">
              Click a record or boundary
            </p>
          </div>
        </div>
      </div>
    );
  }

  const details = selectedBoundary?.details ?? {};
  const showFull = Boolean(selectedBoundary);
  const statsFields = entityConfig?.statsFields ?? [];
  const childPinsConfig = entityConfig?.childPins;
  const hasChildren = Boolean(childPinsConfig);
  const childList = childFeatures ?? [];

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-4 h-4 text-lake-blue flex-shrink-0" />
            <h2 className="text-sm font-semibold text-foreground truncate">
              {displayBoundary.name}
            </h2>
          </div>
          {showFull && (
            <button
              onClick={onClearSelection}
              className="p-1 hover:bg-surface-accent rounded transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <XMarkIcon className="w-3.5 h-3.5 text-foreground-muted" />
            </button>
          )}
        </div>
        {entityConfig && (
          <p className="text-[10px] text-foreground-muted mt-0.5">{entityConfig.singular}</p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {!showFull ? (
          <div className="p-[10px] text-xs text-foreground-muted">Click to view details</div>
        ) : loading ? (
          <div className="p-[10px] space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-3 rounded bg-surface-accent animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Stats from entityRegistry.statsFields */}
            {statsFields.length > 0 && (
              <div className="p-[10px] border-b border-border space-y-1.5">
                <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
                  Information
                </h3>
                {statsFields.map((sf) => {
                  const raw = details[sf.key];
                  if (raw == null || raw === '') return null;
                  let display = String(raw);
                  if (sf.format === 'number' && typeof raw === 'number') {
                    display = raw.toLocaleString();
                  } else if (sf.format === 'area-acres' && typeof raw === 'number') {
                    display = `${Math.round(raw / 640).toLocaleString()} sq mi`;
                  }
                  // Render URLs as links
                  if (sf.key === 'web_url' || sf.key === 'website_url') {
                    return (
                      <StatRow key={sf.key} label={sf.label}>
                        <a
                          href={display.startsWith('http') ? display : `https://${display}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-lake-blue hover:underline truncate block"
                        >
                          {display.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                        </a>
                      </StatRow>
                    );
                  }
                  return <StatRow key={sf.key} label={sf.label} value={display} />;
                })}
              </div>
            )}

            {/* Location */}
            {selectedBoundary?.lat != null && (
              <div className="p-[10px] border-b border-border space-y-1.5">
                <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
                  Location
                </h3>
                <StatRow
                  label="Coordinates"
                  value={`${selectedBoundary.lat.toFixed(4)}, ${selectedBoundary.lng?.toFixed(4)}`}
                />
              </div>
            )}

            {/* Child records (e.g. school buildings in district) */}
            {hasChildren && (
              <div className="p-[10px] space-y-2">
                <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
                  {entityConfig?.relationships.find(
                    (r) => r.targetType === childPinsConfig?.linkSlug?.replace(/-/g, '-')
                  )?.label ?? 'Related Records'}
                  <span className="ml-1 font-normal text-foreground-subtle">
                    ({childList.length})
                  </span>
                </h3>
                {childList.length === 0 ? (
                  <p className="text-[10px] text-foreground-subtle">
                    No records found in this area
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {childList.map((child) => {
                      const atlasSlug = child.meta?.atlas_school_slug as string | undefined;
                      const href = atlasSlug
                        ? `/explore/schools/${atlasSlug}`
                        : childPinsConfig?.linkSlug
                          ? `/explore/${childPinsConfig.linkSlug}/${child.id}`
                          : '#';
                      return (
                      <Link
                        key={child.id}
                        href={href}
                        className="flex items-center justify-between px-2 py-1.5 rounded text-xs text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors group"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate text-foreground group-hover:text-foreground">
                            {child.name}
                          </div>
                          {child.meta?.address && (
                            <div className="text-[10px] text-foreground-subtle truncate">
                              {String(child.meta.address)}
                            </div>
                          )}
                        </div>
                        <ChevronRightIcon className="w-3 h-3 flex-shrink-0 text-foreground-subtle group-hover:text-foreground" />
                      </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Remaining data not covered by statsFields */}
            {(() => {
              const knownKeys = new Set([
                'id', 'geometry', 'geom', 'centroid',
                ...statsFields.map((sf) => sf.key),
              ]);
              const extra = Object.entries(details).filter(
                ([k, v]) => !knownKeys.has(k) && v != null && v !== '' && typeof v !== 'object'
              );
              if (extra.length === 0) return null;
              return (
                <div className="p-[10px] border-t border-border space-y-1.5">
                  <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
                    Additional Data
                  </h3>
                  {extra.map(([key, value]) => (
                    <StatRow
                      key={key}
                      label={key.replace(/_/g, ' ')}
                      value={String(value)}
                    />
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] text-foreground-subtle capitalize flex-shrink-0">{label}</span>
      {children ?? <span className="text-xs text-foreground text-right truncate">{value}</span>}
    </div>
  );
}
