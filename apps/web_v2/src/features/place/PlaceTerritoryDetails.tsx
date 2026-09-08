'use client';

/**
 * Territory detail body for `/directory/territory/:unitId`.
 *
 * Place page owns identity + relationship above this block.
 * Here: passport stamp, About, then visit-gated civic sections.
 * Relationship (Live / Work / Follow) is never gated — see PlaceRelationshipSection.
 */

import { useMemo } from 'react';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  DockActionRow,
  DockSection,
} from '@/features/map/dockCore/panes/DockPaneShell';
import { DockOfficeholdersSection } from '@/features/map/dockCore/panes/DockOfficeholdersSection';
import { DockPassportLockedSections } from '@/features/map/dockCore/panes/DockPassportLockedSections';
import { DockUnitProfileSection } from '@/features/map/dockCore/panes/DockUnitProfileSection';
import { DockWorldObjectsHereSection } from '@/features/map/dockCore/panes/DockWorldObjectsHereSection';
import { useTerritoryPassportUnlock } from '@/features/map/dockCore/panes/useTerritoryPassportUnlock';
import { TerritoryHeroHeader } from '@/features/map/dockCore/panes/TerritoryHeroHeader';
import { TerritoryBulletinSection } from '@/features/map/dockCore/panes/TerritoryBulletinSection';
import { IconSparkles } from '@/features/map/dockCore/core/icons';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import type { PlaceRecord } from '@/features/place/placeTypes';

const UNIT_AI_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
]);

const CTU_KINDS = new Set<DockEntity['kind']>(['ctu']);

const DOCK_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
  'district',
  'senate_district',
  'house_district',
  'zipcode',
]);

export function placeRecordToDockEntity(place: PlaceRecord): DockEntity | null {
  if (!DOCK_KINDS.has(place.dockKind as DockEntity['kind'])) return null;
  return {
    id: place.id,
    kind: place.dockKind as DockEntity['kind'],
    title: place.name,
    kindLabel: place.kindLabel,
  };
}

export function PlaceTerritoryDetails({
  place,
  presenceUi = true,
}: {
  place: PlaceRecord;
  presenceUi?: boolean;
}) {
  const { openSubpage } = useMapDock();
  const entity = useMemo(() => placeRecordToDockEntity(place), [place]);

  if (!entity) {
    return (
      <p className="text-[14px] text-foreground-muted">
        Details for this territory type are not available yet.
      </p>
    );
  }

  return (
    <PlaceTerritoryDetailsBody
      entity={entity}
      openSubpage={openSubpage}
      presenceUi={presenceUi}
    />
  );
}

function PlaceTerritoryDetailsBody({
  entity,
  openSubpage,
  presenceUi,
}: {
  entity: DockEntity;
  openSubpage: ReturnType<typeof useMapDock>['openSubpage'];
  presenceUi: boolean;
}) {
  const { loading: unlockLoading, unlocked, locked, unlockable, xpEarned } =
    useTerritoryPassportUnlock(entity);

  const contentUnlocked = !presenceUi || unlocked;

  return (
    <div className="space-y-6">
      {presenceUi ? (
        <TerritoryHeroHeader
          entity={entity}
          unlockable={unlockable}
          loading={unlockLoading}
          unlocked={unlocked}
          locked={locked}
          xpEarned={xpEarned}
          compact
        />
      ) : null}

      <DockUnitProfileSection entity={entity} />

      {presenceUi && locked ? (
        <DockPassportLockedSections entity={entity} omitSavePlace />
      ) : null}

      {contentUnlocked ? (
        <>
          <DockOfficeholdersSection entity={entity} />

          {UNIT_AI_KINDS.has(entity.kind) ? (
            <TerritoryBulletinSection entity={entity} />
          ) : null}

          {CTU_KINDS.has(entity.kind) ? (
            <DockWorldObjectsHereSection entity={entity} />
          ) : null}

          {UNIT_AI_KINDS.has(entity.kind) ? (
            <DockSection
              title="Place AI"
              subtitle="Ask about this area — seats, website, contact."
            >
              <DockActionRow
                title="Open AI"
                subtitle="Chats stay on this record · back returns here"
                onClick={() =>
                  openSubpage({
                    title: entity.title,
                    subtitle: 'AI',
                    kind: 'territory-ai',
                    slug: entity.id,
                  })
                }
                trailing={
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-foreground">
                    <IconSparkles className="h-4 w-4" />
                  </span>
                }
              />
            </DockSection>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
