'use client';

import { 
  UserCircleIcon,
  UserPlusIcon,
  UserMinusIcon,
  UserGroupIcon,
  MapPinIcon,
  CalendarIcon,
  LinkIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { UserGroupIcon as UserGroupIconSolid } from '@heroicons/react/24/solid';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

/**
 * Right Sidebar for Friends page
 * Selected user details, relationship status, actions, mutual connections
 */
export default function FriendsRightSidebar() {
  // Mock selected user
  const selectedUser = {
    id: '1',
    username: 'sarah_mn',
    name: 'Sarah Johnson',
    avatar: null,
    location: 'Minneapolis, MN',
    bio: 'Love exploring Minnesota! Always looking for new places to discover and share.',
    relationship: 'friend' as const,
    isFollowing: true,
    followsYou: true,
    mutualFriends: 12,
    joinedDate: '2023-05-15',
    posts: 156,
    pins: 89,
    followers: 234,
    following: 189,
  };

  const mutualConnections = [
    { id: '2', username: 'minnesota_explorer', name: 'Mike Chen', avatar: null },
    { id: '3', username: 'twin_cities_lover', name: 'Emma Davis', avatar: null },
    { id: '4', username: 'north_woods_hiker', name: 'Alex Thompson', avatar: null },
  ];

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      {selectedUser ? (
        <div className="space-y-4">
          {/* User Header */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              {selectedUser.avatar ? (
                <ProfilePhoto 
                  account={{ username: selectedUser.username, image_url: selectedUser.avatar }} 
                  size="lg" 
                  editable={false} 
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-surface-accent flex items-center justify-center border border-white/10">
                  <UserCircleIcon className="w-8 h-8 text-white/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white truncate">
                  {selectedUser.name}
                </h3>
                <div className="text-sm text-white/60 truncate">
                  @{selectedUser.username}
                </div>
              </div>
            </div>

            {/* Relationship Badge */}
            {selectedUser.relationship === 'friend' && (
              <div className="bg-lake-blue/20 border border-lake-blue/30 rounded-md p-2 mb-3">
                <div className="flex items-center gap-2">
                  <UserGroupIconSolid className="w-5 h-5 text-lake-blue" />
                  <div>
                    <div className="text-sm font-medium text-lake-blue">Friends</div>
                    <div className="text-xs text-white/60">You follow each other</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bio */}
          {selectedUser.bio && (
            <div>
              <p className="text-sm text-white/80">{selectedUser.bio}</p>
            </div>
          )}

          {/* Location */}
          {selectedUser.location && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <MapPinIcon className="w-4 h-4" />
              <span>{selectedUser.location}</span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{selectedUser.posts}</div>
              <div className="text-xs text-white/60">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{selectedUser.pins}</div>
              <div className="text-xs text-white/60">Pins</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{selectedUser.followers}</div>
              <div className="text-xs text-white/60">Followers</div>
            </div>
          </div>

          {/* Mutual Friends */}
          {selectedUser.mutualFriends > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-white/60 mb-2">
                {selectedUser.mutualFriends} Mutual Friends
              </h4>
              <div className="space-y-2">
                {mutualConnections.slice(0, 3).map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-2 p-2 bg-surface-accent rounded-md"
                  >
                    <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center">
                      <UserCircleIcon className="w-4 h-4 text-white/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {friend.name}
                      </div>
                      <div className="text-xs text-white/60 truncate">
                        @{friend.username}
                      </div>
                    </div>
                  </div>
                ))}
                {selectedUser.mutualFriends > 3 && (
                  <button className="w-full text-xs text-white/60 hover:text-white text-center py-1">
                    View all {selectedUser.mutualFriends} mutual friends
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            {selectedUser.relationship === 'friend' ? (
              <>
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs font-medium">
                  <UserGroupIconSolid className="w-4 h-4" />
                  Friends
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/30 transition-colors text-xs font-medium">
                  <UserMinusIcon className="w-4 h-4" />
                  Unfriend
                </button>
              </>
            ) : selectedUser.isFollowing ? (
              <>
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs font-medium">
                  <UserPlusIcon className="w-4 h-4" />
                  Following
                </button>
                {selectedUser.followsYou && (
                  <div className="text-xs text-white/60 text-center py-1">
                    Follows you back
                  </div>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/30 transition-colors text-xs font-medium">
                  <UserMinusIcon className="w-4 h-4" />
                  Unfollow
                </button>
              </>
            ) : (
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-xs font-medium">
                <UserPlusIcon className="w-4 h-4" />
                Follow
              </button>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs">
                <LinkIcon className="w-4 h-4" />
                Profile
              </button>
              <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs">
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>

          {/* Joined Date */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <CalendarIcon className="w-3 h-3" />
              <span>
                Joined {new Date(selectedUser.joinedDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long'
                })}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <UserCircleIcon className="w-12 h-12 text-white/30 mx-auto mb-3" />
          <p className="text-sm text-white/60">Select a user to view details</p>
        </div>
      )}
    </div>
  );
}
