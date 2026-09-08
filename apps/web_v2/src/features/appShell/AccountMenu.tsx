'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AccountAvatar,
  getAccountDisplayName,
  getAccountHandle,
  useAuthSafe,
} from '@/features/auth';
import {
  accountProfilePath,
  fetchPublicProfile,
} from '@/features/community/profileApi';
import { useAccountMenu } from '@/features/appShell/AccountMenuContext';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  IconBell,
  IconCalendar,
  IconChat,
  IconContactBook,
  IconGear,
  IconHome,
  IconLayers,
  IconSignOut,
  IconSparkles,
  IconUser,
} from '@/features/map/dockCore/core/icons';
import {
  CALENDAR_PATH,
  HELPDESK_PATH,
  CONTACTS_PATH,
  MESSAGES_PATH,
  NOTIFICATIONS_PATH,
  PAGES_PATH,
  SERVICES_PATH,
  SETTINGS_PATH,
  WELCOME_PATH,
  settingsAccountPath,
} from '@/lib/routes/routePolicy';
import { safePadTop, safePadBottom } from '@/lib/despia/safeArea';

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

function formatCount(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

/**
 * Left account menu revealed when the App stage pushes right (X-style).
 * Most rows navigate to Own scroll surfaces; a few still hand off to MapDock cards.
 */
export default function AccountMenu() {
  const router = useRouter();
  const { open, closeDrawer } = useAccountMenu();
  const { openProfileCard } = useMapDock();
  const {
    account,
    accounts,
    user,
    isLoading,
    signOut,
    selectAccount,
  } = useAuthSafe();

  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [followersCount, setFollowersCount] = useState<number | null>(null);

  const displayName = getAccountDisplayName(account, user?.email);
  const handle = getAccountHandle(account);

  useEffect(() => {
    if (!open || !account?.id) {
      return;
    }
    const ac = new AbortController();
    void fetchPublicProfile(account.id, ac.signal)
      .then((profile) => {
        if (ac.signal.aborted || !profile) return;
        setFollowingCount(profile.following_count);
        setFollowersCount(profile.followers_count);
      })
      .catch(() => {
        /* keep dashes */
      });
    return () => ac.abort();
  }, [open, account?.id]);

  const runThenClose = useCallback(
    (fn: () => void) => {
      closeDrawer();
      // Let the stage start sliding shut before the sheet mounts.
      requestAnimationFrame(() => fn());
    },
    [closeDrawer],
  );

  const onOpenProfile = useCallback(() => {
    const path = accountProfilePath(account?.username);
    if (!path) return;
    closeDrawer();
    router.push(path);
  }, [account?.username, closeDrawer, router]);

  const onEditProfile = useCallback(() => {
    if (!account) return;
    closeDrawer();
    router.push(settingsAccountPath());
  }, [account, closeDrawer, router]);

  const onSignOut = async () => {
    closeDrawer();
    await signOut();
    router.replace(WELCOME_PATH);
    router.refresh();
  };

  const primary: NavItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: <IconUser className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !accountProfilePath(account?.username),
      onClick: onOpenProfile,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <IconBell className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !account,
      onClick: () => {
        closeDrawer();
        router.push(NOTIFICATIONS_PATH);
      },
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: <IconChat className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !account,
      onClick: () => {
        closeDrawer();
        router.push(MESSAGES_PATH);
      },
    },
    {
      id: 'helpdesk',
      label: 'Helpdesk',
      icon: <IconSparkles className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !account,
      onClick: () => {
        closeDrawer();
        router.push(HELPDESK_PATH);
      },
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: <IconContactBook className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !account,
      onClick: () => {
        closeDrawer();
        router.push(CONTACTS_PATH);
      },
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: <IconCalendar className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !account,
      onClick: () => {
        closeDrawer();
        router.push(CALENDAR_PATH);
      },
    },
    {
      id: 'pages',
      label: 'My Pages',
      icon: <IconLayers className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !account,
      onClick: () => {
        closeDrawer();
        router.push(PAGES_PATH);
      },
    },
    {
      id: 'services',
      label: 'Services',
      icon: <IconHome className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !account,
      onClick: () => {
        closeDrawer();
        router.push(SERVICES_PATH);
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <IconGear className="h-[1.35rem] w-[1.35rem]" />,
      disabled: !account,
      onClick: () => {
        closeDrawer();
        router.push(SETTINGS_PATH);
      },
    },
  ];

  const otherAccounts = accounts.filter((row) => row.id !== account?.id);

  return (
    <nav
      id="app-account-drawer"
      className="flex h-full w-full flex-col bg-white text-foreground"
      aria-label="Account menu"
      {...(!open ? { inert: true as const } : {})}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5"
        style={{
          paddingTop: safePadTop('0.75rem'),
          paddingBottom: safePadBottom('1rem'),
        }}
      >
        {/* Identity */}
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            disabled={!accountProfilePath(account?.username)}
            onClick={onOpenProfile}
            className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#f7f5f1] ring-1 ring-black/[0.06] transition active:scale-95 disabled:opacity-60"
            aria-label={handle ? `Open profile ${handle}` : 'Open profile'}
          >
            <AccountAvatar
              account={account}
              email={user?.email}
              size="md"
              loading={isLoading && !account}
              className="h-14 w-14"
            />
          </button>
        </div>

        <div className="mt-3 min-w-0">
          {isLoading && !account ? (
            <div className="space-y-2" aria-hidden>
              <div className="h-5 w-28 animate-pulse rounded-full bg-black/[0.08]" />
              <div className="h-3.5 w-20 animate-pulse rounded-full bg-black/[0.06]" />
            </div>
          ) : (
            <>
              <p className="truncate text-[19px] font-extrabold leading-tight tracking-tight">
                {displayName}
              </p>
              {handle ? (
                <p className="mt-0.5 truncate text-[14px] leading-tight text-foreground-muted">
                  {handle}
                </p>
              ) : null}
              {account ? (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="mt-2.5 inline-flex h-8 items-center justify-center rounded-full bg-black/[0.06] px-3.5 text-[13px] font-semibold text-foreground transition active:scale-[0.98] active:bg-black/[0.1]"
                >
                  Edit profile
                </button>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-3.5 flex items-center gap-4 text-[14px]">
          <button
            type="button"
            disabled={!account}
            onClick={() => {
              if (!account?.id) return;
              runThenClose(() => openProfileCard(account.id, { view: 'following' }));
            }}
            className="transition active:opacity-70 disabled:opacity-50"
          >
            <span className="font-bold tabular-nums text-foreground">
              {formatCount(followingCount)}
            </span>{' '}
            <span className="text-foreground-muted">Following</span>
          </button>
          <button
            type="button"
            disabled={!account}
            onClick={() => {
              if (!account?.id) return;
              runThenClose(() => openProfileCard(account.id, { view: 'followers' }));
            }}
            className="transition active:opacity-70 disabled:opacity-50"
          >
            <span className="font-bold tabular-nums text-foreground">
              {formatCount(followersCount)}
            </span>{' '}
            <span className="text-foreground-muted">Followers</span>
          </button>
        </div>

        {/* Primary links */}
        <ul className="mt-6 space-y-0.5">
          {primary.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={item.onClick}
                className="flex w-full items-center gap-5 rounded-xl px-1 py-3 text-left transition active:bg-black/[0.04] disabled:opacity-45"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-foreground">
                  {item.icon}
                </span>
                <span className="text-[19px] font-bold leading-none tracking-tight">
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="my-3 border-t border-black/[0.08]" />

        {/* Switch accounts (compact) */}
        {otherAccounts.length > 0 ? (
          <div className="mb-2 space-y-1">
            {otherAccounts.map((row) => {
              const rowName = getAccountDisplayName(row, user?.email);
              const rowHandle = getAccountHandle(row);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    selectAccount(row.id);
                    closeDrawer();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition active:bg-black/[0.04]"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#f7f5f1] ring-1 ring-black/[0.06]">
                    <AccountAvatar account={row} email={user?.email} size="sm" className="h-8 w-8" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {rowHandle ?? rowName}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void onSignOut()}
          className="mt-1 flex w-full items-center gap-5 rounded-xl px-1 py-3 text-left text-red-600 transition active:bg-red-500/10"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center">
            <IconSignOut className="h-[1.35rem] w-[1.35rem]" />
          </span>
          <span className="text-[16px] font-semibold leading-none">Sign out</span>
        </button>
      </div>
    </nav>
  );
}

/** Closes the drawer on Home tabs route changes. */
export function AccountMenuRouteCloser() {
  const pathname = usePathname();
  const { open, closeDrawer } = useAccountMenu();

  useEffect(() => {
    if (open) closeDrawer();
    // Only react to path changes — not open toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
