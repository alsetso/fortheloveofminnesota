'use client';

import Link from 'next/link';
import { UserCircleIcon, CalendarIcon } from '@heroicons/react/24/outline';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { usePage } from '@/hooks/usePage';

interface PageDetailRightSidebarProps {
  pageId: string;
}

/**
 * Right Sidebar for Page detail
 * Author info, metadata, related pages
 */
export default function PageDetailRightSidebar({ pageId }: PageDetailRightSidebarProps) {
  const { page, loading } = usePage(pageId);

  if (loading || !page) {
    return (
      <div className="h-full flex flex-col p-3 overflow-y-auto">
        <div className="flex items-center justify-center py-8">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const ownerName = page.owner.first_name && page.owner.last_name
    ? `${page.owner.first_name} ${page.owner.last_name}`
    : page.owner.username || 'Unknown';

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      <div className="space-y-4">
        {/* Author */}
        <div>
          <h3 className="text-xs font-semibold text-white/60 mb-2">Author</h3>
          <Link
            href={page.owner.username ? `/${encodeURIComponent(page.owner.username)}` : '#'}
            className="flex items-center gap-3 p-2 bg-surface-accent rounded-md hover:bg-surface-accent/80 transition-colors"
          >
            {page.owner.image_url ? (
              <ProfilePhoto account={page.owner} size="md" editable={false} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center border border-white/10">
                <UserCircleIcon className="w-5 h-5 text-white/60" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {ownerName}
              </div>
              {page.owner.username && (
                <div className="text-xs text-white/60 truncate">
                  @{page.owner.username}
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Metadata */}
        <div className="space-y-2 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <CalendarIcon className="w-4 h-4" />
            <span>Created {new Date(page.created_at).toLocaleDateString()}</span>
          </div>
          {page.last_edited_at !== page.created_at && (
            <div className="flex items-center gap-2 text-xs text-white/60">
              <CalendarIcon className="w-4 h-4" />
              <span>Updated {new Date(page.last_edited_at).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-white/70 capitalize">
            <span className="px-2 py-0.5 bg-surface-accent rounded text-white/70">
              {page.visibility}
            </span>
          </div>
        </div>

        {/* Tags */}
        {page.tags && page.tags.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <h3 className="text-xs font-semibold text-white/60 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {page.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-surface-accent text-xs text-white/70 rounded border border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
