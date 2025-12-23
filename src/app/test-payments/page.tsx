'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentElementTest from './components/PaymentElementTest';
import StripeElementsTest from './components/StripeElementsTest';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

export default function TestPaymentsPage() {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h1 className="text-sm font-semibold text-red-900 mb-2">
              Missing Stripe Configuration
            </h1>
            <p className="text-xs text-red-700">
              NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set in your environment variables.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 mb-1">
            Payment Testing
          </h1>
          <p className="text-xs text-gray-600">
            Test Stripe Payment Element and Stripe Elements side by side
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payment Element */}
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Payment Element
            </h2>
            <p className="text-xs text-gray-600 mb-3">
              Stripe&apos;s recommended component - handles all payment methods automatically
            </p>
            <Elements stripe={stripePromise}>
              <PaymentElementTest />
            </Elements>
          </div>

          {/* Stripe Elements */}
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Stripe Elements
            </h2>
            <p className="text-xs text-gray-600 mb-3">
              Individual card element with more control over styling
            </p>
            <Elements stripe={stripePromise}>
              <StripeElementsTest />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
}
