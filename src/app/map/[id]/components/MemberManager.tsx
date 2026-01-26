'use client';

import { useState, useEffect } from 'react';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import SidebarHeader from '@/components/layout/SidebarHeader';
import MapMemberItem from './MapMemberItem';
import InviteMemberModal from './InviteMemberModal';
import MapMembershipRequests from './MapMembershipRequests';
import type { MapMember } from '@/types/map';

interface MemberManagerProps {
  mapId: string;
  mapAccountId: string;
  autoApproveMembers: boolean;
  membershipQuestions: Array<{ id: number; question: string }>;
  membershipRules: string | null;
  onMemberAdded?: () => void;
  onMemberRemoved?: () => void;
  onClose?: () => void;
  mapName?: string;
}

export default function MemberManager({
  mapId,
  mapAccountId,
  autoApproveMembers,
  membershipQuestions,
  membershipRules,
  onMemberAdded,
  onMemberRemoved,
  onClose,
  mapName,
}: MemberManagerProps) {
  const { account, activeAccountId } = useAuthStateSafe();
  const { addToast } = useToastContext();
  const [members, setMembers] = useState<MapMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'editor' | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Use active account ID from dropdown
  const currentAccountId = activeAccountId || account?.id || null;

  const isMapOwner = currentAccountId === mapAccountId;
  const isManager = userRole === 'manager' || userRole === 'owner';
  const canManage = isMapOwner || isManager;

  // Fetch members function - reusable
  const fetchMembers = async () => {
    if (!mapId || !currentAccountId) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/maps/${mapId}/members`);
      
      if (response.ok) {
        const data = await response.json();
        const membersList = data.members || [];
        setMembers(membersList);
        
        const myMember = membersList.find((m: MapMember) => m.account_id === currentAccountId);
        
        if (myMember) {
          setUserRole(myMember.role);
        } else if (currentAccountId === mapAccountId) {
          setUserRole('owner');
        } else {
          setUserRole(null);
        }
      } else if (response.status === 403) {
        setAccessDenied(true);
        setMembers([]);
        setUserRole(null);
      } else {
        setMembers([]);
        setUserRole(null);
      }
    } catch (err) {
      setMembers([]);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch - only once when component mounts or mapId/account changes
  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, currentAccountId]);

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

  if (accessDenied && !loading) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-gray-500 mb-2">You must be a member to view the member list.</p>
        <p className="text-xs text-gray-400">Request membership to join this map.</p>
      </div>
    );
  }

  const existingMemberIds = members.map(m => m.account_id);

  return (
    <div className="h-full flex flex-col">
      <SidebarHeader
        title="Map Members"
        onClose={onClose || (() => {})}
        isOwner={isMapOwner}
        mapId={mapId}
        mapName={mapName}
        showMenu={true}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          {/* Invite Button */}
          {canManage && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              <UserPlusIcon className="w-3.5 h-3.5" />
              Invite Member
            </button>
          )}
          
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
