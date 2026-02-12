'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

/**
 * Left Sidebar for Explore page
 * Header and search only — category filter removed
 */
export default function ExploreLeftSidebar() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Explore</h2>
        <p className="text-[10px] text-foreground-muted mt-0.5">Discover Minnesota</p>
      </div>

      {/* Search */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-xs text-foreground placeholder:text-foreground-muted border-none focus:outline-none focus:ring-2 focus:ring-lake-blue"
          />
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        </div>
      </div>
    </div>
  );
}
