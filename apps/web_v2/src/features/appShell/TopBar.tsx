'use client';

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AccountAvatar,
  getAccountDisplayName,
  getAccountHandle,
  useAuthSafe,
} from '@/features/auth';
import { useAccountMenuSafe } from '@/features/appShell/AccountMenuContext';
import {
  useIsAppShellChrome,
  useShellHeaderSlot,
} from '@/features/appShell/shellChromeContext';
import { useCollapseBelowOnScroll } from '@/features/appShell/useCollapseBelowOnScroll';
import {
  APP_CONTENT_MAX_WIDTH_PX,
  APP_SHELL_GUTTER_X_CLASS,
} from '@/features/appShell/tabs';
import { SAFE_AREA, safePadTop } from '@/lib/despia/safeArea';

export type TopBarProps = {
  /** Center title — string for default h1, or a custom node (e.g. map mode menu). */
  title?: ReactNode;
  /**
   * Extra control beside the account avatar (e.g. inline Discover search).
   * Does not replace the avatar.
   */
  leading?: ReactNode;
  /** Right-side action (e.g. Create). Replaces the avatar balance spacer. */
  trailing?: ReactNode;
  /** Segment tabs + banner + search — sticks under the avatar row. */
  below?: ReactNode;
  /**
   * Force secondary chrome collapsed/expanded.
   * Omit to auto-collapse on scroll down and reveal on scroll up.
   */
  belowCollapsed?: boolean;
  /**
   * Paint `below` over content under the bar instead of growing the header
   * (e.g. Play/Scout on the map so the canvas does not resize).
   */
  belowOverlay?: boolean;
};

/**
 * Shell header: full-bleed bar (bg + border), contents centered at 800px —
 * same large-screen model as TabBar. Pages keep rendering `<TopBar />`; it
 * portals into the AppShell header slot and never paints inside the compact
 * content column.
 */
export function TopBar(props: TopBarProps) {
  const inShell = useIsAppShellChrome();
  const slot = useShellHeaderSlot();
  const chrome = <TopBarChrome {...props} />;

  if (inShell) {
    // Wait for the full-bleed slot — never fall back into the 800px column.
    if (!slot) return null;
    return createPortal(chrome, slot);
  }

  return chrome;
}

function TopBarChrome({
  title = 'Minnesota',
  leading,
  trailing,
  below,
  belowCollapsed,
  belowOverlay = false,
}: TopBarProps) {
  const { account, user, isLoading } = useAuthSafe();
  const { open, toggleDrawer } = useAccountMenuSafe();
  const label = getAccountDisplayName(account, user?.email);
  const handle = getAccountHandle(account);
  const headerRef = useRef<HTMLElement>(null);
  const belowRef = useRef<HTMLDivElement>(null);
  const autoCollapsed = useCollapseBelowOnScroll(
    headerRef,
    belowRef,
    Boolean(below) && belowCollapsed === undefined,
  );
  const collapsed = belowCollapsed ?? autoCollapsed;

  const belowCollapseClass = `grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
    collapsed
      ? 'pointer-events-none grid-rows-[0fr] opacity-0'
      : 'grid-rows-[1fr] opacity-100'
  }`;

  const belowPanel = below ? (
    <div
      ref={belowRef}
      className={belowCollapseClass}
      aria-hidden={collapsed}
      inert={collapsed || undefined}
    >
      <div
        className={`min-h-0 overflow-hidden ${
          belowOverlay ? 'bg-[#f7f5f1]' : ''
        }`}
      >
        {below}
      </div>
    </div>
  ) : null;

  return (
    <header
      ref={headerRef}
      className={`relative w-full shrink-0 bg-[#f7f5f1] ${
        below && !collapsed ? '' : 'border-b border-black/[0.08]'
      }`}
      style={{
        paddingTop: safePadTop('0.2rem'),
        paddingLeft: SAFE_AREA.left,
        paddingRight: SAFE_AREA.right,
      }}
      data-feed-top-chrome=""
      data-app-shell-topbar=""
    >
      {/* Compact column — mirrors TabBar icon row alignment */}
      <div
        className="mx-auto w-full"
        style={{ maxWidth: APP_CONTENT_MAX_WIDTH_PX }}
      >
        <div className={`relative flex h-11 items-center ${APP_SHELL_GUTTER_X_CLASS}`}>
          <div className="relative z-[1] flex shrink-0 items-center gap-0">
            <button
              type="button"
              onClick={toggleDrawer}
              aria-label={handle ? `Account ${handle}` : label ? `Account ${label}` : 'Account'}
              aria-expanded={open}
              aria-controls="app-account-drawer"
              aria-hidden={open}
              tabIndex={open ? -1 : undefined}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[opacity,transform] active:scale-95 ${
                open ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              <span className="h-8 w-8 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/[0.06]">
                <AccountAvatar
                  account={account}
                  email={user?.email}
                  size="sm"
                  loading={isLoading && !account}
                  className="h-8 w-8"
                />
              </span>
            </button>
            {leading != null ? (
              <div className="-ml-0.5 flex items-center">{leading}</div>
            ) : null}
          </div>

          <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center">
            {typeof title === 'string' || title == null ? (
              <h1 className="text-[17px] font-bold tracking-tight text-foreground">
                {title ?? 'Minnesota'}
              </h1>
            ) : (
              <div className="pointer-events-auto max-w-[55%]">{title}</div>
            )}
          </div>

          {trailing ? (
            <div className="relative z-[1] ml-auto flex min-h-8 min-w-8 shrink-0 items-center justify-end">
              {trailing}
            </div>
          ) : (
            <div className="ml-auto h-8 w-8 shrink-0" aria-hidden />
          )}
        </div>

        {!belowOverlay ? belowPanel : null}
      </div>

      {belowOverlay && belowPanel ? (
        <div className="absolute inset-x-0 top-full z-30">{belowPanel}</div>
      ) : null}
    </header>
  );
}
