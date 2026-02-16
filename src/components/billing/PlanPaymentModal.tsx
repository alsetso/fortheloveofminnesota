'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon, InformationCircleIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

type PlanDirection = 'upgrade' | 'downgrade' | 'new' | 'current';

interface PlanPaymentModalProps {
  planSlug: string;
  isOpen: boolean;
  onClose: () => void;
  account: any;
  initialPlan?: any;
  currentPlanSlug?: string | null;
  subscriptionStatus?: string | null;
  allPlans?: BillingPlan[];
}

function getPlanDirection(
  targetSlug: string,
  currentSlug: string | null | undefined,
  subscriptionStatus: string | null | undefined,
  allPlans: BillingPlan[],
): PlanDirection {
  if (!currentSlug || !subscriptionStatus || !['active', 'trialing'].includes(subscriptionStatus)) {
    return 'new';
  }
  if (targetSlug.toLowerCase() === currentSlug.toLowerCase()) return 'current';

  const current = allPlans.find((p) => p.slug.toLowerCase() === currentSlug.toLowerCase());
  const target = allPlans.find((p) => p.slug.toLowerCase() === targetSlug.toLowerCase());
  if (!current || !target) return 'new';

  return target.display_order > current.display_order ? 'upgrade' : 'downgrade';
}

export default function PlanPaymentModal({
  planSlug,
  isOpen,
  onClose,
  account,
  initialPlan,
  currentPlanSlug,
  subscriptionStatus,
  allPlans = [],
}: PlanPaymentModalProps) {
  const [plan, setPlan] = useState<BillingPlan | null>(initialPlan || null);
  const [features, setFeatures] = useState<(BillingFeature & { limit_value?: number | null; limit_type?: string | null })[]>(
    initialPlan ? (initialPlan.features || []).filter((f: any) => !f.isInherited) : []
  );
  const [loading, setLoading] = useState(!initialPlan);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [processing, setProcessing] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'canceled' | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [cardLast4, setCardLast4] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);

  const direction = plan
    ? getPlanDirection(plan.slug, currentPlanSlug, subscriptionStatus, allPlans)
    : 'new';

  const hasActiveSubscription = direction === 'upgrade' || direction === 'downgrade';
  const hasStripeCustomer = !!account?.stripe_customer_id;
  const canOneClick = hasActiveSubscription || (direction === 'new' && hasStripeCustomer);

  useEffect(() => {
    if (!isOpen || !hasStripeCustomer) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/billing/payment-methods');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const defaultCard = data.paymentMethods?.find((pm: any) => pm.isDefault) || data.paymentMethods?.[0];
        if (defaultCard && !cancelled) {
          setCardLast4(defaultCard.last4);
          setCardBrand(defaultCard.brand);
        }
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [isOpen, hasStripeCustomer]);

  useEffect(() => {
    if (!isOpen) return;
    setPlanError(null);

    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('checkout');
    if (status === 'success' || status === 'canceled') {
      setCheckoutStatus(status);
    } else {
      setCheckoutStatus(null);
    }

    if (planSlug) {
      if (initialPlan && initialPlan.slug.toLowerCase() === planSlug.toLowerCase()) {
        setPlan(initialPlan);
        const directFeatures = (initialPlan.features || []).filter((f: any) => !f.isInherited);
        setFeatures(directFeatures);
        setLoading(false);
      } else {
        fetchPlanDetails();
      }
    } else {
      setPlanError('No plan specified');
      setLoading(false);
    }
  }, [isOpen, planSlug, initialPlan]);

  const fetchPlanDetails = async () => {
    setLoading(true);
    setPlanError(null);
    try {
      const response = await fetch('/api/billing/plans');
      if (response.ok) {
        const data = await response.json();
        const foundPlan = data.plans?.find((p: any) => p.slug.toLowerCase() === planSlug.toLowerCase());
        if (foundPlan && foundPlan.is_active) {
          setPlan(foundPlan);
          const directFeatures = (foundPlan.features || []).filter((f: any) => !f.isInherited);
          setFeatures(directFeatures);
        } else {
          setPlanError('Plan not found or no longer available');
          setPlan(null);
        }
      } else {
        setPlanError('Failed to load plan details');
      }
    } catch (error) {
      console.error('Error fetching plan details:', error);
      setPlanError('Error loading plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && planSlug) {
      setCheckoutStatus(null);
      setSelectedPeriod('monthly');
      setProcessing(false);
    }
  }, [planSlug, isOpen]);

  const handleCheckout = async () => {
    if (!plan) return;

    if (!account) {
      const returnUrl = `/billing?plan=${plan.slug}`;
      window.location.href = `/?redirect=${encodeURIComponent(returnUrl)}&message=${encodeURIComponent('Please sign in to continue with your purchase')}`;
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.slug,
          period: selectedPeriod,
          returnUrl: `/settings/plans`,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        if (url) window.location.href = url;
      } else {
        const error = await response.json();
        setPlanError(error.error || 'Failed to start checkout. Please try again.');
      }
    } catch {
      setPlanError('Network error. Please check your connection and try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleChangePlan = async () => {
    if (!plan) return;

    setProcessing(true);
    setPlanError(null);
    try {
      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.slug,
          period: selectedPeriod,
        }),
      });

      if (response.ok) {
        setCheckoutStatus('success');
      } else {
        const error = await response.json();
        if (error.error === 'no_payment_method') {
          await handleCheckout();
          return;
        }
        setPlanError(error.error || error.message || 'Failed to change plan. Please try again.');
      }
    } catch {
      setPlanError('Network error. Please check your connection and try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Loading spinner (not open yet)
  if (!isOpen) {
    if (loading) {
      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl p-6">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-border-muted border-t-foreground" />
              <p className="mt-3 text-sm text-foreground-muted">Loading plan details...</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Error state
  if (planError || (!plan && !loading)) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl p-6">
          <div className="text-center space-y-4">
            <p className="text-sm font-semibold text-foreground">{planError || 'Plan not found'}</p>
            <p className="text-xs text-foreground-muted">The selected plan is no longer available.</p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-foreground text-surface font-semibold rounded-lg hover:opacity-90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const monthlyPrice = plan.price_monthly_cents / 100;
  const yearlyPrice = plan.price_yearly_cents ? plan.price_yearly_cents / 100 : null;
  const yearlyMonthlyEquivalent = yearlyPrice ? yearlyPrice / 12 : null;

  const isFreePlan = plan.price_monthly_cents === 0 &&
    !plan.stripe_price_id_monthly &&
    (!plan.price_yearly_cents || plan.price_yearly_cents === 0) &&
    !plan.stripe_price_id_yearly;

  const formatPrice = (cents: number) => `$${cents.toFixed(2)}`;

  const formatFeatureLimit = (feature: any) => {
    if (!feature.limit_type || feature.limit_type === 'boolean') return feature.name;
    if (feature.limit_type === 'unlimited') return `Unlimited ${feature.name}`;
    if (feature.limit_type === 'count' && feature.limit_value !== null) return `${feature.limit_value} ${feature.name}`;
    if (feature.limit_type === 'storage_mb' && feature.limit_value !== null) {
      const gb = feature.limit_value >= 1000 ? (feature.limit_value / 1000).toFixed(1) : null;
      return gb ? `${gb}GB ${feature.name}` : `${feature.limit_value}MB ${feature.name}`;
    }
    return feature.name;
  };

  const directionLabel = direction === 'upgrade' ? 'Upgrade' : direction === 'downgrade' ? 'Downgrade' : null;
  const DirectionIcon = direction === 'upgrade' ? ArrowUpIcon : direction === 'downgrade' ? ArrowDownIcon : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-muted dark:border-white/10">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="For the Love of Minnesota" className="h-6 w-auto" />
            <span className="text-sm font-semibold text-foreground">
              {directionLabel ? `${directionLabel} Plan` : 'Plan Details'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-accent transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status messages */}
          {checkoutStatus === 'success' && (
            <div className="p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-md">
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-green-900 dark:text-green-300">
                    {hasActiveSubscription ? 'Plan Changed' : 'Subscription Activated'}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400/80 mt-0.5">
                    {hasActiveSubscription
                      ? `You've been switched to ${plan.name}. Changes take effect immediately.`
                      : 'Your plan has been successfully updated.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {checkoutStatus === 'canceled' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-md">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">Payment Canceled</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400/80 mt-0.5">You can try again when ready.</p>
                </div>
              </div>
            </div>
          )}

          {/* Direction badge */}
          {directionLabel && !checkoutStatus && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              direction === 'upgrade'
                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
            }`}>
              {DirectionIcon && <DirectionIcon className="w-3 h-3" />}
              {directionLabel}
            </div>
          )}

          {/* Plan Name */}
          <div>
            <h2 className="text-2xl font-bold text-foreground">{plan.name}</h2>
            {plan.description && (
              <p className="text-sm text-foreground-muted mt-1">{plan.description}</p>
            )}
          </div>

          {/* Annual vs Monthly comparison */}
          {!isFreePlan && yearlyPrice && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">Billing</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('monthly')}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 text-left transition-all ${
                    selectedPeriod === 'monthly'
                      ? 'border-foreground bg-surface-accent dark:bg-white/5'
                      : 'border-border-muted dark:border-white/10 bg-surface'
                  }`}
                >
                  <span className="text-xs font-semibold text-foreground-muted">Monthly</span>
                  <span className="text-lg font-bold text-foreground mt-0.5">{formatPrice(monthlyPrice)}</span>
                  <span className="text-[10px] text-foreground-muted">per month</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('yearly')}
                  className={`relative flex flex-col items-center p-3 rounded-xl border-2 text-left transition-all ${
                    selectedPeriod === 'yearly'
                      ? 'border-foreground bg-surface-accent dark:bg-white/5'
                      : 'border-border-muted dark:border-white/10 bg-surface'
                  }`}
                >
                  {yearlyMonthlyEquivalent != null && monthlyPrice > 0 && yearlyMonthlyEquivalent < monthlyPrice && (
                    <span className="absolute -top-1.5 right-2 px-1.5 py-0.5 rounded-full bg-green-500 text-[10px] font-semibold text-white">
                      Save {Math.round((1 - yearlyMonthlyEquivalent / monthlyPrice) * 100)}%
                    </span>
                  )}
                  <span className="text-xs font-semibold text-foreground-muted">Annual</span>
                  <span className="text-lg font-bold text-foreground mt-0.5">
                    {yearlyMonthlyEquivalent != null ? formatPrice(yearlyMonthlyEquivalent) : formatPrice(yearlyPrice / 12)}
                  </span>
                  <span className="text-[10px] text-foreground-muted">per month</span>
                  <span className="text-[10px] text-foreground-muted/60 mt-0.5">{formatPrice(yearlyPrice)}/yr</span>
                </button>
              </div>
            </div>
          )}

          {!isFreePlan && !yearlyPrice && (
            <div className="flex gap-2 p-1 bg-surface-accent dark:bg-white/5 rounded-lg">
              <span className="flex-1 px-4 py-2 text-sm font-semibold text-foreground">
                {formatPrice(monthlyPrice)}/month
              </span>
            </div>
          )}

          {/* Price summary */}
          {isFreePlan ? (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">Free</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {selectedPeriod === 'yearly' && yearlyMonthlyEquivalent != null
                  ? formatPrice(yearlyMonthlyEquivalent)
                  : formatPrice(monthlyPrice)}
              </span>
              <span className="text-sm text-foreground-muted">/month</span>
              {selectedPeriod === 'yearly' && yearlyPrice && (
                <span className="text-xs text-foreground-muted/70">({formatPrice(yearlyPrice)} billed annually)</span>
              )}
            </div>
          )}

          {/* Features */}
          {features.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Features</h3>
              <div className="space-y-2">
                {features.map((feature) => (
                  <div key={feature.id} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0">&#10003;</span>
                    <div className="flex-1">
                      <span className="text-foreground-muted">{formatFeatureLimit(feature)}</span>
                      {feature.category && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-accent dark:bg-white/5 text-foreground-muted capitalize">
                          {feature.category}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-muted dark:border-white/10 bg-surface-accent/50 dark:bg-white/[0.02] space-y-3">
          {checkoutStatus === 'success' ? (
            <button
              onClick={() => {
                onClose();
                window.location.reload();
              }}
              className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          ) : isFreePlan ? (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-foreground">It's Free Forever</p>
                <p className="text-[10px] text-foreground-muted">Features and permissions may change</p>
              </div>
              {!account && (
                <button
                  onClick={() => {
                    const returnUrl = `/billing?plan=${plan.slug}`;
                    window.location.href = `/?redirect=${encodeURIComponent(returnUrl)}&message=${encodeURIComponent('Please sign in to activate your free plan')}`;
                  }}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign In to Activate
                </button>
              )}
            </>
          ) : !account ? (
            <>
              <button
                onClick={() => {
                  const returnUrl = `/billing?plan=${plan.slug}`;
                  window.location.href = `/?redirect=${encodeURIComponent(returnUrl)}&message=${encodeURIComponent('Please sign in to continue with your purchase')}`;
                }}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In to Continue
              </button>
              <p className="text-xs text-foreground-muted text-center">You need to sign in to purchase a plan</p>
            </>
          ) : canOneClick ? (
            <>
              <button
                onClick={handleChangePlan}
                disabled={processing}
                className={`w-full py-3 px-4 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  direction === 'downgrade'
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {processing
                  ? 'Processing...'
                  : hasActiveSubscription
                    ? `Confirm ${directionLabel}`
                    : `Subscribe to ${plan.name}`}
              </button>
              <p className="text-xs text-foreground-muted text-center">
                {hasActiveSubscription
                  ? direction === 'upgrade'
                    ? 'You\'ll be charged the prorated difference immediately'
                    : 'You\'ll receive a prorated credit on your next invoice'
                  : cardLast4
                    ? `Using your ${cardBrand || 'card'} ending in ${cardLast4}`
                    : 'Using your card on file'}
              </p>
              {!hasActiveSubscription && plan.slug === 'contributor' && (
                <p className="text-xs text-blue-600 dark:text-blue-400 text-center font-medium">
                  Includes a 7-day free trial
                </p>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleCheckout}
                disabled={processing || !account}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Continue to Payment'}
              </button>
              <p className="text-xs text-foreground-muted text-center">
                You'll be redirected to complete your payment securely
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
