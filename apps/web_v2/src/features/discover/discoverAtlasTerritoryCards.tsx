'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PASSPORT_TERRITORY_KINDS } from '@/features/accountTerritories/store/passportKinds';
import {
  IconBoundaries,
  IconHome,
  IconLayers,
  IconMapPin,
  IconRoute,
  IconTree,
} from '@/features/map/dockCore/core/icons';
import type { AtlasFilterKind } from '@/lib/atlas/types';
import { discoverKindPath } from '@/lib/routes/routePolicy';

const TERRITORY_META_LABEL = 'Territory';

const KIND_ICONS: Record<string, typeof IconHome> = {
  ctu: IconHome,
  county: IconLayers,
  school_district: IconMapPin,
  district: IconLayers,
  senate_district: IconLayers,
  house_district: IconLayers,
};

const TERRITORY_TONE: Record<string, string> = {
  ctu: 'from-[#2a6f8f] to-[#1a4a62]',
  county: 'from-[#3d4a6b] to-[#252e45]',
  school_district: 'from-[#2f5d4a] to-[#1c3a2e]',
  district: 'from-[#8b5a3c] to-[#5c3a26]',
  senate_district: 'from-[#3d4a6b] to-[#252e45]',
  house_district: 'from-[#5c4a3a] to-[#3a2e24]',
};

/** Static territory tables — first cards in the Discover Atlas strip. */
export const DISCOVER_TERRITORY_ATLAS_CARDS = PASSPORT_TERRITORY_KINDS;

/** Compact media tile for territory kinds in the Discover Atlas carousel. */
export function atlasTerritoryCardMedia(unitKind: string): ReactNode {
  const Icon = KIND_ICONS[unitKind] ?? IconLayers;
  const tone = TERRITORY_TONE[unitKind] ?? 'from-[#4a5568] to-[#2d3748]';
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${tone} text-white`}
    >
      <Icon className="h-7 w-7 opacity-90" />
    </div>
  );
}

function collectionTone(kind: AtlasFilterKind): string {
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

function collectionIcon(kind: AtlasFilterKind): ReactNode {
  switch (kind) {
    case 'park':
      return <IconTree className="h-7 w-7 opacity-90" />;
    case 'bridge':
    case 'trail':
      return <IconRoute className="h-7 w-7 opacity-90" />;
    case 'lake':
      return <IconBoundaries className="h-7 w-7 opacity-90" />;
    default:
      return <IconMapPin className="h-7 w-7 opacity-90" />;
  }
}

/** Compact media tile for atlas feature sets in the Discover carousel. */
export function atlasCollectionCardMedia(kind: AtlasFilterKind): ReactNode {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${collectionTone(kind)} text-white`}
    >
      {collectionIcon(kind)}
    </div>
  );
}

/**
 * Full Atlas page grid cell — territory lists with richer chrome.
 */
export function DiscoverAtlasTerritoryPageCard({
  slug,
  label,
  total,
  unitKind,
}: {
  slug: string;
  label: string;
  total: number;
  unitKind: string;
}) {
  const Icon = KIND_ICONS[unitKind] ?? IconLayers;
  return (
    <Link
      href={discoverKindPath(slug)}
      className="flex h-full flex-col overflow-hidden rounded-[16px] bg-black/[0.035] transition active:opacity-80"
    >
      <span className="relative flex h-20 items-center justify-center bg-gradient-to-br from-[#4a5568] to-[#2d3748] text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
        <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground">
          {label}
        </span>
        <span className="text-[12px] text-foreground-muted">
          {TERRITORY_META_LABEL} · {total.toLocaleString()}
        </span>
      </span>
    </Link>
  );
}
