'use client';

import { ReactNode, useEffect, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Get Stripe publishable key - must be available at build time
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Create Stripe promise - loadStripe returns a Promise that resolves to Stripe | null
// Only create promise if key exists and is valid (starts with pk_)
// Wrap in try-catch to prevent errors on page load if key is invalid
let stripePromise: Promise<Stripe | null> | null = null;

if (stripeKey && stripeKey.startsWith('pk_')) {
  try {
    stripePromise = loadStripe(stripeKey);
  } catch (error) {
    // Silently fail - Stripe.js is optional (only needed for embedded forms)
    console.warn('[StripeProvider] Failed to initialize Stripe.js:', error);
    stripePromise = null;
  }
}

interface StripeProviderProps {
  children: ReactNode;
}

export function StripeProvider({ children }: StripeProviderProps) {
  const [stripeLoaded, setStripeLoaded] = useState<boolean | null>(null);

  useEffect(() => {
    // Silently handle missing key - Stripe.js is optional (only needed for embedded forms)
    // The app uses server-side checkout, so Stripe.js isn't required
    if (!stripeKey || !stripeKey.startsWith('pk_')) {
      setStripeLoaded(false);
      return;
    }

    if (!stripePromise) {
      setStripeLoaded(false);
      return;
    }

    // Verify Stripe.js loads successfully
    stripePromise
      .then((stripe) => {
        if (stripe) {
          setStripeLoaded(true);
        } else {
          // Silently fail - not critical for app functionality
          setStripeLoaded(false);
        }
      })
      .catch((error) => {
        // Silently fail - Stripe.js is optional
        setStripeLoaded(false);
      });
  }, []);

  // If no key or promise, render children without Elements wrapper
  if (!stripeKey || !stripePromise) {
    return <>{children}</>;
  }

  // Render Elements with stripe promise
  // Elements will handle the loading state internally
  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#111827',
            colorBackground: '#ffffff',
            colorText: '#111827',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '6px',
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}
