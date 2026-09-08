'use client';

/**
 * Profile About tab — game stats + Discover identity + traits.
 */

import type { PublicProfile } from '@/features/community/profileApi';
import {
  ProfileAboutDiscoverSections,
  profileAboutHasDiscover,
} from '@/features/community/ProfileAboutDiscoverSections';
import { ProfileGameStats } from '@/features/community/ProfileGameStats';
import { formatTraitEmoji, formatTraitLabel } from '@/features/account/accountTraits';
import {
  DiscoverSectionHeader,
  DISCOVER_FOLLOW_PILL_CLASS,
} from '@/features/discover/DiscoverChrome';
import type { TodayRecord } from '@/features/today/records';

export function ProfileAboutPanel({
  profile,
}: {
  profile: PublicProfile;
  /** Kept for call-site compatibility; game stats no longer expand into records. */
  onSelectRecord?: (record: TodayRecord) => void;
}) {
  const hasStanding = Boolean(
    profile.standing_level || profile.standing_streak || profile.standing_discovers,
  );
  const traits = profile.account.traits ?? [];
  const about = profile.about ?? { interests: [], places: [], schools: [] };
  const hasDiscover = profile.is_self || profileAboutHasDiscover(about);
  const hasAnything = hasStanding || traits.length > 0 || hasDiscover;

  if (!hasAnything) {
    return (
      <div className="px-5 py-14 text-center">
        <p className="text-[17px] font-bold tracking-tight text-foreground">Nothing here yet</p>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground-muted">
          They haven’t shared interests, places, schools, or game stats yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-6 pt-4">
      <ProfileGameStats profile={profile} />

      <ProfileAboutDiscoverSections
        accountId={profile.account.id}
        isSelf={profile.is_self}
        about={about}
      />

      {traits.length > 0 ? (
        <section>
          <DiscoverSectionHeader title="Traits" className="px-0" />
          <div
            className="mt-2.5 flex flex-wrap gap-1.5"
            role="list"
            aria-label="Traits"
          >
            {traits.map((t) => (
              <span
                key={t}
                role="listitem"
                className={`inline-flex items-center gap-1 ${DISCOVER_FOLLOW_PILL_CLASS}`}
              >
                <span aria-hidden>{formatTraitEmoji(t)}</span>
                {formatTraitLabel(t)}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
