'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, UserIcon, CreditCardIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import type { Account } from '@/features/auth';
import BillingFeaturesCard from './BillingFeaturesCard';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';

interface AccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  user: any;
}

export default function AccountSidebar({ isOpen, onClose, account, user }: AccountSidebarProps) {
  const getPlanDisplay = (plan: string | null | undefined) => {
    if (!plan) return 'Hobby';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const getRoleDisplay = (role: string | null | undefined) => {
    if (!role) return 'User';
    return role.charAt(0).toUpperCase() + role.slice(1);
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
            <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-white shadow-xl">
                    {/* Header */}
                    <div className="bg-black px-4 py-4">
                      <div className="flex items-center justify-between">
                        <Dialog.Title className="text-sm font-semibold text-white">
                          Account
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
                      {/* Profile Section */}
                      {account && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 ${getPaidPlanBorderClasses(account.plan)}`}>
                              <div className="w-full h-full rounded-full overflow-hidden bg-white">
                                {account.image_url ? (
                                  <Image
                                    src={account.image_url}
                                    alt={account.username || 'Account'}
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-cover rounded-full"
                                    unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                    <UserIcon className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {account.first_name && account.last_name
                                  ? `${account.first_name} ${account.last_name}`
                                  : account.username || 'Account'}
                              </div>
                              {account.username && (
                                <div className="text-xs text-gray-500 truncate">
                                  @{account.username}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Account Details */}
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-2 border-t border-gray-100">
                              <span className="text-gray-500">Role</span>
                              <span className="text-gray-900 font-medium">{getRoleDisplay(account.role)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-t border-gray-100">
                              <span className="text-gray-500">Plan</span>
                              <span className="text-gray-900 font-medium">{getPlanDisplay(account.plan)}</span>
                            </div>
                            {account.subscription_status && (
                              <div className="flex justify-between py-2 border-t border-gray-100">
                                <span className="text-gray-500">Status</span>
                                <span className={`font-medium capitalize ${
                                  account.subscription_status === 'active' || account.subscription_status === 'trialing'
                                    ? 'text-green-600'
                                    : 'text-gray-600'
                                }`}>
                                  {account.subscription_status}
                                </span>
                              </div>
                            )}
                            {user?.email && (
                              <div className="flex justify-between py-2 border-t border-gray-100">
                                <span className="text-gray-500">Email</span>
                                <span className="text-gray-900 truncate max-w-[200px]">{user.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Billing Section */}
                      {account?.stripe_customer_id && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <CreditCardIcon className="w-4 h-4 text-gray-500" />
                            <h3 className="text-sm font-semibold text-gray-900">Billing</h3>
                          </div>
                          <p className="text-xs text-gray-600 mb-3">
                            Manage your subscription, payment methods, and billing history in the Stripe Customer Portal.
                          </p>
                          <button
                            onClick={handleManageBilling}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
                          >
                            Open Billing Portal
                            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Plan Info */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Current Plan</h3>
                        <p className="text-xs text-gray-600 mb-3">
                          {account?.plan === 'hobby' || !account?.plan
                            ? 'You are currently on the Hobby plan with basic features.'
                            : account?.plan === 'contributor'
                            ? 'You have access to advanced analytics and unlimited maps.'
                            : `You are on the ${getPlanDisplay(account?.plan)} plan.`}
                        </p>
                        {(!account?.plan || account?.plan === 'hobby') && (
                          <button
                            onClick={onClose}
                            className="w-full px-4 py-2 text-xs font-medium text-white bg-black hover:bg-gray-800 rounded transition-colors"
                          >
                            View Plans
                          </button>
                        )}
                      </div>

                      <BillingFeaturesCard />

                      {/* Help Section */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Need Help?</h3>
                        <p className="text-xs text-gray-600 mb-3">
                          Have questions about your account or billing?
                        </p>
                        <a
                          href="mailto:loveofminnesota@gmail.com"
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          loveofminnesota@gmail.com
                        </a>
                      </div>
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
