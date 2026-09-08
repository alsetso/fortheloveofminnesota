'use client';

/**
 * Profile header — avatar with XP ring + social counts.
 * Game stats + traits live on the About tab (`ProfileAboutPanel`).
 */

import { useEffect, useState } from 'react';
import type { PublicProfile } from '@/features/community/profileApi';
import {
  ProfileStatCell,
  ProfileStatRow,
} from '@/features/community/ProfileStatCell';
import {
  getDockAvatarInnerClass,
  getDockAvatarLevelBadgeClass,
  isPaidPlan,
} from '@/lib/billing/planHelpers';

const RING_SIZE = 88;
const RING_STROKE = 3.25;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2 - 1;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function StandingAvatar({
  profile,
  progressPct,
  level,
}: {
  profile: PublicProfile;
  progressPct: number | null;
  level: number | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const pct = Math.max(0, Math.min(1, progressPct ?? 0));
  const dash = mounted ? pct * RING_CIRC : 0;
  const paid = isPaidPlan(profile.account.plan);
  const src = profile.account.image_url?.trim() || null;
  const initials = (
    profile.account.username?.trim() || profile.account.first_name?.trim() || '?'
  )
    .slice(0, 1)
    .toUpperCase();

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      aria-label={
        level != null && progressPct != null
          ? `Level ${level}, ${Math.round(pct * 100)} percent to next`
          : undefined
      }
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={RING_STROKE}
          className="text-black/[0.08]"
        />
        {progressPct != null ? (
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${RING_CIRC}`}
            className="text-lake-blue transition-[stroke-dasharray] duration-700 ease-out"
          />
        ) : null}
        {paid ? (
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS - RING_STROKE - 1.5}
            fill="none"
            stroke="url(#profile-header-gold)"
            strokeWidth={2}
          />
        ) : null}
        <defs>
          <linearGradient id="profile-header-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#facc15" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute inset-[6px] overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
        <div className={getDockAvatarInnerClass(profile.account.plan)}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-lake-blue text-white">
              <span className="text-[1.4rem] font-semibold">{initials}</span>
            </div>
          )}
        </div>
      </div>

      {level != null ? (
        <span className={getDockAvatarLevelBadgeClass(profile.account.plan, 'lg')}>
          {level}
        </span>
      ) : null}
    </div>
  );
}

export function ProfileHeaderPlate({
  profile,
  onOpenFollowers,
  onOpenFollowing,
}: {
  profile: PublicProfile;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}) {
  const level = profile.standing_level;
  const followersPrivateOnlyMe = Boolean(profile.is_self && profile.followers_private);
  const followingPrivateOnlyMe = Boolean(profile.is_self && profile.following_private);
  const progressPct = level?.progress_pct ?? null;

  return (
    <div className="flex items-center gap-3">
      <StandingAvatar
        profile={profile}
        progressPct={progressPct}
        level={level?.level ?? null}
      />
      <ProfileStatRow>
        <ProfileStatCell
          count={profile.posts_count}
          label="Posts"
          sublabel={
            profile.is_self && (profile.posts_only_me_count ?? 0) > 0
              ? `${profile.posts_only_me_count} only you`
              : null
          }
        />
        <ProfileStatCell
          count={profile.followers_count ?? '—'}
          label="Followers"
          privateOnlyMe={followersPrivateOnlyMe}
          disabled={profile.followers_count == null}
          onClick={onOpenFollowers}
        />
        <ProfileStatCell
          count={profile.following_count ?? '—'}
          label="Following"
          privateOnlyMe={followingPrivateOnlyMe}
          disabled={profile.following_count == null}
          onClick={onOpenFollowing}
        />
      </ProfileStatRow>
    </div>
  );
}
