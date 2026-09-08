'use client';

/**
 * Visual gate for territory detail sections below About — shows what’s waiting
 * behind a visit without exposing the real content.
 */

import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { IconLock } from '@/features/map/dockCore/core/icons';
import {
  DockSection,
  ENTRY_ROW_GLASS_CLASS,
} from '@/features/map/dockCore/panes/DockPaneShell';
import { isSaveableTerritoryDockKind } from '@/features/accountTerritories/store/constants';

type LockedRow = {
  title: string;
  subtitle: string;
};

function lockedRowsFor(entity: DockEntity, omitSavePlace: boolean): LockedRow[] {
  const rows: LockedRow[] = [
    {
      title: 'Officials',
      subtitle: 'Seats and officeholders for this place',
    },
    {
      title: 'Public Bulletin',
      subtitle: 'Meeting agendas, photos, and community updates',
    },
    // Collectible finds are scoped to cities & towns only.
    ...(entity.kind === 'ctu'
      ? [{ title: 'Finds here', subtitle: 'Collectibles placed inside this city or town' }]
      : []),
    {
      title: 'Place AI',
      subtitle: 'Ask about this area',
    },
  ];

  if (!omitSavePlace && isSaveableTerritoryDockKind(entity.kind)) {
    rows.push({
      title: 'Save place',
      subtitle: 'Tag how this area relates to you',
    });
  }

  if (entity.kind === 'county') {
    rows.push({
      title: 'Inside this county',
      subtitle: 'Cities and towns on the map',
    });
  } else if (entity.kind === 'school_district') {
    rows.push({
      title: 'Inside this district',
      subtitle: 'Schools on the map',
    });
  } else if (entity.kind === 'district') {
    rows.push({
      title: 'Precincts',
      subtitle: 'Voting precincts inside this district',
    });
  }

  return rows;
}

/**
 * After the Travel-to-unlock prompt — frosted stubs for every gated section so
 * the page still reads as a full territory record, just locked.
 */
export function DockPassportLockedSections({
  entity,
  omitSavePlace = false,
}: {
  entity: DockEntity;
  /** Place page surfaces relationship above the lock — don’t stub it here. */
  omitSavePlace?: boolean;
}) {
  const rows = lockedRowsFor(entity, omitSavePlace);

  return (
    <DockSection
      title="Locked until you visit"
      subtitle="Travel here in person to open the rest of this record."
    >
      <div
        className={`overflow-hidden rounded-2xl ${ENTRY_ROW_GLASS_CLASS} divide-y divide-[rgb(var(--map-ink-subtle))]`}
        aria-hidden={false}
      >
        {rows.map((row) => (
          <div
            key={row.title}
            className="flex items-center gap-3 px-3.5 py-3 opacity-70"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-foreground-muted">
              <IconLock className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-foreground">
                {row.title}
              </p>
              <p className="truncate text-[12px] text-foreground-muted">
                {row.subtitle}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              Locked
            </span>
          </div>
        ))}
      </div>
    </DockSection>
  );
}
