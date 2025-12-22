'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface UpgradeToProModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  feature?: string; // Optional: which feature triggered the modal
  overlay?: 'center' | 'sidebar'; // Display mode
}

const PRO_FEATURES = [
  'Unlimited property intelligence queries',
  'Advanced skip trace lookups',
  'Private pins',
  'Priority support',
];

export default function UpgradeToProModal({
  isOpen,
  onClose,
  onUpgrade,
  feature,
  overlay = 'center',
}: UpgradeToProModalProps) {
  const [mounted, setMounted] = useState(false);

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

  if (!mounted || !isOpen) return null;

  // Sidebar overlay mode - covers the intelligence sidebar
  if (overlay === 'sidebar') {
    return (
      <div className="fixed left-0 top-0 bottom-0 z-[52] w-[80vw] lg:w-80 bg-white border-r border-gray-200 shadow-xl flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Upgrade to Pro</h2>
              <p className="text-xs text-indigo-200">$20/month</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Feature context */}
          {feature && (
            <div className="text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
              <span className="font-medium text-gray-900">{feature}</span> requires a Pro subscription
            </div>
          )}

          {/* Benefits list */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Pro includes:</p>
            <ul className="space-y-1.5">
              {PRO_FEATURES.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckIcon className="w-3.5 h-3.5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-gray-600">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="pt-2 space-y-2">
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              <SparklesIcon className="w-4 h-4" />
              Upgrade Now
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex-shrink-0">
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-4">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Upgrade to Pro</h2>
              <p className="text-xs text-indigo-200">$20/month</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Feature context */}
          {feature && (
            <div className="text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
              <span className="font-medium text-gray-900">{feature}</span> requires a Pro subscription
            </div>
          )}

          {/* Benefits list */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Pro includes:</p>
            <ul className="space-y-1.5">
              {PRO_FEATURES.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckIcon className="w-3.5 h-3.5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-gray-600">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="pt-2 space-y-2">
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              <SparklesIcon className="w-4 h-4" />
              Upgrade Now
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">
            Cancel anytime. Secure payment via Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}

