'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import DraggableBottomSheet from '@/components/ui/DraggableBottomSheet';
import FocusModeLeftNav from '@/components/explore/layers/FocusModeLeftNav';
import LayerDetailLeftSidebar from '@/components/explore/layers/LayerDetailLeftSidebar';
import SubRecordsLeftSidebar from '@/components/explore/layers/SubRecordsLeftSidebar';
import LayerDetailMap from '@/components/explore/layers/LayerDetailMap';
import LayerDetailRightSidebar from '@/components/explore/layers/LayerDetailRightSidebar';
import { getLayerConfigBySlug } from '@/features/map/config/layersConfig';
import { getExploreChildContext } from '@/features/map/config/exploreLayerInteractionConfig';
import { useExploreRecord } from '@/features/explore/hooks/useExploreRecord';
import { preloadAll } from '@/features/map/services/liveBoundaryCache';

const RIGHT_SIDEBAR_BREAKPOINT = 976;

interface ExploreTableLayoutProps {
  table: string;
  recordSlug?: string;
}

type BoundarySelection = {
  layer: 'state' | 'county' | 'ctu' | 'district';
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  details?: Record<string, unknown>;
};

/** Derive display name from record */
function nameFromRecord(record: Record<string, unknown>, table: string): string {
  if (table === 'state') return String(record.name ?? 'Minnesota');
  if (table === 'counties') return String(record.county_name ?? 'County');
  if (table === 'cities-and-towns') return String(record.feature_name ?? 'CTU');
  if (table === 'congressional-districts') return `District ${record.district_number ?? ''}`;
  return 'Unknown';
}

/** Map boundary layer type to explore table slug for routing */
const LAYER_TO_TABLE: Record<string, string> = {
  state: 'state',
  county: 'counties',
  ctu: 'cities-and-towns',
  district: 'congressional-districts',
};

/**
 * Shared layout for /explore/[table] and /explore/[table]/[slug]
 * List on left, map in center, details on right
 * Single fetch via useExploreRecord; no duplicate API calls
 */
export default function ExploreTableLayout({ table, recordSlug }: ExploreTableLayoutProps) {
  const router = useRouter();
  const { record, loading } = useExploreRecord(table, recordSlug);
  const [hoveredBoundary, setHoveredBoundary] = useState<BoundarySelection | null>(null);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  const layerConfig = getLayerConfigBySlug(table);

  useEffect(() => {
    preloadAll();
  }, []);

  // Derive selected boundary from single source of truth (useExploreRecord)
  const selectedBoundary: BoundarySelection | null =
    record && recordSlug
      ? {
          layer: record.layerType,
          id: recordSlug,
          name: nameFromRecord(record.record, table),
          lat: record.centroid[1], // GeoJSON: [lng, lat]
          lng: record.centroid[0],
          details: record.record,
        }
      : null;

  useEffect(() => {
    const check = () => setIsMobileLayout(window.innerWidth < RIGHT_SIDEBAR_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleBoundarySelect = useCallback(
    (boundary: BoundarySelection) => {
      const targetTable = LAYER_TO_TABLE[boundary.layer] ?? table;
      router.push(`/explore/${targetTable}/${boundary.id}`, { scroll: false });
    },
    [table, router]
  );

  const handleBoundaryHover = useCallback((boundary: BoundarySelection | null) => {
    setHoveredBoundary(boundary);
  }, []);

  const handleClearSelection = useCallback(() => {
    router.push(`/explore/${table}`, { scroll: false });
  }, [table, router]);

  if (!layerConfig) return null;

  const isFocusMode = Boolean(recordSlug);
  const displayName = (selectedBoundary || hoveredBoundary)?.name ?? layerConfig.label;

  const { hasSubRecords, childTable, parentFilterValue } = getExploreChildContext(
    table,
    selectedBoundary?.details
  );

  const focusLeftSidebar =
    hasSubRecords && selectedBoundary && childTable ? (
      <SubRecordsLeftSidebar
        parentTable={table}
        parentRecord={{
          id: selectedBoundary.id,
          name: selectedBoundary.name,
          details: selectedBoundary.details,
        }}
        childTable={childTable as 'counties' | 'cities-and-towns'}
        onRecordSelect={handleBoundarySelect}
      />
    ) : (
      <FocusModeLeftNav table={table} recordName={displayName} />
    );

  return (
    <NewPageWrapper
      mainNoScroll={true}
      leftSidebar={
        isFocusMode ? (
          focusLeftSidebar
        ) : (
          <LayerDetailLeftSidebar
            layerSlug={table}
            selectedRecordId={recordSlug}
            onRecordSelect={handleBoundarySelect}
          />
        )
      }
      rightSidebar={
        <LayerDetailRightSidebar
          layerSlug={table}
          selectedBoundary={selectedBoundary}
          hoveredBoundary={hoveredBoundary}
          loading={loading}
          onClearSelection={handleClearSelection}
        />
      }
    >
      <div className="h-[calc(100vh-3.5rem)] w-full flex flex-col min-h-0">
        <div className="flex-shrink-0 z-10 p-[10px] bg-surface/95 backdrop-blur-sm border-b border-border flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href={recordSlug ? `/explore/${table}` : '/explore'}
              className="flex-shrink-0 p-1.5 -ml-1 rounded-md hover:bg-surface-accent transition-colors"
              aria-label="Back"
            >
              <ArrowLeftIcon className="w-5 h-5 text-foreground-muted" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground mb-0.5 truncate">
                {isFocusMode ? displayName : layerConfig.label}
              </h1>
              <p className="text-xs text-foreground-muted truncate">
                {isFocusMode ? layerConfig.label : layerConfig.description}
              </p>
            </div>
          </div>
          {isMobileLayout && (
            <button
              type="button"
              onClick={() => setInfoSheetOpen(true)}
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-surface-accent transition-colors"
              aria-label="View details"
              title="View details"
            >
              <InformationCircleIcon className="w-5 h-5 text-foreground-muted" />
            </button>
          )}
        </div>

        <DraggableBottomSheet
          isOpen={infoSheetOpen}
          onClose={() => setInfoSheetOpen(false)}
          title="Details"
          showCloseButton={true}
          initialHeight={50}
          snapPoints={[40, 70, 95]}
          contentClassName="p-0"
        >
          <div className="h-[60vh] overflow-y-auto">
            <LayerDetailRightSidebar
              layerSlug={table}
              selectedBoundary={selectedBoundary}
              hoveredBoundary={hoveredBoundary}
              loading={loading}
              onClearSelection={() => {
                setInfoSheetOpen(false);
                handleClearSelection();
              }}
            />
          </div>
        </DraggableBottomSheet>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 relative">
            <LayerDetailMap
              layerSlug={table}
              selectedId={recordSlug}
              focusOnly={isFocusMode}
              boundsGeometry={record?.geometry ?? null}
              overlayLayerSlug={
                hasSubRecords && childTable === 'cities-and-towns' ? childTable : undefined
              }
              parentCountyName={
                childTable === 'cities-and-towns' ? parentFilterValue ?? undefined : undefined
              }
              onBoundarySelect={handleBoundarySelect}
              onBoundaryHover={handleBoundaryHover}
            />
          </div>
        </div>
      </div>
    </NewPageWrapper>
  );
}
