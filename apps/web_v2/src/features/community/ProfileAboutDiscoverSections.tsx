'use client';

/**
 * Profile About — interests / places / schools from Discover.
 * Self: live Discover summaries (manage links). Others: public read-only mirror.
 */

import Link from 'next/link';
import { DiscoverInterestsSection } from '@/features/discover/DiscoverInterestsSection';
import { DiscoverPlacesInterestsSummary } from '@/features/discover/DiscoverPlacesInterestsSummary';
import { DiscoverSchoolsSummary } from '@/features/discover/DiscoverSchoolsSummary';
import {
  DiscoverSectionHeader,
  DISCOVER_FOLLOW_PILL_CLASS,
} from '@/features/discover/DiscoverChrome';
import type { ProfileAboutDiscover } from '@/features/community/profileAboutDiscover';
import { directoryPageSharePath } from '@/lib/directory/pageContactLinks';
import {
  DISCOVER_SCHOOLS_PATH,
  GAME_PATH,
  directoryTerritoryPath,
} from '@/lib/routes/routePolicy';
import { queuePendingMapFocus } from '@/map/location/camera/pendingMapFocus';

const PILL_PREVIEW = 12;

function PublicPillSection({
  title,
  ariaLabel,
  items,
}: {
  title: string;
  ariaLabel: string;
  items: Array<{
    id: string;
    name: string;
    href?: string;
    onNavigate?: () => void;
  }>;
}) {
  if (items.length === 0) return null;
  const preview = items.slice(0, PILL_PREVIEW);
  const overflow = Math.max(0, items.length - preview.length);

  return (
    <section>
      <DiscoverSectionHeader title={title} className="px-0" />
      <div
        className="mt-2.5 flex flex-wrap items-center gap-1.5"
        role="list"
        aria-label={ariaLabel}
      >
        {preview.map((item) =>
          item.href ? (
            <Link
              key={item.id}
              href={item.href}
              role="listitem"
              className={`${DISCOVER_FOLLOW_PILL_CLASS} transition active:opacity-70`}
              onClick={item.onNavigate}
            >
              {item.name}
            </Link>
          ) : (
            <span
              key={item.id}
              role="listitem"
              className={DISCOVER_FOLLOW_PILL_CLASS}
            >
              {item.name}
            </span>
          ),
        )}
        {overflow > 0 ? (
          <span className="rounded-full px-2 py-1 text-[12px] font-semibold text-foreground-muted">
            +{overflow}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function PublicInterestsSection({
  interests,
}: {
  interests: ProfileAboutDiscover['interests'];
}) {
  return (
    <PublicPillSection
      title="Interests"
      ariaLabel="Interests"
      items={interests.map((row) => ({ id: row.id, name: row.name }))}
    />
  );
}

function PublicPlacesSection({
  places,
}: {
  places: ProfileAboutDiscover['places'];
}) {
  return (
    <PublicPillSection
      title="Places"
      ariaLabel="Places"
      items={places.map((place) => ({
        id: place.unit_id,
        name: place.name,
        href: directoryTerritoryPath(place.unit_id),
      }))}
    />
  );
}

function PublicSchoolsSection({
  schools,
}: {
  schools: ProfileAboutDiscover['schools'];
}) {
  return (
    <PublicPillSection
      title="Schools"
      ariaLabel="Schools"
      items={schools.map((school) => {
        const pagePath = directoryPageSharePath(school.page_slug);
        const hasCoords =
          school.lat != null &&
          school.lng != null &&
          Number.isFinite(school.lat) &&
          Number.isFinite(school.lng);
        return {
          id: school.school_id,
          name: school.name,
          href: pagePath ?? (hasCoords ? GAME_PATH : DISCOVER_SCHOOLS_PATH),
          onNavigate:
            hasCoords && !pagePath
              ? () => {
                  queuePendingMapFocus({
                    lat: school.lat!,
                    lng: school.lng!,
                    label: school.name,
                  });
                }
              : undefined,
        };
      })}
    />
  );
}

/** Self About — same Discover summaries + manage/add as Discover home. */
function SelfDiscoverSections({ accountId }: { accountId: string }) {
  return (
    <div className="-mx-4">
      <DiscoverInterestsSection accountId={accountId} />
      <DiscoverPlacesInterestsSummary accountId={accountId} />
      <DiscoverSchoolsSummary accountId={accountId} />
    </div>
  );
}

export function ProfileAboutDiscoverSections({
  accountId,
  isSelf,
  about,
}: {
  accountId: string;
  isSelf: boolean;
  about: ProfileAboutDiscover;
}) {
  if (isSelf) {
    return <SelfDiscoverSections accountId={accountId} />;
  }

  const hasAny =
    about.interests.length > 0 ||
    about.places.length > 0 ||
    about.schools.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-6">
      <PublicInterestsSection interests={about.interests} />
      <PublicPlacesSection places={about.places} />
      <PublicSchoolsSection schools={about.schools} />
    </div>
  );
}

export function profileAboutHasDiscover(about: ProfileAboutDiscover | undefined): boolean {
  if (!about) return false;
  return (
    about.interests.length > 0 ||
    about.places.length > 0 ||
    about.schools.length > 0
  );
}
