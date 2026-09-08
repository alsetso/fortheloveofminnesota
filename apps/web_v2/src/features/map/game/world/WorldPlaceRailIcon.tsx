'use client';

/** Icons for world model kinds (rail + dock cards). */

import type { ReactNode } from 'react';
import {
  IconBillboard,
  IconBus,
  IconCat,
  IconChest,
  IconChicken,
  IconCoin,
  IconCoop,
  IconCow,
  IconDog,
  IconFish,
  IconFlag,
  IconFox,
  IconGraduationCap,
  IconHeart,
  IconMapPin,
  IconTree,
  IconWoodenSign,
} from '@/features/map/dockCore/core/icons';
import type { WorldModelSlug } from '@/features/map/game/world/catalog';
import { getWorldModel } from '@/features/map/game/world/catalogStore';
import type { WorldPlaceMode } from '@/features/map/game/world/placeModeStore';

const SLUG_ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  'wooden-sign-ipoly3d': IconWoodenSign,
  'wooden-sign': IconWoodenSign,
  'coin-quaternius': IconCoin,
  'heart-quaternius': IconHeart,
  'flag-quaternius': IconFlag,
  flag: IconFlag,
  'billboard-poly': IconBillboard,
  billboard: IconBillboard,
  'tree-quaternius': IconTree,
  'cow-poly': IconCow,
  'chicken-jeremy': IconChicken,
  chicken: IconChicken,
  'chicken-coop-quaternius': IconCoop,
  'cat-poly': IconCat,
  'beagle-poly': IconDog,
  'fox-poly': IconFox,
  'treasure-chest-safayan': IconChest,
  'fish-kenney': IconFish,
  'graduation-cap-poly': IconGraduationCap,
  bus: IconBus,
  schoolbus: IconBus,
};

const CATEGORY_ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  prop: IconMapPin,
  vehicle: IconBus,
  air: IconMapPin,
  water: IconMapPin,
  building: IconMapPin,
  sign: IconWoodenSign,
  sport: IconMapPin,
  animal: IconDog,
  character: IconMapPin,
};

export function WorldModelKindIcon({
  kind,
  className = 'h-5 w-5',
}: {
  kind: WorldModelSlug;
  className?: string;
}) {
  const spec = getWorldModel(kind);
  const Icon =
    SLUG_ICONS[kind] ??
    (spec ? CATEGORY_ICONS[spec.category] : null) ??
    IconMapPin;
  return <Icon className={className} />;
}

export function WorldPlaceRailIcon({
  mode,
  className = 'h-5 w-5',
}: {
  mode: WorldPlaceMode;
  className?: string;
}) {
  const kind = mode === 'off' ? 'wooden-sign-ipoly3d' : mode;
  return <WorldModelKindIcon kind={kind} className={className} />;
}
