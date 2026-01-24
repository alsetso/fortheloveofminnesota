'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CreditCardIcon, CheckCircleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { Account } from '@/features/auth';

interface PaymentMethod {
  id: string;
  brand: string | undefined;
  last4: string | undefined;
  expMonth: number | undefined;
  expYear: number | undefined;
  isDefault: boolean;
}

interface PaymentMethodsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
}

export default function PaymentMethodsSidebar({ isOpen, onClose, account }: PaymentMethodsSidebarProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);

  // Fetch payment methods every time the sidebar opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchPaymentMethods();
    }
  }, [isOpen]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/payment-methods');
      if (response.ok) {
        const data = await response.json();
        console.log('[PaymentMethodsSidebar] API Response:', data);
        console.log('[PaymentMethodsSidebar] Payment Methods:', JSON.stringify(data.paymentMethods, null, 2));
        setPaymentMethods(data.paymentMethods || []);
        setHasStripeCustomer(data.hasStripeCustomer);
      } else {
        console.error('[PaymentMethodsSidebar] API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[PaymentMethodsSidebar] Error fetching payment methods:', error);
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

  const getBrandIcon = (brand: string | undefined) => {
    if (!brand) return 'Card';
    const brandLower = brand.toLowerCase();
    return brandLower.charAt(0).toUpperCase() + brandLower.slice(1);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-white shadow-xl">
                    {/* Header */}
                    <div className="bg-black px-4 py-4">
                      <div className="flex items-center justify-between">
                        <Dialog.Title className="text-sm font-semibold text-white">
                          Payment Methods
                        </Dialog.Title>
                        <button
                          type="button"
                          className="text-white/70 hover:text-white transition-colors"
                          onClick={onClose}
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {loading ? (
                        <div className="flex items-center justify-center py-20">
                          <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-gray-300 border-t-gray-900 mb-3"></div>
                            <p className="text-sm text-gray-600 font-medium">Loading payment methods...</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Stripe Customer Status */}
                          <div className={`border rounded-lg p-4 ${
                            hasStripeCustomer 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircleIcon className={`w-5 h-5 ${
                                hasStripeCustomer ? 'text-green-600' : 'text-gray-400'
                              }`} />
                              <h3 className="text-sm font-semibold text-gray-900">
                                {hasStripeCustomer ? 'Billing Active' : 'No Billing Setup'}
                              </h3>
                            </div>
                            <p className="text-xs text-gray-600">
                              {hasStripeCustomer 
                                ? 'Your Stripe billing account is active and configured.'
                                : 'No Stripe customer ID found. Subscribe to a plan to set up billing.'}
                            </p>
                          </div>

                          {/* Payment Methods List */}
                          {hasStripeCustomer && (
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-900">Saved Cards</h3>
                                {account?.stripe_customer_id && (
                                  <button
                                    onClick={handleManageBilling}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    Manage
                                  </button>
                                )}
                              </div>

                              {/* Card Count Message */}
                              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-gray-700">
                                  Looks like you have <span className="font-semibold">{paymentMethods.length}</span> {paymentMethods.length === 1 ? 'card' : 'cards'}
                                </p>
                              </div>

                              {paymentMethods.length > 0 ? (
                                <div className="space-y-2">
                                  {paymentMethods.map((pm) => (
                                    <div
                                      key={pm.id}
                                      className={`border rounded-lg p-3 ${
                                        pm.isDefault 
                                          ? 'border-blue-300 bg-blue-50' 
                                          : 'border-gray-200 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <CreditCardIcon className="w-5 h-5 text-gray-500" />
                                          <div>
                                            <div className="text-sm font-medium text-gray-900">
                                              {getBrandIcon(pm.brand)} {pm.last4 || 'N/A'}
                                            </div>
                                          </div>
                                        </div>
                                        {pm.isDefault && (
                                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                            DEFAULT
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <CreditCardIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                  <p className="text-xs text-gray-500">No payment methods found</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Manage in Stripe Portal */}
                          {hasStripeCustomer && account?.stripe_customer_id && (
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                                Manage Payment Methods
                              </h3>
                              <p className="text-xs text-gray-600 mb-3">
                                Add, remove, or update your payment methods securely in the Stripe Customer Portal.
                              </p>
                              <button
                                onClick={handleManageBilling}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-black hover:bg-gray-800 rounded transition-colors"
                              >
                                Open Billing Portal
                                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {/* Help Section */}
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">Payment Issues?</h3>
                            <p className="text-xs text-gray-600 mb-3">
                              Having trouble with payments or need assistance?
                            </p>
                            <a
                              href="mailto:loveofminnesota@gmail.com"
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              loveofminnesota@gmail.com
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
