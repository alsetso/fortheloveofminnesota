'use client';

import { useState, useEffect } from 'react';
import { 
  CreditCardIcon, 
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import BillingSetup from '@/components/billing/BillingSetup';
import ViewsUsageSection from '@/components/billing/ViewsUsageSection';

interface PaymentMethod {
  id: string;
  brand: string | undefined;
  last4: string | undefined;
  expMonth: number | undefined;
  expYear: number | undefined;
  isDefault: boolean;
}

export default function BillingPageClient() {
  const { account, refreshAccount } = useAuthStateSafe();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);

  useEffect(() => {
    if (account?.stripe_customer_id) {
      fetchPaymentMethods();
    } else {
      setLoading(false);
    }
  }, [account?.stripe_customer_id]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
        setHasStripeCustomer(data.hasStripeCustomer);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!account?.stripe_customer_id) return;
    
    try {
      const response = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create billing portal session');
      }

      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      alert(error instanceof Error ? error.message : 'Failed to open billing portal');
    }
  };

  const getPlanDisplayName = (plan: string | null | undefined) => {
    if (!plan) return 'Hobby';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const getStatusDisplay = () => {
    if (!account?.subscription_status) return null;
    
    const status = account.subscription_status;
    if (status === 'active' || status === 'trialing') {
      return { text: 'Active', color: 'bg-green-900/20 text-green-400' };
    }
    if (status === 'canceled') {
      return { text: 'Canceled', color: 'bg-surface-accent text-foreground/80' };
    }
    if (status === 'past_due') {
      return { text: 'Payment Required', color: 'bg-red-900/20 text-red-400' };
    }
    return { text: status, color: 'bg-surface-accent text-foreground/80' };
  };

  const getBrandIcon = (brand: string | undefined) => {
    if (!brand) return 'Card';
    const brandLower = brand.toLowerCase();
    return brandLower.charAt(0).toUpperCase() + brandLower.slice(1);
  };

  const statusDisplay = getStatusDisplay();
  const planDisplayName = getPlanDisplayName(account?.plan);
  const isProUser = account?.plan && account.plan !== 'hobby';

  const planPrice = account?.plan === 'plus' ? '$80/month' : account?.plan === 'contributor' ? '$20/month' : 'Free';
  const isTrial = account?.billing_mode === 'trial' || account?.subscription_status === 'trialing';
  const isActive = account?.subscription_status === 'active' || account?.subscription_status === 'trialing';

  const handleUpgrade = () => {
    window.location.href = '/settings/plans';
  };

  return (
    <div className="space-y-3">
      {/* Billing Setup */}
      {!hasStripeCustomer && account && (
        <BillingSetup 
          account={account} 
          onCustomerCreated={() => {
            refreshAccount();
            fetchPaymentMethods();
          }}
        />
      )}

      {/* Manage Billing */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground mb-3">Manage Billing</h3>
        <div className="flex items-center justify-between p-[10px] border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent transition-colors bg-surface-accent">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-xs font-semibold text-foreground">{planDisplayName}</h4>
              {isTrial && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">Trial</span>}
              {statusDisplay && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusDisplay.color}`}>{statusDisplay.text}</span>}
            </div>
            <p className="text-xs text-foreground/70">
              {isProUser 
                ? (isActive 
                  ? `${planPrice} • Active subscription` 
                  : account.subscription_status === 'canceled' 
                  ? 'Subscription canceled' 
                  : account.subscription_status === 'past_due' 
                  ? 'Payment required' 
                  : 'Subscription inactive')
                : 'Upgrade to unlock Contributor features'
              }
            </p>
          </div>
          <button 
            onClick={isProUser && hasStripeCustomer ? handleManageBilling : handleUpgrade} 
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground bg-surface border border-border-muted dark:border-white/20 hover:bg-surface-accent rounded-md transition-colors flex-shrink-0"
          >
            <CreditCardIcon className="w-3 h-3" />
            <span>{isProUser && hasStripeCustomer ? 'Manage' : 'Upgrade'}</span>
          </button>
        </div>
      </div>

      {/* Payment Methods */}
      {hasStripeCustomer && (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Payment Methods</h3>
            <button
              onClick={handleManageBilling}
              className="text-xs text-foreground/70 hover:text-foreground font-medium"
            >
              Manage
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-border-muted dark:border-white/30 border-t-white mb-2"></div>
              <p className="text-xs text-foreground/60">Loading payment methods...</p>
            </div>
          ) : paymentMethods.length > 0 ? (
            <div className="space-y-2">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className={`border rounded-md p-[10px] ${
                    pm.isDefault 
                      ? 'border-lake-blue/50 bg-lake-blue/10' 
                      : 'border-border-muted dark:border-white/10 bg-surface-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCardIcon className="w-4 h-4 text-foreground/60" />
                      <div>
                        <div className="text-xs font-medium text-foreground">
                          {getBrandIcon(pm.brand)} •••• {pm.last4 || 'N/A'}
                        </div>
                        {pm.expMonth && pm.expYear && (
                          <div className="text-[10px] text-foreground/60">
                            Expires {pm.expMonth.toString().padStart(2, '0')}/{pm.expYear}
                          </div>
                        )}
                      </div>
                    </div>
                    {pm.isDefault && (
                      <span className="text-[10px] font-semibold text-lake-blue bg-lake-blue/20 px-1.5 py-0.5 rounded">
                        DEFAULT
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-border-muted dark:border-white/10 rounded-md bg-surface-accent">
              <CreditCardIcon className="w-8 h-8 text-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-foreground/60">No payment methods found</p>
              <button
                onClick={handleManageBilling}
                className="mt-2 text-xs text-lake-blue hover:text-lake-blue/80 font-medium"
              >
                Add payment method
              </button>
            </div>
          )}

          {/* Stripe Portal Link */}
          <div className="mt-3 pt-3 border-t border-border-muted dark:border-white/10">
            <button
              onClick={handleManageBilling}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-foreground bg-surface border border-border-muted dark:border-white/20 hover:bg-surface-accent rounded-md transition-colors"
            >
              <span>Open Billing Portal</span>
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </button>
            <p className="text-[10px] text-foreground/60 mt-1.5 text-center">
              Manage subscriptions, payment methods, and billing history
            </p>
          </div>
        </div>
      )}

      {/* Views & Usage */}
      {account?.id && (
        <ViewsUsageSection accountId={account.id} />
      )}

      {/* Help Section */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground mb-2">Need Help?</h3>
        <p className="text-xs text-foreground/70 mb-2">
          Have questions about billing or payments?
        </p>
        <a
          href="mailto:loveofminnesota@gmail.com"
          className="text-xs text-lake-blue hover:text-lake-blue/80 underline"
        >
          loveofminnesota@gmail.com
        </a>
      </div>
    </div>
  );
}
