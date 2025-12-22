'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ExclamationCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import type { BillingClientProps } from '../types';

export default function BillingClient({ initialBillingData, onChangePlanClick }: BillingClientProps) {
  const router = useRouter();
  const [billingData, setBillingData] = useState<BillingData>(initialBillingData);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Handle checkout session completion
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const canceled = params.get('canceled');

    if (sessionId) {
      // Checkout completed successfully
      setError(null);
      // Force a full page refresh to get latest subscription status
      // Stripe Checkout automatically saves payment methods to the customer
      window.location.href = '/?modal=account&tab=billing&session_id=' + sessionId;
    } else if (canceled) {
      // Checkout was canceled
      setError('Checkout was canceled. You can try again anytime.');
      // Clean up URL but keep modal params
      window.history.replaceState({}, '', '/?modal=account&tab=billing');
    }
  }, [router]);

  // Open Stripe Customer Portal (for managing existing subscriptions)
  const openCustomerPortal = async () => {
    try {
      setPortalLoading(true);
      setError(null);
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: `${window.location.origin}/?modal=account&tab=billing`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open customer portal');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      console.error('Error opening customer portal:', err);
      setError(err instanceof Error ? err.message : 'Failed to open customer portal');
      setPortalLoading(false);
    }
  };



  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-[10px] bg-white border border-gray-200 rounded-md">
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-gray-900">Billing</h1>
        </div>
        <p className="text-xs text-gray-600">Manage your subscription and billing</p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
          <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Plan</h3>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {billingData.plan === 'plus' ? 'Pro+' : billingData.plan === 'pro' ? 'Pro' : 'Hobby'}
            </span>
            {billingData.isTrial && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Trial
              </span>
            )}
            {billingData.subscription_status && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                billingData.isActive
                  ? 'bg-green-100 text-green-800'
                  : billingData.subscription_status === 'past_due'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {billingData.subscription_status === 'active' ? 'Active' :
                 billingData.subscription_status === 'trialing' ? 'Trialing' :
                 billingData.subscription_status === 'past_due' ? 'Past Due' :
                 billingData.subscription_status === 'canceled' ? 'Canceled' :
                 billingData.subscription_status === 'incomplete' ? 'Incomplete' :
                 billingData.subscription_status}
              </span>
            )}
          </div>
          {billingData.plan === 'plus' && billingData.billing_mode === 'standard' && (
            <p className="text-xs text-gray-600">$80/month</p>
          )}
          {billingData.plan === 'pro' && billingData.billing_mode === 'standard' && (
            <p className="text-xs text-gray-600">$20/month</p>
          )}
          {billingData.plan === 'hobby' && (
            <p className="text-xs text-gray-600">Free plan</p>
          )}
          {billingData.stripe_subscription_id && (
            <p className="text-xs text-gray-500">
              Subscription ID: {billingData.stripe_subscription_id.substring(0, 20)}...
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-gray-200">
            {onChangePlanClick ? (
              <button
                onClick={onChangePlanClick}
                className="text-xs text-gold-600 hover:text-gold-700 transition-colors"
              >
                Change Plan
              </button>
            ) : (
              <button
                onClick={() => {
                  // Open account modal with billing tab to show change plan
                  window.location.href = '/?modal=account&tab=billing';
                }}
                className="text-xs text-gold-600 hover:text-gold-700 transition-colors"
              >
                Change Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">
          Need help with billing? <Link href="/contact" className="text-gray-900 font-medium hover:underline">Contact our team</Link> for assistance.
        </p>
      </div>

      {/* Subscriptions & Billing Section */}
      {billingData.hasCustomer && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1.5">Subscriptions & Billing</h3>
              <p className="text-xs text-gray-600">
                Access the Stripe Customer Portal to manage your subscription, update payment methods, view billing history and invoices, 
                update your billing address, and cancel or modify your subscription. All payment methods are securely managed through Stripe.
              </p>
            </div>
            <button
              onClick={openCustomerPortal}
              disabled={portalLoading}
              className="flex items-center gap-1.5 px-[10px] py-[10px] bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {portalLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Opening...
                </>
              ) : (
                <>
                  Manage Subscriptions
                  <ArrowRightIcon className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

