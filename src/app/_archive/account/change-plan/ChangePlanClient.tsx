'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  CheckIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  EnvelopeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { BillingData } from '@/lib/billingServer';

interface ChangePlanClientProps {
  initialBillingData: BillingData;
}

export default function ChangePlanClient({ initialBillingData }: ChangePlanClientProps) {
  const router = useRouter();
  const [billingData] = useState<BillingData>(initialBillingData);
  const [error, setError] = useState<string | null>(null);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  // Open coming soon modal for Pro subscription
  const handleProCheckout = () => {
    setShowComingSoonModal(true);
  };

  // Handle Pro+ contact
  const handleProPlusContact = () => {
    // Open email client or redirect to contact form
    window.location.href = 'mailto:support@mnuda.com?subject=Pro+ Plan Inquiry';
  };

  const currentPlan = billingData.plan;
  const isProActive = currentPlan === 'pro' && billingData.isActive;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-[10px] bg-white border border-gray-200 rounded-md">
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-gray-900">Change Plan</h1>
        </div>
        <p className="text-xs text-gray-600">Choose the plan that works best for you</p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
          <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Hobby Plan - Only show if not current plan */}
        {currentPlan !== 'hobby' && (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="px-[10px] py-[10px] border-b border-gray-200">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-semibold text-gray-900">Hobby</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-gray-900">$0</span>
                <span className="text-xs text-gray-600">/month</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Default plan</p>
            </div>
            <div className="px-[10px] py-[10px] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>10 pins</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>3 areas</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>1 profile</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>Public visibility</span>
              </div>
            </div>
            <div className="px-[10px] py-[10px] border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  // For downgrading, redirect to billing page where they can manage subscription
                  router.push('/?modal=account&tab=billing');
                }}
                className="w-full px-[10px] py-[10px] bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Switch to Hobby
              </button>
            </div>
          </div>
        )}

        {/* Pro Plan - Only show if not current plan */}
        {!isProActive && (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="px-[10px] py-[10px] border-b border-gray-200">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-semibold text-gray-900">Pro</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-gray-900">$20</span>
                <span className="text-xs text-gray-600">/month</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Most popular</p>
            </div>
            <div className="px-[10px] py-[10px] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>Unlimited pins</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>Unlimited areas</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>Multiple profiles</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>Private visibility</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckIcon className="w-3 h-3 text-gray-500" />
                <span>Priority support</span>
              </div>
            </div>
            <div className="px-[10px] py-[10px] border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleProCheckout}
                className="w-full px-[10px] py-[10px] bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors flex items-center justify-center gap-1.5"
              >
                Subscribe to Pro
                <ArrowRightIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Pro+ Plan - Always show */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-[10px] py-[10px] border-b border-gray-200">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-semibold text-gray-900">Pro+</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">$80</span>
              <span className="text-xs text-gray-600">/month</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Enterprise features</p>
          </div>
          <div className="px-[10px] py-[10px] space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <CheckIcon className="w-3 h-3 text-gray-500" />
              <span>Everything in Pro</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <CheckIcon className="w-3 h-3 text-gray-500" />
              <span>Custom integrations</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <CheckIcon className="w-3 h-3 text-gray-500" />
              <span>Dedicated support</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <CheckIcon className="w-3 h-3 text-gray-500" />
              <span>Custom branding</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <CheckIcon className="w-3 h-3 text-gray-500" />
              <span>API access</span>
            </div>
          </div>
          <div className="px-[10px] py-[10px] border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleProPlusContact}
              className="w-full px-[10px] py-[10px] bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <EnvelopeIcon className="w-3 h-3" />
              Contact Us
            </button>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">
          Need help choosing a plan? <Link href="/contact" className="text-gray-900 font-medium hover:underline">Contact our team</Link> for personalized recommendations.
        </p>
      </div>

      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowComingSoonModal(false)}
        >
          <div 
            className="bg-white rounded-md border border-gray-200 max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MNUDA Branding */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-12 h-12">
                <Image
                  src="/logo.png"
                  alt="MNUDA"
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center mb-2">
                <SparklesIcon className="w-5 h-5 text-gray-400 mr-1.5" />
                <h2 className="text-sm font-semibold text-gray-900">Coming Soon</h2>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                We&apos;re building something great! Pro subscriptions will be available soon. 
                Stay tuned for updates.
              </p>
            </div>

            {/* Close Button */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowComingSoonModal(false)}
                className="px-[10px] py-[10px] bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

