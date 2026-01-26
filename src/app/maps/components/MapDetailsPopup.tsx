'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, EyeIcon, UserGroupIcon, GlobeAltIcon, LockClosedIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe } from '@/features/auth';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import BottomButtonsPopup from '@/components/layout/BottomButtonsPopup';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from '../types';
import JoinMapRequestModal from '@/app/map/[id]/components/JoinMapRequestModal';

interface MapDetailsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  map: MapItem | null;
  account: { plan?: string | null; id?: string } | null;
}

interface MapMembershipData {
  isMember: boolean;
  isOwner: boolean;
  autoApproveMembers: boolean;
  membershipQuestions: Array<{ id: number; question: string }>;
  membershipRules: string | null;
  hasPendingRequest: boolean;
}

export default function MapDetailsPopup({ isOpen, onClose, map, account }: MapDetailsPopupProps) {
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
  
  // Fetch membership data when modal opens or active account changes
  useEffect(() => {
    if (!isOpen || !map || !currentAccountId) {
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
          } else {
            setMembershipData(null);
          }
          return;
        }
        const mapData = await mapResponse.json();

        // Check if user is a member (using active account ID)
        // For public maps, we'll try to check membership, but if 403, assume not a member
        let isMember = false;
        try {
          const membersResponse = await fetch(`/api/maps/${mapId}/members`);
          if (membersResponse.ok) {
            const membersData = await membersResponse.json();
            isMember = membersData.members?.some((m: any) => m.account_id === currentAccountId) || false;
          } else if (membersResponse.status === 403) {
            // 403 means user is not a member (can't view members list)
            isMember = false;
          }
        } catch (err) {
          // If error, assume not a member
          isMember = false;
        }

        // Check for pending request (using active account ID)
        // For public maps, we'll try to check, but if 403, assume no pending request
        let hasPendingRequest = false;
        try {
          const requestsResponse = await fetch(`/api/maps/${mapId}/membership-requests`);
          if (requestsResponse.ok) {
            const requestsData = await requestsResponse.json();
            hasPendingRequest = requestsData.requests?.some(
              (r: any) => r.account_id === currentAccountId && r.status === 'pending'
            ) || false;
          } else if (requestsResponse.status === 403) {
            // 403 means user can't view requests (not a manager/owner)
            // For non-members, we can't check pending status via this endpoint
            // We'll assume no pending request and show join button
            hasPendingRequest = false;
          }
        } catch (err) {
          // If error, assume no pending request
          hasPendingRequest = false;
        }

        const isOwner = currentAccountId === mapData.account_id;
        const isPublic = mapData.visibility === 'public';

        // Transform membership questions to ensure they have IDs
        // Database format: [{"question": "...", "required": true}, ...]
        // Expected format: [{id: number, question: string}, ...]
        const membershipQuestions = (mapData.membership_questions || []).map((q: any, index: number) => ({
          id: q.id !== undefined ? q.id : index,
          question: q.question || q,
        }));

        // For public maps, if we couldn't determine membership (403), assume not a member
        // This allows showing "Join Map" button
        const finalIsMember = isPublic && !isMember && !isOwner ? false : isMember;

        setMembershipData({
          isMember: finalIsMember,
          isOwner,
          autoApproveMembers: mapData.auto_approve_members || false,
          membershipQuestions,
          membershipRules: mapData.membership_rules || null,
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
  }, [isOpen, map, currentAccountId]);

  if (!isOpen || !map) return null;
  
  const handleViewMap = () => {
    if (map.href) {
      router.push(map.href);
    } else {
      router.push(getMapUrl(map));
    }
    onClose();
  };

  const handleJoinMap = async (answers: Array<{ question_id: number; answer: string }>) => {
    if (!currentAccountId) {
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
  
  // Content component to reuse in both mobile and desktop
  const mapDetailsContent = (
    <>
      {/* Header - Mobile only */}
      <div className="lg:hidden flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Map Details</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      
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
    </>
  );
  
  return (
    <>
      {/* Mobile: Bottom slide-up popup - full width, constrained to white container */}
      <div className="lg:hidden fixed pointer-events-none z-[60]" style={{ top: '10vh', left: 0, right: 0, height: '90vh' }}>
        {/* Backdrop - covers 100% of white container area */}
        {isOpen && (
          <div
            className="absolute inset-0 bg-black/20 pointer-events-auto transition-opacity duration-300"
            onClick={onClose}
          />
        )}
        
        {/* Popup container - full width, max height 80vh */}
        <div className="relative w-full h-full pointer-events-none">
          <BottomButtonsPopup
            isOpen={isOpen}
            onClose={onClose}
            type="account"
            height="half"
            containerRelative={true}
          >
            <div className="px-4 py-4 space-y-3 pointer-events-auto">
              {mapDetailsContent}
            </div>
          </BottomButtonsPopup>
        </div>
      </div>

      {/* Desktop: Centered modal */}
      <div className="hidden lg:flex fixed inset-0 z-50 items-center justify-center">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Map Details</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto flex-1 p-3 space-y-3">
            {mapDetailsContent}
          </div>
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
