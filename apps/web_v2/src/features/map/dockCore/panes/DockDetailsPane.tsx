'use client';

import TerritorySaveSection from '@/features/accountTerritories/ui/TerritorySaveSection';
import { isSaveableTerritoryDockKind } from '@/features/accountTerritories/store/constants';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  DockActionRow,
  DockPaneShell,
  DockSection,
} from '@/features/map/dockCore/panes/DockPaneShell';
import DockAtlasFeatureSection from '@/features/map/dockCore/panes/DockAtlasFeatureSection';
import { DockOfficeholdersSection } from '@/features/map/dockCore/panes/DockOfficeholdersSection';
import DockPageDetailSection from '@/features/map/dockCore/panes/DockPageDetailSection';
import { DockPassportLockedSections } from '@/features/map/dockCore/panes/DockPassportLockedSections';
import { DockUnitProfileSection } from '@/features/map/dockCore/panes/DockUnitProfileSection';
import { DockWorldObjectsHereSection } from '@/features/map/dockCore/panes/DockWorldObjectsHereSection';
import { useTerritoryPassportUnlock } from '@/features/map/dockCore/panes/useTerritoryPassportUnlock';
import { TerritoryHeroHeader } from '@/features/map/dockCore/panes/TerritoryHeroHeader';
import { TerritoryBulletinSection } from '@/features/map/dockCore/panes/TerritoryBulletinSection';
import { IconSparkles } from '@/features/map/dockCore/core/icons';
import { useTerritoryLayers } from '@/features/map/territory';
import { ToggleTrack } from '@/components/ui/Toggle';
import { haptic } from '@/lib/despia/haptics';

/** Atlas kinds whose feature id matches territory.units.id (passport + AI + bulletin). */
const UNIT_AI_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
  // district / senate_district / house_district: hidden for first launch
]);

/**
 * Only CTUs (cities, towns, townships) are the primary collectible discovery
 * layer. Counties and school districts are organizational containers —
 * too broad to make individual finds meaningful. Objects are placed at the
 * CTU level so discovery scales with how much of Minnesota you've physically
 * traveled.
 */
const CTU_KINDS = new Set<DockEntity['kind']>(['ctu']);

/** Place / pin / page detail layout inside the dock. */
export default function DockDetailsPane({ entity }: { entity: DockEntity }) {
  const { openSubpage, openAccount } = useMapDock();
  const {
    countyOverlays,
    toggleCountyCities,
    toggleCountyTowns,
    districtSchools,
    toggleDistrictSchools,
    districtParts,
    loadDistrictParts,
    clearDistrictParts,
  } = useTerritoryLayers();
  const { loading: unlockLoading, unlocked, locked, unlockable, xpEarned } =
    useTerritoryPassportUnlock(entity);

  const isPage = entity.kind === 'page';
  const isAtlas = entity.kind === 'atlas';
  const isCounty = entity.kind === 'county';
  const isSchoolDistrict = entity.kind === 'school_district';
  const isDistrict = entity.kind === 'district';

  const citiesOn = countyOverlays.countyId === entity.id && countyOverlays.citiesOn;
  const townsOn = countyOverlays.countyId === entity.id && countyOverlays.townsOn;
  const ctuLoading =
    countyOverlays.citiesLoading && countyOverlays.countyId === entity.id;
  const schoolsOn =
    districtSchools.districtId === entity.id && districtSchools.schoolsOn;
  const partsOn = districtParts.districtId === entity.id && districtParts.partsOn;

  if (isPage) {
    return (
      <DockPaneShell>
        <div className="space-y-5 pb-6">
          <DockPageDetailSection entity={entity} />
          <DockSection title="Account">
            <DockActionRow
              title="Account"
              subtitle="Profile, wallet, plan"
              onClick={openAccount}
            />
          </DockSection>
        </div>
      </DockPaneShell>
    );
  }

  if (isAtlas) {
    return (
      <DockPaneShell>
        <DockAtlasFeatureSection entity={entity} />
      </DockPaneShell>
    );
  }

  return (
    <DockPaneShell>
      <div className="space-y-5 pb-6">
        {/* Passport stamp hero — identity chips + lock/unlock state + See all link */}
        <TerritoryHeroHeader
          entity={entity}
          unlockable={unlockable}
          loading={unlockLoading}
          unlocked={unlocked}
          locked={locked}
          xpEarned={xpEarned}
        />

        {/* About — always public for every territory. */}
        <DockUnitProfileSection entity={entity} />

        {/* Frosted section stubs below About when still locked. */}
        {locked ? <DockPassportLockedSections entity={entity} /> : null}

        {/* Everything below About — only after visit (or non-passport kinds). */}
        {unlocked ? (
          <>
            <DockOfficeholdersSection entity={entity} />

            {/* Public Bulletin — territory-specific feed, gated by passport visit. */}
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

            {isSaveableTerritoryDockKind(entity.kind) ? (
              <TerritorySaveSection
                territoryUnitId={entity.id}
                territoryTitle={entity.title}
              />
            ) : null}

            {isCounty ? (
              <DockSection
                title="Inside this county"
                subtitle="Toggle related boundaries on the map within this county."
              >
                <DockActionRow
                  title="Cities"
                  subtitle={
                    ctuLoading
                      ? 'Loading…'
                      : citiesOn
                        ? `${countyOverlays.citiesCount.toLocaleString()} on map`
                        : 'Incorporated cities in this county'
                  }
                  onClick={() => {
                    haptic.toggle();
                    toggleCountyCities(entity.id);
                  }}
                  trailing={<ToggleTrack on={citiesOn} type="compact" />}
                />
                <DockActionRow
                  title="Towns"
                  subtitle={
                    ctuLoading
                      ? 'Loading…'
                      : townsOn
                        ? `${countyOverlays.townsCount.toLocaleString()} on map`
                        : 'Townships and towns in this county'
                  }
                  onClick={() => {
                    haptic.toggle();
                    toggleCountyTowns(entity.id);
                  }}
                  trailing={<ToggleTrack on={townsOn} type="compact" />}
                />
              </DockSection>
            ) : null}

            {isSchoolDistrict ? (
              <DockSection
                title="Inside this district"
                subtitle="Toggle schools on the map for this district."
              >
                <DockActionRow
                  title="Show schools"
                  subtitle={
                    districtSchools.schoolsLoading &&
                    districtSchools.districtId === entity.id
                      ? 'Loading…'
                      : schoolsOn
                        ? `${districtSchools.schoolsCount.toLocaleString()} on map`
                        : 'Schools linked to this district'
                  }
                  onClick={() => {
                    haptic.toggle();
                    toggleDistrictSchools(entity.id);
                  }}
                  trailing={<ToggleTrack on={schoolsOn} type="compact" />}
                />
              </DockSection>
            ) : null}

            {isDistrict ? (
              <DockSection
                title="Precincts"
                subtitle="Voting precincts inside this congressional district."
              >
                <DockActionRow
                  title="Show precincts"
                  subtitle={
                    districtParts.partsLoading &&
                    districtParts.districtId === entity.id
                      ? 'Loading…'
                      : partsOn
                        ? `${districtParts.partsCount.toLocaleString()} on map`
                        : 'Load precinct boundaries'
                  }
                  onClick={() => {
                    haptic.toggle();
                    if (partsOn) clearDistrictParts();
                    else loadDistrictParts(entity.id);
                  }}
                  trailing={<ToggleTrack on={partsOn} type="compact" />}
                />
              </DockSection>
            ) : null}
          </>
        ) : null}
      </div>
    </DockPaneShell>
  );
}
