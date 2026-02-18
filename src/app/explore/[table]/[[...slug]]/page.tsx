'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import ExploreTableLayout from '@/components/explore/ExploreTableLayout';
import EntityDirectoryPage from '@/components/explore/EntityDirectoryPage';
import EntityDetailPage from '@/components/explore/EntityDetailPage';
import SchoolProfilePage from '@/components/explore/SchoolProfilePage';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { getEntityConfig } from '@/features/explore/config/entityRegistry';
import { LAYER_SLUGS } from '@/features/map/config/layersConfig';

/**
 * /explore/[table]          → Directory (list)  or  Map  (?view=map)
 * /explore/[table]/[id]     → Entity detail     or  Map  (?view=map)
 *
 * Default: data-first pages (EntityDirectoryPage / EntityDetailPage).
 * ?view=map: full Mapbox experience via legacy ExploreTableLayout.
 */
function ExploreTableOrRecordPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();

  const table = params?.table as string;
  const slugParam = params?.slug;
  const recordSlug = Array.isArray(slugParam) && slugParam[0] ? slugParam[0] : undefined;

  const viewMode = searchParams.get('view');
  const entityConfig = getEntityConfig(table);

  /* ── unknown entity type ── */
  if (!entityConfig) {
    return (
      <NewPageWrapper>
        <div className="max-w-[960px] mx-auto w-full px-4 py-6">
          <div className="text-center py-12">
            <h1 className="text-lg font-bold text-foreground mb-2">Not Found</h1>
            <p className="text-sm text-foreground-muted">
              The requested page does not exist.
            </p>
          </div>
        </div>
      </NewPageWrapper>
    );
  }

  /* ── map view (legacy ExploreTableLayout) ── */
  if (viewMode === 'map' && LAYER_SLUGS.includes(table)) {
    return (
      <>
        <PageViewTracker />
        <ExploreTableLayout table={table} recordSlug={recordSlug} />
      </>
    );
  }

  /* ── school community page (owns its own NewPageWrapper with sidebars) ── */
  if (table === 'schools' && recordSlug) {
    return (
      <>
        <PageViewTracker />
        <SchoolProfilePage recordId={recordSlug} />
      </>
    );
  }

  /* ── data-first views ── */
  return (
    <>
      <PageViewTracker />
      <NewPageWrapper>
        {recordSlug ? (
          <EntityDetailPage entitySlug={table} recordId={recordSlug} />
        ) : (
          <EntityDirectoryPage entitySlug={table} />
        )}
      </NewPageWrapper>
    </>
  );
}

export default function ExploreTableOrRecordPage() {
  return (
    <Suspense>
      <ExploreTableOrRecordPageInner />
    </Suspense>
  );
}
