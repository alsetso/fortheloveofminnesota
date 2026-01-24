'use client';

import { useState, useEffect } from 'react';
import { Group } from '@/types/group';
import Link from 'next/link';
import { useAuthStateSafe } from '@/features/auth';
import { PlusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function GroupsSidebar() {
  const { account } = useAuthStateSafe();
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isPayingUser = account?.plan === 'contributor' || account?.plan === 'professional' || account?.plan === 'business';
  const yourGroups = allGroups.filter(g => g.is_member === true);
  const otherGroups = allGroups.filter(g => !g.is_member);

  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/groups?limit=50', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setAllGroups(data.groups || []);
        }
      } catch (err) {
        console.error('Error fetching groups:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Groups</h2>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-2 w-16 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderGroupItem = (group: Group) => (
    <Link
      key={group.id}
      href={`/groups/${group.slug}`}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      {/* Group Image */}
      <div className="flex-shrink-0">
        {group.image_url ? (
          <img
            src={group.image_url}
            alt={group.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-sm font-medium">
              {group.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Group Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
          {group.name}
        </div>
        <div className="text-xs text-gray-500">
          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
          {group.visibility === 'private' && ' • Private'}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-6">
      {/* Your Groups Section - Only show if user has paying plan */}
      {isPayingUser && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Your Groups</h2>
            <div className="flex items-center gap-2">
              {isPayingUser && (
                <Link
                  href="/groups/new"
                  className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                  title="Create group"
                >
                  <PlusIcon className="w-4 h-4 text-gray-600" />
                </Link>
              )}
              {isPayingUser && (
                <Link
                  href="/groups/manage"
                  className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                  title="Manage groups"
                >
                  <Cog6ToothIcon className="w-4 h-4 text-gray-600" />
                </Link>
              )}
            </div>
          </div>
          {yourGroups.length > 0 ? (
            <div className="space-y-2">
              {yourGroups.map(renderGroupItem)}
            </div>
          ) : (
            <p className="text-sm text-gray-500">You're not a member of any groups yet.</p>
          )}
        </div>
      )}

      {/* Other Groups Section - Show to all users */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {isPayingUser ? 'Other Groups' : 'Groups'}
          </h2>
        </div>
        {otherGroups.length > 0 ? (
          <div className="space-y-2">
            {otherGroups.map(renderGroupItem)}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {allGroups.length === 0 ? 'No groups available.' : 'No other groups to show.'}
          </p>
        )}
      </div>
    </div>
  );
}
