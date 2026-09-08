'use client';

/**
 * `/discover/zone/[id]` — pitched streets hero with 3D models,
 * then collectives + sub-zones in Discover chrome.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import {
  DiscoverHeroCarousel,
  DiscoverListSection,
  DiscoverSectionHeader,
  type DiscoverHeroCard,
} from '@/features/discover/DiscoverChrome';
import { DiscoverExperienceZoneCardMap } from '@/features/discover/DiscoverExperienceZoneCardMap';
import { DiscoverZoneHeroMap } from '@/features/discover/DiscoverZoneHeroMap';
import { IconArrowLeft, IconChevronRight } from '@/features/map/dockCore/core/icons';
import { safePadTop } from '@/lib/despia/safeArea';
import {
  fetchExperienceZoneDetail,
  isAbortError,
  type ExperienceZoneCollection,
  type ExperienceZoneDetail,
  type ExperienceZoneSubZone,
} from '@/lib/experienceZones/fetchExperienceZoneDetail';
import { focusForExperienceZone } from '@/lib/experienceZones/focusForExperienceZone';
import {
  DISCOVER_PATH,
  GAME_PATH,
  discoverZonePath,
} from '@/lib/routes/routePolicy';
import { queuePendingMapFocus } from '@/map/location/camera/pendingMapFocus';

const SUB_TONES: NonNullable<DiscoverHeroCard['tone']>[] = [
  'pine',
  'lake',
  'dusk',
  'clay',
];

function subZoneToCard(
  zone: ExperienceZoneSubZone,
  index: number,
): DiscoverHeroCard {
  return {
    id: zone.id,
    eyebrow: 'Sub-zone',
    title: zone.name,
    subtitle:
      zone.description?.trim() || 'Open this area inside the experience zone.',
    href: discoverZonePath(zone.id),
    tone: SUB_TONES[index % SUB_TONES.length],
    media: zone.geometry ? (
      <DiscoverExperienceZoneCardMap
        zoneId={zone.id}
        name={zone.name}
        geometry={zone.geometry}
      />
    ) : undefined,
  };
}

function CollectiveRow({
  item,
  onOpen,
}: {
  item: ExperienceZoneCollection;
  onOpen: () => void;
}) {
  const subtitle =
    item.description?.trim() ||
    (item.placementCount > 0
      ? `${item.placementCount.toLocaleString()} placement${
          item.placementCount === 1 ? '' : 's'
        } in this zone`
      : 'Content pack in this zone');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-5 py-3 text-left transition active:bg-black/[0.03]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-black/[0.08] bg-[#f4f6f8] text-[15px] font-bold text-lake-blue">
        {item.label.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-snug text-foreground">
          {item.label}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-snug text-foreground-muted">
          {subtitle}
        </span>
      </span>
      {item.placementCount > 0 ? (
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground-muted">
          {item.placementCount.toLocaleString()}
        </span>
      ) : null}
      <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/70" />
    </button>
  );
}

export default function DiscoverZonePage({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const [zone, setZone] = useState<ExperienceZoneDetail | null>(null);
  const [subZones, setSubZones] = useState<ExperienceZoneSubZone[]>([]);
  const [collections, setCollections] = useState<ExperienceZoneCollection[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let active = true;
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const result = await fetchExperienceZoneDetail(zoneId, ac.signal);
        if (!active || ac.signal.aborted) return;
        if (!result) {
          setFailed(true);
          setZone(null);
          setSubZones([]);
          setCollections([]);
          setLoading(false);
          return;
        }
        setZone(result.zone);
        setSubZones(result.subZones);
        setCollections(result.collections);
        setLoading(false);
      } catch (err) {
        if (!active || isAbortError(err)) return;
        setFailed(true);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
      ac.abort();
    };
  }, [zoneId]);

  const subCards = useMemo(
    () => subZones.map((z, i) => subZoneToCard(z, i)),
    [subZones],
  );

  const openOnMap = () => {
    if (!zone) return;
    const focus = focusForExperienceZone(zone);
    if (focus) queuePendingMapFocus(focus);
    router.push(GAME_PATH);
  };

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
          <h1 className="pointer-events-none absolute inset-x-0 truncate px-28 text-center text-[17px] font-bold tracking-tight text-foreground">
            {zone?.name ?? 'Experience zone'}
          </h1>
          <div className="ml-auto w-[88px]" aria-hidden />
        </div>
      </header>

      <div className="pb-14">
        {loading ? (
          <div className="h-[min(52vh,420px)] animate-pulse bg-black/[0.06]" />
        ) : zone?.geometry ? (
          <DiscoverZoneHeroMap
            zoneId={zone.id}
            name={zone.name}
            geometry={zone.geometry}
            subZones={subZones}
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-black/[0.04] px-5 text-[14px] text-foreground-muted">
            {failed ? 'Couldn’t load this zone.' : 'No map geometry for this zone.'}
          </div>
        )}

        {!loading && zone ? (
          <>
            <section className="border-b border-black/[0.08] px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-muted">
                Experience zone
              </p>
              <h2 className="mt-1.5 text-[22px] font-bold tracking-tight text-foreground">
                {zone.name}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-foreground-muted">
                {zone.description?.trim() ||
                  'Explore this zone on the map — models, collectives, and sub-areas live here.'}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-[12px]">
                <div>
                  <dt className="text-foreground-muted">Placements</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
                    {zone.placementCount != null
                      ? zone.placementCount.toLocaleString()
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">Collectives</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
                    {zone.collectionCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">Sub-zones</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
                    {zone.subZoneCount.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={openOnMap}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-lake-blue px-5 text-[14px] font-semibold text-white transition active:opacity-80"
              >
                Open on map
              </button>
            </section>

            {subCards.length > 0 ? (
              <DiscoverHeroCarousel
                sectionTitle="Sub-zones"
                cards={subCards}
                size="compact"
              />
            ) : null}

            {collections.length > 0 ? (
              <DiscoverListSection title="Collectives">
                {collections.map((c) => (
                  <CollectiveRow key={c.slug} item={c} onOpen={openOnMap} />
                ))}
              </DiscoverListSection>
            ) : (
              <section className="pt-5">
                <DiscoverSectionHeader title="Collectives" />
                <p className="px-5 pt-3 text-[14px] text-foreground-muted">
                  No content collectives tagged to this zone yet.
                </p>
              </section>
            )}
          </>
        ) : null}

        {!loading && failed ? (
          <p className="px-5 pt-6 text-[14px] text-foreground-muted">
            This experience zone isn’t available.
          </p>
        ) : null}
      </div>
    </PageScroll>
  );
}
