'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import type { 
  ProfileAccount, 
  ProfileOwnership, 
  ViewerInfo 
} from '@/types/profile';

interface UseProfileOwnershipOptions {
  /** Account being viewed */
  account: ProfileAccount;
  /** Server-side ownership determination (for authenticated users) */
  serverIsOwnProfile: boolean;
}

interface UseProfileOwnershipResult extends ProfileOwnership {
  /** Toggle between owner and visitor view modes */
  toggleViewMode: () => void;
  /** Set specific view mode */
  setViewMode: (mode: 'owner' | 'visitor') => void;
}

/**
 * Hook to manage profile ownership state and permissions.
 * 
 * Consolidates server-side auth check with client-side guest verification
 * and provides a unified API for ownership-based UI rendering.
 * 
 * @example
 * ```tsx
 * const { canEdit, canCreatePin, viewMode, toggleViewMode } = useProfileOwnership({
 *   account,
 *   serverIsOwnProfile,
 * });
 * 
 * if (canEdit) {
 *   // Show edit controls
 * }
 * ```
 */
export function useProfileOwnership({
  account,
  serverIsOwnProfile,
}: UseProfileOwnershipOptions): UseProfileOwnershipResult {
  const { user } = useAuth();
  
  // Client-side ownership state (for guest accounts)
  const [clientIsOwner, setClientIsOwner] = useState(false);
  const [viewMode, setViewMode] = useState<'owner' | 'visitor'>('owner');
  const [viewer, setViewer] = useState<ViewerInfo | null>(null);

  // Determine ownership on mount and when dependencies change
  useEffect(() => {
    const determineOwnership = async () => {
      // Server already confirmed ownership for authenticated user
      if (serverIsOwnProfile) {
        setClientIsOwner(true);
        setViewer({
          type: 'authenticated',
          userId: user?.id,
          email: user?.email || undefined,
        });
        return;
      }

      // Not owner - set viewer info for non-owners
      setClientIsOwner(false);
      
      if (user) {
        setViewer({
          type: 'authenticated',
          userId: user.id,
          email: user.email || undefined,
        });
      } else {
        setViewer({ type: 'anonymous' });
      }
    };

    determineOwnership();
  }, [serverIsOwnProfile, user]);

  // Ownership: server auth only (no guest accounts)
  const isOwner = serverIsOwnProfile;
  
  // Guest accounts no longer supported
  const isGuestAccount = false;

  // Effective permissions based on ownership AND view mode
  const effectiveOwner = isOwner && viewMode === 'owner';

  const toggleViewMode = useCallback(() => {
    if (!isOwner) return; // Only owners can toggle
    setViewMode(prev => prev === 'owner' ? 'visitor' : 'owner');
  }, [isOwner]);

  const handleSetViewMode = useCallback((mode: 'owner' | 'visitor') => {
    if (!isOwner && mode === 'owner') return; // Non-owners can't set owner mode
    setViewMode(mode);
  }, [isOwner]);

  return {
    isOwner,
    isGuestAccount,
    viewMode: isOwner ? viewMode : 'visitor',
    canEdit: effectiveOwner,
    canCreatePin: effectiveOwner,
    canSeePrivatePins: effectiveOwner,
    viewer,
    toggleViewMode,
    setViewMode: handleSetViewMode,
  };
}


