'use client';

import { useCallback, useEffect, useState } from 'react';
import { EditProfileForm } from '@/features/account';
import { useAuthSafe } from '@/features/auth';
import {
  blockAccount,
  fetchBlockedAccountIds,
  unblockAccount,
} from '@/features/community/blockApi';
import {
  accountProfilePath,
  fetchPublicProfile,
  followAccount,
  profilePathWithFrom,
  publicProfileDisplayName,
  publicProfileHandle,
  recordProfileView,
  unfollowAccount,
  type PublicProfile,
} from '@/features/community/profileApi';
import { formatTraitEmoji, formatTraitLabel } from '@/features/account/accountTraits';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { SocialGraphDockCard } from '@/features/map/dockCore/dockCard/cards/SocialGraphDockCard';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconEye } from '@/features/map/dockCore/core/icons';
import { useMapTimeFilter } from '@/features/map/dockCore/hooks/useMapTimeFilter';
import { refreshCommunityPins } from '@/features/map/community';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { getDockAvatarInnerClass, getDockAvatarRingClass } from '@/lib/billing/planHelpers';
import { useRouter } from 'next/navigation';

type ProfileView = 'profile' | 'followers' | 'following';

function ProfileAvatar({ profile }: { profile: PublicProfile }) {
  const src = profile.account.image_url?.trim() || null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
    );
  }
  const initials = (
    profile.account.username?.trim() || profile.account.first_name?.trim() || '?'
  )
    .slice(0, 1)
    .toUpperCase();
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-lake-blue text-white">
      <span className="text-[1.5rem] font-semibold">{initials}</span>
    </div>
  );
}

function ProfileStat({
  count,
  label,
  privateOnlyMe,
  sublabel,
  disabled,
  onClick,
}: {
  count: number | string;
  label: string;
  /** Owner viewing their own hidden list — still clickable, muted + Only me. */
  privateOnlyMe?: boolean;
  /** Extra line under the label (e.g. self “N only you”). */
  sublabel?: string | null;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className = `flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition ${
    onClick && !disabled ? 'active:opacity-70' : ''
  } ${disabled ? 'opacity-50' : ''} ${privateOnlyMe ? 'opacity-70' : ''}`;

  const body = (
    <>
      <span
        className={`text-[1.05rem] font-semibold tabular-nums leading-none ${
          privateOnlyMe ? 'text-foreground-muted' : 'text-foreground'
        }`}
      >
        {count}
      </span>
      {privateOnlyMe ? (
        <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium leading-none text-foreground-muted">
          <IconEye className="h-3 w-3" />
          Only me
        </span>
      ) : (
        <span className="mt-1 text-[10px] font-medium leading-none text-foreground-muted">
          {label}
        </span>
      )}
      {sublabel ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-medium leading-none text-foreground-muted">
          <IconEye className="h-2.5 w-2.5" />
          {sublabel}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

/**
 * Public profile card — opened via `openProfileCard(accountId)` whenever a
 * username/avatar is tapped anywhere in the app. Smart about existing vs
 * non-existing accounts: `fetchPublicProfile` resolves `null` on a 404 and
 * this renders a plain "Account unavailable" state instead of a broken card.
 * Followers/following open inline (same card) rather than as separate dock cards.
 * Posts live on `/:username` (`ProfileFeed`); dock links there when a handle exists.
 * Own-profile edit opens inline via `openProfileCard(id, { edit: true })`.
 */
export default function ProfileDockCard() {
  const {
    profileCardTarget,
    profileCardStartInEdit,
    profileCardStartView,
    openAccount,
  } = useMapDock();
  const router = useRouter();
  const { account: viewer } = useAuthSafe();
  const { value: timeFilter } = useMapTimeFilter();
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [view, setView] = useState<ProfileView>('profile');
  const [editing, setEditing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  useEffect(() => {
    setView(profileCardStartView);
    setEditing(profileCardStartInEdit);
    setFollowError(null);
    setBlocked(false);
    setBlockError(null);
    if (!profileCardTarget) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfile(undefined);
    const ac = new AbortController();
    void fetchPublicProfile(profileCardTarget, ac.signal)
      .then((next) => {
        if (!cancelled) setProfile(next);
        if (next && !next.is_self) void recordProfileView(next.account.id);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    if (viewer?.id && profileCardTarget !== viewer.id) {
      void fetchBlockedAccountIds(ac.signal)
        .then((ids) => {
          if (!cancelled) setBlocked(ids.includes(profileCardTarget));
        })
        .catch(() => {
          if (!cancelled) setBlocked(false);
        });
    }
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [
    profileCardTarget,
    profileCardStartInEdit,
    profileCardStartView,
    viewer?.id,
  ]);

  const toggleFollow = useCallback(async () => {
    if (!profile || followBusy) return;
    const nextFollowing = !profile.is_following;
    setFollowBusy(true);
    setFollowError(null);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            is_following: nextFollowing,
            followers_count:
              prev.followers_count == null
                ? prev.followers_count
                : prev.followers_count + (nextFollowing ? 1 : -1),
          }
        : prev,
    );
    try {
      if (nextFollowing) await followAccount(profile.account.id);
      else await unfollowAccount(profile.account.id);
    } catch (e) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              is_following: !nextFollowing,
              followers_count:
                prev.followers_count == null
                  ? prev.followers_count
                  : prev.followers_count + (nextFollowing ? -1 : 1),
            }
          : prev,
      );
      setFollowError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setFollowBusy(false);
    }
  }, [profile, followBusy]);

  const refreshAfterSave = useCallback(async (accountId: string) => {
    try {
      const next = await fetchPublicProfile(accountId);
      if (next) setProfile(next);
    } catch {
      // Keep current profile if refresh fails; auth state already updated.
    }
    setEditing(false);
  }, []);

  const toggleBlock = useCallback(async () => {
    if (!profile || profile.is_self || blockBusy) return;
    if (!viewer) {
      openAccount();
      return;
    }
    setBlockBusy(true);
    setBlockError(null);
    const nextBlocked = !blocked;
    try {
      if (nextBlocked) await blockAccount(profile.account.id);
      else await unblockAccount(profile.account.id);
      setBlocked(nextBlocked);
      void refreshCommunityPins(timeFilter);
    } catch (e) {
      setBlockError(e instanceof Error ? e.message : 'Could not update block');
    } finally {
      setBlockBusy(false);
    }
  }, [profile, blockBusy, viewer, blocked, openAccount, timeFilter]);

  if (!profileCardTarget || profile === null) {
    return (
      <DockCardShell variant="entity" titleMode="center" title="Profile">
        <p className="text-center text-sm text-foreground-muted">
          This account is no longer available.
        </p>
      </DockCardShell>
    );
  }

  if (profile === undefined) {
    return (
      <DockCardShell variant="entity" titleMode="none">
        <div className="flex flex-col items-center px-1 pb-4 pt-1 text-center" aria-hidden>
          <div className="h-[4.25rem] w-[4.25rem] animate-pulse rounded-full bg-map-ink-subtle" />
          <div className="mt-3 h-5 w-32 animate-pulse rounded-full bg-map-ink-subtle" />
          <div className="mt-1.5 h-3.5 w-20 animate-pulse rounded-full bg-map-ink-subtle" />
        </div>
      </DockCardShell>
    );
  }

  if (view === 'followers' || view === 'following') {
    // SocialGraphDockCard owns DockCardShell + scrollKey so followers/following
    // reset scroll independently of the profile entity key.
    const listPrivate =
      view === 'followers' ? profile.followers_private : profile.following_private;
    return (
      <SocialGraphDockCard
        variant={view}
        accountId={profile.account.id}
        backLabel={publicProfileDisplayName(profile.account)}
        onBack={() => setView('profile')}
        listPrivate={profile.is_self && listPrivate}
        onRemoved={() => {
          setProfile((prev) => {
            if (!prev) return prev;
            if (view === 'followers') {
              const n = prev.followers_count;
              return {
                ...prev,
                followers_count: n == null ? n : Math.max(0, n - 1),
              };
            }
            const n = prev.following_count;
            return {
              ...prev,
              following_count: n == null ? n : Math.max(0, n - 1),
            };
          });
        }}
      />
    );
  }

  if (editing && profile.is_self) {
    return (
      <DockCardShell
        variant="entity"
        titleMode="sub"
        title="Edit profile"
        backLabel="Profile"
        onBack={() => setEditing(false)}
      >
        <EditProfileForm
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            void refreshAfterSave(updated.id);
          }}
        />
      </DockCardShell>
    );
  }

  const displayName = publicProfileDisplayName(profile.account);
  const handle = publicProfileHandle(profile.account);
  const bio = profile.account.bio?.trim();
  const traits = profile.account.traits ?? [];
  const selfPhone = profile.is_self ? profile.account.phone?.trim() || null : null;
  const phoneHref = selfPhone
    ? `tel:${selfPhone.replace(/[^\d+]/g, '')}`
    : null;
  const followersPrivateOnlyMe = profile.is_self && profile.followers_private;
  const followingPrivateOnlyMe = profile.is_self && profile.following_private;

  return (
    <DockCardShell variant="entity" titleMode="none">
      {/* Instagram-style header: identity left, stats top-right */}
      <div className="flex items-start gap-3 px-0.5 pt-1">
        <div className="flex min-w-0 max-w-[42%] flex-col items-start">
          <div className={getDockAvatarRingClass(profile.account.plan)}>
            <div className={getDockAvatarInnerClass(profile.account.plan)}>
              <ProfileAvatar profile={profile} />
            </div>
          </div>
          <h2 className="mt-2 max-w-full truncate text-[1.05rem] font-semibold leading-tight tracking-tight text-foreground">
            {displayName}
          </h2>
          {handle ? (
            <p className="mt-0.5 max-w-full truncate text-[13px] leading-tight text-foreground-muted">
              {handle}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 items-start gap-1 pt-2">
          <ProfileStat
            count={profile.posts_count}
            label="Posts"
            sublabel={
              profile.is_self && (profile.posts_only_me_count ?? 0) > 0
                ? `${profile.posts_only_me_count} only you`
                : null
            }
          />
          <ProfileStat
            count={profile.followers_count ?? '—'}
            label="Followers"
            privateOnlyMe={followersPrivateOnlyMe}
            disabled={profile.followers_count == null}
            onClick={() => setView('followers')}
          />
          <ProfileStat
            count={profile.following_count ?? '—'}
            label="Following"
            privateOnlyMe={followingPrivateOnlyMe}
            disabled={profile.following_count == null}
            onClick={() => setView('following')}
          />
        </div>
      </div>

      {bio ? (
        <p className="mt-3 px-0.5 text-left text-[13px] leading-snug text-foreground">
          {bio}
        </p>
      ) : null}

      {selfPhone && phoneHref ? (
        <div className="mt-2.5 flex px-0.5">
          <a
            href={phoneHref}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-lake-blue transition active:scale-[0.98] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            <span aria-hidden>📞</span>
            <span className="truncate">{selfPhone}</span>
          </a>
        </div>
      ) : null}

      {traits.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5 px-0.5">
          {traits.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-lake-blue/10 px-2.5 py-1 text-[11px] font-medium text-lake-blue"
            >
              <span aria-hidden>{formatTraitEmoji(t)}</span>
              {formatTraitLabel(t)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        {profile.is_self ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`inline-flex w-full items-center justify-center rounded-2xl px-3 py-3 text-[14px] font-semibold text-foreground transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            Edit profile
          </button>
        ) : viewer ? (
          <button
            type="button"
            disabled={followBusy}
            onClick={() => void toggleFollow()}
            className={
              profile.is_following
                ? `inline-flex w-full items-center justify-center rounded-2xl px-3 py-3 text-[14px] font-semibold text-foreground transition active:scale-[0.99] disabled:opacity-60 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`
                : 'inline-flex w-full items-center justify-center rounded-2xl bg-lake-blue px-3 py-3 text-[14px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60'
            }
          >
            {profile.is_following ? 'Following' : 'Follow'}
          </button>
        ) : (
          <p className="text-center text-[12px] text-foreground-muted">Sign in to follow</p>
        )}
        {followError ? (
          <p className="mt-1.5 text-center text-[12px] text-red-600">{followError}</p>
        ) : null}
        {!profile.is_self && viewer ? (
          <button
            type="button"
            disabled={blockBusy}
            onClick={() => void toggleBlock()}
            className="mt-2 inline-flex w-full items-center justify-center rounded-2xl px-3 py-2.5 text-[13px] font-medium text-red-600 transition active:scale-[0.99] disabled:opacity-60"
          >
            {blockBusy ? 'Updating…' : blocked ? 'Unblock' : 'Block user'}
          </button>
        ) : null}
        {blockError ? (
          <p className="mt-1.5 text-center text-[12px] text-red-600">{blockError}</p>
        ) : null}
        {!profile.is_self && profile.is_followed_by ? (
          <p className="mt-2 text-center text-[11px] font-medium text-foreground-muted">
            Follows you
          </p>
        ) : null}
      </div>

      {accountProfilePath(profile.account.username) ? (
        <div className="mt-4 pb-2">
          <button
            type="button"
            onClick={() => {
              const path = profilePathWithFrom(
                accountProfilePath(profile.account.username),
                'map',
              );
              if (path) router.push(path);
            }}
            className={`inline-flex h-9 w-full items-center justify-center rounded-xl px-3 text-[13px] font-semibold text-foreground transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            View posts
          </button>
        </div>
      ) : null}
    </DockCardShell>
  );
}
