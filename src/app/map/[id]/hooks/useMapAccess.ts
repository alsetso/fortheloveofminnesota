'use client';

import { useMemo } from 'react';
import { useAuthStateSafe } from '@/features/auth';

interface UseMapAccessOptions {
  isOwner: boolean;
  isMember: boolean;
  isManager: boolean;
  userRole: 'owner' | 'manager' | 'editor' | null;
  showMembers: boolean;
  viewAsRole?: 'owner' | 'manager' | 'editor' | 'non-member';
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
  viewAsRole,
}: UseMapAccessOptions) {
  const { account, activeAccountId } = useAuthStateSafe();

  // Compute current account ID once
  const currentAccountId = useMemo(
    () => activeAccountId || account?.id || null,
    [activeAccountId, account?.id]
  );

  // If owner is viewing as a different role, override the computed role
  const effectiveRole = useMemo(() => {
    if (isOwner && viewAsRole) {
      if (viewAsRole === 'non-member') return null;
      if (viewAsRole !== 'owner') return viewAsRole;
    }
    return isOwner ? 'owner' : isManager ? 'manager' : isMember ? userRole : null;
  }, [isOwner, isManager, isMember, userRole, viewAsRole]);

  // Compute user role string once
  const computedUserRole = useMemo(
    () => effectiveRole,
    [effectiveRole]
  );

  // Override access flags when viewing as different role
  const effectiveIsOwner = useMemo(() => isOwner && (!viewAsRole || viewAsRole === 'owner'), [isOwner, viewAsRole]);
  const effectiveIsManager = useMemo(() => {
    if (isOwner && viewAsRole === 'manager') return true;
    if (isOwner && (viewAsRole === 'editor' || viewAsRole === 'non-member')) return false;
    return isManager;
  }, [isOwner, isManager, viewAsRole]);
  const effectiveIsMember = useMemo(() => {
    if (isOwner && viewAsRole === 'non-member') return false; // Non-member is not a member
    if (isOwner && viewAsRole) return true; // Owner viewing as any other role is still a member
    return isMember;
  }, [isOwner, isMember, viewAsRole]);

  // Access flags - computed once to avoid repeated checks
  // When viewing as different role, use effective values
  const access = useMemo(
    () => ({
      // Can view/edit settings - managers/editors can view (read-only), owners can edit
      canViewSettings: effectiveIsMember || effectiveIsOwner,
      // Can view posts - only for live map (posts removed from custom maps)
      // Always false - filtered in page component based on isLiveMap
      canViewPosts: false,
      // Can view members (if they have permission)
      // Managers can view members, editors cannot
      canViewMembers: showMembers && (effectiveIsOwner || effectiveIsManager),
      // Show join button (authenticated but not a member)
      showJoinButton: !effectiveIsMember && !effectiveIsOwner && currentAccountId !== null,
      // Can use collaboration tools
      canUseCollaborationTools: (effectiveIsMember || effectiveIsOwner) && currentAccountId !== null,
      // Is authenticated
      isAuthenticated: currentAccountId !== null,
      // Has any access (member, manager, or owner)
      hasAccess: effectiveIsMember || effectiveIsManager || effectiveIsOwner,
    }),
    [effectiveIsMember, effectiveIsOwner, effectiveIsManager, showMembers, currentAccountId]
  );

  return {
    currentAccountId,
    computedUserRole,
    access,
    // Effective role flags (accounting for view-as mode)
    effectiveIsOwner: effectiveIsOwner,
    effectiveIsManager: effectiveIsManager,
    effectiveIsMember: effectiveIsMember,
  };
}
