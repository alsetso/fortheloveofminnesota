'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  XCircleIcon
} from '@heroicons/react/24/outline';
import type { Account } from '@/features/auth';
import type { User } from '@supabase/supabase-js';
import ProPaymentForm from './ProPaymentForm';
import ComingSoonScreen from './ComingSoonScreen';
import BusinessSetupForm from './BusinessSetupForm';
import GovernmentSetupForm from './GovernmentSetupForm';

type PlanTab = 'contributor' | 'business' | 'government';

interface PaymentScreenProps {
  plan: PlanTab;
  account: Account | null;
  user: User | null;
  onBack: () => void;
}

export default function PaymentScreen({ plan, account, user, onBack }: PaymentScreenProps) {
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(account?.stripe_customer_id || null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [hasPriceId, setHasPriceId] = useState<boolean | null>(null);
  const [customerFetched, setCustomerFetched] = useState(false);

  // Check if plan has a price ID configured
  useEffect(() => {
    const checkPriceId = async () => {
      try {
        // Check with API which plans have price IDs configured
        const response = await fetch(`/api/billing/check-price-id?plan=${plan}`);
        if (response.ok) {
          const data = await response.json();
          setHasPriceId(data.hasPriceId);
        } else {
          // Default: Contributor has price ID, others don't
          setHasPriceId(plan === 'contributor');
        }
      } catch (error) {
        console.error('Error checking price ID:', error);
        // Default: Contributor has price ID, others don't
        setHasPriceId(plan === 'contributor');
      }
    };

    checkPriceId();
  }, [plan]);

  const getPlanName = (plan: PlanTab) => {
    switch (plan) {
      case 'contributor': return 'Contributor';
      case 'business': return 'Business';
      case 'government': return 'Government';
    }
  };

  const contributorFeatures = [
    { emoji: '⭐', label: 'Gold Profile Border' },
    { emoji: '🗺️', label: 'Unlimited Custom Maps' },
    { emoji: '📊', label: 'Visitor Analytics' },
    { emoji: '⏰', label: 'All-Time Historical Data' },
    { emoji: '📝', label: 'Extended Text (1,000 chars)' },
    { emoji: '🎥', label: 'Add Videos' },
    { emoji: '📁', label: 'Unlimited Collections' },
  ];

  // If no price ID, show appropriate screen
  if (hasPriceId === false) {
    if (plan === 'business') {
      return <BusinessSetupForm onBack={onBack} />;
    }
    if (plan === 'government') {
      return <GovernmentSetupForm onBack={onBack} />;
    }
    // For contributor, if no price ID, show coming soon (shouldn't happen in production)
    if (plan === 'contributor') {
      return <ComingSoonScreen plan="business" onBack={onBack} />;
    }
    return <ComingSoonScreen plan={plan as 'business' | 'government'} onBack={onBack} />;
  }

  // For Contributor, show payment form
  return (
    <>
    <div className="max-w-[600px] mx-auto px-4 py-6 space-y-6 pb-20">
      {/* Header with Back Button and Account Status */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          Back to Plans
        </button>
        {plan === 'contributor' && (
          <div className="flex items-center gap-2">
            {loadingCustomer ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-gray-400 border-t-gray-700 rounded-full animate-spin"></div>
                <span className="text-xs text-gray-500 font-medium">Checking...</span>
              </div>
            ) : stripeCustomerId ? (
              <div className="flex items-center gap-2 text-gray-700">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Payment Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <XCircleIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Not Set Up</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold mb-1 text-gray-900">Complete Your {getPlanName(plan)} Upgrade</h1>
        <p className="text-xs text-gray-500">
          Add your payment method to proceed with your subscription.
        </p>
      </div>

      {/* Stripe Customer ID Status - Only show if no customer ID */}
      {!stripeCustomerId && (
        <div className="py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-600">Payment Account Status</h3>
            {loadingCustomer ? (
              <div className="w-3 h-3 border border-gray-400 border-t-gray-700 rounded-full animate-spin"></div>
            ) : (
              <button
                onClick={() => {
                  if (user && account && !customerFetched) {
                    setCustomerFetched(true);
                    setLoadingCustomer(true);
                    fetch('/api/billing/ensure-customer', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                    })
                      .then(res => res.json())
                      .then(data => {
                        if (data.customerId) {
                          setStripeCustomerId(data.customerId);
                        }
                      })
                      .catch(err => console.error('Error fetching customer:', err))
                      .finally(() => setLoadingCustomer(false));
                  }
                }}
                className="text-xs text-gray-700 hover:text-gray-900 underline"
              >
                Set Up Payments
              </button>
            )}
          </div>
        </div>
      )}

      {/* What's Included - Only show for Contributor */}
      {plan === 'contributor' && (
        <>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">What's Included</h3>
          <div className="flex flex-wrap gap-2">
            {contributorFeatures.map((feature, index) => {
              return (
                <div key={index} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors">
                  <span className="text-xs">{feature.emoji}</span>
                  <span className="text-xs text-gray-700">{feature.label}</span>
                </div>
              );
            })}
          </div>
          
          {/* Pricing Card - Below What's Included */}
          <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2.5">
            <div className="flex items-baseline gap-1.5">
              <div className="text-2xl font-semibold text-gray-900">$20</div>
              <div className="text-xs text-gray-500">/month</div>
            </div>
          </div>
        </>
      )}

      {/* Payment Form */}
      {user ? (
        <ProPaymentForm
          stripeCustomerId={stripeCustomerId}
          onSuccess={() => {
            // Refresh page or show success message
            window.location.reload();
          }}
        />
      ) : (
        <div className="p-6 text-center">
          <p className="text-sm text-gray-600 mb-4">Please sign in to continue with payment</p>
          <button
            onClick={() => window.location.href = '/?signin=true'}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Sign In
          </button>
        </div>
      )}
    </div>
    
    {/* Floating Terms Footer */}
    <footer className="fixed bottom-0 left-0 right-0 w-screen bg-transparent border-t border-gray-200 h-10 z-50">
      <div className="w-full h-full flex items-center justify-between px-4">
        <div className="text-xs text-gray-500">
          All payments are final
        </div>
        <div className="text-xs text-gray-500">
          <a href="/terms" className="hover:text-gray-700 transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
    </>
  );
}
