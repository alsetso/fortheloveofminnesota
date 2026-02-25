'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCardIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';

interface PaymentMethod {
  id: string;
  brand: string | undefined;
  last4: string | undefined;
  expMonth: number | undefined;
  expYear: number | undefined;
  isDefault: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  hobby: 'Public',
  contributor: 'Contributor',
};

const PLAN_PRICES: Record<string, string> = {
  hobby: '$0',
  contributor: '$20/mo',
};

function getStatusBadge(status: string | null | undefined) {
  if (!status) return null;
  switch (status) {
    case 'active':
    case 'trialing':
      return { text: status === 'trialing' ? 'Trial' : 'Active', cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30' };
    case 'past_due':
      return { text: 'Past Due', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30' };
    case 'canceled':
      return { text: 'Canceled', cls: 'bg-surface-accent text-foreground-muted border border-border-muted' };
    default:
      return { text: status, cls: 'bg-surface-accent text-foreground-muted border border-border-muted' };
  }
}

export default function BillingPageClient() {
  const { account, refreshAccount } = useAuthStateSafe();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);

  const hasCustomer = Boolean(account?.stripe_customer_id);
  const planLabel = PLAN_LABELS[account?.plan ?? ''] ?? 'Public';
  const planPrice = PLAN_PRICES[account?.plan ?? ''] ?? '$0';
  const isPaid = account?.plan && account.plan !== 'hobby';
  const statusBadge = getStatusBadge(account?.subscription_status);

  useEffect(() => {
    if (hasCustomer) {
      fetchPaymentMethods();
    } else {
      setLoading(false);
    }
  }, [hasCustomer]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/payment-methods');
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data.paymentMethods ?? []);
      }
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    } finally {
      setLoading(false);
    }
  };

  const openPortal = async () => {
    if (!hasCustomer) return;
    try {
      const res = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to open billing portal');
      }
      const { url } = await res.json();
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Billing portal error:', err);
    }
  };

  const setupCustomer = async () => {
    setSettingUp(true);
    try {
      const res = await fetch('/api/billing/ensure-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to set up billing');
      }
      await refreshAccount();
      await fetchPaymentMethods();
    } catch (err) {
      console.error('Setup error:', err);
    } finally {
      setSettingUp(false);
    }
  };

  const brandLabel = (brand: string | undefined) => {
    if (!brand) return 'Card';
    return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
  };

  return (
    <div className="space-y-3">
      {/* Subscription */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground mb-2">Subscription</h3>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">{planLabel}</span>
              <span className="text-xs text-foreground-muted">{planPrice}</span>
              {statusBadge && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge.cls}`}>
                  {statusBadge.text}
                </span>
              )}
            </div>
            {!isPaid && (
              <p className="text-xs text-foreground-muted">Upgrade to unlock more features</p>
            )}
          </div>
          {isPaid && hasCustomer ? (
            <button
              onClick={openPortal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors"
            >
              Manage
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </button>
          ) : (
            <Link
              href="/pricing"
              className="px-2.5 py-1.5 text-xs font-medium text-foreground bg-lake-blue hover:bg-lake-blue/80 rounded-md transition-colors"
            >
              View Plans
            </Link>
          )}
        </div>
      </div>

      {/* Billing Setup — only when no Stripe customer yet */}
      {!hasCustomer && account && (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <h3 className="text-sm font-semibold text-foreground mb-1">Set Up Billing</h3>
          <p className="text-xs text-foreground-muted mb-3">
            Create your billing account to manage subscriptions and payment methods through Stripe.
          </p>
          <button
            onClick={setupCustomer}
            disabled={settingUp}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors disabled:opacity-50"
          >
            <CreditCardIcon className="w-3 h-3" />
            {settingUp ? 'Setting up…' : 'Set up billing'}
          </button>
        </div>
      )}

      {/* Payment Methods */}
      {hasCustomer && (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <h3 className="text-sm font-semibold text-foreground mb-2">Payment Methods</h3>

          {loading ? (
            <div className="py-6 text-center">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-border-muted border-t-foreground mb-1.5" />
              <p className="text-xs text-foreground-muted">Loading…</p>
            </div>
          ) : paymentMethods.length > 0 ? (
            <div className="space-y-1.5">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className={`flex items-center justify-between p-[10px] rounded-md border ${
                    pm.isDefault
                      ? 'border-green-200 dark:border-green-500/30 bg-green-500/5'
                      : 'border-border-muted dark:border-white/10 bg-surface-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CreditCardIcon className="w-3.5 h-3.5 text-foreground-muted" />
                    <span className="text-xs font-medium text-foreground">
                      {brandLabel(pm.brand)} •••• {pm.last4 || '—'}
                    </span>
                    {pm.expMonth != null && pm.expYear != null && (
                      <span className="text-[10px] text-foreground-muted">
                        {pm.expMonth.toString().padStart(2, '0')}/{pm.expYear}
                      </span>
                    )}
                  </div>
                  {pm.isDefault && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                      <CheckCircleIcon className="w-3 h-3" />
                      Default
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-foreground-muted py-3">No payment methods on file.</p>
          )}

          <button
            onClick={openPortal}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors"
          >
            <span>{paymentMethods.length > 0 ? 'Manage in Stripe' : 'Add payment method'}</span>
            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Help */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <p className="text-xs text-foreground-muted">
          Questions? <a href="mailto:loveofminnesota@gmail.com" className="text-lake-blue hover:underline">loveofminnesota@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
