'use client';

/**
 * Profile About — Level / Streak / Finds as a Posts-style count row.
 */

import type { PublicProfile } from '@/features/community/profileApi';
import {
  ProfileStatCell,
  ProfileStatRow,
} from '@/features/community/ProfileStatCell';
import { DiscoverSectionHeader } from '@/features/discover/DiscoverChrome';
import { DISCOVER_COLLECTIBLES_PATH } from '@/lib/routes/routePolicy';

export function ProfileGameStats({ profile }: { profile: PublicProfile }) {
  const level = profile.standing_level;
  const streak = profile.standing_streak;
  const discovers = profile.standing_discovers;
  if (!level && !streak && !discovers) return null;

  return (
    <section>
      <DiscoverSectionHeader title="Standing" className="px-0" />
      <div className="mt-2.5">
        <ProfileStatRow>
          <ProfileStatCell
            count={level?.level ?? '—'}
            label="Level"
            privateOnlyMe={Boolean(profile.is_self && profile.level_private)}
            disabled={level == null}
          />
          <ProfileStatCell
            count={streak?.current_streak ?? '—'}
            label="Streak"
            privateOnlyMe={Boolean(profile.is_self && profile.streak_private)}
            disabled={streak == null}
          />
          <ProfileStatCell
            count={discovers?.items_found ?? '—'}
            label="Finds"
            privateOnlyMe={Boolean(profile.is_self && profile.discovers_private)}
            disabled={discovers == null}
            href={profile.is_self && discovers ? DISCOVER_COLLECTIBLES_PATH : undefined}
          />
        </ProfileStatRow>
      </div>
    </section>
  );
}
