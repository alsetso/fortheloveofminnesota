'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { resolvePostLocationSeed } from '@/components/media/capture/PostLocationPanel';
import { EditProfileForm, updateAccountProfile } from '@/features/account';
import type { ProfileNameDisplay } from '@/features/account';
import { useAuthSafe } from '@/features/auth';
import CreatePostSheet from '@/features/community/CreatePostSheet';
import {
  accountProfileShareUrl,
  fetchPublicProfile,
  fetchPublicProfileByUsername,
  isAccountIdProfileSegment,
  followAccount,
  publicProfileDisplayName,
  recordProfileView,
  unfollowAccount,
  type PublicProfile,
} from '@/features/community/profileApi';
import { useAccountMenuSafe } from '@/features/appShell/AccountMenuContext';
import { PageScroll } from '@/features/appShell/PageScroll';
import { ProfileAboutPanel } from '@/features/community/ProfileAboutPanel';
import {
  ProfileContentTabs,
  type ProfileContentTabId,
} from '@/features/community/ProfileContentTabs';
import { ProfileFeed } from '@/features/community/ProfileFeed';
import { ProfileHeaderPlate } from '@/features/community/ProfileHeaderPlate';
import { ProfileMediaGrid } from '@/features/community/ProfileMediaGrid';
import { ProfilePagesPanel } from '@/features/community/ProfilePagesPanel';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconMenu,
  IconPlus,
} from '@/features/map/dockCore/core/icons';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { TodayRecordHost, type TodayRecord } from '@/features/today/records';
import { haptic } from '@/lib/despia/haptics';
import { FEED_PATH, GAME_PATH } from '@/lib/routes/routePolicy';
import { isReservedUsername } from '@/lib/account/reservedUsernames';
import { safePadTop } from '@/lib/despia/safeArea';

const SCROLLBAR_HIDE =
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const NAME_DISPLAY_OPTIONS: Array<{ value: ProfileNameDisplay; label: string }> = [
  { value: 'full_name', label: 'Full Name' },
  { value: 'username', label: 'Username' },
];

function profileFromParam(raw: string | null): 'post' | 'map' | null {
  if (raw === 'post' || raw === 'map') return raw;
  return null;
}

async function shareOrCopy(title: string, url: string) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, url });
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* ignore */
  }
}

/**
 * /:username — sharable public account profile.
 */
export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const searchParams = useSearchParams();
  const from = profileFromParam(searchParams.get('from'));
  let username = typeof params?.username === 'string' ? params.username : '';
  try {
    username = decodeURIComponent(username);
  } catch {
    /* keep raw */
  }
  username = username.trim().replace(/^@/, '').toLowerCase();

  const router = useRouter();
  const { account: viewer, applyAccount } = useAuthSafe();
  const { openProfileCard, openAccount } = useMapDock();
  const { openDrawer } = useAccountMenuSafe();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [shareFlash, setShareFlash] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TodayRecord | null>(null);
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [nameDisplayBusy, setNameDisplayBusy] = useState(false);
  const [contentTab, setContentTab] = useState<ProfileContentTabId>('feed');
  const [composeOpen, setComposeOpen] = useState(false);
  const [feedEpoch, setFeedEpoch] = useState(0);
  const nameMenuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!username || isReservedUsername(username)) {
      setProfile(null);
      setError('Profile not found');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = isAccountIdProfileSegment(username)
        ? await fetchPublicProfile(username)
        : await fetchPublicProfileByUsername(username);
      setProfile(next);
      if (!next) setError('Profile not found');
      else if (!next.is_self) void recordProfileView(next.account.id, 'direct');
    } catch (e: unknown) {
      setProfile(null);
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNameMenuOpen(false);
    setContentTab('feed');
  }, [username]);

  useEffect(() => {
    if (!nameMenuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const el = nameMenuRef.current;
      if (!el) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        setNameMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNameMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [nameMenuOpen]);

  const toggleFollow = useCallback(async () => {
    if (!profile || followBusy) return;
    if (!viewer) {
      openAccount();
      return;
    }
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
  }, [profile, followBusy, viewer, openAccount]);

  const onBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    if (from === 'map') {
      router.push(GAME_PATH);
      return;
    }
    router.push(FEED_PATH);
  };

  const viewerHandle = viewer?.username?.trim().replace(/^@/, '').toLowerCase() || null;
  const isSelfView =
    profile?.is_self ?? Boolean(viewerHandle && viewerHandle === username);
  const showOwnerCompose = Boolean(isSelfView && !from);
  const showBack = Boolean(from) || Boolean(profile && !profile.is_self);

  const shareUrl = profile ? accountProfileShareUrl(profile.account.username) : null;

  const onShare = () => {
    if (!profile || !shareUrl) return;
    const title = publicProfileDisplayName(profile.account);
    void shareOrCopy(title, shareUrl).then(() => {
      setShareFlash(true);
      window.setTimeout(() => setShareFlash(false), 1600);
    });
  };

  const displayName = profile ? publicProfileDisplayName(profile.account) : '';
  const bio = profile?.account.bio?.trim();
  const nameDisplay: ProfileNameDisplay =
    profile?.account.profile_name_display === 'username' ? 'username' : 'full_name';

  const setNameDisplay = useCallback(
    async (next: ProfileNameDisplay) => {
      if (!profile?.is_self || nameDisplayBusy || next === nameDisplay) {
        setNameMenuOpen(false);
        return;
      }
      setNameDisplayBusy(true);
      setNameMenuOpen(false);
      const prev = profile.account.profile_name_display;
      setProfile((p) =>
        p
          ? {
              ...p,
              account: { ...p.account, profile_name_display: next },
            }
          : p,
      );
      try {
        const updated = await updateAccountProfile(profile.account.id, {
          profile_name_display: next,
        });
        applyAccount?.(updated);
      } catch {
        setProfile((p) =>
          p
            ? {
                ...p,
                account: { ...p.account, profile_name_display: prev },
              }
            : p,
        );
      } finally {
        setNameDisplayBusy(false);
      }
    },
    [profile, nameDisplayBusy, nameDisplay, applyAccount],
  );

  if (editing && profile?.is_self) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#f7f5f1]">
        <header
          className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]/95 backdrop-blur-md"
          style={{ paddingTop: safePadTop('0.15rem') }}
        >
          <div className="flex h-11 items-center gap-2 px-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Back"
              className="inline-flex items-center gap-0.5 py-1.5 pl-1 pr-2 text-[17px] text-lake-blue active:opacity-60"
            >
              <IconArrowLeft className="h-5 w-5" />
              Profile
            </button>
          </div>
        </header>
        <PageScroll className={SCROLLBAR_HIDE}>
          <div className="px-4 pb-12 pt-4">
            <EditProfileForm
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setEditing(false);
                const next = updated.username?.trim().toLowerCase();
                if (next && next !== username) {
                  router.replace(`/${encodeURIComponent(next)}`);
                  return;
                }
                void load();
              }}
            />
          </div>
        </PageScroll>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f5f1]">
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]/95 backdrop-blur-md"
        style={{ paddingTop: safePadTop('0.15rem') }}
      >
        <div className="relative flex h-11 items-center px-2">
          {showOwnerCompose ? (
            <button
              type="button"
              aria-label="Create post"
              onClick={() => {
                haptic.toggle();
                setComposeOpen(true);
              }}
              className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lake-blue active:bg-black/[0.04] active:opacity-70"
            >
              <IconPlus className="h-6 w-6" />
            </button>
          ) : showBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="relative z-10 inline-flex shrink-0 items-center gap-0.5 py-1.5 pl-1 pr-2 text-[17px] text-lake-blue active:opacity-60"
            >
              <IconArrowLeft className="h-5 w-5" />
              Back
            </button>
          ) : (
            <span className="w-9 shrink-0" aria-hidden />
          )}
          {displayName ? (
            profile?.is_self ? (
              <div ref={nameMenuRef} className="absolute inset-x-16 flex justify-center">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={nameMenuOpen}
                  disabled={nameDisplayBusy}
                  onClick={() => setNameMenuOpen((open) => !open)}
                  className="inline-flex max-w-full items-center gap-0.5 truncate rounded-lg px-1.5 py-1 text-[17px] font-semibold text-foreground active:opacity-70 disabled:opacity-60"
                >
                  <span className="truncate">{displayName}</span>
                  <IconChevronDown
                    className={`h-4 w-4 shrink-0 text-foreground-muted transition ${
                      nameMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {nameMenuOpen ? (
                  <div
                    role="listbox"
                    aria-label="Show name as"
                    className="absolute left-1/2 top-full z-20 mt-1 w-44 -translate-x-1/2 overflow-hidden rounded-2xl border border-black/[0.08] bg-white py-1 shadow-lg"
                  >
                    <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                      Show
                    </p>
                    {NAME_DISPLAY_OPTIONS.map((option) => {
                      const selected = nameDisplay === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => void setNameDisplay(option.value)}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] font-medium text-foreground active:bg-black/[0.04]"
                        >
                          <span className="min-w-0 flex-1">{option.label}</span>
                          {selected ? (
                            <IconCheck className="h-4 w-4 shrink-0 text-lake-blue" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <h1 className="pointer-events-none absolute inset-x-16 truncate text-center text-[17px] font-semibold text-foreground">
                {displayName}
              </h1>
            )
          ) : null}
          {profile?.is_self ? (
            <button
              type="button"
              aria-label="More"
              onClick={() => openDrawer()}
              className="relative z-10 ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground active:bg-black/[0.04] active:opacity-70"
            >
              <IconMenu className="h-5 w-5" />
            </button>
          ) : shareUrl ? (
            <button
              type="button"
              onClick={onShare}
              className="relative z-10 ml-auto shrink-0 px-2.5 py-1.5 text-[17px] font-semibold text-lake-blue active:opacity-60"
            >
              {shareFlash ? 'Copied' : 'Share'}
            </button>
          ) : (
            <span className="ml-auto w-9" aria-hidden />
          )}
        </div>
      </header>

      <PageScroll onRefresh={load} className={SCROLLBAR_HIDE}>
        <div className="space-y-3 px-4 pb-3 pt-3">
          {loading && !profile ? (
            <div className="flex items-center gap-3">
              <div className="h-[88px] w-[88px] animate-pulse rounded-full bg-black/[0.06]" />
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <div className="mx-auto h-8 w-8 animate-pulse rounded bg-black/[0.06]" />
                <div className="mx-auto h-8 w-8 animate-pulse rounded bg-black/[0.06]" />
                <div className="mx-auto h-8 w-8 animate-pulse rounded bg-black/[0.06]" />
              </div>
            </div>
          ) : null}

          {error && !profile ? (
            <div className="py-16 text-center">
              <p className="text-[16px] font-semibold text-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 text-[14px] font-semibold text-lake-blue"
              >
                Retry
              </button>
            </div>
          ) : null}

          {profile ? (
            <>
              <ProfileHeaderPlate
                profile={profile}
                onOpenFollowers={() =>
                  openProfileCard(profile.account.id, { view: 'followers' })
                }
                onOpenFollowing={() =>
                  openProfileCard(profile.account.id, { view: 'following' })
                }
              />

              {bio ? (
                <p className="text-left text-[14px] leading-snug text-foreground">{bio}</p>
              ) : null}

              <div>
                {profile.is_self ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className={`inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-xl px-3 text-[13px] font-semibold text-foreground transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                    >
                      Edit profile
                    </button>
                    {shareUrl ? (
                      <button
                        type="button"
                        onClick={onShare}
                        className={`inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-xl px-3 text-[13px] font-semibold text-foreground transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                      >
                        {shareFlash ? 'Copied' : 'Share profile'}
                      </button>
                    ) : null}
                  </div>
                ) : viewer ? (
                  <button
                    type="button"
                    disabled={followBusy}
                    onClick={() => void toggleFollow()}
                    className={
                      profile.is_following
                        ? `inline-flex h-9 w-full items-center justify-center rounded-xl px-3 text-[13px] font-semibold text-foreground transition active:scale-[0.99] disabled:opacity-60 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`
                        : 'inline-flex h-9 w-full items-center justify-center rounded-xl bg-lake-blue px-3 text-[13px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60'
                    }
                  >
                    {profile.is_following ? 'Following' : 'Follow'}
                  </button>
                ) : (
                  <p className="text-center text-[12px] text-foreground-muted">
                    Sign in to follow
                  </p>
                )}
                {followError ? (
                  <p className="mt-1.5 text-center text-[12px] text-red-600">{followError}</p>
                ) : null}
                {!profile.is_self && profile.is_followed_by ? (
                  <p className="mt-1.5 text-center text-[11px] font-medium text-foreground-muted">
                    Follows you
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {profile ? (
          <div className="pb-8">
            <ProfileContentTabs active={contentTab} onChange={setContentTab} />
            {contentTab === 'about' ? (
              <ProfileAboutPanel
                profile={profile}
                onSelectRecord={setSelectedRecord}
              />
            ) : null}
            {contentTab === 'feed' ? (
              <ProfileFeed
                key={`feed-${feedEpoch}`}
                accountId={profile.account.id}
                isSelf={profile.is_self}
              />
            ) : null}
            {contentTab === 'media' ? (
              <ProfileMediaGrid
                key={`media-${feedEpoch}`}
                accountId={profile.account.id}
                isSelf={profile.is_self}
              />
            ) : null}
            {contentTab === 'pages' ? (
              <ProfilePagesPanel accountId={profile.account.id} isSelf={profile.is_self} />
            ) : null}
          </div>
        ) : null}
      </PageScroll>

      {composeOpen ? (
        <CreatePostSheet
          state={resolvePostLocationSeed(null)}
          onClose={() => setComposeOpen(false)}
          onCreated={() => {
            setComposeOpen(false);
            setFeedEpoch((n) => n + 1);
            setContentTab('feed');
            void load();
          }}
        />
      ) : null}

      <TodayRecordHost
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}
