'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSchoolCatalog } from '@/lib/schools/catalog';
import { SCHOOL_CATALOG_PAGE_SIZE } from '@/lib/schools/constants';
import type { SchoolCatalogRow } from '@/lib/schools/types';

type CatalogListState = {
  rows: SchoolCatalogRow[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

const EMPTY: CatalogListState = {
  rows: [],
  total: 0,
  hasMore: true,
  loading: false,
  error: null,
};

/** Paginated statewide school catalog (25 / page). */
export function useSchoolCatalogList(query: string) {
  const [state, setState] = useState<CatalogListState>(EMPTY);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const loadMore = useCallback(async (reset: boolean) => {
    if (loadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;
    loadingRef.current = true;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      ...(reset ? { rows: [], total: 0, hasMore: true } : null),
    }));
    if (reset) {
      offsetRef.current = 0;
      hasMoreRef.current = true;
    }
    try {
      const offset = reset ? 0 : offsetRef.current;
      const body = await fetchSchoolCatalog({
        q: queryRef.current,
        offset,
        limit: SCHOOL_CATALOG_PAGE_SIZE,
      });
      const nextRows = body.rows ?? [];
      const nextOffset = offset + nextRows.length;
      const more = nextOffset < (body.total ?? 0);
      offsetRef.current = nextOffset;
      hasMoreRef.current = more;
      setState((prev) => ({
        rows: reset ? nextRows : [...prev.rows, ...nextRows],
        total: body.total ?? nextRows.length,
        hasMore: more,
        loading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load',
      }));
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadMore(true);
  }, [loadMore, query]);

  return { ...state, loadMore: () => void loadMore(false) };
}
