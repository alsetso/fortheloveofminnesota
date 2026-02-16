'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import AdminBillingModal from '@/components/admin/AdminBillingModal';

interface AccountRef {
  id: string;
  username: string | null;
  image_url?: string | null;
  plan: string | null;
  subscription_status: string | null;
  billing_mode?: string | null;
  stripe_customer_id: string | null;
  role?: string | null;
  created_at?: string | null;
}

interface StripeEventRow {
  id: string;
  stripe_event_id: string;
  event_type: string;
  account_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  processed: boolean;
  processing_error: string | null;
  created_at: string;
  processed_at: string | null;
  retry_count: number;
  accounts?: AccountRef | null;
}

interface SubscriptionRow {
  id: string;
  stripe_customer_id: string;
  subscription_id: string;
  status: string;
  price_id: string;
  current_period_end: string;
  current_period_start: string;
  cancel_at_period_end: boolean;
  accounts?: AccountRef | null;
}

const PLAN_OPTIONS = ['hobby', 'contributor', 'plus', 'testing'] as const;

function hasSubMismatch(sub: SubscriptionRow): boolean {
  const plan = sub.accounts?.plan ?? 'hobby';
  const stripeActive = sub.status === 'active' || sub.status === 'trialing';
  const isPaidPlan = plan !== 'hobby';
  return (stripeActive && !isPaidPlan) || (!stripeActive && isPaidPlan);
}

export default function StripeEventsSettingsClient() {
  const { account } = useSettings();
  const router = useRouter();
  const isAdmin = account?.role === 'admin';

  // Data
  const [allAccounts, setAllAccounts] = useState<AccountRef[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountPlanFilter, setAccountPlanFilter] = useState('');

  const [events, setEvents] = useState<StripeEventRow[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [allEventTypes, setAllEventTypes] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [processedFilter, setProcessedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [eventsOffset, setEventsOffset] = useState(0);
  const limit = 50;

  // Expansion
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  // Sidebar selection — driven by account id, selectable from any table
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [sidebarPlan, setSidebarPlan] = useState<string>('hobby');
  const [sidebarSaving, setSidebarSaving] = useState(false);
  const [sidebarMsg, setSidebarMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showBillingModal, setShowBillingModal] = useState(false);

  // Derive selected account from any source: accounts list, subscription join, or event join
  const selectedAccount: AccountRef | null =
    allAccounts.find((a) => a.id === selectedAccountId) ??
    subscriptions.find((s) => s.accounts?.id === selectedAccountId)?.accounts ??
    events.find((e) => e.accounts?.id === selectedAccountId)?.accounts ??
    null;

  // Find subscription for the selected account (if any)
  const selectedSub = subscriptions.find(
    (s) => s.accounts?.id === selectedAccountId || s.stripe_customer_id === selectedAccount?.stripe_customer_id
  ) ?? null;

  // ── Fetchers ──

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (accountSearch) params.set('search', accountSearch);
      if (accountPlanFilter) params.set('plan', accountPlanFilter);
      const res = await fetch(`/api/admin/billing/accounts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAllAccounts(data.accounts || []);
    } catch (e) {
      console.error(e);
      setAllAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [accountSearch, accountPlanFilter]);

  const fetchEventTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/billing/stripe-events?limit=200&offset=0');
      if (!res.ok) return;
      const data = await res.json();
      const types = Array.from(new Set((data.events || []).map((e: StripeEventRow) => e.event_type))).sort() as string[];
      setAllEventTypes(types);
    } catch { /* silent */ }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(eventsOffset));
      if (eventTypeFilter) params.set('event_type', eventTypeFilter);
      if (processedFilter === 'yes') params.set('processed', 'true');
      if (processedFilter === 'no') params.set('processed', 'false');
      const res = await fetch(`/api/admin/billing/stripe-events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setEvents(data.events || []);
      setEventsTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
      setEvents([]);
      setEventsTotal(0);
    } finally {
      setLoadingEvents(false);
    }
  }, [eventsOffset, eventTypeFilter, processedFilter]);

  const fetchSubscriptions = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const res = await fetch('/api/admin/billing/subscriptions?limit=200');
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (e) {
      console.error(e);
      setSubscriptions([]);
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  // Sync sidebar plan when selection changes
  useEffect(() => {
    if (selectedAccount) setSidebarPlan(selectedAccount.plan ?? 'hobby');
    setSidebarMsg(null);
  }, [selectedAccount]);

  const handlePlanOverride = useCallback(async () => {
    if (!selectedAccount) return;
    setSidebarSaving(true);
    setSidebarMsg(null);
    try {
      const res = await fetch(`/api/admin/billing/accounts/${selectedAccount.id}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: sidebarPlan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update plan');
      }
      setSidebarMsg({ type: 'ok', text: 'Plan updated' });
      fetchAccounts();
      fetchSubscriptions();
    } catch (e: unknown) {
      setSidebarMsg({ type: 'err', text: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setSidebarSaving(false);
    }
  }, [selectedAccount, sidebarPlan, fetchAccounts, fetchSubscriptions]);

  const handleModalSaved = useCallback(() => {
    fetchAccounts();
    fetchSubscriptions();
    fetchEvents();
  }, [fetchAccounts, fetchSubscriptions, fetchEvents]);

  // ── Effects ──

  useEffect(() => {
    if (!isAdmin) return;
    fetchEventTypes();
    fetchSubscriptions();
  }, [isAdmin, fetchEventTypes, fetchSubscriptions]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAccounts();
  }, [isAdmin, fetchAccounts]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchEvents();
  }, [isAdmin, fetchEvents]);

  useEffect(() => {
    if (account && !isAdmin) {
      const t = setTimeout(() => router.replace('/settings'), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [account, isAdmin, router]);

  // ── Derived stats ──

  const unprocessedCount = events.filter((e) => !e.processed).length;
  const mismatchCount = subscriptions.filter(hasSubMismatch).length;

  const planCounts = allAccounts.reduce<Record<string, number>>((acc, a) => {
    const p = a.plan ?? 'hobby';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  if (account && !isAdmin) {
    return (
      <div className="p-[10px] space-y-3">
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">Admin only. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:flex lg:gap-3">
    <div className="space-y-3 flex-1 min-w-0">
      {/* Header */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BoltIcon className="w-4 h-4" />
          Billing Admin
        </h2>
        <p className="text-xs text-foreground-muted mt-0.5">
          All accounts, subscriptions, and Stripe events. Click any row to manage in the sidebar.
        </p>
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['hobby', 'contributor', 'plus', 'testing'] as const).map((plan) => (
          <button
            key={plan}
            type="button"
            onClick={() => setAccountPlanFilter((prev) => prev === plan ? '' : plan)}
            className={`bg-surface border rounded-md p-[10px] text-left transition-colors ${accountPlanFilter === plan ? 'border-blue-400 dark:border-blue-500' : 'border-border-muted dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'}`}
          >
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">{plan}</p>
            <p className="text-lg font-semibold text-foreground mt-0.5">{planCounts[plan] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Operational stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">Subscriptions</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">{subscriptions.length}</p>
        </div>
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">Events</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">{eventsTotal}</p>
        </div>
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">Alerts</p>
          <p className="text-lg font-semibold text-foreground mt-0.5 flex items-center gap-1">
            {(unprocessedCount + mismatchCount) > 0 && <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />}
            {unprocessedCount + mismatchCount}
          </p>
        </div>
      </div>

      {/* ── Accounts table ── */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <UsersIcon className="w-4 h-4" />
          Accounts
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            placeholder="Search username..."
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-muted text-xs text-foreground px-2 py-1.5 w-40"
          />
          <select
            value={accountPlanFilter}
            onChange={(e) => setAccountPlanFilter(e.target.value)}
            className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-muted text-xs text-foreground px-2 py-1.5"
          >
            <option value="">All plans</option>
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {loadingAccounts ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-foreground-muted">
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
            Loading accounts...
          </div>
        ) : allAccounts.length === 0 ? (
          <p className="text-xs text-foreground-muted py-4">No accounts match filters</p>
        ) : (
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="border-b border-border-muted">
                  <th className="text-left p-2 font-semibold text-foreground">Account</th>
                  <th className="text-left p-2 font-semibold text-foreground">Plan</th>
                  <th className="text-left p-2 font-semibold text-foreground">Sub status</th>
                  <th className="text-left p-2 font-semibold text-foreground">Billing</th>
                  <th className="text-left p-2 font-semibold text-foreground">Role</th>
                </tr>
              </thead>
              <tbody>
                {allAccounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <tr
                      key={acc.id}
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`border-b border-border-muted cursor-pointer hover:bg-surface-accent/50 transition-colors ${isSelected ? 'ring-1 ring-inset ring-blue-400/50' : ''}`}
                    >
                      <td className="p-2">
                        <span className="flex items-center gap-1.5">
                          {acc.image_url ? (
                            <Image src={acc.image_url} alt="" width={20} height={20} className="rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <UserCircleIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="font-medium text-foreground truncate">{acc.username ?? '—'}</span>
                        </span>
                      </td>
                      <td className="p-2 text-foreground">{acc.plan ?? '—'}</td>
                      <td className="p-2 text-foreground-muted">{acc.subscription_status ?? '—'}</td>
                      <td className="p-2 text-foreground-muted">{acc.billing_mode ?? '—'}</td>
                      <td className="p-2 text-foreground-muted">{acc.role ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Subscriptions table ── */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <CreditCardIcon className="w-4 h-4" />
          Subscriptions
          {mismatchCount > 0 && (
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400 ml-auto">{mismatchCount} mismatch{mismatchCount !== 1 && 'es'}</span>
          )}
        </h3>
        {loadingSubs ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-foreground-muted">
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
            Loading...
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="text-xs text-foreground-muted py-4">No subscriptions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-muted">
                  <th className="text-left p-2 font-semibold text-foreground">Account</th>
                  <th className="text-left p-2 font-semibold text-foreground">account.plan</th>
                  <th className="text-left p-2 font-semibold text-foreground">Stripe status</th>
                  <th className="text-left p-2 font-semibold text-foreground">price_id</th>
                  <th className="text-left p-2 font-semibold text-foreground">Period end</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => {
                  const acc = sub.accounts;
                  const mismatch = hasSubMismatch(sub);
                  const isExpanded = expandedSubId === sub.id;
                  const isSelected = selectedAccountId === acc?.id;
                  return (
                    <Fragment key={sub.id}>
                      <tr
                        onClick={() => {
                          setExpandedSubId(isExpanded ? null : sub.id);
                          if (acc?.id) setSelectedAccountId(acc.id);
                        }}
                        className={`border-b border-border-muted cursor-pointer hover:bg-surface-accent/50 transition-colors ${mismatch ? 'bg-red-500/5' : ''} ${isSelected ? 'ring-1 ring-inset ring-blue-400/50' : ''}`}
                      >
                        <td className="p-2">
                          <span className="flex items-center gap-1.5">
                            {acc?.image_url ? (
                              <Image src={acc.image_url} alt="" width={20} height={20} className="rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <UserCircleIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="font-medium text-foreground truncate">{acc?.username ?? '—'}</span>
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={mismatch ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-foreground'}>
                            {acc?.plan ?? '—'}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={mismatch ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-foreground'}>
                            {sub.status}
                          </span>
                          {sub.cancel_at_period_end && (
                            <span className="ml-1 text-amber-600 dark:text-amber-400">(cancels)</span>
                          )}
                        </td>
                        <td className="p-2 font-mono text-[10px] text-foreground-muted">{sub.price_id?.slice(-12)}</td>
                        <td className="p-2 text-foreground-muted">
                          {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border-muted bg-surface-muted/50">
                          <td colSpan={5} className="p-2">
                            <div className="text-[10px] space-y-1">
                              <p><span className="font-semibold">subscription_id:</span> {sub.subscription_id}</p>
                              <p><span className="font-semibold">stripe_customer_id:</span> {sub.stripe_customer_id}</p>
                              <p><span className="font-semibold">price_id:</span> {sub.price_id}</p>
                              <p><span className="font-semibold">period:</span> {new Date(sub.current_period_start).toLocaleDateString()} – {new Date(sub.current_period_end).toLocaleDateString()}</p>
                              {sub.cancel_at_period_end && <p className="text-amber-600 dark:text-amber-400 font-semibold">Cancels at period end</p>}
                              {acc && (
                                <div className="mt-1 pt-1 border-t border-border-muted">
                                  <p><span className="font-semibold">account.id:</span> {acc.id}</p>
                                  <p><span className="font-semibold">account.plan:</span> {acc.plan ?? '—'}</p>
                                  <p><span className="font-semibold">account.subscription_status:</span> {acc.subscription_status ?? '—'}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Events table ── */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <BoltIcon className="w-4 h-4" />
          Events
          {unprocessedCount > 0 && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 ml-auto">{unprocessedCount} unprocessed</span>
          )}
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <select
            value={eventTypeFilter}
            onChange={(e) => { setEventTypeFilter(e.target.value); setEventsOffset(0); }}
            className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-muted text-xs text-foreground px-2 py-1.5"
          >
            <option value="">All types</option>
            {allEventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={processedFilter}
            onChange={(e) => { setProcessedFilter(e.target.value as 'all' | 'yes' | 'no'); setEventsOffset(0); }}
            className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-muted text-xs text-foreground px-2 py-1.5"
          >
            <option value="all">All</option>
            <option value="yes">Processed</option>
            <option value="no">Unprocessed</option>
          </select>
          <div className="flex items-center gap-2 text-xs text-foreground-muted ml-auto">
            <button
              type="button"
              onClick={() => setEventsOffset((o) => Math.max(0, o - limit))}
              disabled={eventsOffset === 0}
              className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 disabled:opacity-50"
            >
              Prev
            </button>
            <span>{eventsOffset + 1}–{Math.min(eventsOffset + limit, eventsTotal)} of {eventsTotal}</span>
            <button
              type="button"
              onClick={() => setEventsOffset((o) => o + limit)}
              disabled={eventsOffset + limit >= eventsTotal}
              className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        {loadingEvents ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-foreground-muted">
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
            Loading events...
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs text-foreground-muted py-4">No events match filters</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-muted">
                  <th className="text-left p-2 font-semibold text-foreground">Time</th>
                  <th className="text-left p-2 font-semibold text-foreground">Type</th>
                  <th className="text-left p-2 font-semibold text-foreground">Account</th>
                  <th className="text-left p-2 font-semibold text-foreground">Status</th>
                  <th className="text-left p-2 font-semibold text-foreground">Error</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const acc = ev.accounts;
                  const isExpanded = expandedEventId === ev.id;
                  return (
                    <Fragment key={ev.id}>
                      <tr className={`border-b border-border-muted hover:bg-surface-accent/50 ${!ev.processed ? 'bg-amber-500/5' : ''}`}>
                        <td className="p-2 text-foreground-muted whitespace-nowrap">
                          {new Date(ev.created_at).toLocaleString()}
                        </td>
                        <td className="p-2 font-mono text-[10px] text-foreground">{ev.event_type}</td>
                        <td className="p-2">
                          {acc?.username ? (
                            <button
                              type="button"
                              onClick={() => { if (acc?.id) setSelectedAccountId(acc.id); }}
                              className="text-foreground hover:underline"
                            >
                              {acc.username}
                            </button>
                          ) : (
                            <span className="text-foreground-muted">—</span>
                          )}
                        </td>
                        <td className="p-2">
                          {ev.processed ? (
                            <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <ClockIcon className="w-4 h-4" /> No
                            </span>
                          )}
                        </td>
                        <td className="p-2 max-w-[120px] truncate text-foreground-muted" title={ev.processing_error ?? ''}>
                          {ev.processing_error ?? '—'}
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                            className="p-1 rounded hover:bg-surface-accent"
                          >
                            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border-muted bg-surface-muted/50">
                          <td colSpan={6} className="p-2">
                            <div className="text-[10px] space-y-1">
                              <p><span className="font-semibold">stripe_event_id:</span> {ev.stripe_event_id}</p>
                              {ev.stripe_customer_id && <p><span className="font-semibold">stripe_customer_id:</span> {ev.stripe_customer_id}</p>}
                              {ev.stripe_subscription_id && <p><span className="font-semibold">stripe_subscription_id:</span> {ev.stripe_subscription_id}</p>}
                              {ev.processed_at && <p><span className="font-semibold">processed_at:</span> {new Date(ev.processed_at).toLocaleString()}</p>}
                              {ev.retry_count > 0 && <p><span className="font-semibold">retry_count:</span> {ev.retry_count}</p>}
                              {ev.processing_error && <p className="text-red-600 dark:text-red-400"><span className="font-semibold">error:</span> {ev.processing_error}</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {/* ── Right sidebar — desktop only ── */}
    <div className="hidden lg:block w-64 flex-shrink-0">
      <div className="sticky top-3 bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px] space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Account Details</h3>
        {!selectedAccount ? (
          <p className="text-xs text-foreground-muted">Click any account, subscription, or event row to manage.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {selectedAccount.image_url ? (
                <Image src={selectedAccount.image_url} alt="" width={32} height={32} className="rounded-full object-cover flex-shrink-0" />
              ) : (
                <UserCircleIcon className="w-8 h-8 text-gray-400 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{selectedAccount.username ?? '—'}</p>
                <p className="text-[10px] text-foreground-muted truncate">{selectedAccount.id}</p>
              </div>
            </div>
            <div className="text-[10px] space-y-1">
              <p><span className="font-semibold text-foreground">Plan:</span> <span className="text-foreground-muted">{selectedAccount.plan ?? '—'}</span></p>
              <p><span className="font-semibold text-foreground">Sub status:</span> <span className="text-foreground-muted">{selectedAccount.subscription_status ?? '—'}</span></p>
              <p><span className="font-semibold text-foreground">Billing mode:</span> <span className="text-foreground-muted">{selectedAccount.billing_mode ?? '—'}</span></p>
              <p><span className="font-semibold text-foreground">Stripe customer:</span> <span className="text-foreground-muted truncate block">{selectedAccount.stripe_customer_id ?? '—'}</span></p>
              {selectedAccount.role && (
                <p><span className="font-semibold text-foreground">Role:</span> <span className="text-foreground-muted">{selectedAccount.role}</span></p>
              )}
              {selectedSub && (
                <>
                  <div className="mt-1 pt-1 border-t border-border-muted" />
                  <p><span className="font-semibold text-foreground">Stripe sub:</span> <span className="text-foreground-muted">{selectedSub.status}</span></p>
                  <p><span className="font-semibold text-foreground">Period end:</span> <span className="text-foreground-muted">{new Date(selectedSub.current_period_end).toLocaleDateString()}</span></p>
                  {selectedSub.cancel_at_period_end && (
                    <p className="text-amber-600 dark:text-amber-400 font-semibold">Cancels at period end</p>
                  )}
                </>
              )}
            </div>
            <div className="pt-2 border-t border-border-muted space-y-2">
              <label className="block text-[10px] font-semibold text-foreground">Override plan</label>
              <select
                value={sidebarPlan}
                onChange={(e) => setSidebarPlan(e.target.value)}
                className="w-full rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-muted text-xs text-foreground px-2 py-1.5"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handlePlanOverride}
                disabled={sidebarSaving || sidebarPlan === (selectedAccount.plan ?? 'hobby')}
                className="w-full text-xs font-medium px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                {sidebarSaving ? 'Saving...' : 'Save'}
              </button>
              {sidebarMsg && (
                <p className={`text-[10px] ${sidebarMsg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {sidebarMsg.text}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowBillingModal(true)}
              className="w-full text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 dark:border-white/10 text-foreground hover:bg-surface-accent transition-colors"
            >
              Manage Account
            </button>
          </>
        )}
      </div>
    </div>

    {/* Admin billing modal */}
    {showBillingModal && selectedAccount && (
      <AdminBillingModal
        account={selectedAccount}
        subscription={selectedSub}
        onClose={() => setShowBillingModal(false)}
        onSaved={handleModalSaved}
      />
    )}
    </div>
  );
}
