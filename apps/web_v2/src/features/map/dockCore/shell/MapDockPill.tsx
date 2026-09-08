'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { setMapSearchQuery, useMapSearchQuery } from '@/features/map/dockCore/store/mapSearchStore';
import {
  entityKindLabel,
  paneCentersTitleChrome,
  paneHidesTitleAtFull,
  paneIconId,
  paneSubtitle,
  paneTitle,
  paneUsesTitleChrome,
  type DockPaneIconId,
} from '@/features/map/dockCore/core/dockPanes';
import {
  useComposeHeader,
  triggerComposePost,
  triggerComposeToggleVisibility,
} from '@/features/map/dockCore/store/composeHeaderStore';
import { useSelectedPointChrome } from '@/features/map/dockCore/hooks/useSelectedPointChrome';
import { isMapToolPane } from '@/features/map/dockCore/core/mapRailActions';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
  MAP_DOCK_GLASS_HOVER_CLASS,
  MAP_DOCK_HANDLE_CLASS,
  MAP_DOCK_HANDLE_SLOT_PX,
  MAP_DOCK_SEARCH_PILL_SHELL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import {
  IconLayers,
  IconCursor,
  IconMapStyle,
  IconSearch,
  IconArrowLeft,
  IconX,
  IconUser,
  IconSparkles,
  IconPlus,
  IconCopy,
  IconCheckSmall,
} from '@/features/map/dockCore/core/icons';
import {
  AccountAvatar,
  useAuthSafe,
} from '@/features/auth';
import WalletCreditsCount from '@/features/tools/wallet/WalletCreditsCount';
import { isContactBookToolKind, showsCreditsChipKind } from '@/features/tools/core/contactBookTools';
import TerritoryDetailsOpsMenu from '@/features/map/dockCore/controllers/TerritoryDetailsOpsMenu';
import { GameDockFindMe } from '@/features/map/game/GameDockFindMe';
import { GAME_PATH, STORY_PATH, settingsBillingPath } from '@/lib/routes/routePolicy';
import { useDemoMapChrome } from '@/features/setup/DemoMapChromeContext';

/** Transparent field — frost lives on the shell so blur works over the map. */
const PILL_INPUT_CLASS =
  'h-12 w-full min-w-0 rounded-full border-none bg-transparent pl-11 text-base text-foreground placeholder:text-foreground-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden';

const SEARCH_SHELL_CLASS = `relative min-w-0 flex-1 overflow-hidden rounded-full shadow-sm ring-1 ring-black/[0.04] ${MAP_DOCK_GLASS_BORDER_CLASS} ${MAP_DOCK_SEARCH_PILL_SHELL_CLASS}`;

const AVATAR_SLOT_CLASS = `inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ${MAP_DOCK_GLASS_BORDER_CLASS} ${MAP_DOCK_GLASS_FILL_CLASS} text-lake-blue shadow-sm transition-[background-color,transform] duration-150 ${MAP_DOCK_GLASS_HOVER_CLASS} active:scale-95`;

const BACK_SLOT_CLASS = `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${MAP_DOCK_GLASS_BORDER_CLASS} ${MAP_DOCK_GLASS_FILL_CLASS} text-foreground shadow-sm transition-[background-color,transform] duration-150 ${MAP_DOCK_GLASS_HOVER_CLASS} active:scale-95`;

const TITLE_CHROME_CLASS = `flex min-h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full ${MAP_DOCK_GLASS_BORDER_CLASS} px-3 py-1.5 shadow-sm ${MAP_DOCK_GLASS_FILL_CLASS}`;

function showsCreditsInTitleChrome(pane: {
  id: string;
  kind?: string;
}): boolean {
  if (pane.id === 'tools') return true;
  if (
    pane.id === 'subpage' &&
    'kind' in pane &&
    pane.kind &&
    (showsCreditsChipKind(pane.kind) || isContactBookToolKind(pane.kind))
  ) {
    return true;
  }
  return false;
}

function PaneChromeIcon({ id }: { id: DockPaneIconId }): ReactNode {
  const cls = 'h-5 w-5 shrink-0 text-lake-blue';
  switch (id) {
    case 'layers':
      return <IconLayers className={cls} />;
    case 'map-style':
      return <IconMapStyle className={cls} />;
    case 'locate':
      return <IconCursor className={cls} />;
    case 'search':
      return <IconSearch className={cls} />;
    case 'tools':
      return <IconSearch className={cls} />;
    case 'account':
      return <IconUser className={cls} />;
    case 'details':
      return <IconLayers className={cls} />;
    case 'ai':
      return <IconSparkles className={cls} />;
    default:
      return null;
  }
}

// ── Compose header (post-compose pane) ───────────────────────────────────────

const VIS_PILL_CLASS =
  'inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-black/[0.07] bg-black/[0.04] px-3 text-[12px] font-semibold text-foreground transition-[background-color,transform] duration-150 active:scale-95';

function ComposeHeaderSlot() {
  const { canPost, posting, visibility } = useComposeHeader();

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {/* Visibility toggle */}
      <button
        type="button"
        onClick={triggerComposeToggleVisibility}
        aria-label={visibility === 'public' ? 'Visible to everyone — tap to change' : 'Only you — tap to change'}
        title={visibility === 'public' ? 'Public' : 'Only me'}
        className={VIS_PILL_CLASS}
      >
        {visibility === 'public' ? (
          <>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M10 2a8 8 0 1 1 0 16A8 8 0 0 1 10 2Zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
            </svg>
            Public
          </>
        ) : (
          <>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h1Zm4 4.732V15h2v-1.268A1.5 1.5 0 0 0 10 11a1.5 1.5 0 0 0-1 2.732ZM13 9V7a3 3 0 0 0-6 0v2h6Z" clipRule="evenodd" />
            </svg>
            Only me
          </>
        )}
      </button>

      {/* Post button */}
      <button
        type="button"
        disabled={!canPost || posting}
        onClick={triggerComposePost}
        aria-label="Post"
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-lake-blue px-4 text-[13px] font-bold text-white shadow-sm transition-[opacity,transform] duration-150 active:scale-95 disabled:opacity-35"
      >
        {posting ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4Z" />
          </svg>
        ) : (
          'Post'
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Floating search pill — glass chrome.
 * Search field on browse/search; title chrome (icon + name) on stacked panes; avatar → account.
 * On `/game`, Find Me / recenter sits inside the search field on the right.
 */
export default function MapDockPill() {
  const demo = useDemoMapChrome();
  const dock = useMapDock();
  const router = useRouter();
  const pathname = usePathname();
  const { account, user, isLoading: authLoading } = useAuthSafe();
  const inputRef = useRef<HTMLInputElement>(null);
  const { pane } = dock;
  const isPostCompose = pane.id === 'post-compose';
  const isCityPane = pane.id === 'city';
  const searchQuery = useMapSearchQuery();
  const titleMode = paneUsesTitleChrome(pane);
  const isSelectedPoint = pane.id === 'selected-point';
  const iconId = paneIconId(pane);
  const selectedPointChrome = useSelectedPointChrome();
  const title = isSelectedPoint ? selectedPointChrome.title : paneTitle(pane);
  const subtitleRaw = isSelectedPoint
    ? selectedPointChrome.subtitle
    : paneSubtitle(pane);
  const subtitle = subtitleRaw?.trim() || null;
  const showSubtitle = Boolean(
    subtitle && subtitle.toLowerCase() !== title.trim().toLowerCase(),
  );
  const toolPane = isMapToolPane(pane.id);
  const surfaceBackLabel = pathname === GAME_PATH ? 'Back to game' : 'Back';
  const backLabel = isSelectedPoint
    ? 'Close'
    : toolPane
      ? surfaceBackLabel
      : pane.id === 'search'
        ? 'Close search'
        : 'Back';
  const BackIcon = isSelectedPoint ? IconX : IconArrowLeft;
  const hideTitleAtFull = paneHidesTitleAtFull(pane) && dock.snap === 'full';
  /** Territory details — centered type + name + more at every snap (no avatar). */
  const detailsHeader = pane.id === 'details';
  const centerTitle = paneCentersTitleChrome(pane) || detailsHeader;
  const aiChrome = dock.territoryAiChrome;
  const aiChatHeader = Boolean(centerTitle && aiChrome && !detailsHeader);
  const headerTitle = title;
  const headerSubtitle = detailsHeader
    ? entityKindLabel(pane.entity)
    : subtitle;
  const showHeaderSubtitle = Boolean(
    headerSubtitle &&
      headerSubtitle.toLowerCase() !== headerTitle.trim().toLowerCase(),
  );

  const showCreditsChip = showsCreditsInTitleChrome(pane);

  const onAccountAvatar = () => {
    if (pane.id === 'account') dock.openBrowse();
    else dock.openAccount();
  };

  const openCredits = () => {
    dock.collapse();
    router.push(settingsBillingPath());
  };
  const onCreditsChip = openCredits;

  const handleFocus = () => {
    if (titleMode) return;
    // City pane — filter in-place; don't navigate to global search.
    if (isCityPane) return;
    dock.openSearch();
  };

  const handleCancel = () => {
    inputRef.current?.blur();
    dock.cancelSearch();
  };

  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCopyCoords = useCallback(() => {
    const label = selectedPointChrome.coordsLabel;
    if (!label) return;
    void navigator.clipboard.writeText(label).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1800);
    });
  }, [selectedPointChrome.coordsLabel]);

  const handleHandleTap = () => {
    inputRef.current?.blur();
    dock.back();
  };

  // During the setup demo the dock header (search + account) is hidden so the
  // coach chip rail stays the only UI landmark. The sheet drag still works.
  // Must be placed after all hooks to respect the Rules of Hooks.
  if (demo !== null) return null;

  return (
    <div className="relative min-w-0 w-full">
      {/*
        Handle sits in the header's top pad (same height as bottom pad) and is
        absolutely centered there — not stacked as extra flow above the search.
      */}
      <button
        type="button"
        data-sheet-drag-handle
        onClick={handleHandleTap}
        aria-label={
          isSelectedPoint
            ? 'Close'
            : toolPane
              ? surfaceBackLabel
              : 'Back or collapse'
        }
        className="group absolute inset-x-0 z-[1] flex w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        style={{ top: -MAP_DOCK_HANDLE_SLOT_PX, height: MAP_DOCK_HANDLE_SLOT_PX }}
      >
        <span
          className={`h-0.5 w-8 rounded-full transition-[background-color,transform] duration-150 group-active:scale-x-90 ${MAP_DOCK_HANDLE_CLASS}`}
          aria-hidden
        />
      </button>

      {centerTitle && titleMode && !hideTitleAtFull ? (
        <div className="relative flex min-h-11 min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={aiChatHeader ? aiChrome!.onBackToChats : dock.back}
            aria-label={aiChatHeader ? 'Back to chats' : backLabel}
            title={aiChatHeader ? 'Back to chats' : backLabel}
            className={`${BACK_SLOT_CLASS} relative z-[1]`}
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center ${
              aiChatHeader || detailsHeader ? 'px-[5.5rem]' : 'px-14'
            }`}
          >
            <div className="min-w-0 max-w-full text-center">
              {detailsHeader ? (
                <>
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wide leading-tight text-foreground-muted">
                    {headerSubtitle}
                  </p>
                  <p className="truncate text-base font-semibold leading-tight text-foreground">
                    {headerTitle}
                  </p>
                </>
              ) : (
                <>
                  <p className="truncate text-base font-semibold leading-tight text-foreground">
                    {headerTitle}
                  </p>
                  <p className="truncate text-[11px] font-medium leading-tight text-foreground-muted">
                    {aiChatHeader ? 'Chat' : showHeaderSubtitle ? headerSubtitle : 'AI'}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="relative z-[1] ml-auto flex shrink-0 items-center gap-2">
            {detailsHeader ? (
              <TerritoryDetailsOpsMenu entity={pane.entity} />
            ) : isPostCompose ? (
              <ComposeHeaderSlot />
            ) : (
              <>
                {aiChatHeader ? (
                  <button
                    type="button"
                    disabled={aiChrome!.newChatDisabled}
                    onClick={aiChrome!.onNewChat}
                    aria-label="New chat"
                    title="New chat"
                    className={`${BACK_SLOT_CLASS} disabled:opacity-40`}
                  >
                    <IconPlus className="h-5 w-5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Account"
                  aria-expanded={pane.id === 'account'}
                  className={AVATAR_SLOT_CLASS}
                  onClick={onAccountAvatar}
                >
                  <AccountAvatar
                    account={account}
                    email={user?.email}
                    size="sm"
                    loading={authLoading && !account}
                    className="h-full w-full"
                  />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          {dock.canGoBack || titleMode ? (
            <button
              type="button"
              onClick={dock.back}
              aria-label={backLabel}
              title={backLabel}
              className={BACK_SLOT_CLASS}
            >
              <BackIcon className="h-5 w-5" />
            </button>
          ) : null}

          {titleMode ? (
            hideTitleAtFull ? (
              <div className="min-w-0 flex-1" aria-hidden />
            ) : (
              <div className={TITLE_CHROME_CLASS}>
                <div className="flex min-w-0 items-center gap-2.5">
                  {iconId !== 'none' && !isSelectedPoint ? (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lake-blue/10">
                      <PaneChromeIcon id={iconId} />
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold leading-tight text-foreground">
                      {title}
                    </p>
                    {showSubtitle ? (
                      <p className="truncate text-[11px] font-medium leading-tight text-foreground-muted">
                        {subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
                {showCreditsChip ? (
                  <WalletCreditsCount onOpenCredits={onCreditsChip} />
                ) : null}
              </div>
            )
          ) : (
            <div className={SEARCH_SHELL_CLASS}>
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 z-[1] h-5 w-5 -translate-y-1/2 text-foreground-muted" />
              <input
                ref={inputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                onFocus={handleFocus}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancel();
                }}
                placeholder={isCityPane && pane.id === 'city' ? `Search ${pane.ctu.name}` : 'Search people, places, atlas…'}
                autoComplete="off"
                className={`${PILL_INPUT_CLASS} ${
                  pathname === GAME_PATH || pathname === STORY_PATH
                    ? searchQuery.length > 0
                      ? 'pr-[5.25rem]'
                      : 'pr-12'
                    : searchQuery.length > 0
                      ? 'pr-12'
                      : 'pr-4'
                } focus:ring-2 focus:ring-lake-blue/30`}
              />
              <div className="absolute inset-y-0 right-1.5 z-[1] flex items-center">
                {searchQuery.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setMapSearchQuery('')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted transition-[color,transform] duration-150 hover:text-foreground active:scale-90"
                    aria-label="Clear search"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                ) : null}
                {pathname === GAME_PATH || pathname === STORY_PATH ? (
                  <GameDockFindMe />
                ) : null}
              </div>
            </div>
          )}

          {isSelectedPoint && selectedPointChrome.coordsLabel ? (
            <button
              type="button"
              aria-label={copied ? 'Copied!' : 'Copy coordinates'}
              title={copied ? 'Copied!' : selectedPointChrome.coordsLabel}
              onClick={onCopyCoords}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-[color,transform] duration-150 hover:text-foreground active:scale-90"
            >
              {copied
                ? <IconCheckSmall className="h-4 w-4 text-green-500" />
                : <IconCopy className="h-4 w-4" />}
            </button>
          ) : null}

          {hideTitleAtFull ? null : isPostCompose ? (
            <ComposeHeaderSlot />
          ) : (
            <button
              type="button"
              aria-label="Account"
              aria-expanded={pane.id === 'account'}
              className={AVATAR_SLOT_CLASS}
              onClick={onAccountAvatar}
            >
              <AccountAvatar
                account={account}
                email={user?.email}
                size="sm"
                loading={authLoading && !account}
                className="h-full w-full"
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
