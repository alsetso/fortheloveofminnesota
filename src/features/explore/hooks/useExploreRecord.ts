'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchExploreRecord, type ExploreRecordResult } from '@/features/map/services/exploreRecordService';

/**
 * Single source of truth for explore record data.
 * One fetch per (table, recordSlug); result cached in exploreRecordService.
 * Use for: Layout selectedBoundary, Map zoom, RightSidebar display, LeftSidebar click.
 */
export function useExploreRecord(table: string, recordSlug: string | undefined) {
  const [result, setResult] = useState<ExploreRecordResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!recordSlug || !table) {
      setResult(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchExploreRecord(table, String(recordSlug))
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useExploreRecord]', err);
          setResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [table, recordSlug]);

  return { record: result, loading };
}
