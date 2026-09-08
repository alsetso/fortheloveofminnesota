'use client';

import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockActionRow } from '@/features/map/dockCore/panes/DockPaneShell';
import { IconSparkles, IconWallet } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { formatAccountPlan } from '@/lib/auth/selectedAccount';
import {
  formatWalletBalance,
  useWalletSummary,
  type WalletEarnedBreakdown,
} from '@/features/tools/wallet/useWalletSummary';
import { settingsBillingPath } from '@/lib/routes/routePolicy';

function CreditsSourceChart({
  earned,
  loading,
}: {
  earned: WalletEarnedBreakdown | null | undefined;
  loading: boolean;
}) {
  const platform = earned?.platform ?? 0;
  const collected = earned?.collected ?? 0;
  const total = earned?.total ?? platform + collected;
  const platformPct = total > 0 ? Math.round((platform / total) * 100) : 0;
  const collectedPct = total > 0 ? 100 - platformPct : 0;

  return (
    <div
      className={`rounded-2xl px-3 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-foreground">Where credits came from</p>
        <p className="text-[12px] tabular-nums text-foreground-muted">
          {loading && !earned ? '…' : `${total.toLocaleString()} earned`}
        </p>
      </div>

      <div
        className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-black/[0.08]"
        role="img"
        aria-label={
          total > 0
            ? `${platformPct}% platform, ${collectedPct}% collected`
            : 'No credits earned yet'
        }
      >
        {loading && !earned ? (
          <span className="block h-full w-full animate-pulse bg-black/[0.06]" />
        ) : total > 0 ? (
          <>
            {platform > 0 ? (
              <span
                className="block h-full bg-lake-blue transition-[width] duration-500"
                style={{ width: `${platformPct}%` }}
              />
            ) : null}
            {collected > 0 ? (
              <span
                className="block h-full bg-amber-400 transition-[width] duration-500"
                style={{ width: `${collectedPct}%` }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-lake-blue" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              Platform
            </p>
          </div>
          <p className="mt-1 text-[20px] font-bold tabular-nums tracking-tight text-foreground">
            {loading && !earned ? '—' : platform.toLocaleString()}
          </p>
          <p className="text-[11px] text-foreground-muted">Plan & subscription</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              Collected
            </p>
          </div>
          <p className="mt-1 text-[20px] font-bold tabular-nums tracking-tight text-foreground">
            {loading && !earned ? '—' : collected.toLocaleString()}
          </p>
          <p className="text-[11px] text-foreground-muted">Coins & map finds</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Wallet dock card — balance, source split, and billing entry.
 */
export default function WalletDockCard() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const { closeDockCard, collapse } = useMapDock();
  const { summary, loading, error, refresh } = useWalletSummary();

  const planLabel =
    summary?.planLabel?.trim() || formatAccountPlan(account?.plan);
  const usagePct =
    summary && summary.monthlyGrant > 0
      ? Math.min(100, Math.round((summary.usedThisMonth / summary.monthlyGrant) * 100))
      : 0;

  const openBilling = () => {
    closeDockCard();
    collapse();
    router.push(settingsBillingPath());
  };

  return (
    <DockCardShell
      titleMode="center"
      eyebrow="Billing"
      title="Credits"
    >
      <div
        className={`rounded-2xl px-4 py-5 text-center ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        {loading || !summary ? (
          <div className="mx-auto h-10 w-24 animate-pulse rounded-lg bg-map-ink-subtle" />
        ) : (
          <p className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
            {formatWalletBalance(summary)}
          </p>
        )}
        <p className="mt-1 text-[12px] text-foreground-muted">
          {planLabel} plan
          {summary?.isUnlimited
            ? ' · unlimited'
            : summary
              ? ` · resets ${summary.resetsOn}`
              : ''}
        </p>
        {error ? (
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-3 text-[12px] font-medium text-lake-blue"
          >
            Couldn’t load — tap to retry
          </button>
        ) : null}
      </div>

      <CreditsSourceChart earned={summary?.earned} loading={loading} />

      {summary && !summary.isUnlimited ? (
        <div
          className={`rounded-2xl px-3 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] text-foreground-muted">Used this month</span>
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {summary.usedThisMonth} of {summary.monthlyGrant}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
            <span
              className="block h-full rounded-full bg-lake-blue transition-[width] duration-300"
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <DockActionRow
          title="Open billing"
          subtitle="Plan, costs, and activity"
          icon={<IconWallet className="h-5 w-5" />}
          onClick={openBilling}
        />
        <DockActionRow
          title="Plan"
          subtitle="Included monthly credits"
          icon={<IconSparkles className="h-5 w-5" />}
          trailing={
            <span className="shrink-0 rounded-full bg-lake-blue/10 px-2 py-0.5 text-[12px] font-semibold text-lake-blue">
              {planLabel}
            </span>
          }
          onClick={openBilling}
        />
      </div>
    </DockCardShell>
  );
}
