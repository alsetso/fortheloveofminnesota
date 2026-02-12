'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  PlusIcon,
  UserGroupIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';

/**
 * Left Sidebar for Maps page
 * Search, filters, view toggles, and create button
 */
export default function MapsLeftSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account } = useAuthStateSafe();

  const currentView = searchParams.get('view') || (account ? 'my-maps' : 'community');

  const handleViewChange = (view: string) => {
    router.push(`/maps?view=${view}`);
  };

  const filters = [
    ...(account ? [{ id: 'my-maps', label: 'My Maps', icon: FolderIcon }] : []),
    { id: 'community', label: 'Community', icon: UserGroupIcon },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <h2 className="text-base font-semibold text-foreground">Maps</h2>
      </div>


      {/* Create Button */}
      {account && (
        <div className="p-3 border-b border-border-muted dark:border-white/10">
          <button
            onClick={() => router.push('/maps/new')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Create Map
          </button>
        </div>
      )}

      {/* View Filters */}
      <div className="p-3 space-y-1 border-b border-border-muted dark:border-white/10">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = currentView === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => handleViewChange(filter.id)}
              className={`w-full flex items-center justify-between gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                isActive
                  ? 'bg-surface-accent text-foreground'
                  : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{filter.label}</span>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}
