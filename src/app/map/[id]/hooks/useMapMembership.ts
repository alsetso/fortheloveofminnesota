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

    // Use initial members if provided
    if (initialMembers && initialMembers.length >= 0) {
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

    const checkMembership = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/maps/${mapId}/members`);
        if (response.ok) {
          const data = await response.json();
          const myMember = data.members?.find((m: any) => m.account_id === currentAccountId);
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
        } else {
          // 403 means not a member
          setMembership({
            isMember: false,
            isOwner,
            isManager: isOwner,
            userRole: isOwner ? 'owner' : null,
            showMembers: isOwner,
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
