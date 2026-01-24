'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Group, GroupMember } from '@/types/group';
import { Post } from '@/types/post';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeftIcon, 
  UserPlusIcon, 
  UserMinusIcon,
  GlobeAltIcon,
  LockClosedIcon,
  UsersIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import FeedPost from '@/components/feed/FeedPost';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { Account } from '@/features/auth';
import CreatePostModal from '@/components/feed/CreatePostModal';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

interface GroupPageClientProps {
  initialGroup: Group;
}

export default function GroupPageClient({ initialGroup }: GroupPageClientProps) {
  const router = useRouter();
  const { account, user } = useAuthStateSafe();
  const supabase = useSupabaseClient();
  const [group, setGroup] = useState<Group>(initialGroup);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const postsOffsetRef = useRef(0);
  const [showMembers, setShowMembers] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [joinRequestStatus, setJoinRequestStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  // Fetch group posts
  const fetchPosts = useCallback(async (reset = false) => {
    if (reset) {
      postsOffsetRef.current = 0;
      setIsLoadingPosts(true);
    }

    try {
      const url = new URL('/api/posts', window.location.origin);
      url.searchParams.set('limit', '20');
      url.searchParams.set('offset', postsOffsetRef.current.toString());
      url.searchParams.set('group_id', group.id);

      const response = await fetch(url.toString(), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      const newPosts = data.posts || [];

      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMorePosts(newPosts.length === 20);
      postsOffsetRef.current += newPosts.length;
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setIsLoadingPosts(false);
    }
  }, [group.id]);

  // Fetch group members
  const fetchMembers = useCallback(async () => {
    if (!group.is_member || !user) return;

    setIsLoadingMembers(true);
    try {
      const response = await fetch(`/api/groups/${group.slug}/members`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [group.slug, group.is_member, user]);

  // Join/Leave group (public groups only)
  const handleJoinLeave = async () => {
    if (!user || !account) {
      router.push('/');
      return;
    }

    // Private groups require join requests
    if (group.visibility === 'private' && !group.is_member) {
      setShowRequestModal(true);
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const method = group.is_member ? 'DELETE' : 'POST';
      const response = await fetch(`/api/groups/${group.slug}/members`, {
        method,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update membership');
      }

      // Refresh group data
      const groupResponse = await fetch(`/api/groups/${group.slug}`, {
        credentials: 'include',
      });

      if (groupResponse.ok) {
        const { group: updatedGroup } = await groupResponse.json();
        setGroup(updatedGroup);
        
        if (updatedGroup.is_member && !group.is_member) {
          fetchMembers();
        }
      }
    } catch (err) {
      console.error('Error updating membership:', err);
      setError(err instanceof Error ? err.message : 'Failed to update membership');
    } finally {
      setIsJoining(false);
    }
  };

  // Request to join private group
  const handleRequestJoin = async () => {
    if (!user || !account) {
      router.push('/');
      return;
    }

    setIsRequestingJoin(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${group.slug}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: requestMessage.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create join request');
      }

      setJoinRequestStatus('pending');
      setShowRequestModal(false);
      setRequestMessage('');
    } catch (err) {
      console.error('Error requesting to join:', err);
      setError(err instanceof Error ? err.message : 'Failed to request to join');
    } finally {
      setIsRequestingJoin(false);
    }
  };

  // Load posts on mount
  useEffect(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  // Load members when showing members section
  useEffect(() => {
    if (showMembers && group.is_member) {
      fetchMembers();
    }
  }, [showMembers, group.is_member, fetchMembers]);

  // Check join request status for private groups
  useEffect(() => {
    if (!user || !account || group.is_member || group.visibility !== 'private') {
      setJoinRequestStatus('none');
      return;
    }

    const checkRequestStatus = async () => {
      try {
        // Query user's own requests for this group via Supabase
        const { data: requests } = await supabase
          .from('group_requests')
          .select('id, status')
          .eq('group_id', group.id)
          .eq('account_id', account.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (requests && requests.length > 0) {
          const latestRequest = requests[0] as any;
          if (latestRequest.status === 'pending') {
            setJoinRequestStatus('pending');
          } else if (latestRequest.status === 'approved') {
            setJoinRequestStatus('approved');
          } else {
            setJoinRequestStatus('denied');
          }
        } else {
          setJoinRequestStatus('none');
        }
      } catch (err) {
        console.error('Error checking request status:', err);
        setJoinRequestStatus('none');
      }
    };

    checkRequestStatus();
  }, [user, account, group.id, group.is_member, group.visibility, supabase]);

  const handlePostCreated = () => {
    fetchPosts(true);
  };

  const handleLoadMore = () => {
    if (!isLoadingPosts && hasMorePosts && !error) {
      fetchPosts();
    }
  };

  const displayName = group.created_by
    ? group.created_by.first_name && group.created_by.last_name
      ? `${group.created_by.first_name} ${group.created_by.last_name}`
      : group.created_by.username || 'Unknown'
    : 'Unknown';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/groups" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Groups</span>
          </Link>
          <Link
            href="/feed"
            className="absolute left-1/2 transform -translate-x-1/2"
          >
            <Image
              src="/logo.png"
              alt="Love of Minnesota"
              width={32}
              height={32}
              className="w-8 h-8"
            />
          </Link>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Group Header */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] mb-3">
          <div className="flex items-start gap-3">
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
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h1 className="text-sm font-semibold text-gray-900">{group.name}</h1>
                {group.visibility === 'public' ? (
                  <GlobeAltIcon className="w-4 h-4 text-gray-500 flex-shrink-0" title="Public" />
                ) : (
                  <LockClosedIcon className="w-4 h-4 text-gray-500 flex-shrink-0" title="Private" />
                )}
              </div>

              {group.description && (
                <p className="text-xs text-gray-600 mb-2">{group.description}</p>
              )}

              <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                <span>{group.member_count} {group.member_count === 1 ? 'member' : 'members'}</span>
                <span>•</span>
                <span>{group.post_count} {group.post_count === 1 ? 'post' : 'posts'}</span>
                <span>•</span>
                <span>Created by {displayName}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                {user && account ? (
                  <>
                    {group.is_member ? (
                      <button
                        onClick={handleJoinLeave}
                        disabled={isJoining}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isJoining ? (
                          'Loading...'
                        ) : (
                          <>
                            <UserMinusIcon className="w-3.5 h-3.5 inline mr-1" />
                            Leave Group
                          </>
                        )}
                      </button>
                    ) : group.visibility === 'private' ? (
                      <>
                        {joinRequestStatus === 'pending' ? (
                          <div className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md">
                            Request Pending
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowRequestModal(true)}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Request to Join
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={handleJoinLeave}
                        disabled={isJoining}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isJoining ? (
                          'Loading...'
                        ) : (
                          <>
                            <UserPlusIcon className="w-3.5 h-3.5 inline mr-1" />
                            Join Group
                          </>
                        )}
                      </button>
                    )}
                    {group.is_admin && (
                      <Link
                        href={`/groups/${group.slug}/settings`}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        <PencilIcon className="w-3.5 h-3.5 inline mr-1" />
                        Edit Group
                      </Link>
                    )}
                  </>
                ) : (
                  <Link
                    href="/"
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Sign in to join
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-[10px] mb-3">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Members Section (if member) */}
        {group.is_member && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px] mb-3">
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-900">Members</span>
                <span className="text-xs text-gray-500">({group.member_count})</span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${showMembers ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMembers && (
              <div className="mt-3 space-y-2">
                {isLoadingMembers ? (
                  <div className="text-xs text-gray-500">Loading members...</div>
                ) : members.length > 0 ? (
                  members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <ProfilePhoto
                        account={member.account as unknown as Account}
                        size="sm"
                        editable={false}
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/profile/${member.account?.username || 'unknown'}`}
                          className="text-xs font-medium text-gray-900 hover:text-blue-600"
                        >
                          {member.account?.first_name && member.account?.last_name
                            ? `${member.account.first_name} ${member.account.last_name}`
                            : member.account?.username || 'Unknown'}
                        </Link>
                        {member.is_admin && (
                          <span className="text-xs text-gray-500 ml-1">• Admin</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500">No members found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Posts Section */}
        <div className="space-y-3">
          {user && account && group.is_member && (
            <div className="bg-white border border-gray-200 rounded-md p-[10px]">
              <button
                onClick={() => setIsCreatePostModalOpen(true)}
                className="w-full text-left text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Create Post in {group.name}
              </button>
            </div>
          )}

          {isLoadingPosts && posts.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-md p-[10px] animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : posts.length > 0 ? (
            <>
              {posts.map((post) => (
                <FeedPost key={post.id} post={post} />
              ))}

              {hasMorePosts && (
                <div className="text-center py-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingPosts}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingPosts ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md p-[10px] text-center">
              <p className="text-xs text-gray-500">
                {group.is_member ? 'No posts yet. Be the first to post!' : 'Join the group to see posts'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Create Post Modal */}
      {user && account && (
        <CreatePostModal
          isOpen={isCreatePostModalOpen}
          onClose={() => setIsCreatePostModalOpen(false)}
          onPostCreated={() => {
            setIsCreatePostModalOpen(false);
            handlePostCreated();
          }}
          initialGroupId={group.id}
          lockGroupId={true}
        />
      )}

      {/* Request to Join Modal */}
      {showRequestModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[100] transition-opacity"
            onClick={() => setShowRequestModal(false)}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-[400px] pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Request to Join {group.name}</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Message (optional)
                  </label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Tell the group admins why you'd like to join..."
                    maxLength={500}
                    rows={4}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {requestMessage.length}/500 characters
                  </div>
                </div>
                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    {error}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setRequestMessage('');
                    setError(null);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestJoin}
                  disabled={isRequestingJoin}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequestingJoin ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
