'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, EllipsisHorizontalIcon, ShareIcon } from '@heroicons/react/24/outline';

interface PageDetailLeftSidebarProps {
  pageId: string;
}

/**
 * Left Sidebar for Page detail
 * Navigation and page actions
 */
export default function PageDetailLeftSidebar({ pageId }: PageDetailLeftSidebarProps) {
  const router = useRouter();

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Back Button */}
      <div className="p-3 border-b border-white/10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-2 py-2 text-sm text-white/70 hover:bg-surface-accent hover:text-white rounded-md transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Page Actions */}
      <div className="p-3 space-y-1 border-b border-white/10">
        <button className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md text-white/70 hover:bg-surface-accent hover:text-white transition-colors">
          <ShareIcon className="w-5 h-5" />
          <span>Share</span>
        </button>
        <button className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md text-white/70 hover:bg-surface-accent hover:text-white transition-colors">
          <EllipsisHorizontalIcon className="w-5 h-5" />
          <span>More options</span>
        </button>
      </div>

      {/* Table of Contents Placeholder */}
      <div className="p-3">
        <h3 className="text-xs font-semibold text-white/60 mb-2">On this page</h3>
        <div className="space-y-1">
          <button className="w-full text-left px-2 py-1 text-xs text-white/70 hover:text-white transition-colors">
            Introduction
          </button>
          <button className="w-full text-left px-2 py-1 text-xs text-white/70 hover:text-white transition-colors">
            Section 1
          </button>
          <button className="w-full text-left px-2 py-1 text-xs text-white/70 hover:text-white transition-colors">
            Section 2
          </button>
        </div>
      </div>
    </div>
  );
}
