'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { XMarkIcon, CheckIcon, SparklesIcon, ExclamationCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string; // Optional: which feature triggered the modal
  overlay?: 'center' | 'sidebar'; // Display mode
}

interface BillingData {
  plan: 'hobby' | 'pro' | 'plus';
  billing_mode: 'standard' | 'trial';
  subscription_status: string | null;
  isTrial: boolean;
  isActive: boolean;
}

export default function BillingModal({
  isOpen,
  onClose,
  feature,
  overlay = 'center',
}: BillingModalProps) {
  const router = useRouter();
  const { openWelcome, closeModal } = useAppModalContextSafe();
  const [mounted, setMounted] = useState(false);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only lock body scroll for center mode
    if (isOpen && overlay === 'center') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, overlay]);

  // Fetch billing data when modal opens
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const fetchBillingData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/billing/data');
        
        if (!response.ok) {
          // If unauthorized (401), switch to login modal instead of showing error
          if (response.status === 401) {
            console.log('[BillingModal] User not authenticated, switching to login modal');
            closeModal();
            openWelcome();
            return;
          }
          
          // Try to get error message from response
          let errorMessage = 'Failed to fetch billing data';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If response isn't JSON, use status text
            errorMessage = response.status === 500
              ? 'Server error. Please try again later.'
              : `Failed to fetch billing data (${response.status})`;
          }
          
          console.error('[BillingModal] Billing data fetch failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorMessage,
          });
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        
        // Debug: Log all data received from API
        console.log('[BillingModal] Fetched billing data:', {
          raw: data,
          plan: data.plan,
          billing_mode: data.billing_mode,
          subscription_status: data.subscription_status,
          isTrial: data.isTrial,
          isActive: data.isActive,
        });
        
        setBillingData({
          plan: data.plan || 'hobby',
          billing_mode: data.billing_mode || 'standard',
          subscription_status: data.subscription_status,
          isTrial: data.isTrial || false,
          isActive: data.isActive || false,
        });
      } catch (err) {
        console.error('Error fetching billing data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load billing information');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, [isOpen, mounted]);

  // Handle checkout session completion
  useEffect(() => {
    if (!isOpen) return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const canceled = params.get('canceled');

    if (sessionId) {
      // Checkout completed successfully - refresh billing data
      setError(null);
      const fetchBillingData = async () => {
        try {
          const response = await fetch('/api/billing/data');
          if (response.ok) {
            const data = await response.json();
            
            // Debug: Log refresh data
            console.log('[BillingModal] Refreshed billing data after checkout:', data);
            
            setBillingData({
              plan: data.plan || 'hobby',
              billing_mode: data.billing_mode || 'standard',
              subscription_status: data.subscription_status,
              isTrial: data.isTrial || false,
              isActive: data.isActive || false,
            });
          }
        } catch (err) {
          console.error('Error refreshing billing data:', err);
        }
      };
      fetchBillingData();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled) {
      // Checkout was canceled
      setError('Checkout was canceled. You can try again anytime.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isOpen]);

  const handleUpgrade = async () => {
    try {
      setCheckoutLoading(true);
      setError(null);
      
      console.log('[BillingModal] Creating checkout session...');
      
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setCheckoutLoading(false);
    }
  };


  if (!mounted || !isOpen) return null;

  const isProUser = billingData?.plan === 'pro' || billingData?.plan === 'plus';
  const showUpgrade = !isProUser || !billingData?.isActive;

  // Sidebar overlay mode
  if (overlay === 'sidebar') {
    return (
      <div className="fixed left-0 top-0 bottom-0 z-[52] w-[80vw] lg:w-80 bg-white border-r border-gray-200 shadow-xl flex flex-col">
        <div className="p-[10px] flex-shrink-0 border-b border-gray-200">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-[10px] right-[10px] p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>

          {/* Branding */}
          <div className="flex flex-col items-center justify-center mb-3 space-y-2">
            <div className="relative w-8 h-8">
              <Image
                src="/heart.png"
                alt="Heart"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div className="relative w-full max-w-[200px] h-auto">
              <Image
                src="/mid_text For the love of mn.png"
                alt="For the Love of Minnesota"
                width={200}
                height={50}
                className="w-full h-auto object-contain"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              {isProUser ? 'Billing & Subscription' : 'Upgrade to Pro'}
            </h2>
            {!isProUser && <p className="text-xs text-gray-600">$20/month</p>}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-[10px] space-y-3 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs flex items-start gap-2">
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : billingData ? (
            <>
              {/* Feature context */}
              {feature && showUpgrade && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
                  <span className="font-medium text-gray-900">{feature}</span> requires a Pro subscription
                </div>
              )}

              {/* Current Plan Status */}
              {isProUser && (
                <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Plan</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {billingData.plan === 'plus' ? 'Pro+' : 'Pro'}
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
                  </div>
                </div>
              )}

              {/* Upgrade Section */}
              {showUpgrade && (
                <>
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={handleUpgrade}
                      disabled={checkoutLoading}
                      className="w-full flex items-center justify-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {checkoutLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Starting checkout...
                        </>
                      ) : (
                        <>
                          Upgrade Now
                          <ArrowRightIcon className="w-3 h-3" />
                        </>
                      )}
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2"
                    >
                      Maybe later
                    </button>
                  </div>
                </>
              )}

              {/* Billing Management Section */}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-[10px] py-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            Cancel anytime. Secure payment via Stripe.
          </p>
        </div>
      </div>
    );
  }

  // Center modal mode (default)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-sm rounded-md bg-white border border-gray-200 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-[10px]">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-[10px] right-[10px] p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>

          {/* Branding */}
          <div className="flex flex-col items-center justify-center mb-3 space-y-2">
            <div className="relative w-8 h-8">
              <Image
                src="/heart.png"
                alt="Heart"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div className="relative w-full max-w-[200px] h-auto">
              <Image
                src="/mid_text For the love of mn.png"
                alt="For the Love of Minnesota"
                width={200}
                height={50}
                className="w-full h-auto object-contain"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              {isProUser ? 'Billing & Subscription' : 'Upgrade to Pro'}
            </h2>
            {!isProUser && <p className="text-xs text-gray-600">$20/month</p>}
          </div>

          {/* Content */}
          <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs flex items-start gap-2">
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : billingData ? (
            <>
              {/* Feature context */}
              {feature && showUpgrade && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
                  <span className="font-medium text-gray-900">{feature}</span> requires a Pro subscription
                </div>
              )}

              {/* Current Plan Status */}
              {isProUser && (
                <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Plan</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {billingData.plan === 'plus' ? 'Pro+' : 'Pro'}
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
                  </div>
                </div>
              )}

              {/* Upgrade Section */}
              {showUpgrade && (
                <>
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={handleUpgrade}
                      disabled={checkoutLoading}
                      className="w-full flex items-center justify-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {checkoutLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Starting checkout...
                        </>
                      ) : (
                        <>
                          Upgrade Now
                          <ArrowRightIcon className="w-3 h-3" />
                        </>
                      )}
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2"
                    >
                      Maybe later
                    </button>
                  </div>
                </>
              )}

              {/* Billing Management Section */}
            </>
          ) : null}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-[10px] text-gray-400 text-center">
              Cancel anytime. Secure payment via Stripe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

