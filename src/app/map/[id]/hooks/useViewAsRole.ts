'use client';

import { useState, useCallback, useEffect } from 'react';

export type ViewAsRole = 'owner' | 'manager' | 'editor' | 'non-member';

/**
 * Hook to manage "View As" role state for map owners
 * Allows owners to preview the map as different roles (Owner, Manager, Editor, Non-Member)
 */
export function useViewAsRole(isOwner: boolean) {
  const [viewAsRole, setViewAsRole] = useState<ViewAsRole>('owner');

  // Reset to owner when user is no longer owner
  useEffect(() => {
    if (!isOwner) {
      setViewAsRole('owner');
    }
  }, [isOwner]);

  const handleRoleChange = useCallback((role: ViewAsRole) => {
    if (isOwner) {
      setViewAsRole(role);
      // Store in sessionStorage for persistence across navigation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('map_view_as_role', role);
      }
    }
  }, [isOwner]);

  // Load from sessionStorage on mount
  useEffect(() => {
    if (isOwner && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('map_view_as_role') as ViewAsRole | null;
      if (stored && ['owner', 'manager', 'editor', 'non-member'].includes(stored)) {
        setViewAsRole(stored);
      }
    }
  }, [isOwner]);

  return {
    viewAsRole,
    setViewAsRole: handleRoleChange,
  };
}
