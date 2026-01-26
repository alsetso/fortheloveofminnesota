'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

interface PlanPaymentModalProps {
  planSlug: string;
  isOpen: boolean;
  onClose: () => void;
  account: any;
  initialPlan?: any;
}

export default function PlanPaymentModal({ planSlug, isOpen, onClose, account, initialPlan }: PlanPaymentModalProps) {
  const [plan, setPlan] = useState<BillingPlan | null>(initialPlan || null);
  const [features, setFeatures] = useState<(BillingFeature & { limit_value?: number | null; limit_type?: string | null })[]>(
    initialPlan ? (initialPlan.features || []).filter((f: any) => !f.isInherited) : []
  );
  const [loading, setLoading] = useState(!initialPlan);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [processing, setProcessing] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'canceled' | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Reset error state
    setPlanError(null);
    
    // Check for checkout status in URL first
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('checkout');
    if (status === 'success' || status === 'canceled') {
      setCheckoutStatus(status);
    } else {
      setCheckoutStatus(null);
    }
    
    // Load plan data
    if (planSlug) {
      // If we have initial plan and it matches, use it
      if (initialPlan && initialPlan.slug.toLowerCase() === planSlug.toLowerCase()) {
        setPlan(initialPlan);
        const directFeatures = (initialPlan.features || []).filter((f: any) => !f.isInherited);
        setFeatures(directFeatures);
        setLoading(false);
      } else {
        // Fetch new plan data (plan changed or no initial data)
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
          // Show only direct features (non-inherited) for the payment modal
          // These are the features unique to this plan
          const directFeatures = (foundPlan.features || []).filter((f: any) => !f.isInherited);
          setFeatures(directFeatures);
        } else {
          // Plan not found or inactive - security validation
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

  // Reset state when plan slug changes (user switches plans)
  useEffect(() => {
    if (isOpen && planSlug) {
      // Reset checkout status when switching plans
      setCheckoutStatus(null);
      setSelectedPeriod('monthly');
      setProcessing(false);
    }
  }, [planSlug, isOpen]);

  const handleContinue = async () => {
    if (!plan) return;
    
    // Security check: Ensure user is authenticated
    if (!account) {
      // Redirect to sign in with return URL preserving plan parameter
      const returnUrl = `/billing?plan=${plan.slug}`;
      window.location.href = `/?redirect=${encodeURIComponent(returnUrl)}&message=${encodeURIComponent('Please sign in to continue with your purchase')}`;
      return;
    }
    
    setProcessing(true);
    try {
      const billingPeriod = selectedPeriod === 'monthly' ? 'monthly' : 'yearly';

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: plan.slug,
          period: billingPeriod,
          returnUrl: `/billing?plan=${plan.slug}`,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        }
      } else {
        const error = await response.json();
        console.error('Failed to create checkout session:', error);
        setPlanError(error.error || 'Failed to start checkout. Please try again.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setPlanError('Network error. Please check your connection and try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) {
    if (loading) {
      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
              <p className="mt-3 text-sm text-gray-500">Loading plan details...</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Show error state if plan not found or invalid
  if (planError || (!plan && !loading)) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6">
          <div className="text-center space-y-4">
            <p className="text-sm font-semibold text-gray-900">{planError || 'Plan not found'}</p>
            <p className="text-xs text-gray-600">The selected plan is no longer available.</p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
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
  const currentPrice = selectedPeriod === 'monthly' ? monthlyPrice : (yearlyPrice || monthlyPrice);
  
  // Check if plan is free (no payment required)
  const isFreePlan = plan.price_monthly_cents === 0 && 
                     !plan.stripe_price_id_monthly && 
                     (!plan.price_yearly_cents || plan.price_yearly_cents === 0) &&
                     !plan.stripe_price_id_yearly;

  const formatPrice = (cents: number) => {
    return `$${cents.toFixed(2)}`;
  };

  const formatFeatureLimit = (feature: any) => {
    if (!feature.limit_type || feature.limit_type === 'boolean') {
      return feature.name;
    }
    if (feature.limit_type === 'unlimited') {
      return `Unlimited ${feature.name}`;
    }
    if (feature.limit_type === 'count' && feature.limit_value !== null) {
      return `${feature.limit_value} ${feature.name}`;
    }
    if (feature.limit_type === 'storage_mb' && feature.limit_value !== null) {
      const gb = feature.limit_value >= 1000 ? (feature.limit_value / 1000).toFixed(1) : null;
      return gb ? `${gb}GB ${feature.name}` : `${feature.limit_value}MB ${feature.name}`;
    }
    return feature.name;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="For the Love of Minnesota" 
              className="h-6 w-auto"
            />
            <span className="text-sm font-semibold text-gray-900">Plan Details</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Checkout Status Messages */}
          {checkoutStatus === 'success' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-green-900">Subscription Activated</p>
                  <p className="text-xs text-green-700 mt-0.5">Your plan has been successfully updated.</p>
                </div>
              </div>
            </div>
          )}
          
          {checkoutStatus === 'canceled' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-900">Payment Canceled</p>
                  <p className="text-xs text-blue-700 mt-0.5">You can try again when ready.</p>
                </div>
              </div>
            </div>
          )}

          {/* Plan Name */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
            {plan.description && (
              <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
            )}
          </div>

          {/* Payment Period Selection - Only show for paid plans */}
          {!isFreePlan && yearlyPrice && (
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setSelectedPeriod('monthly')}
                className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  selectedPeriod === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedPeriod('yearly')}
                className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  selectedPeriod === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                Yearly
              </button>
            </div>
          )}

          {/* Price Display */}
          <div className="space-y-2">
            {isFreePlan ? (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">Free</span>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {selectedPeriod === 'yearly' && yearlyMonthlyEquivalent 
                      ? formatPrice(yearlyMonthlyEquivalent)
                      : formatPrice(currentPrice)}
                  </span>
                  <span className="text-sm text-gray-600">
                    /month
                  </span>
                </div>
                {selectedPeriod === 'yearly' && yearlyPrice && (
                  <p className="text-xs text-gray-500">
                    {formatPrice(yearlyPrice)} per year, billed annually
                  </p>
                )}
              </>
            )}
          </div>

          {/* Features List */}
          {features.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Features</h3>
              <div className="space-y-2">
                {features.map((feature) => (
                  <div key={feature.id} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    <div className="flex-1">
                      <span className="text-gray-700">
                        {formatFeatureLimit(feature)}
                      </span>
                      {feature.category && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">
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
        <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
          {checkoutStatus === 'success' ? (
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          ) : isFreePlan ? (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-gray-900">It's Free Forever</p>
                <p className="text-[10px] text-gray-500">
                  Features and permissions may change
                </p>
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
              <p className="text-xs text-gray-500 text-center">
                You need to sign in to purchase a plan
              </p>
            </>
          ) : (
            <>
              <button
                onClick={handleContinue}
                disabled={processing || !account}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Continue to Payment'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                You'll be redirected to complete your payment securely
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
