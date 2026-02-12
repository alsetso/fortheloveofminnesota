'use client';

import { useState } from 'react';
import { 
  UserCircleIcon,
  UserPlusIcon,
  UserMinusIcon,
  CheckIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { UserGroupIcon } from '@heroicons/react/24/solid';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface User {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  location?: string;
  mutualFriends?: number;
  relationship: 'friend' | 'following' | 'follower' | 'none';
  bio?: string;
  isFollowing?: boolean;
  followsYou?: boolean;
}

/**
 * Friends Feed - Display users with relationship status
 * Friends = mutual follows, Following = you follow them, Followers = they follow you
 */
export default function FriendsFeed() {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Mock users data
  const users: User[] = [
    {
      id: '1',
      username: 'sarah_mn',
      name: 'Sarah Johnson',
      location: 'Minneapolis, MN',
      mutualFriends: 12,
      relationship: 'friend',
      bio: 'Love exploring Minnesota!',
      isFollowing: true,
      followsYou: true,
    },
    {
      id: '2',
      username: 'minnesota_explorer',
      name: 'Mike Chen',
      location: 'Duluth, MN',
      mutualFriends: 8,
      relationship: 'following',
      bio: 'Outdoor enthusiast',
      isFollowing: true,
      followsYou: false,
    },
    {
      id: '3',
      username: 'twin_cities_lover',
      name: 'Emma Davis',
      location: 'St. Paul, MN',
      mutualFriends: 5,
      relationship: 'follower',
      bio: 'Sharing my Minnesota adventures',
      isFollowing: false,
      followsYou: true,
    },
    {
      id: '4',
      username: 'north_woods_hiker',
      name: 'Alex Thompson',
      location: 'Boundary Waters, MN',
      mutualFriends: 0,
      relationship: 'none',
      bio: 'Hiking the North Woods',
      isFollowing: false,
      followsYou: false,
    },
    {
      id: '5',
      username: 'lake_superior_views',
      name: 'Jessica Martinez',
      location: 'Grand Marais, MN',
      mutualFriends: 15,
      relationship: 'friend',
      bio: 'Lake Superior photographer',
      isFollowing: true,
      followsYou: true,
    },
  ];

  const getRelationshipBadge = (user: User) => {
    if (user.relationship === 'friend') {
      return (
        <span className="px-2 py-0.5 bg-lake-blue/20 text-lake-blue text-xs font-medium rounded flex items-center gap-1">
          <UserGroupIcon className="w-3 h-3" />
          Friends
        </span>
      );
    }
    if (user.relationship === 'following') {
      return (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded">
          Following
        </span>
      );
    }
    if (user.relationship === 'follower') {
      return (
        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded">
          Follows you
        </span>
      );
    }
    return null;
  };

  const filteredUsers = selectedFilter === 'all' 
    ? users 
    : users.filter(u => {
        if (selectedFilter === 'friends') return u.relationship === 'friend';
        if (selectedFilter === 'following') return u.relationship === 'following';
        if (selectedFilter === 'followers') return u.relationship === 'follower';
        if (selectedFilter === 'suggestions') return u.relationship === 'none';
        return true;
      });

  return (
    <div className="max-w-[800px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Friends</h1>
        <p className="text-sm text-white/60">
          Manage your connections on Love of Minnesota
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-surface border border-white/10 rounded-md p-3 text-center">
          <div className="text-2xl font-bold text-white">{users.length}</div>
          <div className="text-xs text-white/60 mt-1">Total</div>
        </div>
        <div className="bg-surface border border-white/10 rounded-md p-3 text-center">
          <div className="text-2xl font-bold text-lake-blue">
            {users.filter(u => u.relationship === 'friend').length}
          </div>
          <div className="text-xs text-white/60 mt-1">Friends</div>
        </div>
        <div className="bg-surface border border-white/10 rounded-md p-3 text-center">
          <div className="text-2xl font-bold text-green-400">
            {users.filter(u => u.relationship === 'following').length}
          </div>
          <div className="text-xs text-white/60 mt-1">Following</div>
        </div>
        <div className="bg-surface border border-white/10 rounded-md p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">
            {users.filter(u => u.relationship === 'follower').length}
          </div>
          <div className="text-xs text-white/60 mt-1">Followers</div>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className="bg-surface border border-white/10 rounded-md p-4 cursor-pointer hover:border-white/20 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {user.avatar ? (
                  <ProfilePhoto account={{ username: user.username, image_url: user.avatar }} size="md" editable={false} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-accent flex items-center justify-center border border-white/10">
                    <UserCircleIcon className="w-6 h-6 text-white/60" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {user.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/60">@{user.username}</span>
                      {getRelationshipBadge(user)}
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  {user.relationship === 'friend' ? (
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs font-medium">
                      <UserGroupIcon className="w-4 h-4" />
                      Friends
                    </button>
                  ) : user.isFollowing ? (
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs font-medium">
                      <CheckIcon className="w-4 h-4" />
                      Following
                    </button>
                  ) : (
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-xs font-medium">
                      <UserPlusIcon className="w-4 h-4" />
                      Follow
                    </button>
                  )}
                </div>

                {/* Bio */}
                {user.bio && (
                  <p className="text-xs text-white/70 mb-2">{user.bio}</p>
                )}

                {/* Location & Mutual Friends */}
                <div className="flex items-center gap-4 text-xs text-white/60">
                  {user.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPinIcon className="w-3 h-3" />
                      <span>{user.location}</span>
                    </div>
                  )}
                  {user.mutualFriends !== undefined && user.mutualFriends > 0 && (
                    <div className="flex items-center gap-1.5">
                      <UserGroupIcon className="w-3 h-3" />
                      <span>{user.mutualFriends} mutual friends</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <div className="text-center py-12 border border-white/10 border-dashed rounded-md bg-surface/50">
          <UserCircleIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Users Found</h3>
          <p className="text-sm text-white/60">
            {selectedFilter === 'suggestions' 
              ? 'No suggestions available at this time'
              : `No ${selectedFilter} found`}
          </p>
        </div>
      )}
    </div>
  );
}
