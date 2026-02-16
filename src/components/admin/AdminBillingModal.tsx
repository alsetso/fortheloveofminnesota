'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import {
  XMarkIcon,
  UserCircleIcon,
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

// ── Types ──

interface AccountRef {
  id: string;
  username: string | null;
  image_url?: string | null;
  plan: string | null;
  subscription_status: string | null;
  billing_mode?: string | null;
  stripe_customer_id: string | null;
  role?: string | null;
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
  card_brand?: string | null;
  card_last4?: string | null;
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
}

interface Props {
  account: AccountRef;
  subscription: SubscriptionRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const PLAN_OPTIONS = ['hobby', 'contributor', 'plus', 'testing'] as const;
const TABS = ['Account', 'Subscription', 'Events'] as const;
type Tab = (typeof TABS)[number];

const inputClass = 'w-full rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-muted text-xs text-foreground px-2 py-1.5';
const labelClass = 'block text-[10px] font-semibold text-foreground mb-0.5';
const btnPrimary = 'text-xs font-medium px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors';
const btnDanger = 'text-xs font-medium px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors';

function StatusBadge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={`text-[10px] flex items-center gap-1 ${ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {ok ? <CheckCircleIcon className="w-3 h-3" /> : <ExclamationTriangleIcon className="w-3 h-3" />}
      {text}
    </p>
  );
}

export default function AdminBillingModal({ account, subscription, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('Account');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Account tab state ──
  const [accPlan, setAccPlan] = useState(account.plan ?? 'hobby');
  const [accSubStatus, setAccSubStatus] = useState(account.subscription_status ?? '');
  const [accBillingMode, setAccBillingMode] = useState(account.billing_mode ?? 'standard');
  const [accStripeCustomer, setAccStripeCustomer] = useState(account.stripe_customer_id ?? '');

  // ── Subscription tab state ──
  const [subForm, setSubForm] = useState({
    subscription_id: subscription?.subscription_id ?? '',
    stripe_customer_id: subscription?.stripe_customer_id ?? account.stripe_customer_id ?? '',
    status: subscription?.status ?? 'active',
    price_id: subscription?.price_id ?? '',
    current_period_start: subscription?.current_period_start?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    current_period_end: subscription?.current_period_end?.slice(0, 10) ?? '',
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
    card_brand: subscription?.card_brand ?? '',
    card_last4: subscription?.card_last4 ?? '',
  });
  const isNewSub = !subscription;

  // ── Events tab state ──
  const [accountEvents, setAccountEvents] = useState<StripeEventRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    stripe_event_id: `manual_${Date.now()}`,
    event_type: 'admin.manual_entry',
    processed: true,
    processing_error: '',
  });

  // Sync form when account changes
  useEffect(() => {
    setAccPlan(account.plan ?? 'hobby');
    setAccSubStatus(account.subscription_status ?? '');
    setAccBillingMode(account.billing_mode ?? 'standard');
    setAccStripeCustomer(account.stripe_customer_id ?? '');
  }, [account]);

  useEffect(() => {
    if (subscription) {
      setSubForm({
        subscription_id: subscription.subscription_id,
        stripe_customer_id: subscription.stripe_customer_id,
        status: subscription.status,
        price_id: subscription.price_id,
        current_period_start: subscription.current_period_start?.slice(0, 10),
        current_period_end: subscription.current_period_end?.slice(0, 10),
        cancel_at_period_end: subscription.cancel_at_period_end,
        card_brand: subscription.card_brand ?? '',
        card_last4: subscription.card_last4 ?? '',
      });
    }
  }, [subscription]);

  const fetchAccountEvents = useCallback(async () => {
    if (!account.id) return;
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/admin/billing/stripe-events?limit=50&offset=0`);
      if (!res.ok) return;
      const data = await res.json();
      const filtered = (data.events || []).filter(
        (e: StripeEventRow) =>
          e.account_id === account.id ||
          (account.stripe_customer_id && e.stripe_customer_id === account.stripe_customer_id)
      );
      setAccountEvents(filtered);
    } catch { /* silent */ } finally {
      setLoadingEvents(false);
    }
  }, [account.id, account.stripe_customer_id]);

  useEffect(() => {
    if (tab === 'Events') fetchAccountEvents();
  }, [tab, fetchAccountEvents]);

  const clearMsg = () => setMsg(null);

  // ── Account save ──
  const saveAccount = useCallback(async () => {
    setSaving(true);
    clearMsg();
    try {
      const res = await fetch(`/api/admin/billing/accounts/${account.id}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: accPlan,
          subscription_status: accSubStatus || undefined,
          billing_mode: accBillingMode || undefined,
          stripe_customer_id: accStripeCustomer || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      setMsg({ ok: true, text: 'Account updated' });
      onSaved();
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' });
    } finally {
      setSaving(false);
    }
  }, [account.id, accPlan, accSubStatus, accBillingMode, accStripeCustomer, onSaved]);

  // ── Subscription save / create ──
  const saveSub = useCallback(async () => {
    setSaving(true);
    clearMsg();
    try {
      if (isNewSub) {
        const res = await fetch('/api/admin/billing/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...subForm,
            current_period_start: new Date(subForm.current_period_start).toISOString(),
            current_period_end: new Date(subForm.current_period_end).toISOString(),
            card_brand: subForm.card_brand || null,
            card_last4: subForm.card_last4 || null,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to create');
        }
        setMsg({ ok: true, text: 'Subscription created' });
      } else {
        const res = await fetch('/api/admin/billing/subscriptions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: subscription!.id,
            status: subForm.status,
            price_id: subForm.price_id,
            current_period_start: new Date(subForm.current_period_start).toISOString(),
            current_period_end: new Date(subForm.current_period_end).toISOString(),
            cancel_at_period_end: subForm.cancel_at_period_end,
            stripe_customer_id: subForm.stripe_customer_id,
            card_brand: subForm.card_brand || null,
            card_last4: subForm.card_last4 || null,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to update');
        }
        setMsg({ ok: true, text: 'Subscription updated' });
      }
      onSaved();
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' });
    } finally {
      setSaving(false);
    }
  }, [isNewSub, subForm, subscription, onSaved]);

  const deleteSub = useCallback(async () => {
    if (!subscription || !confirm('Delete this subscription record?')) return;
    setSaving(true);
    clearMsg();
    try {
      const res = await fetch('/api/admin/billing/subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subscription.id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      setMsg({ ok: true, text: 'Subscription deleted' });
      onSaved();
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' });
    } finally {
      setSaving(false);
    }
  }, [subscription, onSaved]);

  // ── Event actions ──
  const createEvent = useCallback(async () => {
    setSaving(true);
    clearMsg();
    try {
      const res = await fetch('/api/admin/billing/stripe-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripe_event_id: newEvent.stripe_event_id,
          event_type: newEvent.event_type,
          account_id: account.id,
          stripe_customer_id: account.stripe_customer_id,
          event_data: { admin_manual: true },
          processed: newEvent.processed,
          processing_error: newEvent.processing_error || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      setMsg({ ok: true, text: 'Event created' });
      setShowNewEvent(false);
      setNewEvent({ stripe_event_id: `manual_${Date.now()}`, event_type: 'admin.manual_entry', processed: true, processing_error: '' });
      fetchAccountEvents();
      onSaved();
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' });
    } finally {
      setSaving(false);
    }
  }, [newEvent, account, fetchAccountEvents, onSaved]);

  const toggleEventProcessed = useCallback(async (ev: StripeEventRow) => {
    try {
      const res = await fetch('/api/admin/billing/stripe-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ev.id,
          processed: !ev.processed,
          processed_at: !ev.processed ? new Date().toISOString() : null,
          processing_error: !ev.processed ? null : ev.processing_error,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      fetchAccountEvents();
      onSaved();
    } catch { /* silent */ }
  }, [fetchAccountEvents, onSaved]);

  const deleteEvent = useCallback(async (evId: string) => {
    if (!confirm('Delete this event record?')) return;
    try {
      const res = await fetch('/api/admin/billing/stripe-events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evId }),
      });
      if (!res.ok) throw new Error('Failed');
      fetchAccountEvents();
      onSaved();
    } catch { /* silent */ }
  }, [fetchAccountEvents, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border border-border-muted dark:border-white/10 rounded-lg shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border-muted">
          {account.image_url ? (
            <Image src={account.image_url} alt="" width={28} height={28} className="rounded-full object-cover" />
          ) : (
            <UserCircleIcon className="w-7 h-7 text-gray-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{account.username ?? 'Unknown'}</p>
            <p className="text-[10px] text-foreground-muted truncate">{account.id}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-surface-accent">
            <XMarkIcon className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-muted">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setMsg(null); }}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tab === t ? 'text-foreground border-b-2 border-gray-900 dark:border-white' : 'text-foreground-muted hover:text-foreground'}`}
            >
              {t}
              {t === 'Events' && accountEvents.length > 0 && (
                <span className="ml-1 text-[10px] text-foreground-muted">({accountEvents.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* ── Account Tab ── */}
          {tab === 'Account' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Plan</label>
                  <select value={accPlan} onChange={(e) => setAccPlan(e.target.value)} className={inputClass}>
                    {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Subscription status</label>
                  <input value={accSubStatus} onChange={(e) => setAccSubStatus(e.target.value)} placeholder="active / inactive" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Billing mode</label>
                  <input value={accBillingMode} onChange={(e) => setAccBillingMode(e.target.value)} placeholder="standard" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Stripe customer ID</label>
                  <input value={accStripeCustomer} onChange={(e) => setAccStripeCustomer(e.target.value)} placeholder="cus_..." className={inputClass} />
                </div>
              </div>
              <button type="button" onClick={saveAccount} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving...' : 'Save Account'}
              </button>
            </>
          )}

          {/* ── Subscription Tab ── */}
          {tab === 'Subscription' && (
            <>
              {isNewSub && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">No subscription found for this account. Fill out to create one.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Subscription ID</label>
                  <input
                    value={subForm.subscription_id}
                    onChange={(e) => setSubForm((f) => ({ ...f, subscription_id: e.target.value }))}
                    placeholder="sub_..."
                    className={inputClass}
                    disabled={!isNewSub}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stripe customer ID</label>
                  <input
                    value={subForm.stripe_customer_id}
                    onChange={(e) => setSubForm((f) => ({ ...f, stripe_customer_id: e.target.value }))}
                    placeholder="cus_..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={subForm.status}
                    onChange={(e) => setSubForm((f) => ({ ...f, status: e.target.value }))}
                    className={inputClass}
                  >
                    {['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Price ID</label>
                  <input
                    value={subForm.price_id}
                    onChange={(e) => setSubForm((f) => ({ ...f, price_id: e.target.value }))}
                    placeholder="price_..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Period start</label>
                  <input
                    type="date"
                    value={subForm.current_period_start}
                    onChange={(e) => setSubForm((f) => ({ ...f, current_period_start: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Period end</label>
                  <input
                    type="date"
                    value={subForm.current_period_end}
                    onChange={(e) => setSubForm((f) => ({ ...f, current_period_end: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Card brand</label>
                  <input
                    value={subForm.card_brand}
                    onChange={(e) => setSubForm((f) => ({ ...f, card_brand: e.target.value }))}
                    placeholder="visa"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Card last 4</label>
                  <input
                    value={subForm.card_last4}
                    onChange={(e) => setSubForm((f) => ({ ...f, card_last4: e.target.value }))}
                    placeholder="4242"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cancel_at_period_end"
                  checked={subForm.cancel_at_period_end}
                  onChange={(e) => setSubForm((f) => ({ ...f, cancel_at_period_end: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="cancel_at_period_end" className="text-xs text-foreground">Cancel at period end</label>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveSub} disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving...' : isNewSub ? 'Create Subscription' : 'Update Subscription'}
                </button>
                {!isNewSub && (
                  <button type="button" onClick={deleteSub} disabled={saving} className={btnDanger}>
                    <TrashIcon className="w-3 h-3 inline mr-1" />Delete
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Events Tab ── */}
          {tab === 'Events' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">
                  Events for this account ({accountEvents.length})
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewEvent(!showNewEvent)}
                  className="text-xs flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors"
                >
                  <PlusIcon className="w-3 h-3" /> {showNewEvent ? 'Cancel' : 'New event'}
                </button>
              </div>

              {showNewEvent && (
                <div className="border border-border-muted rounded-md p-2 space-y-2 bg-surface-muted/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Event ID</label>
                      <input
                        value={newEvent.stripe_event_id}
                        onChange={(e) => setNewEvent((f) => ({ ...f, stripe_event_id: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Event type</label>
                      <input
                        value={newEvent.event_type}
                        onChange={(e) => setNewEvent((f) => ({ ...f, event_type: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="new_ev_processed"
                      checked={newEvent.processed}
                      onChange={(e) => setNewEvent((f) => ({ ...f, processed: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="new_ev_processed" className="text-xs text-foreground">Processed</label>
                  </div>
                  <button type="button" onClick={createEvent} disabled={saving} className={btnPrimary}>
                    {saving ? 'Creating...' : 'Create Event'}
                  </button>
                </div>
              )}

              {loadingEvents ? (
                <div className="flex items-center justify-center py-6 text-xs text-foreground-muted">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600 mr-2" />
                  Loading...
                </div>
              ) : accountEvents.length === 0 ? (
                <p className="text-xs text-foreground-muted py-4">No events for this account.</p>
              ) : (
                <div className="space-y-1">
                  {accountEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`border border-border-muted rounded-md p-2 text-[10px] space-y-0.5 ${!ev.processed ? 'bg-amber-500/5' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-foreground">{ev.event_type}</span>
                        <span className="text-foreground-muted">{new Date(ev.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-foreground-muted truncate">{ev.stripe_event_id}</p>
                      {ev.processing_error && (
                        <p className="text-red-600 dark:text-red-400 truncate">{ev.processing_error}</p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleEventProcessed(ev)}
                          className="text-[10px] text-foreground-muted hover:text-foreground transition-colors"
                        >
                          {ev.processed ? 'Mark unprocessed' : 'Mark processed'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvent(ev.id)}
                          className="text-[10px] text-red-500 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer message */}
        {msg && (
          <div className="px-3 pb-3">
            <StatusBadge ok={msg.ok} text={msg.text} />
          </div>
        )}
      </div>
    </div>
  );
}
