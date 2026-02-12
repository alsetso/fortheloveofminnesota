'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  HomeIcon,
  MegaphoneIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import { usePathname } from 'next/navigation';

/**
 * Left Sidebar for Ad Center page
 * Manage Pages and profiles navigation
 */
export default function AdCenterLeftSidebar() {
  const pathname = usePathname();
  const [isAdCenterExpanded, setIsAdCenterExpanded] = useState(true);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <h2 className="text-sm font-semibold text-foreground">Manage Pages and profiles</h2>
      </div>

      {/* Profile */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-accent dark:hover:bg-white/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-surface-accent flex items-center justify-center flex-shrink-0">
            <HeartIcon className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">For the Love of Minnesota</div>
            <div className="text-xs text-foreground-muted">Page</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-3 space-y-1">
        <Link
          href="/"
          className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
            pathname === '/'
              ? 'bg-surface-accent text-foreground'
              : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground'
          }`}
        >
          <HomeIcon className="w-5 h-5" />
          <span>Home</span>
        </Link>

        {/* Ad Center - Expandable */}
        <div>
          <button
            onClick={() => setIsAdCenterExpanded(!isAdCenterExpanded)}
            className={`w-full flex items-center justify-between px-2 py-2 text-sm rounded-md transition-colors ${
              pathname?.startsWith('/ad_center')
                ? 'bg-surface-accent text-foreground'
                : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-3">
              <MegaphoneIcon className="w-5 h-5" />
              <span>Ad Center</span>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${isAdCenterExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Sub-navigation */}
          {isAdCenterExpanded && (
            <div className="ml-8 mt-1 space-y-1">
              <Link
                href="/ad_center"
                className={`flex items-center gap-3 px-2 py-1.5 text-sm rounded-md transition-colors ${
                  pathname === '/ad_center'
                    ? 'bg-surface-accent text-foreground'
                    : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground'
                }`}
              >
                <span>All ads</span>
              </Link>
              <Link
                href="/ad_center/credits"
                className={`flex items-center gap-3 px-2 py-1.5 text-sm rounded-md transition-colors ${
                  pathname === '/ad_center/credits'
                    ? 'bg-surface-accent text-foreground'
                    : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground'
                }`}
              >
                <CreditCardIcon className="w-4 h-4" />
                <span>Ad credits</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Advertise Button */}
      <div className="mt-auto px-3 pt-3 border-t border-border-muted dark:border-white/10 pb-3">
        <a
          href="https://www.facebook.com/61585183979046/ad_center/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center px-4 py-2.5 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
        >
          Advertise
        </a>
      </div>
    </div>
  );
}
