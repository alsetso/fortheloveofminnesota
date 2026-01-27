'use client';

import { useMemo } from 'react';
import { useAuthStateSafe } from '@/features/auth';

interface UseMapAccessOptions {
  isOwner: boolean;
  isMember: boolean;
  isManager: boolean;
  userRole: 'owner' | 'manager' | 'editor' | null;
  showMembers: boolean;
}

/**
 * Consolidated hook for map access checks and computed access flags
 * Reduces repeated `isMember || isOwner` checks throughout the component
 */
export function useMapAccess({
  isOwner,
  isMember,
  isManager,
  userRole,
  showMembers,
}: UseMapAccessOptions) {
  const { account, activeAccountId } = useAuthStateSafe();

  // Compute current account ID once
  const currentAccountId = useMemo(
    () => activeAccountId || account?.id || null,
    [activeAccountId, account?.id]
  );

  // Compute user role string once
  const computedUserRole = useMemo(
    () => (isOwner ? 'owner' : isManager ? 'manager' : isMember ? userRole : null),
    [isOwner, isManager, isMember, userRole]
  );

  // Access flags - computed once to avoid repeated checks
  const access = useMemo(
    () => ({
      // Can view/edit settings
      canViewSettings: isMember || isOwner,
      // Can view posts
      canViewPosts: isMember || isOwner,
      // Can view members (if they have permission)
      canViewMembers: showMembers,
      // Show join button (authenticated but not a member)
      showJoinButton: !isMember && !isOwner && currentAccountId !== null,
      // Can use collaboration tools
      canUseCollaborationTools: (isMember || isOwner) && currentAccountId !== null,
      // Is authenticated
      isAuthenticated: currentAccountId !== null,
      // Has any access (member, manager, or owner)
      hasAccess: isMember || isManager || isOwner,
    }),
    [isMember, isOwner, showMembers, currentAccountId]
  );

  return {
    currentAccountId,
    computedUserRole,
    access,
  };
}
