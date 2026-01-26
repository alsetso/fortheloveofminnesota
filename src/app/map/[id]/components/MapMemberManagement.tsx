'use client';

import { useState, useEffect } from 'react';
import { UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import MapMemberItem from './MapMemberItem';
import InviteMemberModal from './InviteMemberModal';
import MapMembershipRequests from './MapMembershipRequests';
import type { MapMember } from '@/types/map';

interface MapMemberManagementProps {
  mapId: string;
  mapAccountId: string;
  autoApproveMembers: boolean;
  membershipQuestions: Array<{ id: number; question: string }>;
  membershipRules: string | null;
  onMemberAdded?: () => void;
  onMemberRemoved?: () => void;
  onClose?: () => void;
}

export default function MapMemberManagement({
  mapId,
  mapAccountId,
  autoApproveMembers,
  membershipQuestions,
  membershipRules,
  onMemberAdded,
  onMemberRemoved,
  onClose,
}: MapMemberManagementProps) {
  const { account } = useAuthStateSafe();
  const { addToast } = useToastContext();
  const [members, setMembers] = useState<MapMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'editor' | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const isMapOwner = account?.id === mapAccountId;
  const isManager = userRole === 'manager' || userRole === 'owner';
  const canManage = isMapOwner || isManager;

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/maps/${mapId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
        
        // Find current user's role
        const myMember = data.members?.find((m: MapMember) => m.account_id === account?.id);
        if (myMember) {
          setUserRole(myMember.role);
        } else if (isMapOwner) {
          setUserRole('owner');
        }
      } else if (response.status === 403) {
        // User is not a member - show access denied message
        setAccessDenied(true);
        setMembers([]);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [mapId, account?.id, isMapOwner]);

  const handleInvite = async (accountId: string, role: 'manager' | 'editor') => {
    try {
      const response = await fetch(`/api/maps/${mapId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to invite member');
      }

      await fetchMembers();
      onMemberAdded?.();
      addToast(createToast('success', 'Member invited successfully', {
        duration: 3000,
      }));
    } catch (err: any) {
      addToast(createToast('error', err.message || 'Failed to invite member', {
        duration: 4000,
      }));
      throw err;
    }
  };

  const handleRoleChange = async (memberId: string, role: 'manager' | 'editor') => {
    try {
      const response = await fetch(`/api/maps/${mapId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      await fetchMembers();
      addToast(createToast('success', 'Member role updated', {
        duration: 3000,
      }));
    } catch (err: any) {
      addToast(createToast('error', err.message || 'Failed to update role', {
        duration: 4000,
      }));
      throw err;
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(`/api/maps/${mapId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      await fetchMembers();
      onMemberRemoved?.();
      addToast(createToast('success', 'Member removed successfully', {
        duration: 3000,
      }));
    } catch (err: any) {
      addToast(createToast('error', err.message || 'Failed to remove member', {
        duration: 4000,
      }));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-500 mt-2">Loading members...</p>
      </div>
    );
  }

  // If access denied, show message
  if (accessDenied && !loading) {
    return (
      <div className="h-full flex flex-col">
        {/* Header - Mobile only (desktop header is in layout) */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 lg:hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Members</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Close members"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Members</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-center py-8">
            <p className="text-xs text-gray-500 mb-2">You must be a member to view the member list.</p>
            <p className="text-xs text-gray-400">Request membership to join this map.</p>
          </div>
        </div>
      </div>
    );
  }

  const existingMemberIds = members.map(m => m.account_id);

  return (
    <div className="h-full flex flex-col">
      {/* Header - Hidden on mobile (BottomButtonsPopup has header), only show on desktop */}
      <div className="hidden lg:flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Members</h2>
          <span className="text-xs text-gray-500">({members.length})</span>
        </div>
        {canManage && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
          >
            <UserPlusIcon className="w-3.5 h-3.5" />
            Invite
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto lg:p-3 space-y-3">
        {/* Members List */}
        {members.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-gray-500">No members yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <MapMemberItem
                key={member.id}
                member={member}
                onRoleChange={(role) => handleRoleChange(member.id, role)}
                onRemove={() => handleRemove(member.id)}
                canManage={canManage}
                isMapOwner={isMapOwner}
              />
            ))}
          </div>
        )}

        {/* Membership Requests (if not auto-approve) */}
        {canManage && !autoApproveMembers && (
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-900">Pending Requests</h3>
            </div>
            <MapMembershipRequests
              mapId={mapId}
              membershipQuestions={membershipQuestions}
              onMemberAdded={() => {
                fetchMembers();
                onMemberAdded?.();
              }}
            />
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onInvite={handleInvite}
          existingMemberIds={existingMemberIds}
        />
      )}
    </div>
  );
}
