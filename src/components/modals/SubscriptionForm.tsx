'use client';

import { useState, FormEvent } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ArrowRightIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

const cardElementOptions = {
  style: {
    base: {
      fontSize: '12px',
      color: '#374151',
      '::placeholder': {
        color: '#9CA3AF',
      },
    },
    invalid: {
      color: '#EF4444',
    },
  },
};

interface SubscriptionFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function SubscriptionForm({ onSuccess, onError }: SubscriptionFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!stripe) {
      const err = 'Stripe.js is still loading. Please wait a moment and try again.';
      setError(err);
      onError(err);
      return;
    }

    if (!elements) {
      const err = 'Stripe Elements not initialized';
      setError(err);
      onError(err);
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      const err = 'Card element not found';
      setError(err);
      onError(err);
      return;
    }

    setLoading(true);
    setError('');
    onError('');

    try {
      // Create subscription intent
      const response = await fetch('/api/billing/create-subscription-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create subscription');
      }

      const { clientSecret } = await response.json();

      // Confirm payment with card
      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed');
      }

      setLoading(false);
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Subscription failed';
      setError(errorMessage);
      onError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="border border-gray-200 rounded-md p-[10px]">
        <CardElement options={cardElementOptions} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs flex items-start gap-2">
          <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Processing...
          </>
        ) : (
          <>
            Subscribe $20/month
            <ArrowRightIcon className="w-3 h-3" />
          </>
        )}
      </button>

      <p className="text-[10px] text-gray-500 text-center">
        Secure payment processed by Stripe
      </p>
    </form>
  );
}
