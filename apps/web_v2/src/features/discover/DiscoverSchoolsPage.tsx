'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { useAuthSafe } from '@/features/auth';
import { SchoolCatalogRow } from '@/features/discover/schools/SchoolCatalogRow';
import { SchoolGroupCard } from '@/features/discover/schools/SchoolGroupCard';
import { useAccountSchoolActions } from '@/features/discover/schools/useAccountSchoolActions';
import { useSchoolCatalogList } from '@/features/discover/schools/useSchoolCatalogList';
import { FeedSearchField } from '@/features/feed/FeedSearchField';
import { IconArrowLeft } from '@/features/map/dockCore/core/icons';
import { groupAccountSchools } from '@/lib/schools/groupAccountSchools';
import { SCHOOL_SEARCH_DEBOUNCE_MS } from '@/lib/schools/constants';
import type { SchoolCatalogRow as SchoolCatalogRowType } from '@/lib/schools/types';
import { safePadTop } from '@/lib/despia/safeArea';
import { DISCOVER_PATH, GAME_PATH, discoverKindPath } from '@/lib/routes/routePolicy';
import { queuePendingMapFocus } from '@/map/location/camera/pendingMapFocus';

/** /discover/schools — your schools + statewide catalog. */
export default function DiscoverSchoolsPage() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const { schools, addedSchoolIds, busyKey, error, run, onAdd } =
    useAccountSchoolActions(accountId);
  const groups = useMemo(() => groupAccountSchools(schools), [schools]);
  const notifyCount = groups.filter((group) => group.notify).length;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SCHOOL_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const catalog = useSchoolCatalogList(debouncedQuery);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && catalog.hasMore && !catalog.loading) {
          catalog.loadMore();
        }
      },
      { rootMargin: '200px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [catalog.hasMore, catalog.loading, catalog.loadMore]);

  const onOpenMap = useCallback(
    (row: SchoolCatalogRowType) => {
      if (
        typeof row.lat === 'number' &&
        typeof row.lng === 'number' &&
        Number.isFinite(row.lat) &&
        Number.isFinite(row.lng)
      ) {
        queuePendingMapFocus({
          lat: row.lat,
          lng: row.lng,
          label: row.name,
        });
      }
      router.push(GAME_PATH);
    },
    [router],
  );

  const hint =
    !accountId
      ? 'Sign in to add schools.'
      : groups.length === 0
        ? 'Add a school below, then set Attended / Attending / Parent / Follow.'
        : notifyCount === 0
          ? 'Turn on updates to hear about schools you care about.'
          : 'Your school tags show on Discover and power future alerts.';

  return (
    <PageScroll>
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
        style={{ paddingTop: safePadTop('0.2rem') }}
      >
        <div className="relative flex h-11 items-center px-3">
          <button
            type="button"
            onClick={() => router.push(DISCOVER_PATH)}
            aria-label="Back to Discover"
            className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
          >
            <IconArrowLeft className="h-5 w-5" />
            <span className="text-[16px] font-semibold">Discover</span>
          </button>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-bold tracking-tight text-foreground">
            Schools
          </h1>
          <div className="ml-auto w-[88px]" aria-hidden />
        </div>
      </header>

      <div className="space-y-6 px-5 pb-12 pt-4">
        <p className="text-[14px] leading-snug text-foreground-muted">{hint}</p>

        <Link
          href={discoverKindPath('school-districts')}
          className="inline-flex rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[13px] font-semibold text-foreground transition active:opacity-70"
        >
          School districts
        </Link>

        {error ? <p className="text-[13px] text-red-700">{error}</p> : null}

        {groups.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-foreground-muted">
              Your schools
            </h2>
            <ul className="space-y-3">
              {groups.map((group) => (
                <SchoolGroupCard
                  key={group.schoolId}
                  group={group}
                  accountId={accountId}
                  busyKey={busyKey}
                  run={run}
                />
              ))}
            </ul>
          </section>
        ) : accountId ? (
          <p className="rounded-2xl bg-black/[0.04] px-4 py-6 text-center text-[14px] text-foreground-muted">
            No schools yet — find one below.
          </p>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-foreground-muted">
              Find a school
            </h2>
            {catalog.total > 0 ? (
              <span className="shrink-0 text-[13px] tabular-nums text-foreground-muted">
                {catalog.total.toLocaleString()}
              </span>
            ) : null}
          </div>
          <p className="text-[13px] leading-snug text-foreground-muted">
            Minnesota K–12 schools A–Z. Add to your list or open on the map.
          </p>
          <FeedSearchField
            value={query}
            onChange={setQuery}
            onCancel={() => setQuery('')}
            placeholder="Search schools"
          />

          {catalog.error ? (
            <p className="text-[14px] text-red-700">{catalog.error}</p>
          ) : null}

          {catalog.rows.length === 0 && !catalog.loading ? (
            <p className="pt-2 text-[14px] text-foreground-muted">
              {debouncedQuery
                ? `No schools match “${debouncedQuery}”.`
                : 'No schools found.'}
            </p>
          ) : (
            <div className="divide-y divide-black/[0.08] overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
              {catalog.rows.map((row) => (
                <SchoolCatalogRow
                  key={row.id}
                  row={row}
                  added={addedSchoolIds.has(row.id)}
                  showAdd={Boolean(accountId)}
                  busyKey={busyKey}
                  onAdd={() => void onAdd(row.id)}
                  onMap={() => onOpenMap(row)}
                />
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="h-6" aria-hidden />
          {catalog.loading ? (
            <p className="text-center text-[12px] text-foreground-muted">Loading…</p>
          ) : null}
          {!catalog.loading && !catalog.hasMore && catalog.rows.length > 0 ? (
            <p className="text-center text-[12px] text-foreground-muted">End of list</p>
          ) : null}
        </section>
      </div>
    </PageScroll>
  );
}
