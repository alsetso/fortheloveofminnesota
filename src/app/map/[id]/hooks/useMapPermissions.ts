'use client';

import { useState, useCallback, useEffect } from 'react';
import { canUserPerformMapAction, type PlanLevel } from '@/lib/maps/permissions';
import type { MapData } from '@/types/map';

interface UpgradePrompt {
  isOpen: boolean;
  action: 'pins' | 'areas' | 'posts' | 'clicks';
  requiredPlan: PlanLevel;
  currentPlan?: PlanLevel;
}

interface UseMapPermissionsOptions {
  mapData: MapData | null;
  account: {
    id: string;
    plan: string | null;
    subscription_status: string | null;
  } | null;
  isOwner: boolean;
  userRole: 'owner' | 'manager' | 'editor' | null;
  viewAsRole?: 'owner' | 'manager' | 'editor' | 'non-member';
}

/**
 * Unified hook for map permission checking and upgrade prompts
 * Consolidates the three duplicate permission handlers into one
 */
export function useMapPermissions({
  mapData,
  account,
  isOwner,
  userRole,
  viewAsRole,
}: UseMapPermissionsOptions) {
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt>({
    isOpen: false,
    action: 'pins',
    requiredPlan: 'contributor',
  });

  // Listen for permission denied events from API errors
  useEffect(() => {
    const handlePermissionDenied = (e: CustomEvent) => {
      const { action, requiredPlan, currentPlan } = e.detail;
      setUpgradePrompt({
        isOpen: true,
        action,
        requiredPlan,
        currentPlan,
      });
    };

    window.addEventListener('map-action-permission-denied', handlePermissionDenied as EventListener);
    return () => {
      window.removeEventListener('map-action-permission-denied', handlePermissionDenied as EventListener);
    };
  }, []);

  /**
   * Check if user can perform an action on the map
   * Returns true if allowed, false if not (and shows upgrade prompt if needed)
   * When owner is viewing as different role, use that role for permission checks
   */
  const checkPermission = useCallback(
    (action: 'pins' | 'areas' | 'posts' | 'clicks'): boolean | undefined => {
      if (!mapData || !account) return undefined;

      // If owner is viewing as different role, override the role and isOwner flag
      const effectiveRole = (isOwner && viewAsRole && viewAsRole !== 'owner') 
        ? (viewAsRole === 'non-member' ? null : viewAsRole)
        : userRole;
      const effectiveIsOwner = isOwner && (!viewAsRole || viewAsRole === 'owner');

      const permissionCheck = canUserPerformMapAction(
        action,
        mapData,
        {
          accountId: account.id,
          plan: (account.plan || 'hobby') as PlanLevel,
          subscription_status: account.subscription_status,
          role: effectiveRole || null,
        },
        effectiveIsOwner
      );

      if (!permissionCheck.allowed && permissionCheck.reason === 'plan_required') {
        setUpgradePrompt({
          isOpen: true,
          action,
          requiredPlan: permissionCheck.requiredPlan!,
          currentPlan: permissionCheck.currentPlan,
        });
        return false;
      }

      return permissionCheck.allowed;
    },
    [mapData, account, isOwner, userRole, viewAsRole]
  );

  const closeUpgradePrompt = useCallback(() => {
    setUpgradePrompt((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    checkPermission,
    upgradePrompt,
    closeUpgradePrompt,
  };
}
