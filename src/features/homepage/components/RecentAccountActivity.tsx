'use client';

import { useState, useEffect } from 'react';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { Account } from '@/features/auth';

interface Activity {
  entity_type: string;
  entity_id: string | null;
  url: string;
  viewed_at: string;
}

interface AccountActivity {
  account: Account;
  activities: Activity[];
  lastActive: string;
  activityCount: number;
}

interface RecentAccountActivityProps {
  isAdmin: boolean;
}

export default function RecentAccountActivity({ isAdmin }: RecentAccountActivityProps) {
  const [accountActivities, setAccountActivities] = useState<AccountActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchActivity = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/analytics/recent-activity', { credentials: 'include' });
        if (!res.ok) {
          console.error('Failed to fetch recent activity:', res.statusText);
          setAccountActivities([]);
          return;
        }
        const data = await res.json();
        setAccountActivities(data.accounts || []);
      } catch (err) {
        console.error('Error fetching recent activity:', err);
        setAccountActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const toggleAccount = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getEntityLabel = (entityType: string, url: string) => {
    switch (entityType) {
      case 'map':
        return 'Viewed map';
      case 'pin':
        return 'Viewed pin';
      case 'profile':
        return 'Viewed profile';
      case 'post':
        return 'Viewed post';
      case 'page':
        return url === '/' ? 'Homepage' : url === '/live' ? 'Live Map' : `Page: ${url}`;
      default:
        return `Viewed ${entityType}`;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent Activity (24h)</p>
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide bg-gray-100 px-1.5 py-0.5 rounded">Admin</span>
      </div>

      <div className="border border-gray-200 rounded-md bg-gray-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 p-[10px] text-left hover:bg-gray-100 transition-colors"
          aria-expanded={isOpen}
        >
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            {loading ? 'Loading...' : `${accountActivities.length} active accounts`}
          </span>
          <ChevronDownIcon
            className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {isOpen && (
          <div className="border-t border-gray-200 p-[10px] space-y-2">
            {loading ? (
              <div className="text-xs text-gray-500 text-center py-4">Loading activity...</div>
            ) : accountActivities.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">No activity in the last 24 hours</div>
            ) : (
              accountActivities.map((accountActivity) => {
                const isExpanded = expandedAccounts.has(accountActivity.account.id);
                return (
                  <div
                    key={accountActivity.account.id}
                    className="bg-white border border-gray-200 rounded-md overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleAccount(accountActivity.account.id)}
                      className="w-full flex items-center justify-between gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <ProfilePhoto account={accountActivity.account} size="sm" editable={false} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {accountActivity.account.first_name || accountActivity.account.username || 'Unknown'}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {accountActivity.activityCount} activities • {formatTimeAgo(accountActivity.lastActive)}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-200 p-[10px] space-y-1.5">
                        {accountActivity.activities.slice(0, 10).map((activity, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-gray-600 flex items-center justify-between gap-2 py-1"
                          >
                            <span className="flex-1 truncate">{getEntityLabel(activity.entity_type, activity.url)}</span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {formatTimeAgo(activity.viewed_at)}
                            </span>
                          </div>
                        ))}
                        {accountActivity.activities.length > 10 && (
                          <div className="text-[10px] text-gray-400 text-center pt-1">
                            +{accountActivity.activities.length - 10} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
