'use client';

import { 
  StarIcon,
  ListBulletIcon,
  PhotoIcon,
  CreditCardIcon,
  CodeBracketIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';

/**
 * Right Sidebar for Ad Center page
 * Activity and Tools panels
 */
export default function AdCenterRightSidebar() {
  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto space-y-4">
      {/* Activity Panel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        </div>
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3">
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <StarIcon className="w-4 h-4 text-yellow-500" />
            <span>Recommendations</span>
          </div>
        </div>
      </div>

      {/* Tools Panel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Tools</h3>
          <button className="w-6 h-6 rounded-full hover:bg-surface-accent dark:hover:bg-white/10 flex items-center justify-center transition-colors">
            <EllipsisHorizontalIcon className="w-4 h-4 text-foreground-muted" />
          </button>
        </div>
        
        <div className="space-y-2">
          {/* Get Help Building Strategy */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3">
            <div className="flex items-start gap-3">
              <ListBulletIcon className="w-5 h-5 text-foreground-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground mb-1">
                  Get help building your advertising strategy
                </h4>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Don't know where to start? Answer a few questions about your business and we'll guide you through creating your first ad.
                </p>
              </div>
            </div>
          </div>

          {/* Business Media */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3">
            <div className="flex items-start gap-3">
              <PhotoIcon className="w-5 h-5 text-foreground-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground mb-1">
                  Business media
                </h4>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Add photos and videos from your business here.
                </p>
              </div>
            </div>
          </div>

          {/* Billing & Payments */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3">
            <div className="flex items-start gap-3">
              <CreditCardIcon className="w-5 h-5 text-foreground-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground mb-1">
                  Billing & payments
                </h4>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Manage the way you pay for ads and view payment activity.
                </p>
              </div>
            </div>
          </div>

          {/* Domain Verification */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3">
            <div className="flex items-start gap-3">
              <CodeBracketIcon className="w-5 h-5 text-foreground-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground mb-1">
                  Domain verification
                </h4>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Confirm domain ownership to manage your pixel settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
