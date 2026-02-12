'use client';

import { useParams } from 'next/navigation';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import ExploreTableLayout from '@/components/explore/ExploreTableLayout';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { LAYER_SLUGS, getLayerConfigBySlug } from '@/features/map/config/layersConfig';

/**
 * /explore/[table] and /explore/[table]/[id] — Single page, no remount on navigation.
 * Table index: /explore/counties
 * Record detail: /explore/counties/hennepin-id
 */
export default function ExploreTableOrRecordPage() {
  const params = useParams();
  const table = params?.table as string;
  const slugParam = params?.slug;
  const recordSlug = Array.isArray(slugParam) && slugParam[0] ? slugParam[0] : undefined;

  const layerConfig = getLayerConfigBySlug(table);
  if (!table || !LAYER_SLUGS.includes(table) || !layerConfig) {
    return (
      <NewPageWrapper>
        <div className="max-w-[1200px] mx-auto w-full px-4 py-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-2">Not Found</h1>
            <p className="text-sm text-foreground-muted">The requested layer does not exist.</p>
          </div>
        </div>
      </NewPageWrapper>
    );
  }

  return (
    <>
      <PageViewTracker />
      <ExploreTableLayout table={table} recordSlug={recordSlug} />
    </>
  );
}
