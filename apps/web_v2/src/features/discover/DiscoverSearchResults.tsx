'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DiscoverSectionHeader } from '@/features/discover/DiscoverChrome';
import {
  persistDiscoverSearchCompletion,
  type DiscoverSearchHit,
  type DiscoverSearchSection,
} from '@/features/discover/discoverSearchApi';
import {
  IconChevronRight,
  IconGraduationCap,
  IconHome,
  IconLayers,
  IconMapPin,
  IconPeopleGroup,
  IconPost,
  IconSparkles,
  IconUser,
} from '@/features/map/dockCore/core/icons';
import { discoverHitHref } from '@/lib/discover/search/types';
import { GAME_PATH, isSignedInMapPath } from '@/lib/routes/routePolicy';
import { queuePendingMapFocus } from '@/map/location/camera/pendingMapFocus';

function iconForHit(hit: DiscoverSearchHit) {
  switch (hit.kind) {
    case 'page':
      return <IconHome className="h-[18px] w-[18px]" />;
    case 'territory':
      return <IconLayers className="h-[18px] w-[18px]" />;
    case 'atlas_feature':
    case 'atlas_collection':
      return <IconMapPin className="h-[18px] w-[18px]" />;
    case 'place':
      return <IconMapPin className="h-[18px] w-[18px]" />;
    case 'experience_zone':
      return <IconSparkles className="h-[18px] w-[18px]" />;
    case 'school':
      return <IconGraduationCap className="h-[18px] w-[18px]" />;
    case 'post':
      return <IconPost className="h-[18px] w-[18px]" />;
    case 'account':
      return <IconUser className="h-[18px] w-[18px]" />;
    default:
      return <IconPeopleGroup className="h-[18px] w-[18px]" />;
  }
}

function persistHitOpen(query: string, hit: DiscoverSearchHit) {
  void persistDiscoverSearchCompletion({
    query,
    completedVia: 'result_open',
    hitKind: hit.kind,
    hitId: hit.id,
    hitTitle: hit.title,
    hitHref: discoverHitHref(hit),
  });
}

function SearchResultRow({
  hit,
  query,
  onPlaceSelect,
  onNavigate,
  compact,
}: {
  hit: DiscoverSearchHit;
  query: string;
  onPlaceSelect?: (hit: DiscoverSearchHit) => void;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const onMap = isSignedInMapPath(pathname);

  const finish = () => {
    persistHitOpen(query, hit);
    onNavigate?.();
  };

  const rowPad = compact ? 'px-3' : 'px-5';
  const body = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-black/[0.08] bg-[#f4f6f8] text-lake-blue">
        {hit.meta?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hit.meta.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          iconForHit(hit)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-snug text-foreground">
          {hit.title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-snug text-foreground-muted">
          {[hit.kindLabel, hit.subtitle].filter(Boolean).join(' · ')}
        </span>
      </span>
      <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/70" />
    </>
  );

  const hasMapCoords =
    hit.meta?.lat != null &&
    hit.meta?.lng != null &&
    Number.isFinite(hit.meta.lat) &&
    Number.isFinite(hit.meta.lng);

  if ((hit.kind === 'place' || hit.kind === 'school') && hasMapCoords && !hit.href) {
    return (
      <button
        type="button"
        onClick={() => {
          finish();
          if (onPlaceSelect) {
            onPlaceSelect(hit);
            return;
          }
          queuePendingMapFocus({
            lat: hit.meta!.lat!,
            lng: hit.meta!.lng!,
            label: hit.title,
          });
          if (!onMap) router.push(GAME_PATH);
        }}
        className={`flex w-full items-center gap-3 py-3 text-left transition active:bg-black/[0.03] ${rowPad}`}
      >
        {body}
      </button>
    );
  }

  if (!hit.href) return null;

  return (
    <Link
      href={hit.href}
      onClick={finish}
      className={`flex items-center gap-3 py-3 transition active:bg-black/[0.03] ${rowPad}`}
    >
      {body}
    </Link>
  );
}

export function DiscoverSearchResults({
  query,
  sections,
  onPlaceSelect,
  onNavigate,
  compact = false,
}: {
  query: string;
  sections: DiscoverSearchSection[];
  onPlaceSelect?: (hit: DiscoverSearchHit) => void;
  /** Fired after persist when any hit is activated (dock collapse, etc.). */
  onNavigate?: () => void;
  compact?: boolean;
}) {
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <section key={section.kind} className="pt-3">
          <DiscoverSectionHeader
            title={section.label}
            className={compact ? 'px-0' : undefined}
          />
          <div
            className={`mt-2 divide-y divide-black/[0.07] border-y border-black/[0.06] bg-white/70 ${
              compact ? 'rounded-[12px] border' : ''
            }`}
          >
            {section.hits.map((hit) => (
              <SearchResultRow
                key={`${hit.kind}-${hit.id}`}
                hit={hit}
                query={query}
                onPlaceSelect={onPlaceSelect}
                onNavigate={onNavigate}
                compact={compact}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
