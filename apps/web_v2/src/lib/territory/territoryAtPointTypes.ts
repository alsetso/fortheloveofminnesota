import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';

/** One jurisdiction match from public.territory_at_point. */
export type TerritoryAtPointItem = {
  kind: DockEntity['kind'];
  id: string;
  name: string;
  slug: string | null;
  kindLabel: string;
  subtitle?: string | null;
  ctu_class?: string | null;
};

export type TerritoryAtPointResult = {
  jurisdictions: TerritoryAtPointItem[];
};
