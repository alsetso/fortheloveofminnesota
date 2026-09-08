'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  isAccountTerritoryKind,
  isHiddenTerritoryKind,
} from '@/features/accountTerritories/store/constants';

export type AccountPlaceAffinity = {
  id: string;
  kind: string;
  /** Territory unit id when known — used for remove / home lock. */
  territoryUnitId: string | null;
  entity: DockEntity;
};

type PlaceRow = {
  id: string;
  kind: string;
  territory_unit_id: string | null;
};

type UnitRow = {
  id: string;
  kind: string;
  subtype: string | null;
  name: string;
};

function dockEntityFromUnit(unit: UnitRow): DockEntity {
  switch (unit.kind) {
    case 'ctu':
      return {
        id: unit.id,
        kind: 'ctu',
        title: unit.name,
        subtitle: 'City / town',
        kindLabel: 'City / town',
      };
    case 'county':
      return {
        id: unit.id,
        kind: 'county',
        title: unit.name,
        subtitle: 'County',
      };
    case 'school_district':
      return {
        id: unit.id,
        kind: 'school_district',
        title: unit.name,
        subtitle: 'School district',
      };
    case 'zipcode':
      return {
        id: unit.id,
        kind: 'zipcode',
        title: unit.name,
        subtitle: 'ZIP',
      };
    case 'congressional':
      return {
        id: unit.id,
        kind: 'district',
        title: unit.name,
        subtitle: 'Congressional',
        kindLabel: 'Congressional',
      };
    case 'legislative':
      if (unit.subtype === 'senate') {
        return {
          id: unit.id,
          kind: 'senate_district',
          title: unit.name,
          subtitle: 'Senate',
          kindLabel: 'Senate',
        };
      }
      return {
        id: unit.id,
        kind: 'house_district',
        title: unit.name,
        subtitle: 'House',
        kindLabel: 'House',
      };
    default:
      return {
        id: unit.id,
        kind: 'page',
        title: unit.name,
        subtitle: unit.kind.replace(/_/g, ' '),
      };
  }
}

/** Load public.account_places + place names for the signed-in account. */
export function useAccountPlaces(accountId: string | null | undefined) {
  const [places, setPlaces] = useState<AccountPlaceAffinity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    if (!accountId) {
      setPlaces([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const supabase = createClient();
        const { data: rows, error } = await supabase
          .from('account_places')
          .select('id, kind, territory_unit_id')
          .eq('account_id', accountId)
          .order('created_at', { ascending: true });

        if (error || cancelled) {
          if (error) console.error('account_places', error.message);
          if (!cancelled) setPlaces([]);
          return;
        }

        const placeRows = (rows ?? []) as PlaceRow[];
        const unitIds = [
          ...new Set(placeRows.map((r) => r.territory_unit_id).filter(Boolean)),
        ] as string[];

        const unitById = new Map<string, UnitRow>();
        if (unitIds.length) {
          const { data: units } = await supabase
            .schema('territory')
            .from('units')
            .select('id, kind, subtype, name')
            .in('id', unitIds);
          for (const u of units ?? []) {
            unitById.set(u.id as string, u as UnitRow);
          }
        }

        if (cancelled) return;

        const affinities: AccountPlaceAffinity[] = placeRows
          .flatMap((row) => {
            if (!isAccountTerritoryKind(row.kind)) return [];
            const unit = row.territory_unit_id ? unitById.get(row.territory_unit_id) : null;
            if (!unit || unit.kind !== 'ctu') return [];
            return [
              {
                id: row.id,
                kind: row.kind,
                territoryUnitId: row.territory_unit_id,
                entity: dockEntityFromUnit(unit),
              },
            ];
          })
          .filter((place) => !isHiddenTerritoryKind(place.entity.kind));

        setPlaces(affinities);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, reloadToken]);

  return { places, isLoading, refresh };
}
