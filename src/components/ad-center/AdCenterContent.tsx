'use client';

import { useState } from 'react';
import { 
  InformationCircleIcon,
  XMarkIcon,
  ChartBarIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

/**
 * Ad Center Content - Main dashboard for ad management
 */
export default function AdCenterContent() {
  const [showVerificationBanner, setShowVerificationBanner] = useState(true);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);

  return (
    <div className="max-w-[1000px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Ad Center</h1>
      </div>

      {/* Verification Alert Banner */}
      {showVerificationBanner && (
        <div className="bg-surface-accent border border-border-muted dark:border-white/10 rounded-md p-4 mb-4 relative">
          <button
            onClick={() => setShowVerificationBanner(false)}
            className="absolute top-3 right-3 w-6 h-6 rounded-full hover:bg-surface dark:hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <XMarkIcon className="w-4 h-4 text-foreground-muted" />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <InformationCircleIcon className="w-5 h-5 text-lake-blue flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-foreground mb-3">
                Avoid disruptions to your ads by completing elective verification. Verification isn't required for your ads now, but could be in the future. Help prevent your ads from pausing by verifying yourself or your organization in advance.
              </p>
              <button className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium">
                Get started
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      {showWelcomeBanner && (
        <div className="bg-gradient-to-r from-lake-blue/20 via-aurora-teal/20 to-lake-blue/20 border border-border-muted dark:border-white/10 rounded-md p-6 mb-6 relative overflow-hidden">
          <button
            onClick={() => setShowWelcomeBanner(false)}
            className="absolute top-3 right-3 w-6 h-6 rounded-full hover:bg-surface/50 dark:hover:bg-white/10 flex items-center justify-center transition-colors z-10"
          >
            <XMarkIcon className="w-4 h-4 text-foreground-muted" />
          </button>
          
          {/* Decorative Background */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-lake-blue rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-aurora-teal rounded-full blur-3xl" />
          </div>

          <div className="relative z-0">
            <p className="text-base text-foreground mb-4 max-w-2xl">
              Welcome, Cole! Running an ad on Facebook is an easy way to connect with the people who matter to For the Love of Minnesota and grow your business.
            </p>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium">
                Advertise
              </button>
              <button className="px-4 py-2 bg-transparent border border-border-muted dark:border-white/20 text-foreground rounded-md hover:bg-surface-accent dark:hover:bg-white/10 transition-colors text-sm font-medium">
                Learn more
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Summary</h2>
            <InformationCircleIcon className="w-4 h-4 text-foreground-muted" />
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <button className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium">
              Advertise
            </button>
          </div>
        </div>
        <p className="text-sm text-foreground-muted">
          Cole Bremer spent <span className="font-semibold text-foreground">$0.00</span> on <span className="font-semibold text-foreground">0 ads</span> in the last 60 days.
        </p>
      </div>

      {/* Recent Ads Section */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Recent Ads</h2>
        
        <div className="text-center py-12">
          {/* Placeholder Chart */}
          <div className="w-full h-48 bg-surface-accent rounded-md mb-4 flex items-center justify-center border border-border-muted dark:border-white/10">
            <ChartBarIcon className="w-16 h-16 text-foreground-subtle" />
          </div>
          
          <p className="text-sm text-foreground-muted mb-4">
            You have not created any ads yet. Metrics for individual ads will appear here once you get started.
          </p>
          
          <button className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium mb-4">
            Advertise
          </button>
          
          <div className="pt-4 border-t border-border-muted dark:border-white/10">
            <a
              href="#"
              className="inline-flex items-center gap-1.5 text-sm text-lake-blue hover:text-lake-blue/80 transition-colors"
            >
              <span>Show more details in Ads Manager</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
