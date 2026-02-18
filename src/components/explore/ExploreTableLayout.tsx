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
import type { ChildFeature } from '@/features/map/components/ChildPinsLayer';
import { getLayerConfigBySlug } from '@/features/map/config/layersConfig';
import { getExploreChildContext } from '@/features/map/config/exploreLayerInteractionConfig';
import { useExploreRecord } from '@/features/explore/hooks/useExploreRecord';
import {
  getStateBoundary,
  getCountyBoundaries,
  getCTUBoundaries,
  getCongressionalDistricts,
  getWater,
  getSchoolDistricts,
} from '@/features/map/services/liveBoundaryCache';

const RIGHT_SIDEBAR_BREAKPOINT = 976;

interface ExploreTableLayoutProps {
  table: string;
  recordSlug?: string;
}

type BoundarySelection = {
  layer: 'state' | 'county' | 'ctu' | 'district' | 'water' | 'school-district';
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
  if (table === 'water') return String(record.name ?? record.gnis_name ?? record.nhd_feature_id ?? 'Water body');
  if (table === 'school-districts') return String(record.name ?? record.short_name ?? 'School District');
  return 'Unknown';
}

/** Map boundary layer type to explore table slug for routing */
const LAYER_TO_TABLE: Record<string, string> = {
  state: 'state',
  county: 'counties',
  ctu: 'cities-and-towns',
  district: 'congressional-districts',
  water: 'water',
  'school-district': 'school-districts',
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
  const [childFeatures, setChildFeatures] = useState<ChildFeature[]>([]);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  const layerConfig = getLayerConfigBySlug(table);

  // Preload ONLY the boundary data needed for the current layer — no cross-layer fetches
  useEffect(() => {
    switch (table) {
      case 'state':
        getStateBoundary().catch(() => {});
        break;
      case 'counties':
        getCountyBoundaries().catch(() => {});
        break;
      case 'cities-and-towns':
        getCTUBoundaries().catch(() => {});
        break;
      case 'congressional-districts':
        getCongressionalDistricts().catch(() => {});
        break;
      case 'water':
        getWater().catch(() => {});
        break;
      case 'school-districts':
        getSchoolDistricts().catch(() => {});
        break;
    }
  }, [table]);

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

  // Preview popup state — shown on first click, navigate on "View details"
  const [previewBoundary, setPreviewBoundary] = useState<(BoundarySelection & { lngLat?: [number, number] }) | null>(null);

  // Clear preview when URL changes (record selected via sidebar)
  useEffect(() => {
    setPreviewBoundary(null);
  }, [recordSlug]);

  const handleBoundarySelect = useCallback(
    (boundary: BoundarySelection) => {
      // If already focused on a record, navigate directly (e.g. clicking sub-record)
      if (recordSlug) {
        const targetTable = LAYER_TO_TABLE[boundary.layer] ?? table;
        router.push(`/explore/${targetTable}/${boundary.id}`, { scroll: false });
        return;
      }
      // Otherwise show preview popup
      setPreviewBoundary({
        ...boundary,
        lngLat: boundary.lng != null && boundary.lat != null
          ? [boundary.lng, boundary.lat]
          : undefined,
      });
    },
    [table, router, recordSlug]
  );

  const handlePreviewNavigate = useCallback(() => {
    if (!previewBoundary) return;
    const targetTable = LAYER_TO_TABLE[previewBoundary.layer] ?? table;
    router.push(`/explore/${targetTable}/${previewBoundary.id}`, { scroll: false });
    setPreviewBoundary(null);
  }, [previewBoundary, table, router]);

  // Direct navigation — used by left sidebar list clicks (skip popup)
  const handleDirectSelect = useCallback(
    (boundary: BoundarySelection) => {
      setPreviewBoundary(null);
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
        onRecordSelect={handleDirectSelect}
      />
    ) : (
      <FocusModeLeftNav table={table} recordName={displayName} />
    );

  const showLeftSidebar = table !== 'counties';

  return (
    <NewPageWrapper
      mainNoScroll={true}
      leftSidebar={
        showLeftSidebar
          ? isFocusMode
            ? focusLeftSidebar
            : (
                <LayerDetailLeftSidebar
                  layerSlug={table}
                  selectedRecordId={recordSlug}
                  onRecordSelect={handleDirectSelect}
                />
              )
          : undefined
      }
      rightSidebar={
        <LayerDetailRightSidebar
          layerSlug={table}
          selectedBoundary={selectedBoundary}
          hoveredBoundary={hoveredBoundary}
          loading={loading}
          onClearSelection={handleClearSelection}
          childFeatures={childFeatures}
        />
      }
    >
      <div className="h-[calc(100vh-3.5rem)] w-full flex flex-col min-h-0">
        {/* Header bar */}
        <div className="flex-shrink-0 z-10 px-3 py-2 bg-surface/95 backdrop-blur-sm border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href={recordSlug ? `/explore/${table}` : '/explore'}
              className="flex-shrink-0 p-1 rounded-md hover:bg-surface-accent transition-colors"
              aria-label="Back"
            >
              <ArrowLeftIcon className="w-4 h-4 text-foreground-muted" />
            </Link>
            <h1 className="text-xs font-semibold text-foreground truncate">
              {isFocusMode ? displayName : layerConfig.label}
            </h1>
            {hoveredBoundary && !isFocusMode && hoveredBoundary.name !== displayName && (
              <span className="text-[10px] text-foreground-muted truncate hidden sm:inline">
                — {hoveredBoundary.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isFocusMode && (
              <span className="text-[10px] text-foreground-muted hidden sm:inline">
                {layerConfig.label}
              </span>
            )}
            {isMobileLayout && (
              <button
                type="button"
                onClick={() => setInfoSheetOpen(true)}
                className="p-1 rounded-md hover:bg-surface-accent transition-colors"
                aria-label="View details"
                title="View details"
              >
                <InformationCircleIcon className="w-4 h-4 text-foreground-muted" />
              </button>
            )}
          </div>
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
              childFeatures={childFeatures}
            />
          </div>
        </DraggableBottomSheet>

        {/* Map area with padded container on desktop */}
        <div className="flex-1 min-h-0 p-0 sm:p-[10px] bg-surface-muted">
          <div className="w-full h-full relative overflow-hidden sm:rounded-lg">
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
              onChildFeaturesLoaded={setChildFeatures}
              previewBoundary={previewBoundary}
              onPreviewNavigate={handlePreviewNavigate}
              onPreviewDismiss={() => setPreviewBoundary(null)}
            />
          </div>
        </div>
      </div>
    </NewPageWrapper>
  );
}
