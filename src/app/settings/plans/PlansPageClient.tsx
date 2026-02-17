'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import PlansPricingCards from '@/components/billing/PlansPricingCards';
import PlansComparisonTable from '@/components/billing/PlansComparisonTable';
import PlanPaymentModal from '@/components/billing/PlanPaymentModal';
import type { PlanWithFeatures } from '@/lib/billing/types';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface PlansPageClientProps {
  currentPlanSlug?: string | null;
  subscriptionStatus?: string | null;
}

export default function PlansPageClient({ currentPlanSlug, subscriptionStatus }: PlansPageClientProps) {
  const { account } = useAuthStateSafe();
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPlanSlug, setViewPlanSlug] = useState<string | null>(null);
  const [viewPlanInitial, setViewPlanInitial] = useState<PlanWithFeatures | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/billing/plans');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setPlans(data.plans ?? []);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleViewPlan = (plan: PlanWithFeatures) => {
    setViewPlanInitial(plan);
    setViewPlanSlug(plan.slug);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h2 className="text-sm font-semibold text-foreground">Plans & Features</h2>
        <p className="text-xs text-foreground-muted mt-0.5">
          Compare plans and their features
        </p>
      </div>

      {/* Pricing cards (try this design) */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <p className="text-xs font-medium text-foreground-muted mb-3">Plans</p>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-700" />
          </div>
        ) : (
          <PlansPricingCards
            plans={plans}
            currentPlanSlug={currentPlanSlug}
            subscriptionStatus={subscriptionStatus}
            hasStripeCustomer={!!account?.stripe_customer_id}
            onViewPlan={handleViewPlan}
          />
        )}
      </div>

      {/* Plans comparison table */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <p className="text-xs font-medium text-foreground-muted mb-3">Feature comparison</p>
        <PlansComparisonTable
          currentPlanSlug={currentPlanSlug}
          initialPlans={plans}
          onViewPlan={handleViewPlan}
        />
      </div>

      {/* Subscription audit trail */}
      <BillingAuditTrail />

      {viewPlanSlug && (
        <PlanPaymentModal
          planSlug={viewPlanSlug}
          isOpen
          onClose={() => {
            setViewPlanSlug(null);
            setViewPlanInitial(null);
          }}
          account={account ?? undefined}
          initialPlan={
            viewPlanInitial?.slug.toLowerCase() === viewPlanSlug.toLowerCase() ? viewPlanInitial : undefined
          }
          currentPlanSlug={currentPlanSlug}
          subscriptionStatus={subscriptionStatus}
          allPlans={plans}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Billing Audit Trail
   Shows account state, active subscription, and recent stripe events
   ───────────────────────────────────────────────── */

interface SubscriptionRow {
  subscription_id: string;
  stripe_customer_id: string;
  status: string;
  price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end_date: string | null;
  cancel_at_period_end: boolean;
  card_brand: string | null;
  card_last4: string | null;
  updated_at: string | null;
}

interface StripeEventRow {
  id: string;
  stripe_event_id: string;
  event_type: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  processed: boolean;
  processing_error: string | null;
  created_at: string;
}

interface AccountState {
  plan: string | null;
  subscription_status: string | null;
  billing_mode: string | null;
  stripe_customer_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10',
  trialing: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
  past_due: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
  canceled: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
  incomplete: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/5',
  unpaid: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
};

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  'customer.subscription.created': { label: 'Sub Created', color: 'text-green-700 dark:text-green-400' },
  'customer.subscription.updated': { label: 'Sub Updated', color: 'text-blue-700 dark:text-blue-400' },
  'customer.subscription.deleted': { label: 'Sub Deleted', color: 'text-red-700 dark:text-red-400' },
  'checkout.session.completed': { label: 'Checkout', color: 'text-green-700 dark:text-green-400' },
  'invoice.paid': { label: 'Invoice Paid', color: 'text-green-700 dark:text-green-400' },
  'invoice.payment_succeeded': { label: 'Payment OK', color: 'text-green-700 dark:text-green-400' },
  'invoice.payment_failed': { label: 'Payment Failed', color: 'text-red-700 dark:text-red-400' },
  'invoice.created': { label: 'Invoice Created', color: 'text-foreground-muted' },
  'invoice.upcoming': { label: 'Invoice Upcoming', color: 'text-foreground-muted' },
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function BillingAuditTrail() {
  const { account } = useAuthStateSafe();
  const supabase = useSupabaseClient();
  const [accountState, setAccountState] = useState<AccountState | null>(null);
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [events, setEvents] = useState<StripeEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!account?.id) return;
    const customerId = (account as any).stripe_customer_id;

    const [accRes, subRes, evtRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('plan, subscription_status, billing_mode, stripe_customer_id')
        .eq('id', account.id)
        .single(),
      customerId
        ? (supabase as any)
            .from('subscriptions')
            .select('subscription_id, stripe_customer_id, status, price_id, current_period_start, current_period_end, trial_end_date, cancel_at_period_end, card_brand, card_last4, updated_at')
            .eq('stripe_customer_id', customerId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      customerId
        ? (supabase as any)
            .from('stripe_events')
            .select('id, stripe_event_id, event_type, stripe_customer_id, stripe_subscription_id, processed, processing_error, created_at')
            .eq('stripe_customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] }),
    ]);

    setAccountState((accRes.data ?? null) as AccountState | null);
    setSub((subRes.data as SubscriptionRow) ?? null);
    setEvents(((evtRes.data as StripeEventRow[]) ?? []) as StripeEventRow[]);
    setLoading(false);
  }, [account, supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  if (!account) return null;

  return (
    <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground-muted">Billing Audit Trail</p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-foreground-muted hover:text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-muted border-t-foreground" />
        </div>
      ) : (
        <>
          {/* Account State */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Account State</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KV label="plan" value={accountState?.plan || 'hobby'} />
              <KV label="subscription_status" value={accountState?.subscription_status || 'none'} badge />
              <KV label="billing_mode" value={accountState?.billing_mode || 'standard'} />
              <KV label="stripe_customer_id" value={accountState?.stripe_customer_id ? `…${accountState.stripe_customer_id.slice(-8)}` : 'none'} mono />
            </div>
          </div>

          {/* Active Subscription */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Subscription Record</p>
            {sub ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <KV label="subscription_id" value={`…${sub.subscription_id.slice(-8)}`} mono />
                <KV label="status" value={sub.status} badge />
                <KV label="price_id" value={sub.price_id ? `…${sub.price_id.slice(-12)}` : 'none'} mono />
                <KV label="period_start" value={formatTime(sub.current_period_start)} />
                <KV label="period_end" value={formatTime(sub.current_period_end)} />
                <KV label="trial_end" value={sub.trial_end_date ? formatTime(sub.trial_end_date) : 'none'} />
                <KV label="cancel_at_period_end" value={sub.cancel_at_period_end ? 'yes' : 'no'} />
                <KV label="card" value={sub.card_last4 ? `${sub.card_brand || '•'} …${sub.card_last4}` : 'none'} />
                <KV label="updated_at" value={formatTime(sub.updated_at)} />
              </div>
            ) : (
              <p className="text-[10px] text-foreground-muted italic">No subscription record found</p>
            )}
          </div>

          {/* Stripe Events */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
              Recent Stripe Events {events.length > 0 && <span className="text-foreground-muted/60">({events.length})</span>}
            </p>
            {events.length > 0 ? (
              <div className="space-y-0.5">
                {events.map((evt) => {
                  const meta = EVENT_LABELS[evt.event_type] || { label: evt.event_type.replace(/\./g, ' '), color: 'text-foreground-muted' };
                  return (
                    <div key={evt.id} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-surface-accent/50 dark:hover:bg-white/5 transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${evt.processed ? 'bg-green-500' : evt.processing_error ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <span className={`text-[10px] font-medium w-24 flex-shrink-0 truncate ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-foreground-muted flex-1 truncate font-mono">
                        {evt.stripe_event_id.slice(0, 20)}…
                      </span>
                      {evt.processing_error && (
                        <span className="text-[10px] text-red-600 dark:text-red-400 truncate max-w-[120px]" title={evt.processing_error}>
                          {evt.processing_error}
                        </span>
                      )}
                      <span className="text-[10px] text-foreground-muted/60 flex-shrink-0 tabular-nums">
                        {formatTime(evt.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-foreground-muted italic">No stripe events recorded for this account</p>
            )}
          </div>

          {/* Logic chain */}
          <div className="border-t border-border-muted dark:border-white/10 pt-2 space-y-1">
            <p className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">How it works</p>
            <div className="text-[10px] text-foreground-muted leading-relaxed space-y-0.5">
              <p><span className="font-medium text-foreground">Upgrade/Downgrade</span> → change-plan API swaps price on Stripe subscription → optimistic DB write to accounts.plan + accounts.subscription_status → Stripe fires customer.subscription.updated webhook → webhook updates subscriptions table + stripe_events log</p>
              <p><span className="font-medium text-foreground">New subscription</span> → change-plan API creates subscription via Stripe → optimistic DB write → Stripe fires customer.subscription.created → webhook upserts subscriptions + stripe_events</p>
              <p><span className="font-medium text-foreground">Cancel</span> → Stripe portal → Stripe fires customer.subscription.deleted → webhook deletes subscription row, resets accounts.plan to hobby</p>
              <p><span className="font-medium text-foreground">Trial</span> → 7-day free trial on contributor plan for new subscriptions only (no existing active sub)</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KV({ label, value, badge, mono }: { label: string; value: string; badge?: boolean; mono?: boolean }) {
  const statusClass = badge ? (STATUS_COLORS[value] || 'text-foreground-muted bg-surface-accent dark:bg-white/5') : '';
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-foreground-muted/60 font-mono">{label}</p>
      {badge ? (
        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusClass}`}>{value}</span>
      ) : (
        <p className={`text-[10px] font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
      )}
    </div>
  );
}
