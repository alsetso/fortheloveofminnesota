'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AccountAvatar,
  getAccountDisplayName,
  getAccountHandle,
  useAuthSafe,
} from '@/features/auth';
import { fetchAccountOwnedPageCount } from '@/features/map/directory';
import DockPlanAvatar from '@/features/map/dockCore/shell/DockPlanAvatar';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DockActionRow,
  DockRowChevron,
  ENTRY_ROW_GLASS_CLASS,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  IconCheck,
  IconPlus,
  IconSignOut,
  IconSpinner,
  IconSwitch,
  IconTrash,
  IconRefresh,
} from '@/features/map/dockCore/core/icons';
import { useHomeStatus } from '@/features/accountTerritories/store/useHomeStatus';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import {
  SETUP_PATH,
  WELCOME_PATH,
  NOTIFICATIONS_PATH,
  settingsBillingPath,
} from '@/lib/routes/routePolicy';
import {
  formatWalletBalance,
  useWalletSummary,
} from '@/features/tools/wallet/useWalletSummary';
import { isPaidPlan } from '@/lib/billing/planHelpers';
import { useCampaign } from '@/features/campaign/useCampaign';
import { CampaignReader } from '@/features/campaign/CampaignReader';

const FOOTER_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-[14px] font-medium transition active:scale-[0.99]';

const SECTION_LABEL =
  'px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted';

/** Account dock card — identity + core game hubs. Streamlined for MVP. */
export default function AccountDockCard() {
  const router = useRouter();
  const { openDockCard, closeDockCard, openProfileCard, collapse, openToday } = useMapDock();
  const {
    account,
    accounts,
    user,
    isLoading,
    signOut,
    selectAccount,
    selectingAccountId,
    clearAccountSelection,
    refreshAccount,
  } = useAuthSafe();
  const { summary, loading: walletLoading } = useWalletSummary();
  const { status: homeStatus } = useHomeStatus();
  const homeCount = homeStatus?.homeSetAt ? homeStatus.jurisdictions.length : 0;
  const { passport } = usePassport(account?.id);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const { chapters, loading: campaignLoading, markRead } = useCampaign();
  const [campaignOpen, setCampaignOpen] = useState(false);
  const handleSentenceRead = useCallback((chapterId: number, sentenceId: number) => {
    void markRead(chapterId, [sentenceId]);
  }, [markRead]);

  const activeChapter = (() => {
    const incompleteUnlocked = chapters.find((c) => c.unlocked && !c.complete);
    if (incompleteUnlocked) return incompleteUnlocked;
    return [...chapters].reverse().find((c) => c.unlocked && c.complete) ?? null;
  })();

  useEffect(() => {
    if (!account?.id) {
      setPageCount(null);
      return;
    }
    const ac = new AbortController();
    void fetchAccountOwnedPageCount(ac.signal)
      .then((count) => { if (!ac.signal.aborted) setPageCount(count); })
      .catch(() => { if (!ac.signal.aborted) setPageCount(null); });
    return () => ac.abort();
  }, [account?.id]);

  const displayName = getAccountDisplayName(account, user?.email);
  const handle = getAccountHandle(account);
  const creditsCount = walletLoading ? '…' : formatWalletBalance(summary);
  const creditsUsed = walletLoading ? null : summary ? summary.usedThisMonth : null;

  const onSwitchToAccount = (accountId: string) => {
    selectAccount(accountId);
    closeDockCard();
  };

  const onCreateAccount = () => {
    closeDockCard();
    collapse();
    router.push(`${SETUP_PATH}?new=1`);
  };

  const onResetup = async () => {
    closeDockCard();
    collapse();
    try {
      await fetch('/api/accounts/resetup', { method: 'POST' });
    } catch {
      // If the request fails the local UI still re-routes to /setup —
      // the gate will catch any lingering complete state on refresh.
    }
    await refreshAccount();
    router.replace(SETUP_PATH);
  };

  const onSignOut = async () => {
    closeDockCard();
    await signOut();
    router.replace(WELCOME_PATH);
    router.refresh();
  };

  return (
    <>
    <DockCardShell variant="stack">

      {/* ── Identity header ─────────────────────────────── */}
      <div className="flex flex-col items-center px-1 pb-4 pt-1 text-center">
        <DockPlanAvatar
          account={account}
          email={user?.email}
          plan={account?.plan}
          level={passport?.level.level}
          size="lg"
          loading={isLoading && !account}
          onLevelClick={() => openDockCard('level')}
        />
        {isLoading && !account ? (
          <div className="mt-1.5 w-full space-y-1.5" aria-hidden>
            <div className="mx-auto h-5 w-32 animate-pulse rounded-full bg-black/[0.08]" />
            <div className="mx-auto h-3.5 w-20 animate-pulse rounded-full bg-map-ink-subtle" />
          </div>
        ) : (
          <>
            <h2 className="mt-1.5 max-w-full truncate text-[1.2rem] font-semibold leading-tight tracking-tight text-foreground">
              {displayName}
            </h2>
            {handle ? (
              <p className="mt-0 truncate text-[13px] leading-tight text-foreground-muted">
                {handle}
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* ── Primary hubs ────────────────────────────────── */}
      <div className="space-y-1.5">
        <DockActionRow
          title="Stats"
          trailing={<DockRowChevron />}
          disabled={!account}
          onClick={() => {
            closeDockCard();
            openToday({ returnToCard: 'account' });
          }}
        />
        <DockActionRow
          title="Profile"
          trailing={<DockRowChevron />}
          disabled={!account}
          onClick={() => { if (!account?.id) return; openProfileCard(account.id); }}
        />
        <DockActionRow
          title="Avatar"
          trailing={<DockRowChevron />}
          disabled={!account}
          onClick={() => openDockCard('backpack')}
        />
        <DockActionRow
          title="Notifications"
          trailing={<DockRowChevron />}
          disabled={!account}
          onClick={() => {
            if (!account) return;
            collapse();
            router.push(NOTIFICATIONS_PATH);
          }}
        />
        <DockActionRow
          title="My Content"
          trailing={<DockRowChevron />}
          disabled={!account}
          onClick={() => openDockCard('activity')}
        />
        <DockActionRow
          title="My Places"
          trailing={
            <DockRowChevron>
              {homeCount > 0 ? (
                <span className="shrink-0 rounded-full bg-lake-blue/10 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-lake-blue">
                  {homeCount}
                </span>
              ) : null}
            </DockRowChevron>
          }
          disabled={!account}
          onClick={() => openDockCard('my-places')}
        />
        <DockActionRow
          title="Billing"
          trailing={
            <DockRowChevron>
              {creditsUsed != null ? (
                <span className="text-[12px] font-medium tabular-nums text-foreground-muted">
                  {creditsUsed} used
                </span>
              ) : null}
              <span className="rounded-full bg-lake-blue/10 px-2 py-0.5 text-[13px] font-semibold tabular-nums text-lake-blue">
                {creditsCount}
              </span>
            </DockRowChevron>
          }
          disabled={!account}
          onClick={() => {
            if (!account) return;
            collapse();
            router.push(settingsBillingPath());
          }}
        />
        <DockActionRow
          title="Campaign"
          trailing={<DockRowChevron />}
          onClick={() => { if (activeChapter) setCampaignOpen(true); }}
        />
        {pageCount != null && pageCount > 0 ? (
          <DockActionRow
            title="My pages"
            trailing={
              <DockRowChevron>
                <span className="shrink-0 rounded-full bg-lake-blue/10 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-lake-blue">
                  {pageCount}
                </span>
              </DockRowChevron>
            }
            disabled={!account}
            onClick={() => openDockCard('page-manager')}
          />
        ) : null}
      </div>

      {/* ── Contextual rows (paid plan) ──────────────────── */}
      {isPaidPlan(account?.plan) ? (
        <div className="space-y-1.5">
          <p className={SECTION_LABEL}>More</p>
          <DockActionRow
            title="Contributor"
            trailing={
              <DockRowChevron>
                <span className="shrink-0 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  Active
                </span>
              </DockRowChevron>
            }
            disabled={!account}
            onClick={() => openDockCard('contributor')}
          />
        </div>
      ) : null}

      {/* ── Account Manager ──────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1 pb-1 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            Accounts
          </p>
          {user?.email ? (
            <p className="max-w-[58%] truncate text-[11px] text-foreground-muted">
              {user.email}
            </p>
          ) : null}
        </div>

        {accounts.map((row) => {
          const isActive = row.id === account?.id;
          const isSwitching = selectingAccountId === row.id;
          const rowName = getAccountDisplayName(row, user?.email);
          const rowHandle = getAccountHandle(row);

          return (
            <button
              key={row.id}
              type="button"
              disabled={isActive || !!selectingAccountId}
              onClick={() => { if (!isActive) onSwitchToAccount(row.id); }}
              aria-label={isActive ? `${rowHandle ?? rowName} — active` : `Switch to ${rowHandle ?? rowName}`}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99] disabled:opacity-60 ${ENTRY_ROW_GLASS_CLASS} ${
                isActive ? 'bg-lake-blue/[0.06] ring-1 ring-lake-blue/25' : ''
              }`}
            >
              <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/70 bg-white/60 shadow-sm shadow-black/10">
                <AccountAvatar
                  account={row}
                  email={user?.email}
                  size="sm"
                  loading={isSwitching}
                  className="h-full w-full"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-foreground">
                  {rowHandle ?? rowName}
                </span>
              </span>
              {isActive ? (
                <IconCheck className="h-4 w-4 shrink-0 text-lake-blue" />
              ) : isSwitching ? (
                <IconSpinner className="h-4 w-4 shrink-0 animate-spin text-foreground-muted" />
              ) : (
                <IconSwitch className="h-4 w-4 shrink-0 text-foreground-muted" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onCreateAccount}
          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99] ${ENTRY_ROW_GLASS_CLASS}`}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
            <IconPlus className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 text-[14px] font-semibold text-foreground">
            Create new account
          </span>
          <DockRowChevron />
        </button>
      </div>

      {/* ── Footer actions ───────────────────────────────── */}
      <div className="space-y-1">
        {account ? (
          <button
            type="button"
            onClick={() => void onResetup()}
            className={`${FOOTER_BTN} text-foreground-muted hover:bg-map-ink-faint hover:text-foreground`}
          >
            <IconRefresh className="h-4 w-4" />
            Resetup
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void onSignOut()}
          className={`${FOOTER_BTN} bg-red-500/10 text-red-600 hover:bg-red-500/15`}
        >
          <IconSignOut className="h-4 w-4" />
          Sign out
        </button>
        {account ? (
          <button
            type="button"
            onClick={() => openDockCard('delete-account')}
            className={`${FOOTER_BTN} text-red-600/50 hover:bg-red-500/10 hover:text-red-600`}
          >
            <IconTrash className="h-4 w-4" />
            Delete account
          </button>
        ) : null}
      </div>
    </DockCardShell>

    {campaignOpen && activeChapter && (
      <CampaignReader
        chapters={chapters}
        initialChapter={activeChapter}
        onClose={() => setCampaignOpen(false)}
        onSentenceRead={handleSentenceRead}
      />
    )}
    </>
  );
}
