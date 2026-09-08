'use client';

import { useCallback, useState } from 'react';
import {
  formatAccountPlan,
  useAuthSafe,
} from '@/features/auth';
import {
  SettingsChrome,
  SettingsGroup,
  SettingsRow,
} from '@/features/settings/SettingsChrome';
import {
  formatWalletBalance,
  useWalletSummary,
  type WalletTransaction,
} from '@/features/tools/wallet/useWalletSummary';
import { formatCredits, TOOL_CREDIT_COSTS } from '@/features/tools/core/toolCreditCosts';
import { CreditCostBadge } from '@/features/tools/core/toolUi';
import { isPaidPlan } from '@/lib/billing/planHelpers';
import {
  launchRevenueCatCenter,
  REVENUECAT_PURCHASES_ENABLED,
} from '@/lib/despia/revenueCat';
import { isDespia } from '@/lib/despia/despia';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { SETTINGS_PATH } from '@/lib/routes/routePolicy';

const PRICE_ROWS: { label: string; tool: string; credits: number }[] = [
  {
    label: 'Account match',
    tool: 'People',
    credits: TOOL_CREDIT_COSTS.peopleAccountLookup,
  },
  {
    label: 'Public records',
    tool: 'People',
    credits: TOOL_CREDIT_COSTS.peoplePublicRecords,
  },
  {
    label: 'Person details',
    tool: 'People',
    credits: TOOL_CREDIT_COSTS.peopleDetailPull,
  },
  {
    label: 'Property details',
    tool: 'Addresses',
    credits: TOOL_CREDIT_COSTS.realEstateProperty,
  },
  {
    label: 'Owner / skip-trace',
    tool: 'Addresses',
    credits: TOOL_CREDIT_COSTS.realEstateOwner,
  },
  {
    label: 'Transit',
    tool: 'Utilities',
    credits: TOOL_CREDIT_COSTS.transit,
  },
];

function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActivityRow({ tx }: { tx: WalletTransaction }) {
  return (
    <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-foreground">{tx.label}</p>
        <p className="mt-0.5 text-[12px] text-foreground-muted">
          {formatActivityDate(tx.createdAt)}
        </p>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          tx.amount > 0 ? 'text-emerald-700' : 'text-foreground'
        }`}
      >
        {tx.amount > 0
          ? `+${tx.amount} credit${tx.amount === 1 ? '' : 's'}`
          : `${tx.amount} credit${Math.abs(tx.amount) === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}

/**
 * /settings/billing — plan, credits, costs, ledger, and subscription management.
 */
export default function SettingsBillingPage() {
  const { account } = useAuthSafe();
  const { summary, loading, error, refresh } = useWalletSummary();
  const [manageBusy, setManageBusy] = useState(false);
  const [manageNote, setManageNote] = useState<string | null>(null);

  const planLabel =
    summary?.planLabel?.trim() || formatAccountPlan(account?.plan);
  const paid = isPaidPlan(account?.plan);
  const usagePct =
    summary && summary.monthlyGrant > 0
      ? Math.min(100, Math.round((summary.usedThisMonth / summary.monthlyGrant) * 100))
      : 0;

  const onManageSubscription = useCallback(async () => {
    if (!account?.id || manageBusy) return;
    setManageBusy(true);
    setManageNote(null);
    try {
      if (!REVENUECAT_PURCHASES_ENABLED || !isDespia()) {
        setManageNote(
          paid
            ? 'Manage your subscription in App Store → Subscriptions.'
            : 'Purchases aren’t available in this version. Earn credits on the map.',
        );
        return;
      }
      const launched = await launchRevenueCatCenter(account.id);
      if (!launched) {
        setManageNote('Couldn’t open subscription management.');
      }
    } finally {
      setManageBusy(false);
    }
  }, [account?.id, manageBusy, paid]);

  return (
    <SettingsChrome
      title="Billing"
      backHref={SETTINGS_PATH}
      onRefresh={() => void refresh()}
    >
      <div className="space-y-6 px-4 pb-12 pt-4">
        <h2 className="px-1 text-[28px] font-extrabold tracking-tight text-foreground">
          Billing
        </h2>

        <div
          className={`rounded-[14px] px-4 py-5 text-center ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {loading || !summary ? (
            <div className="mx-auto h-10 w-24 animate-pulse rounded-lg bg-black/[0.06]" />
          ) : (
            <p className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
              {formatWalletBalance(summary)}
            </p>
          )}
          <p className="mt-1 text-[13px] text-foreground-muted">
            {planLabel} plan
            {summary?.isUnlimited
              ? ' · unlimited'
              : summary
                ? ` · resets ${summary.resetsOn}`
                : ''}
          </p>
          {paid ? (
            <span className="mt-3 inline-flex rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Active
            </span>
          ) : null}
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

        {summary && !summary.isUnlimited ? (
          <div
            className={`rounded-[14px] px-4 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
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

        <p className="px-1 text-[13px] leading-snug text-foreground-muted">
          Earn credits by collecting coins and finds on the map.
          {REVENUECAT_PURCHASES_ENABLED
            ? ' You can also manage App Store purchases below.'
            : ' Purchases aren’t available in this version.'}
        </p>

        <SettingsGroup label="Plan">
          <SettingsRow
            title="Current plan"
            subtitle={paid ? 'Contributor benefits are active' : 'Free Hobby plan'}
            trailing={
              <span className="shrink-0 rounded-full bg-lake-blue/10 px-2 py-0.5 text-[12px] font-semibold text-lake-blue">
                {planLabel}
              </span>
            }
          />
          <SettingsRow
            title={paid ? 'Manage subscription' : 'Upgrade'}
            subtitle={
              paid
                ? 'Restore, cancel, or change in App Store'
                : REVENUECAT_PURCHASES_ENABLED
                  ? 'Contributor unlocks more monthly credits'
                  : 'Coming in a later release'
            }
            disabled={!account || manageBusy}
            onClick={() => void onManageSubscription()}
          />
        </SettingsGroup>

        <SettingsGroup label="Costs">
          {PRICE_ROWS.map((row) => (
            <SettingsRow
              key={`${row.tool}-${row.label}`}
              title={row.label}
              subtitle={row.tool}
              trailing={<CreditCostBadge credits={row.credits} />}
            />
          ))}
        </SettingsGroup>
        <p className="px-1 text-center text-[11px] leading-snug text-foreground-muted">
          Flat {formatCredits(1)} for each paid external pull. Cached repeats are free.
        </p>

        <SettingsGroup label="Recent activity">
          {loading || !summary ? (
            <>
              <div className="border-b border-black/[0.06] px-4 py-3.5 last:border-b-0">
                <div className="h-4 w-40 animate-pulse rounded bg-black/[0.06]" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-black/[0.05]" />
              </div>
              <div className="border-b border-black/[0.06] px-4 py-3.5 last:border-b-0">
                <div className="h-4 w-32 animate-pulse rounded bg-black/[0.06]" />
                <div className="mt-2 h-3 w-16 animate-pulse rounded bg-black/[0.05]" />
              </div>
            </>
          ) : summary.transactions.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-[15px] font-medium text-foreground">No activity yet</p>
              <p className="mt-1 text-[13px] leading-snug text-foreground-muted">
                Monthly credits land automatically. Map finds and lookups show up here.
              </p>
            </div>
          ) : (
            summary.transactions.map((tx) => <ActivityRow key={tx.id} tx={tx} />)
          )}
        </SettingsGroup>

        {manageNote ? (
          <p className="rounded-[14px] border border-black/[0.08] bg-white px-4 py-3 text-[13px] leading-snug text-foreground-muted shadow-sm">
            {manageNote}
          </p>
        ) : null}
      </div>
    </SettingsChrome>
  );
}
