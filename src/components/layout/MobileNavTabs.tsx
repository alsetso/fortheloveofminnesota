'use client';

import Link from 'next/link';
import { UserIcon, PlusIcon, Cog6ToothIcon, MagnifyingGlassIcon, NewspaperIcon } from '@heroicons/react/24/outline';
import { PlusIcon as PlusIconSolid, Cog6ToothIcon as Cog6ToothIconSolid, MagnifyingGlassIcon as MagnifyingGlassIconSolid, NewspaperIcon as NewspaperIconSolid } from '@heroicons/react/24/solid';
import { useAuthStateSafe } from '@/features/auth';

export type MobileNavTab = 'news' | 'explore' | 'controls' | 'contribute';

interface MobileNavTabsProps {
  activeTab: MobileNavTab | null;
  onTabClick: (tab: MobileNavTab) => void;
}


/**
 * Fixed bottom tab bar with 3 tabs: Create, Controls, Contribute/Sign In
 * Always visible on mobile, positioned at z-50 (above sheets)
 */
export default function MobileNavTabs({ activeTab, onTabClick }: MobileNavTabsProps) {
  const { account } = useAuthStateSafe();

  const baseClasses = "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors";

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-[50] bg-gray-50 border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {/* News Tab */}
        <button
          onClick={() => onTabClick('news')}
          className={baseClasses}
          aria-label="News"
        >
          {activeTab === 'news' ? (
            <NewspaperIconSolid className="w-5 h-5 text-gray-900" />
          ) : (
            <NewspaperIcon className="w-5 h-5 text-gray-500" />
          )}
          <span className={`text-[10px] font-medium ${activeTab === 'news' ? 'text-gray-900' : 'text-gray-500'}`}>
            News
          </span>
        </button>

        {/* Explore Tab */}
        <button
          onClick={() => onTabClick('explore')}
          className={baseClasses}
          aria-label="Explore"
        >
          {activeTab === 'explore' ? (
            <MagnifyingGlassIconSolid className="w-5 h-5 text-gray-900" />
          ) : (
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-500" />
          )}
          <span className={`text-[10px] font-medium ${activeTab === 'explore' ? 'text-gray-900' : 'text-gray-500'}`}>
            Explore
          </span>
        </button>

        {/* Controls Tab */}
        <button
          onClick={() => onTabClick('controls')}
          className={baseClasses}
          aria-label="Controls"
        >
          {activeTab === 'controls' ? (
            <Cog6ToothIconSolid className="w-5 h-5 text-gray-900" />
          ) : (
            <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
          )}
          <span className={`text-[10px] font-medium ${activeTab === 'controls' ? 'text-gray-900' : 'text-gray-500'}`}>
            Controls
          </span>
        </button>

        {/* Contribute Tab (when signed in) or Sign In (when not signed in) */}
        {account ? (
          <button
            onClick={() => onTabClick('contribute')}
            className={baseClasses}
            aria-label="Contribute"
          >
            {activeTab === 'contribute' ? (
              <PlusIconSolid className="w-5 h-5 text-gray-900" />
            ) : (
              <PlusIcon className="w-5 h-5 text-gray-500" />
            )}
            <span className={`text-[10px] font-medium ${activeTab === 'contribute' ? 'text-gray-900' : 'text-gray-500'}`}>
              Contribute
            </span>
          </button>
        ) : (
          <Link
            href="/account/settings"
            className={baseClasses}
            aria-label="Sign In"
          >
            <UserIcon className="w-5 h-5 text-gray-500" />
            <span className="text-[10px] font-medium text-gray-500">
              Sign In
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}

