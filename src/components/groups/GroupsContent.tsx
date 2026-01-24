'use client';

import { useState, useEffect } from 'react';
import { Group } from '@/types/group';
import Link from 'next/link';
import { useAuthStateSafe } from '@/features/auth';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function GroupsContent() {
  const { account } = useAuthStateSafe();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPayingUser = account?.plan === 'contributor' || account?.plan === 'business';
  const yourGroups = groups.filter(g => g.is_member === true);
  const otherGroups = groups.filter(g => !g.is_member);

  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/groups?limit=100', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setGroups(data.groups || []);
        } else {
          setError('Failed to load groups');
        }
      } catch (err) {
        console.error('Error fetching groups:', err);
        setError('Failed to load groups');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  const renderGroupItem = (group: Group) => (
    <Link
      key={group.id}
      href={`/groups/${group.slug}`}
      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
    >
      {/* Group Image */}
      <div className="flex-shrink-0">
        {group.image_url ? (
          <img
            src={group.image_url}
            alt={group.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-xl font-medium">
              {group.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Group Info */}
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
          {group.name}
        </div>
        {group.description && (
          <div className="text-sm text-gray-600 mt-1 line-clamp-2">
            {group.description}
          </div>
        )}
        <div className="text-xs text-gray-500 mt-2">
          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
          {group.visibility === 'private' && ' • Private'}
        </div>
      </div>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200">
                <div className="w-16 h-16 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-200 rounded" />
                  <div className="h-3 w-64 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        {isPayingUser && (
          <Link
            href="/groups/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Create Group</span>
          </Link>
        )}
      </div>

      {/* Your Groups Section - Only show if user has paying plan */}
      {isPayingUser && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Groups</h2>
          {yourGroups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {yourGroups.map(renderGroupItem)}
            </div>
          ) : (
            <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-gray-600 mb-4">You're not a member of any groups yet.</p>
              <Link
                href="/groups/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Create Your First Group</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Other Groups Section - Show to all users */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isPayingUser ? 'All Groups' : 'Groups'}
        </h2>
        {otherGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherGroups.map(renderGroupItem)}
          </div>
        ) : (
          <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-gray-600">No groups available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
