'use client';

import { CreditCardIcon, PlusIcon } from '@heroicons/react/24/outline';

/**
 * Ad Credits Content - Manage ad credits and payment methods
 */
export default function AdCenterCreditsContent() {
  return (
    <div className="max-w-[800px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Ad Credits</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Manage your ad credits and payment methods
        </p>
      </div>

      {/* Current Balance */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Current Balance</h2>
        </div>
        <div className="text-3xl font-bold text-foreground mb-2">$0.00</div>
        <p className="text-sm text-foreground-muted">No ad credits available</p>
        <button className="mt-4 px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Add Credits
        </button>
      </div>

      {/* Payment Methods */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Payment Methods</h2>
          <button className="px-3 py-1.5 bg-surface-accent text-foreground rounded-md hover:bg-surface-accent/80 dark:hover:bg-white/10 transition-colors text-xs font-medium flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            Add Payment Method
          </button>
        </div>
        <div className="text-center py-8 text-sm text-foreground-muted">
          No payment methods added yet
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Billing History</h2>
        <div className="text-center py-8 text-sm text-foreground-muted">
          No billing history available
        </div>
      </div>
    </div>
  );
}
