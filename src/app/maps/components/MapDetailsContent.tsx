'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, EyeIcon, UserGroupIcon, GlobeAltIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe } from '@/features/auth';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from '../types';
import JoinMapRequestModal from '@/app/map/[id]/components/JoinMapRequestModal';

interface MapDetailsContentProps {
  map: MapItem | null;
  account: { plan?: string | null; id?: string } | null;
  onClose?: () => void;
}

interface MapMembershipData {
  isMember: boolean;
  isOwner: boolean;
  autoApproveMembers: boolean;
  membershipQuestions: Array<{ id: number; question: string }>;
  membershipRules: string | null;
  hasPendingRequest: boolean;
}

export default function MapDetailsContent({ map, account, onClose }: MapDetailsContentProps) {
  const router = useRouter();
  const { openWelcome } = useAppModalContextSafe();
  const { activeAccountId, account: activeAccount } = useAuthStateSafe();
  const { addToast } = useToastContext();
  const [membershipData, setMembershipData] = useState<MapMembershipData | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Use active account ID from context (from account dropdown) instead of prop account
  const currentAccountId = activeAccountId || account?.id || null;
  const currentAccount = activeAccount || account;
  
  // Trigger confetti animation
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Left side confetti
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      
      // Right side confetti
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  };
  
  // Fetch membership data when map changes or active account changes
  useEffect(() => {
    if (!map || !currentAccountId) {
      setMembershipData(null);
      return;
    }

    const fetchMembershipData = async () => {
      setLoadingMembership(true);
      try {
        const mapId = map.id || map.slug;
        if (!mapId) return;

        // Fetch full map data including membership settings
        const mapResponse = await fetch(`/api/maps/${mapId}`);
        if (!mapResponse.ok) {
          // If 403, user doesn't have access (private map)
          if (mapResponse.status === 403) {
            setMembershipData({
              isMember: false,
              isOwner: false,
              autoApproveMembers: false,
              membershipQuestions: [],
              membershipRules: null,
              hasPendingRequest: false,
            });
            return;
          }
          throw new Error('Failed to fetch map data');
        }

        const mapData = await mapResponse.json();
        const fullMap = mapData.map || mapData;

        // Check membership status
        const membersResponse = await fetch(`/api/maps/${mapId}/members`);
        const membersData = membersResponse.ok ? await membersResponse.json() : { members: [] };
        const isMember = membersData.members?.some((m: any) => m.account_id === currentAccountId) || false;
        const isOwner = fullMap.account_id === currentAccountId;

        // Check for pending requests
        let hasPendingRequest = false;
        if (!isMember && !isOwner) {
          const requestsResponse = await fetch(`/api/maps/${mapId}/membership-requests`);
          if (requestsResponse.ok) {
            const requestsData = await requestsResponse.json();
            hasPendingRequest = requestsData.requests?.some((r: any) => r.account_id === currentAccountId && r.status === 'pending') || false;
          }
        }

        setMembershipData({
          isMember,
          isOwner,
          autoApproveMembers: fullMap.auto_approve_members || false,
          membershipQuestions: fullMap.membership_questions || [],
          membershipRules: fullMap.membership_rules || null,
          hasPendingRequest,
        });
      } catch (err) {
        console.error('Error fetching membership data:', err);
        setMembershipData(null);
      } finally {
        setLoadingMembership(false);
      }
    };
    
    fetchMembershipData();
  }, [map, currentAccountId]);

  const handleViewMap = () => {
    if (!map) return;
    const mapUrl = getMapUrl({ id: map.id, slug: map.slug, custom_slug: map.custom_slug });
    router.push(mapUrl);
    onClose?.();
  };

  const handleJoinMap = async (answers: Array<{ question_id: number; answer: string }>) => {
    if (!map || !currentAccountId) {
      openWelcome();
      return;
    }

    try {
      const mapId = map.id || map.slug;
      const response = await fetch(`/api/maps/${mapId}/membership-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join map');
      }

      const data = await response.json();
      
      // If auto-approved, show celebration and refresh membership data
      if (data.auto_approved) {
        // Trigger confetti (cleanup handled automatically by interval timeout)
        const cleanup = triggerConfetti();
        setTimeout(() => cleanup(), 3000);
        
        // Get username for toast
        const accountWithDetails = currentAccount as any;
        const username = accountWithDetails?.username 
          ? `@${accountWithDetails.username}`
          : accountWithDetails?.first_name && accountWithDetails?.last_name
          ? `${accountWithDetails.first_name} ${accountWithDetails.last_name}`
          : 'You';
        
        // Show success toast
        addToast(createToast('success', `${username} just joined ${map.name}`, {
          duration: 4000,
        }));
        
        // Refresh membership status
        const membersResponse = await fetch(`/api/maps/${mapId}/members`);
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          const isMember = membersData.members?.some((m: any) => m.account_id === currentAccountId) || false;
          if (membershipData) {
            setMembershipData({ ...membershipData, isMember });
          }
        }
        setShowJoinModal(false);
        // Navigate to map after joining
        handleViewMap();
      } else {
        // Request submitted, show pending state
        if (membershipData) {
          setMembershipData({ ...membershipData, hasPendingRequest: true });
        }
        setShowJoinModal(false);
      }
    } catch (err: any) {
      addToast(createToast('error', err.message || 'Failed to join map', {
        duration: 4000,
      }));
    }
  };
  
  if (!map) {
    return (
      <div className="p-3 text-center text-xs text-gray-500">
        No map selected
      </div>
    );
  }

  const displayName = map.account
    ? (map.account.first_name && map.account.last_name
        ? `${map.account.first_name} ${map.account.last_name}`
        : map.account.username
        ? `@${map.account.username}`
        : 'User')
    : null;
  
  const isOwner = currentAccountId && map.account && currentAccountId === map.account.id;
  const isMember = membershipData?.isMember || map.current_user_role !== null;
  const canViewMap = isMember || isOwner || !currentAccountId; // Allow viewing if member, owner, or not logged in
  
  return (
    <>
      {/* Header - Desktop only (mobile header is in UnifiedSidebarContainer) */}
      <div className="hidden lg:flex items-center justify-between p-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Map Details</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Title */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-gray-500">Title</div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
            <div className="text-xs text-gray-900">{map.name}</div>
          </div>
        </div>
        
        {/* Description */}
        {map.description && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-gray-500">Description</div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
              <div className="text-xs text-gray-600 whitespace-pre-wrap break-words">{map.description}</div>
            </div>
          </div>
        )}
        
        {/* Owner */}
        {map.account && !map.settings?.presentation?.hide_creator && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-gray-500">Owner</div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
              <div className="flex items-center gap-2">
                {map.account.image_url ? (
                  <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                    <Image
                      src={map.account.image_url}
                      alt={displayName || 'User'}
                      width={24}
                      height={24}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] text-gray-500">
                      {(map.account.first_name?.[0] || map.account.username?.[0] || 'U').toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-xs font-medium text-gray-900 truncate flex-1">
                  {displayName}
                </span>
                {isOwner && (
                  <span className="text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                    Owner
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Stats */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-gray-500">Statistics</div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1.5">
            {map.member_count !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <UserGroupIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-600">Members</span>
                </div>
                <span className="text-xs font-medium text-gray-900">{map.member_count}</span>
              </div>
            )}
            {map.view_count !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <EyeIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-600">Views</span>
                </div>
                <span className="text-xs font-medium text-gray-900">
                  {map.view_count.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Visibility */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-gray-500">Visibility</div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
            <div className="flex items-center gap-1.5">
              {map.visibility === 'public' ? (
                <>
                  <GlobeAltIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-xs font-medium text-gray-900 capitalize">Public</span>
                </>
              ) : (
                <>
                  <LockClosedIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-xs font-medium text-gray-900 capitalize">Private</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Categories */}
        {map.categories && map.categories.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-gray-500">Categories</div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
              <div className="flex flex-wrap gap-1">
                {map.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded border border-gray-200 capitalize"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Role (for My Maps) */}
        {map.current_user_role && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-gray-500">Your Role</div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
              <span className="text-xs font-medium text-gray-900 capitalize">
                {map.current_user_role}
              </span>
            </div>
          </div>
        )}
        
        {/* Footer Actions */}
        <div className="pt-2 space-y-2">
          {!currentAccountId ? (
            <button
              onClick={openWelcome}
              className="w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              Sign In to View Map
            </button>
          ) : map.visibility === 'public' ? (
            // For public maps, show View Map immediately without waiting for membership data
            <button
              onClick={handleViewMap}
              className="w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              View Map
            </button>
          ) : loadingMembership ? (
            <div className="w-full px-3 py-1.5 text-xs text-center text-gray-500">
              Loading...
            </div>
          ) : isMember || isOwner ? (
            <button
              onClick={handleViewMap}
              className="w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              View Map
            </button>
          ) : membershipData?.hasPendingRequest ? (
            <div className="w-full px-3 py-1.5 text-xs text-center text-gray-600 bg-gray-50 rounded-md">
              Membership request pending
            </div>
          ) : (
            <button
              onClick={() => {
                // If we have membership data and conditions are met, direct join
                if (membershipData && 
                    membershipData.membershipQuestions.length === 0 && 
                    membershipData.autoApproveMembers && 
                    map.visibility === 'public') {
                  // Direct join if no questions and auto-approve
                  handleJoinMap([]);
                } else if (membershipData) {
                  // Show join request modal
                  setShowJoinModal(true);
                } else {
                  // Fallback: if membershipData is null, try to show modal or direct join
                  // For public maps, attempt direct join
                  if (map.visibility === 'public') {
                    handleJoinMap([]);
                  } else {
                    setShowJoinModal(true);
                  }
                }
              }}
              className="w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              {membershipData 
                ? (membershipData.autoApproveMembers && (map.visibility as string) === 'public'
                    ? 'Join Map'
                    : 'Request to Join')
                : ((map.visibility as string) === 'public' ? 'Join Map' : 'Request to Join')}
            </button>
          )}
        </div>
      </div>

      {/* Join Request Modal */}
      {showJoinModal && membershipData && (
        <JoinMapRequestModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onSubmit={handleJoinMap}
          membershipQuestions={membershipData.membershipQuestions}
          membershipRules={membershipData.membershipRules}
        />
      )}
    </>
  );
}
