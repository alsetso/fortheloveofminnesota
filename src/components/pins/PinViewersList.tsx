'use client';

import { useState, useEffect } from 'react';
import { UserIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import ProfilePhoto from '@/components/ProfilePhoto';

interface Viewer {
  account_id: string | null;
  account_username: string | null;
  account_first_name: string | null;
  account_last_name: string | null;
  account_image_url: string | null;
  viewed_at: string;
  view_count: number;
}

interface PinViewersListProps {
  pinId: string;
  limit?: number;
  className?: string;
  showHeader?: boolean;
}

export default function PinViewersList({ pinId, limit = 10, className = '', showHeader = true }: PinViewersListProps) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pinId) {
      setLoading(false);
      return;
    }

    const fetchViewers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/analytics/visitors?pin_id=${pinId}&limit=${limit}&offset=0`);
        if (!response.ok) {
          throw new Error('Failed to fetch viewers');
        }
        const data = await response.json();
        setViewers(data.visitors || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('[PinViewersList] Error fetching viewers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchViewers();
  }, [pinId, limit]);

  if (loading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-md p-[10px] ${className}`}>
        {showHeader && <div className="text-xs font-semibold text-gray-900 mb-2">Recent Viewers</div>}
        <div className="text-xs text-gray-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || viewers.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-md p-[10px] space-y-2 ${className}`}>
      {showHeader && (
        <div className="flex items-center gap-1.5 mb-2">
          <UserIcon className="w-3 h-3 text-gray-500" />
          <h3 className="text-xs font-semibold text-gray-900">Recent Viewers</h3>
        </div>
      )}

      <div className="space-y-1.5">
        {viewers.map((viewer) => {
          const displayName = viewer.account_first_name && viewer.account_last_name
            ? `${viewer.account_first_name} ${viewer.account_last_name}`
            : viewer.account_username || 'Guest';

          return (
            <div key={viewer.account_id || `guest-${viewer.viewed_at}`} className="flex items-center gap-2 text-xs">
              <ProfilePhoto
                imageUrl={viewer.account_image_url}
                username={viewer.account_username}
                size={20}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 truncate font-medium">{displayName}</div>
                <div className="text-gray-500 text-[10px]">
                  {formatDistanceToNow(new Date(viewer.viewed_at), { addSuffix: true })}
                  {viewer.view_count > 1 && ` • ${viewer.view_count} views`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

