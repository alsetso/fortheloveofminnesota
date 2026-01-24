'use client';

import { useState, useEffect } from 'react';
import { CreditCardIcon, CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import confetti from 'canvas-confetti';
import type { Account } from '@/features/auth';

interface BillingSetupProps {
  account: Account | null;
  onCustomerCreated?: () => void;
}

export default function BillingSetup({ account, onCustomerCreated }: BillingSetupProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);

  const triggerConfetti = () => {
    // Fire confetti from multiple angles
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleSetupBilling = async () => {
    if (!account) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/billing/ensure-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to set up billing');
      }

      const data = await response.json();
      if (data.customerId) {
        setIsSuccess(true);
        triggerConfetti();
        
        // Notify parent to refresh account data
        if (onCustomerCreated) {
          onCustomerCreated();
        }
        
        // Hide container after 5 seconds
        setTimeout(() => {
          setShouldHide(true);
        }, 5000);
      }
    } catch (error) {
      console.error('Error setting up billing:', error);
      alert(error instanceof Error ? error.message : 'Failed to set up billing');
    } finally {
      setIsCreating(false);
    }
  };

  if (shouldHide) {
    return null;
  }

  return (
    <div className={`mb-6 border rounded-lg p-6 transition-colors ${
      isSuccess
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
        : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
    }`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {isSuccess && account?.image_url ? (
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-green-500">
              <img
                src={account.image_url}
                alt={account.username || 'Account'}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isSuccess ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {isSuccess ? (
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              ) : (
                <CreditCardIcon className="w-6 h-6 text-blue-600" />
              )}
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {isSuccess 
              ? `Congratulations${account?.username ? `, @${account.username}` : ''}!` 
              : 'Set Up Billing'}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {isSuccess
              ? 'You are ready to start a For the Love of Minnesota subscription.'
              : "You don't have billing configured yet. Set up your Stripe customer account to start managing subscriptions and payments."}
          </p>
          
          {!isSuccess && (
            <>
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-600">
                    Secure payment processing through Stripe
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-600">
                    Manage subscriptions and payment methods in one place
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-600">
                    Access to advanced features and analytics
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleSetupBilling}
                disabled={isCreating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Setting up...' : 'Click here to set up billing'}
                {!isCreating && <ArrowRightIcon className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
