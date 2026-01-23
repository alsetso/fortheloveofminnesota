'use client';

import { useState, FormEvent } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ArrowRightIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const cardElementOptions = {
  style: {
    base: {
      fontSize: '13px',
      color: '#374151',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': {
        color: '#9CA3AF',
        fontSize: '13px',
      },
    },
    invalid: {
      color: '#DC2626',
    },
  },
};

interface CreditsPaymentFormProps {
  stripeCustomerId: string | null;
  onSuccess: () => void;
}

export default function CreditsPaymentForm({ stripeCustomerId, onSuccess }: CreditsPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!stripe) {
      setError('Stripe.js is still loading. Please wait a moment and try again.');
      return;
    }

    if (!elements) {
      setError('Stripe Elements not initialized');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create payment method
      const { error: createError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (createError) {
        throw new Error(createError.message || 'Failed to create payment method');
      }

      if (!paymentMethod) {
        throw new Error('Payment method creation returned no result');
      }

      // Create one-time payment
      const response = await fetch('/api/billing/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          customerId: stripeCustomerId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Failed to process payment');
      }

      const data = await response.json();

      // Handle 3D Secure if required
      if (data.requiresAction && data.clientSecret) {
        const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret);
        
        if (confirmError) {
          throw new Error(confirmError.message || 'Payment authentication failed');
        }
      }

      // Check if payment succeeded
      if (data.status === 'succeeded') {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        throw new Error(`Payment status: ${data.status}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="py-4 border-t border-gray-200">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center mx-auto">
            <CheckCircleIcon className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Payment Successful</h3>
            <p className="text-xs text-gray-500">Your credits purchase is complete. Redirecting...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 border-t border-gray-200">
      <div className="mb-3">
        <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Payment Method</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="border border-gray-200 rounded bg-white p-3">
          <CardElement 
            options={cardElementOptions}
            onChange={(e) => {
              setCardComplete(e.complete);
              if (e.error) {
                setError(e.error.message);
              } else {
                setError('');
              }
            }}
          />
        </div>

        {error && (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-3 py-2 rounded text-xs flex items-start gap-2">
            <ExclamationCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-600" />
            <span>{error}</span>
          </div>
        )}

        {cardComplete && (
          <button
            type="submit"
            disabled={!stripe || loading || !stripeCustomerId}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-gray-300 rounded bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                Complete Purchase
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}

        <p className="text-xs text-gray-500 text-center">
          Secure payment processed by Stripe
        </p>
      </form>
    </div>
  );
}
