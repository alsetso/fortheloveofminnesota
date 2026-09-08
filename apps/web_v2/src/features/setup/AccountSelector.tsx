'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import {
  AccountAvatar,
  getAccountDisplayName,
  getAccountHandle,
  useAuthSafe,
  type AccountRow,
} from '@/features/auth';
import { formatAccountPlan, readMultiAccountHint } from '@/lib/auth/selectedAccount';
import { safePadBottom } from '@/lib/despia/safeArea';
import { readScreenRadiusPx } from '@/lib/despia/screenRadius';
import { IconSpinner, IconSwitch } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_DOCK_PAD_HALF_PX,
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
  MAP_DOCK_SHEET_FILL_CLASS,
  mapDockFloatingRadiusPx,
} from '@/features/map/dockCore/core/mapDockTokens';

const DOCK_PAD = MAP_DOCK_DOCK_PAD_HALF_PX;

const ROW_CLASS = `flex w-full items-center gap-3 rounded-[1.15rem] px-3.5 py-3.5 text-left transition active:scale-[0.99] disabled:opacity-70 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`;

/**
 * Pre-setup / pre-map account picker for auth users with multiple public.accounts rows.
 * Floating iOS glass sheet — same tokens as the map explore dock (no drag handle).
 *
 * When `failedFetch` is true and the accounts list is empty, the sheet shows an
 * error state with a retry button and a sign-out escape hatch instead of skeletons.
 */
export default function AccountSelector({
  loading = false,
  failedFetch = false,
  onRetry,
}: {
  /** Show skeleton rows while accounts are still fetching (multi-account hint). */
  loading?: boolean;
  /** Account fetch failed — show error state with retry + sign out. */
  failedFetch?: boolean;
  /** Called when the user taps "Try again". Defaults to retryAccountFetch from context. */
  onRetry?: () => void;
}) {
  const {
    accounts,
    user,
    selectAccount,
    selectingAccountId,
    accountLoading,
    retryAccountFetch,
    signOut,
  } = useAuthSafe();
  const [hintMulti, setHintMulti] = useState(false);
  const [sheetRadiusPx, setSheetRadiusPx] = useState(34);

  useEffect(() => {
    setHintMulti(readMultiAccountHint());
    setSheetRadiusPx(mapDockFloatingRadiusPx(readScreenRadiusPx(), DOCK_PAD));
  }, []);

  const showSkeleton =
    loading || (accountLoading && accounts.length === 0) || (hintMulti && accounts.length === 0);
  const rows: AccountRow[] = accounts;
  const busy = !!selectingAccountId;

  // Error state: fetch completed (not loading, not skeleton) but failed with no rows.
  const showError = failedFetch && !showSkeleton && rows.length === 0;
  const handleRetry = onRetry ?? retryAccountFetch;

  const sheetRadiusStyle = {
    borderRadius: sheetRadiusPx,
  } as CSSProperties;

  return (
    <DialogBackdrop
      dismissible={false}
      layer="SETUP"
      position="absolute"
      align="end"
      dimClassName="bg-black/10"
      frameIsDialog
      ariaLabel="Choose an account"
      className="pointer-events-auto"
      style={
        {
          paddingLeft: DOCK_PAD,
          paddingRight: DOCK_PAD,
          paddingBottom: DOCK_PAD,
        } as CSSProperties
      }
    >
      {/* Opacity-only enter — transform ancestors break backdrop-filter over the map. */}
      <div
        className="account-glass-in relative flex max-h-[min(72dvh,28rem)] w-full flex-col overflow-hidden"
        style={sheetRadiusStyle}
        aria-labelledby="account-selector-title"
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${MAP_DOCK_SHEET_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} shadow-[0_-6px_28px_rgba(0,0,0,0.12)]`}
          style={sheetRadiusStyle}
        />

        <div
          className="relative z-[1] min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pt-5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingBottom: safePadBottom('1.25rem') }}
        >
          <div className="mx-auto w-full max-w-sm">
            <div className="px-1 text-center">
              <h2
                id="account-selector-title"
                className="text-[1.2rem] font-semibold tracking-tight text-foreground"
              >
                {showError ? 'Could not load your profile' : 'Choose an account'}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground-muted">
                {showError
                  ? 'There was a problem connecting to your account. Check your connection and try again.'
                  : 'Pick which profile to open on the map.'}
              </p>
            </div>

            {showError ? (
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={handleRetry}
                  className={`${ROW_CLASS} justify-center`}
                >
                  <span className="text-[15px] font-semibold text-foreground">Try again</span>
                </button>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className={`${ROW_CLASS} justify-center`}
                >
                  <span className="text-[14px] font-medium text-foreground-muted">Sign out</span>
                </button>
              </div>
            ) : (
              <ul className="mt-4 space-y-2" role="list">
                {showSkeleton
                  ? [0, 1].map((i) => (
                      <li
                        key={i}
                        className={`flex items-center gap-3 rounded-[1.15rem] px-3.5 py-3.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                        aria-hidden
                      >
                        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-map-ink-subtle" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-3.5 w-28 animate-pulse rounded-full bg-map-ink-subtle" />
                          <div className="h-3 w-16 animate-pulse rounded-full bg-map-ink-faint" />
                        </div>
                        <div className="h-5 w-5 animate-pulse rounded bg-map-ink-faint" />
                      </li>
                    ))
                  : rows.map((row) => {
                      const handle = getAccountHandle(row);
                      const name = getAccountDisplayName(row, user?.email);
                      const planLabel = formatAccountPlan(row.plan);
                      const isSelecting = selectingAccountId === row.id;
                      const rowBusy = busy && isSelecting;

                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => selectAccount(row.id)}
                            className={`${ROW_CLASS} ${
                              isSelecting ? 'ring-2 ring-map-rail-active' : ''
                            }`}
                            aria-label={`Switch to ${handle ?? name}`}
                            aria-busy={rowBusy}
                          >
                            <span className="inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/70 bg-white/70 shadow-sm shadow-black/10">
                              <AccountAvatar
                                account={row}
                                email={user?.email}
                                size="sm"
                                loading={rowBusy}
                                className="h-full w-full"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold text-foreground">
                                {handle ?? name}
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">
                                {planLabel}
                                {row.status && row.status !== 'active' ? ` · ${row.status}` : ''}
                              </span>
                            </span>
                            <span className="shrink-0 text-foreground-muted" aria-hidden>
                              {rowBusy ? (
                                <IconSpinner className="h-5 w-5 animate-spin" />
                              ) : (
                                <IconSwitch className="h-5 w-5" />
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
              </ul>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes accountGlassIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .account-glass-in { animation: accountGlassIn 0.28s ease-out both; }
      `}</style>
    </DialogBackdrop>
  );
}
