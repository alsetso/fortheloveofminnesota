'use client';

import { useState, useEffect } from 'react';
import { useAuthStateSafe } from '@/features/auth';

interface MembershipData {
  isMember: boolean;
  isOwner: boolean;
  isManager: boolean;
  userRole: 'owner' | 'manager' | 'editor' | null;
  showMembers: boolean;
}

export function useMapMembership(
  mapId: string | null,
  mapAccountId: string | null,
  initialMembers?: any[] | null
) {
  const { account, activeAccountId } = useAuthStateSafe();
  const [membership, setMembership] = useState<MembershipData>({
    isMember: false,
    isOwner: false,
    isManager: false,
    userRole: null,
    showMembers: false,
  });
  const [loading, setLoading] = useState(true);

  // Use active account ID from dropdown, fallback to account.id
  const currentAccountId = activeAccountId || account?.id || null;

  useEffect(() => {
    if (!mapId || !currentAccountId || !mapAccountId) {
      setMembership({
        isMember: false,
        isOwner: false,
        isManager: false,
        userRole: null,
        showMembers: false,
      });
      setLoading(false);
      return;
    }

    const isOwner = currentAccountId === mapAccountId;

    // Handle initialMembers from /api/maps/[id]/data endpoint
    // - null: endpoint checked, user doesn't have access (not a member)
    // - undefined: not yet fetched, need to check
    // - []: user has access but no members yet
    // - [...]: user has access and there are members
    if (initialMembers !== undefined) {
      // initialMembers is either null or an array
      if (initialMembers === null) {
        // Data endpoint already determined user doesn't have access
        setMembership({
          isMember: false,
          isOwner,
          isManager: isOwner,
          userRole: isOwner ? 'owner' : null,
          showMembers: isOwner,
        });
        setLoading(false);
        return;
      }

      // initialMembers is an array (empty or with members)
      // Check if current user is in the members list
      const myMember = initialMembers.find((m: any) => m.account_id === currentAccountId);
      const isMember = !!myMember;
      const userRole = myMember?.role || (isOwner ? 'owner' : null);
      const isManager = userRole === 'manager' || userRole === 'owner';

      setMembership({
        isMember,
        isOwner,
        isManager,
        userRole,
        showMembers: isOwner || isMember,
      });
      setLoading(false);
      return;
    }

    // initialMembers is undefined - data not yet fetched
    // Only call members API if user is owner (owners always have access)
    // For non-owners, wait for initialMembers from data endpoint
    const checkMembership = async () => {
      setLoading(true);
      try {
        if (isOwner) {
          // Owner can always fetch members
          const response = await fetch(`/api/maps/${mapId}/members`);
          if (response.ok) {
            const data = await response.json();
            setMembership({
              isMember: true,
              isOwner: true,
              isManager: true,
              userRole: 'owner',
              showMembers: true,
            });
          } else {
            // Shouldn't happen for owners, but handle gracefully
            setMembership({
              isMember: false,
              isOwner: true,
              isManager: true,
              userRole: 'owner',
              showMembers: true,
            });
          }
        } else {
          // For non-owners, wait for initialMembers from data endpoint
          // Don't call members API directly (will cause 403)
          setMembership({
            isMember: false,
            isOwner: false,
            isManager: false,
            userRole: null,
            showMembers: false,
          });
        }
      } catch (err) {
        console.error('Error checking membership:', err);
        setMembership({
          isMember: false,
          isOwner,
          isManager: isOwner,
          userRole: isOwner ? 'owner' : null,
          showMembers: isOwner,
        });
      } finally {
        setLoading(false);
      }
    };

    checkMembership();
  }, [mapId, currentAccountId, mapAccountId, initialMembers]);

  return { ...membership, loading };
}
