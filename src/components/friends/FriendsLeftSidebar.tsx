'use client';

import { useState } from 'react';
import { 
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { UserGroupIcon as UserGroupIconSolid } from '@heroicons/react/24/solid';

/**
 * Left Sidebar for Friends page
 * Filters: All, Friends, Following, Followers, Suggestions
 */
export default function FriendsLeftSidebar() {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filters = [
    { id: 'all', label: 'All', icon: UsersIcon, count: 247 },
    { id: 'friends', label: 'Friends', icon: UserGroupIconSolid, count: 89, badge: 'mutual' },
    { id: 'following', label: 'Following', icon: UserPlusIcon, count: 156 },
    { id: 'followers', label: 'Followers', icon: UsersIcon, count: 203 },
    { id: 'suggestions', label: 'Suggestions', icon: SparklesIcon, count: 42 },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <input
            type="text"
            placeholder="Search friends..."
            className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-sm text-white placeholder:text-white/60 border-none focus:outline-none focus:ring-2 focus:ring-lake-blue"
          />
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 space-y-1">
        {filters.map((filter) => {
          const Icon = filter.icon;
          return (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`w-full flex items-center justify-between gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                selectedFilter === filter.id
                  ? 'bg-surface-accent text-white'
                  : 'text-white/70 hover:bg-surface-accent hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{filter.label}</span>
                {filter.badge && (
                  <span className="px-1.5 py-0.5 bg-lake-blue/20 text-lake-blue text-[10px] font-medium rounded">
                    {filter.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-white/50">{filter.count}</span>
            </button>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="mt-auto px-3 pt-3 border-t border-white/10">
        <div className="bg-surface-accent rounded-md p-3">
          <div className="text-xs text-white/60 mb-2">Friends = Mutual Follows</div>
          <div className="text-xs text-white/80 leading-relaxed">
            When you and another user follow each other, you become friends!
          </div>
        </div>
      </div>
    </div>
  );
}
