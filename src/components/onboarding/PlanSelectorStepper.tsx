'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import confetti from 'canvas-confetti';
import Image from 'next/image';
import type { Account } from '@/features/auth';
import { useAuthStateSafe } from '@/features/auth';

type PlanWithFeatures = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  price_monthly_cents: number;
  features: Array<{
    id: string;
    name: string;
    emoji: string | null;
    isInherited: boolean;
    limit_value?: number | null;
    limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  }>;
};

interface PlanSelectorStepperProps {
  account: Account | null;
  plans: PlanWithFeatures[];
  plansLoading: boolean;
  onBillingSetup: () => Promise<void>;
  ensureCustomerLoading: boolean;
  ensureCustomerError: string | null;
  onComplete: () => void;
  refreshAccount: (() => Promise<void>) | null;
  onSubStepChange?: (subStep: number, stepName: string) => void;
}

const cardElementOptions = {
  style: {
    base: {
      fontSize: '13px',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: 'transparent',
      '::placeholder': {
        color: '#9CA3AF',
        fontSize: '13px',
      },
    },
    invalid: {
      color: '#ef4444',
    },
  },
};

export default function PlanSelectorStepper({
  account,
  plans,
  plansLoading,
  onBillingSetup,
  ensureCustomerLoading,
  ensureCustomerError,
  onComplete,
  refreshAccount,
  onSubStepChange,
}: PlanSelectorStepperProps) {
  const { signOut } = useAuthStateSafe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripe = useStripe();
  const elements = useElements();
  
  // Check URL param for substep (e.g., ?substep=3)
  const urlSubstep = searchParams.get('substep');
  const parsedSubstep = urlSubstep ? parseInt(urlSubstep, 10) : null;
  // Only allow valid substeps (1-4), default to 1
  const initialSubStep: 1 | 2 | 3 | 4 = (parsedSubstep && parsedSubstep >= 1 && parsedSubstep <= 4) 
    ? parsedSubstep as 1 | 2 | 3 | 4 
    : 1;
  const [currentSubStep, setCurrentSubStep] = useState<1 | 2 | 3 | 4>(initialSubStep);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string>('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string>('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Helper to update URL when substep changes - preserves existing query params
  const updateSubStepUrl = (substep: 1 | 2 | 3 | 4) => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('step', 'plans');
    currentUrl.searchParams.set('substep', substep.toString());
    router.replace(currentUrl.pathname + currentUrl.search, { scroll: false });
  };

  // Check for checkout return status in URL params
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success') {
      setCheckoutSuccess(true);
      // Clean up URL param
      const newUrl = window.location.pathname + window.location.search.replace(/[?&]checkout=success/, '').replace(/[?&]checkout=canceled/, '');
      window.history.replaceState({}, '', newUrl);
    } else if (checkoutStatus === 'canceled') {
      setCheckoutSuccess(false);
      // Clean up URL param
      const newUrl = window.location.pathname + window.location.search.replace(/[?&]checkout=canceled/, '').replace(/[?&]checkout=success/, '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  // Handle checkout button click
  const handleCheckout = async () => {
    if (!account?.stripe_customer_id || !selectedPlanSlug || selectedPlanSlug === 'hobby') {
      setSubscriptionError('Please select a plan and ensure billing is set up');
      return;
    }

    setIsProcessingCheckout(true);
    setSubscriptionError('');

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlanSlug,
          period: 'monthly',
          returnUrl: '/onboarding?step=plans&substep=3',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        // Signal intentional navigation to prevent browser warning
        window.dispatchEvent(new Event('intentional-navigation'));
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setSubscriptionError(err instanceof Error ? err.message : 'Failed to start checkout. Please try again.');
      setIsProcessingCheckout(false);
    }
  };

  // Show confetti immediately when returning from Stripe checkout success
  useEffect(() => {
    if (checkoutSuccess) {
      // Trigger confetti animation immediately on checkout success
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
        });
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6, x: 0.3 },
        });
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6, x: 0.7 },
        });
      }, 300);
    }
  }, [checkoutSuccess]);

  // Show confetti again when both payment success and terms agreed (for continue button)
  useEffect(() => {
    if (checkoutSuccess && termsAgreed && !showConfetti) {
      setShowConfetti(true);
      // Trigger confetti animation
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6, x: 0.5 },
        });
      }, 100);
    }
  }, [checkoutSuccess, termsAgreed, showConfetti]);

  // Step name mapping for substeps
  const stepNames: Record<number, string> = {
    1: 'Customer account',
    2: 'Select a plan',
    3: 'Agree and continue',
  };

  // Report substep changes to parent - only when substep actually changes
  const previousSubStepRef = useRef<number | null>(null);
  useEffect(() => {
    // Only call if substep changed and is valid
    if (
      onSubStepChange && 
      currentSubStep <= 3 && 
      previousSubStepRef.current !== currentSubStep
    ) {
      previousSubStepRef.current = currentSubStep;
      onSubStepChange(currentSubStep, stepNames[currentSubStep]);
    }
  }, [currentSubStep, onSubStepChange]);

  // Auto-advance to step 2 when customer account is set up
  useEffect(() => {
    if (currentSubStep === 1 && account?.stripe_customer_id) {
      setCurrentSubStep(2);
      updateSubStepUrl(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSubStep, account?.stripe_customer_id]);

  // Helper component to render account header
  const renderAccountHeader = () => {
    if (!account?.image_url || !account?.username) return null;
    
    const handleSignOut = async () => {
      try {
        await signOut();
        router.replace('/');
      } catch (error) {
        console.error('Sign out error:', error);
      }
    };
    
    return (
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-neutral-700/50">
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <Image
              src={account.image_url}
              alt={account.username}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <span className="text-xs font-medium text-neutral-300 truncate">@{account.username}</span>
        </div>
        {currentSubStep === 2 && (
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-red-500 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    );
  };

  // Step 1: Setup Billing
  if (currentSubStep === 1) {
    const step1Confirmed = !!account?.stripe_customer_id;
    return (
      <div className="space-y-4">
        {renderAccountHeader()}
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`flex items-center justify-center w-7 h-7 rounded-full bg-transparent border text-xs font-bold transition-colors ${
            step1Confirmed 
              ? 'border-green-500 text-green-400' 
              : 'border-white text-white'
          }`}>1</span>
          <h3 className={`text-sm font-semibold transition-colors ${
            step1Confirmed ? 'text-neutral-500' : 'text-white'
          }`}>Setup customer account</h3>
        </div>
        
        {ensureCustomerLoading && (
          <div className="flex items-center gap-2.5 text-neutral-300 justify-center py-4">
            <div className="w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
            <p className="text-xs font-medium">Setting up a customer account...</p>
          </div>
        )}
        
        {ensureCustomerError && (
          <div className="rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-4 py-3 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
            <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{ensureCustomerError}</span>
          </div>
        )}
        
        {!account?.stripe_customer_id && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-400 text-center leading-relaxed">
              A customer account is required to continue.
            </p>
            <button
              type="button"
              onClick={onBillingSetup}
              disabled={ensureCustomerLoading}
              className="w-full px-4 py-3 border border-neutral-700 rounded-lg text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {ensureCustomerLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Setting up...
                </span>
              ) : (
                'Set up customer account'
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Helper component to render completed steps
  const renderCompletedStep = (stepNumber: number, stepTitle: string, onGoBack?: () => void) => (
    <div className="flex items-center gap-2.5 mb-2">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-transparent border border-green-500 text-green-400 text-xs font-bold">
        {stepNumber}
      </div>
      <div className="flex items-center gap-2 flex-1">
        <h3 className="text-sm font-semibold text-neutral-500">{stepTitle}</h3>
        {onGoBack && (
          <button
            type="button"
            onClick={onGoBack}
            className="text-xs text-neutral-400 hover:text-neutral-300 underline transition-colors"
          >
            Go back
          </button>
        )}
      </div>
    </div>
  );

  // Step 2: Select Plan (cards only)
  if (currentSubStep === 2) {
    // Require billing to be set up before proceeding
    if (!account?.stripe_customer_id) {
      return (
        <div className="space-y-3">
          {renderAccountHeader()}
          <div className="flex items-center gap-2.5 mb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-transparent border border-white text-white text-xs font-bold">2</span>
            <h3 className="text-sm font-semibold text-white">Select a plan</h3>
          </div>
          <div className="rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-4 py-3 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
            <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">Customer account must be set up first. Please complete step 1.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentSubStep(1);
              updateSubStepUrl(1);
            }}
            className="w-full px-4 py-3 border border-neutral-700 rounded-lg text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-all shadow-sm"
          >
            Go back to step 1
          </button>
        </div>
      );
    }

    const handlePlanSelect = (planSlug: string | null) => {
      setSelectedPlanSlug(planSlug);
      setCardError('');
      setSubscriptionError('');
    };

    const step1Confirmed = !!account?.stripe_customer_id;
    const step2Confirmed = !!selectedPlanSlug;
    const isAdmin = account?.role === 'admin';
    
    return (
      <div className="flex flex-col min-h-0 max-h-full">
        <div className="flex-shrink-0 space-y-4 mb-4">
          {renderAccountHeader()}
          {/* Show completed step 1 */}
          {step1Confirmed && renderCompletedStep(1, 'Setup customer account')}
          
          <div className="flex items-center gap-2.5 mb-3">
            <span className={`flex items-center justify-center w-7 h-7 rounded-full bg-transparent border text-xs font-bold transition-colors ${
              step2Confirmed 
                ? 'border-green-500 text-green-400' 
                : 'border-white text-white'
            }`}>2</span>
            <h3 className={`text-sm font-semibold transition-colors ${
              step2Confirmed ? 'text-neutral-500' : 'text-white'
            }`}>Select a plan</h3>
          </div>
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide space-y-4 pr-1 -mr-1">

        {/* For non-admin users: Show "coming soon" banner and hide plans */}
        {!isAdmin ? (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-[#007AFF]/40 bg-gradient-to-br from-[#007AFF]/15 to-[#007AFF]/5 backdrop-blur-sm px-5 py-5 space-y-3 shadow-lg shadow-[#007AFF]/10">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#007AFF]/20 border-2 border-[#007AFF]/40">
                  <CheckCircleIcon className="w-6 h-6 text-[#007AFF]" />
                </div>
                <div className="space-y-1.5 text-center">
                  <h4 className="text-sm font-bold text-white">Check back soon</h4>
                  <p className="text-xs text-neutral-300 leading-relaxed max-w-sm">
                    We are working on the For the Love of Minnesota website right now.
                  </p>
                  <a 
                    href="mailto:loveofminnesota@gmail.com"
                    className="inline-block mt-2 text-xs text-[#007AFF] hover:text-[#0066D6] underline transition-colors"
                  >
                    loveofminnesota@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* For admin users: Show full plans functionality */
          <>
            {plansLoading ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-neutral-700 rounded-lg p-3 bg-neutral-800/50 animate-pulse h-28" />
                <div className="border border-neutral-700 rounded-lg p-3 bg-neutral-800/50 animate-pulse h-28" />
              </div>
            ) : (
              <>
                {!selectedPlanSlug && (
                  <p className="text-xs text-neutral-400 text-center py-3 leading-relaxed">
                    Select a plan to continue
                  </p>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  {plans.map((plan) => {
                    const priceDisplay =
                      plan.price_monthly_cents === 0
                        ? 'Free'
                        : `$${(plan.price_monthly_cents / 100).toFixed(0)}/mo`;
                    const directFeatures = plan.features.filter((f) => !f.isInherited);
                    const isContributor = plan.slug?.toLowerCase() === 'contributor';
                    const isTesting = plan.slug?.toLowerCase() === 'testing';
                    const hasTrial = isContributor || isTesting; // Both have 7-day free trial
                    const isSelected = selectedPlanSlug === plan.slug?.toLowerCase();
                    
                    return (
                      <div
                        key={plan.id}
                        onClick={() => handlePlanSelect(plan.slug?.toLowerCase() || null)}
                        className={`border-2 rounded-lg p-3 bg-neutral-900 flex flex-col cursor-pointer transition-all relative shadow-sm ${
                          isSelected 
                            ? 'border-[#007AFF] ring-2 ring-[#007AFF]/30 bg-[#007AFF]/5' 
                            : 'border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800/50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#007AFF] rounded-full flex items-center justify-center shadow-lg ring-2 ring-black/20">
                            <CheckCircleIcon className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-1.5">
                          <h3 className="text-xs font-bold text-white leading-tight">{plan.name}</h3>
                          {isTesting && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded text-[9px] font-bold text-yellow-400">
                              TEST
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-neutral-100 mb-2">{priceDisplay}</p>
                        {hasTrial && (
                          <div className="rounded-md border border-neutral-700/50 p-2 bg-neutral-800/70 flex items-center justify-between gap-1.5 mb-2 backdrop-blur-sm">
                            <span className="text-[10px] font-bold text-white">7 Day Free Trial</span>
                            <span className="text-[10px] font-medium text-neutral-300">Due today $0</span>
                          </div>
                        )}
                        {isTesting && (
                          <div className="rounded-md border border-yellow-500/50 p-2 bg-yellow-500/10 flex items-center gap-1.5 mb-2 backdrop-blur-sm">
                            <span className="text-[10px] font-bold text-yellow-400">Admin Testing Plan</span>
                          </div>
                        )}
                        {plan.description && (
                          <p className="text-[10px] text-neutral-400 leading-relaxed mb-2 line-clamp-2">
                            {plan.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-neutral-800">
                          {directFeatures
                            .filter((f) => !f.limit_type || f.limit_type === 'boolean')
                            .slice(0, 4)
                            .map((feature) => (
                              <span
                                key={feature.id}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-neutral-800/70 border border-neutral-700/50 rounded-md text-[10px] text-neutral-200 font-medium"
                              >
                                {feature.emoji && <span>{feature.emoji}</span>}
                                {feature.name}
                              </span>
                            ))}
                          {directFeatures
                            .filter(
                              (f) =>
                                f.limit_type &&
                                f.limit_type !== 'boolean'
                            )
                            .slice(0, 2)
                            .map((feature) => {
                              const label =
                                feature.limit_type === 'unlimited'
                                  ? `Unlimited ${feature.name}`
                                  : feature.limit_type === 'count' && feature.limit_value != null
                                    ? `${feature.limit_value} ${feature.name}`
                                    : feature.limit_type === 'storage_mb' && feature.limit_value != null
                                      ? `${feature.limit_value}MB ${feature.name}`
                                      : feature.name;
                              return (
                                <span
                                  key={feature.id}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-neutral-800/70 border border-neutral-700/50 rounded-md text-[10px] text-neutral-200 font-medium"
                                >
                                  {feature.emoji && <span>{feature.emoji}</span>}
                                  {label}
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Continue Button */}
                {selectedPlanSlug && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSubStep(3);
                      updateSubStepUrl(3);
                    }}
                    className="w-full px-4 py-3 border border-transparent rounded-lg text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] active:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-offset-2 focus:ring-offset-black transition-all shadow-sm mt-4"
                  >
                    Continue
                  </button>
                )}
              </>
            )}
          </>
        )}
        </div>
      </div>
    );
  }

  // Step 3: Payment Method & Terms
  if (currentSubStep === 3) {
    const isAdmin = account?.role === 'admin';
    
    // Block non-admin users from accessing substep 3
    if (!isAdmin) {
      return (
        <div className="space-y-3">
          {renderAccountHeader()}
          <div className="flex items-center gap-2.5 mb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-transparent border border-white text-white text-xs font-bold">3</span>
            <h3 className="text-sm font-semibold text-white">Payment & Terms</h3>
          </div>
          <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/20 backdrop-blur-sm px-4 py-3 text-xs text-yellow-300 flex items-start gap-2.5 shadow-sm">
            <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">Account setup options are coming soon. Please go back to continue.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentSubStep(2);
              updateSubStepUrl(2);
            }}
            className="w-full px-4 py-3 border border-neutral-700 rounded-lg text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-all shadow-sm"
          >
            Go back
          </button>
        </div>
      );
    }
    
    // If redirected here via URL param but no plan selected, go back to step 2
    // This handles the case where user has account setup but needs to select a plan
    if (!selectedPlanSlug) {
      // If account has stripe_customer_id, they've completed step 1, so go to step 2
      if (account?.stripe_customer_id) {
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-transparent border border-white text-white text-xs font-bold">3</span>
              <h3 className="text-sm font-semibold text-white">Payment & Terms</h3>
            </div>
            <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/20 backdrop-blur-sm px-4 py-3 text-xs text-yellow-300 flex items-start gap-2.5 shadow-sm">
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">Please select a plan first to complete billing setup.</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentSubStep(2)}
              className="w-full px-4 py-3 border border-neutral-700 rounded-lg text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-all shadow-sm"
            >
              Go to plan selection
            </button>
          </div>
        );
      }
      
      // Otherwise, require step 1 first
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-transparent border border-white text-white text-xs font-bold">3</span>
            <h3 className="text-sm font-semibold text-white">Payment & Terms</h3>
          </div>
          <div className="rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-4 py-3 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
            <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">Please select a plan first. Go back to step 2.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentSubStep(2);
              updateSubStepUrl(2);
            }}
            className="w-full px-4 py-3 border border-neutral-700 rounded-lg text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black transition-all shadow-sm"
          >
            Go back to step 2
          </button>
        </div>
      );
    }

    const selectedPlan = plans.find(p => p.slug?.toLowerCase() === selectedPlanSlug);
    const isFreePlan = selectedPlan?.price_monthly_cents === 0;

    const handleSubmit = async (e: FormEvent) => {
      e.preventDefault();
      
      if (!selectedPlanSlug) {
        setSubscriptionError('Please select a plan');
        return;
      }

      if (!termsAgreed) {
        setSubscriptionError('Please agree to the terms');
        return;
      }

      // Free plan doesn't need payment
      if (isFreePlan) {
        setCurrentSubStep(4);
        updateSubStepUrl(4);
        return;
      }

      if (!stripe || !elements) {
        setSubscriptionError('Payment system is not ready. Please refresh the page.');
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setSubscriptionError('Card input not found');
        return;
      }

      if (!cardComplete) {
        setSubscriptionError('Please complete your card information');
        return;
      }

      if (!account?.stripe_customer_id) {
        setSubscriptionError('Billing account not set up');
        return;
      }

      setProcessing(true);
      setSubscriptionError('');

      try {
        // Create payment method
        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
        });

        if (pmError || !paymentMethod) {
          throw new Error(pmError?.message || 'Failed to create payment method');
        }

        // Create subscription
        const response = await fetch('/api/billing/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethodId: paymentMethod.id,
            customerId: account.stripe_customer_id,
            plan: selectedPlanSlug,
            period: 'monthly',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create subscription');
        }

        // Handle 3D Secure if needed
        if (data.requiresAction && data.clientSecret) {
          const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret);
          if (confirmError) {
            throw new Error(confirmError.message || 'Payment authentication failed');
          }
        }

        setCurrentSubStep(4);
      } catch (err) {
        setSubscriptionError(err instanceof Error ? err.message : 'Failed to process payment');
      } finally {
        setProcessing(false);
      }
    };

    const step1Confirmed = !!account?.stripe_customer_id;
    const step2Confirmed = !!selectedPlanSlug;
    // Step 3 confirmed when: terms agreed AND (free plan OR checkout success OR card complete)
    const step3Confirmed = termsAgreed && (isFreePlan || checkoutSuccess || cardComplete);
    
    return (
      <div className="space-y-4">
        {renderAccountHeader()}
        {/* Show completed steps */}
        {step1Confirmed && renderCompletedStep(1, 'Setup customer account')}
        {step2Confirmed && renderCompletedStep(2, 'Select a plan', () => {
          setCurrentSubStep(2);
          updateSubStepUrl(2);
        })}
        
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`flex items-center justify-center w-7 h-7 rounded-full bg-transparent border text-xs font-bold transition-colors ${
            step3Confirmed 
              ? 'border-green-500 text-green-400' 
              : 'border-white text-white'
          }`}>3</span>
          <h3 className={`text-sm font-semibold transition-colors ${
            step3Confirmed ? 'text-neutral-500' : 'text-white'
          }`}>Payment & Terms</h3>
        </div>

        {/* Selected Plan Summary */}
        {selectedPlan && (
          <div className="pt-2 pb-3 border-b border-neutral-700 space-y-3">
            <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
              <div>
                <p className="text-xs font-medium text-neutral-400 mb-0.5">Selected plan</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{selectedPlan.name}</span>
                  <span className="text-xs font-semibold text-neutral-300">
                    {isFreePlan ? 'Free' : `$${(selectedPlan.price_monthly_cents / 100).toFixed(0)}/mo`}
                  </span>
                </div>
              </div>
            </div>
            
            {/* One-time offer for Hobby plan users */}
            {isFreePlan && (
              <div className="rounded-lg border-2 border-[#007AFF]/60 bg-[#007AFF]/10 backdrop-blur-sm px-4 py-3 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white mb-1">Try Contributor Free for 7 Days</p>
                    <p className="text-xs text-neutral-300 leading-relaxed mb-2.5">
                      Upgrade to Contributor and get a 7-day free trial. No charge today, cancel anytime.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const contributorPlan = plans.find(p => p.slug?.toLowerCase() === 'contributor');
                        if (contributorPlan) {
                          setSelectedPlanSlug('contributor');
                          // Stay on substep 3, just change the selected plan
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-transparent rounded-lg text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] active:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-offset-2 focus:ring-offset-black transition-all shadow-sm"
                    >
                      Switch to Contributor Plan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Checkout Success Message */}
        {checkoutSuccess && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 flex items-start gap-2.5">
            <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Payment successful!</div>
              <div className="text-[10px] mt-0.5">Your 7-day free trial has started. Please agree to the terms below to continue.</div>
            </div>
          </div>
        )}

        {/* Checkout Button for Contributor Plan and Testing Plan */}
        {/* Show button if: not free plan, checkout not successful, and (plan is contributor/testing OR subscription is canceled) */}
        {!isFreePlan && !checkoutSuccess && ((selectedPlanSlug === 'contributor' || selectedPlanSlug === 'testing') || account?.subscription_status === 'canceled') && (
          <div className="space-y-2.5 mb-4">
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isProcessingCheckout || !account?.stripe_customer_id}
              className="w-full px-4 py-3 border border-transparent rounded-lg text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] active:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isProcessingCheckout ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting checkout...
                </span>
              ) : (
                'Start Free Trial'
              )}
            </button>
            {selectedPlan && (
              <p className="text-xs text-neutral-400 text-center">
                Due today $0 • 7-day free trial, then ${(selectedPlan.price_monthly_cents / 100).toFixed(0)}/month
              </p>
            )}
          </div>
        )}

        {/* Terms Checkbox */}
        <div className={`flex items-start gap-2.5 pt-2 pb-2 border-t ${
          !termsAgreed 
            ? 'border-red-500/40 bg-red-900/5 rounded-lg px-2 py-2.5' 
            : 'border-neutral-700'
        } transition-all`}>
          <input
            type="checkbox"
            id="terms-agreement"
            checked={termsAgreed}
            onChange={(e) => {
              setTermsAgreed(e.target.checked);
              setSubscriptionError('');
            }}
            className="mt-0.5 w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-offset-0 cursor-pointer transition-all"
          />
          <label htmlFor="terms-agreement" className="text-xs text-neutral-300 leading-relaxed cursor-pointer">
            I agree to the{' '}
            <a href="/terms" target="_blank" className="text-[#007AFF] hover:text-[#0066D6] hover:underline font-medium transition-colors" onClick={(e) => e.stopPropagation()}>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" className="text-[#007AFF] hover:text-[#0066D6] hover:underline font-medium transition-colors" onClick={(e) => e.stopPropagation()}>
              Privacy Policy
            </a>
          </label>
        </div>

        {subscriptionError && (
          <div className="rounded-lg border border-red-600/50 bg-red-900/20 backdrop-blur-sm px-4 py-3 text-xs text-red-300 flex items-start gap-2.5 shadow-sm">
            <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{subscriptionError}</span>
          </div>
        )}

        {/* Continue Button - Only show after checkout success or for free plan */}
        {((isFreePlan && termsAgreed) || (checkoutSuccess && termsAgreed)) && (
          <div className="space-y-2.5 pt-1">
            {showConfetti && (
              <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                <CheckCircleIcon className="w-5 h-5" />
                <p className="text-xs font-semibold">All set! Ready to continue</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (isFreePlan) {
                  setCurrentSubStep(4);
                  updateSubStepUrl(4);
                } else if (checkoutSuccess && termsAgreed) {
                  setCurrentSubStep(4);
                  updateSubStepUrl(4);
                }
              }}
              disabled={!termsAgreed || (checkoutSuccess && !termsAgreed)}
              className="w-full px-4 py-3 border border-transparent rounded-lg text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] active:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Continue
            </button>
          </div>
        )}

        {/* Legacy payment form button - only for non-Contributor and non-Testing paid plans */}
        {!isFreePlan && !checkoutSuccess && selectedPlanSlug !== 'contributor' && selectedPlanSlug !== 'testing' && (
          <div className="space-y-2.5 pt-1">
            {!termsAgreed && (
              <p className="text-xs text-red-400 text-center font-medium">
                Please agree to the terms to continue
              </p>
            )}
            {!cardComplete && termsAgreed && (
              <p className="text-xs text-red-400 text-center font-medium">
                Please complete your payment information
              </p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={processing || !termsAgreed || !cardComplete}
              className="w-full px-4 py-3 border border-transparent rounded-lg text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] active:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing payment...
                </span>
              ) : (
                'Confirm & Subscribe'
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Step 4: Confirmation
  useEffect(() => {
    if (currentSubStep === 4) {
      onComplete();
    }
  }, [currentSubStep, onComplete]);

  const confirmedPlan = plans.find(p => p.slug?.toLowerCase() === selectedPlanSlug);
  const confirmedPrice = confirmedPlan?.price_monthly_cents === 0 
    ? 'Free' 
    : `$${(confirmedPlan?.price_monthly_cents || 0) / 100}/mo`;

  const isFreePlan = confirmedPlan?.price_monthly_cents === 0;
  const step1Confirmed = !!account?.stripe_customer_id;
  const step2Confirmed = !!selectedPlanSlug;
  const step3Confirmed = termsAgreed && (isFreePlan || cardComplete);
  const step4Confirmed = true; // Step 4 is the confirmation step itself
  
  return (
    <div className="space-y-4">
      {renderAccountHeader()}
      {/* Show completed steps */}
      {step1Confirmed && renderCompletedStep(1, 'Setup customer account')}
      {step2Confirmed && renderCompletedStep(2, 'Select a plan', () => {
        setCurrentSubStep(2);
        updateSubStepUrl(2);
      })}
      {step3Confirmed && renderCompletedStep(3, 'Payment & Terms', () => {
        setCurrentSubStep(3);
        updateSubStepUrl(3);
      })}
      
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full bg-transparent border text-xs font-bold transition-colors ${
          step4Confirmed 
            ? 'border-green-500 text-green-400' 
            : 'border-white text-white'
        }`}>4</span>
        <h3 className={`text-sm font-semibold transition-colors ${
          step4Confirmed ? 'text-neutral-500' : 'text-white'
        }`}>Confirmation</h3>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 text-green-400 justify-center py-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <CheckCircleIcon className="w-5 h-5" />
          <p className="text-xs font-semibold">Plan confirmed</p>
        </div>
        
        {confirmedPlan && (
          <div className="border-2 border-green-500/60 rounded-lg p-4 bg-neutral-900 shadow-sm ring-1 ring-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-white">{confirmedPlan.name}</h4>
              <span className="text-xs font-semibold text-neutral-100">{confirmedPrice}</span>
            </div>
            {confirmedPlan.description && (
              <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed">{confirmedPlan.description}</p>
            )}
          </div>
        )}
        
        <p className="text-xs text-neutral-400 text-center leading-relaxed">
          Your plan has been set up. Click continue to proceed with onboarding.
        </p>
      </div>
    </div>
  );
}
