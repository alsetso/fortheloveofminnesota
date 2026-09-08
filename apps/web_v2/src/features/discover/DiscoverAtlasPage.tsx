'use client';

/**
 * `/discover/atlas` — Atlas feature sets (collections) as a compact grid.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import {
  DISCOVER_TERRITORY_ATLAS_CARDS,
  DiscoverAtlasTerritoryPageCard,
} from '@/features/discover/discoverAtlasTerritoryCards';
import {
  IconArrowLeft,
  IconBoundaries,
  IconMapPin,
  IconRoute,
  IconTree,
} from '@/features/map/dockCore/core/icons';
import { safePadTop } from '@/lib/despia/safeArea';
import {
  atlasVisibilityLabel,
  type AtlasCollectionRow,
  type AtlasFilterKind,
} from '@/lib/atlas/types';
import {
  DISCOVER_PATH,
  discoverAtlasCollectionPath,
} from '@/lib/routes/routePolicy';

function iconForKind(kind: AtlasFilterKind) {
  switch (kind) {
    case 'park':
      return <IconTree className="h-5 w-5" />;
    case 'bridge':
      return <IconRoute className="h-5 w-5" />;
    case 'trail':
      return <IconRoute className="h-5 w-5" />;
    case 'lake':
      return <IconBoundaries className="h-5 w-5" />;
    default:
      return <IconMapPin className="h-5 w-5" />;
  }
}

function toneForKind(kind: AtlasFilterKind): string {
  switch (kind) {
    case 'park':
      return 'from-[#2f5d4a] to-[#1c3a2e]';
    case 'bridge':
      return 'from-[#3d4a6b] to-[#252e45]';
    case 'trail':
      return 'from-[#2a6f8f] to-[#1a4a62]';
    case 'lake':
      return 'from-[#2a6f8f] to-[#1a4a62]';
    default:
      return 'from-[#5c4a3a] to-[#3a2e24]';
  }
}

export default function DiscoverAtlasPage() {
  const router = useRouter();
  const [sets, setSets] = useState<AtlasCollectionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/discover/atlas', {
          credentials: 'include',
          cache: 'no-store',
          signal: ac.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? 'Failed to load');
        }
        const body = (await res.json()) as { featureSets?: AtlasCollectionRow[] };
        if (ac.signal.aborted) return;
        setSets(body.featureSets ?? []);
        setError(null);
      } catch (err) {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
        setSets([]);
      }
    })();
    return () => ac.abort();
  }, []);

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
            Atlas
          </h1>
          <div className="ml-auto w-[88px]" aria-hidden />
        </div>
      </header>

      <div className="pb-12">
        <p className="px-5 pt-4 text-[13px] leading-snug text-foreground-muted">
          Territories and feature sets across Minnesota — cities, parks, bridges, and more.
        </p>

        {error ? (
          <p className="px-5 pt-3 text-[14px] text-red-700">{error}</p>
        ) : null}

        {sets === null ? (
          <div className="mt-4 grid grid-cols-2 gap-2.5 px-5 sm:grid-cols-3">
            {DISCOVER_TERRITORY_ATLAS_CARDS.map((kind) => (
              <DiscoverAtlasTerritoryPageCard
                key={kind.slug}
                slug={kind.slug}
                label={kind.label}
                total={kind.total}
                unitKind={kind.unitKind}
              />
            ))}
            {[0, 1, 2].map((i) => (
              <div
                key={`skeleton-${i}`}
                className="h-[132px] animate-pulse rounded-[16px] bg-black/[0.05]"
              />
            ))}
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-2.5 px-5 sm:grid-cols-3">
            {DISCOVER_TERRITORY_ATLAS_CARDS.map((kind) => (
              <li key={kind.slug}>
                <DiscoverAtlasTerritoryPageCard
                  slug={kind.slug}
                  label={kind.label}
                  total={kind.total}
                  unitKind={kind.unitKind}
                />
              </li>
            ))}
            {sets.length === 0 ? (
              <li className="col-span-full px-0 pt-2">
                <p className="text-[14px] text-foreground-muted">
                  No feature sets published yet.
                </p>
              </li>
            ) : (
              sets.map((set) => (
                <li key={set.id}>
                  <Link
                    href={discoverAtlasCollectionPath(set.slug)}
                    className="flex h-full flex-col overflow-hidden rounded-[16px] bg-black/[0.035] transition active:opacity-80"
                  >
                    <span
                      className={`relative flex h-20 items-center justify-center bg-gradient-to-br ${toneForKind(set.filterKind)} text-white`}
                    >
                      {iconForKind(set.filterKind)}
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
                      <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground">
                        {set.name}
                      </span>
                      <span className="text-[12px] text-foreground-muted">
                        {atlasVisibilityLabel(set.visibility)}
                        {set.featureCount > 0
                          ? ` · ${set.featureCount.toLocaleString()}`
                          : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </PageScroll>
  );
}
