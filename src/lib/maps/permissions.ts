/**
 * Map Permission Checking Logic
 * 
 * Checks if a user can perform actions (pins, areas, posts) on a map
 * based on:
 * 1. Whether the action is enabled
 * 2. Plan requirements
 * 3. User's plan level
 * 4. Role-based overrides
 */

import type { MapData } from '@/types/map';

export type PlanLevel = 'hobby' | 'contributor';

const PLAN_ORDER: Record<PlanLevel, number> = {
  hobby: 1,
  contributor: 2,
};

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: 'disabled' | 'plan_required' | 'not_member' | 'subscription_inactive';
  requiredPlan?: PlanLevel;
  currentPlan?: PlanLevel;
  message: string;
}

export interface UserContext {
  accountId: string;
  plan: PlanLevel;
  subscription_status: string | null;
  role?: 'owner' | 'manager' | 'editor' | null;
}

/**
 * Check if user can perform an action on a map
 */
export function canUserPerformMapAction(
  action: 'pins' | 'areas' | 'posts' | 'clicks',
  map: MapData,
  user: UserContext,
  isOwner: boolean
): PermissionCheckResult {
  const collaboration = map.settings?.collaboration || {};
  
  // Check 1: Is action enabled?
  const allowKey = `allow_${action}` as 'allow_pins' | 'allow_areas' | 'allow_posts' | 'allow_clicks';
  const isEnabled = collaboration[allowKey] === true;
  
  if (!isEnabled) {
    return {
      allowed: false,
      reason: 'disabled',
      message: `This map does not allow ${action} to be added.`,
    };
  }
  
  // Check 2: Owner always has access
  if (isOwner) {
    return {
      allowed: true,
      message: 'Owner has full access',
    };
  }
  
  // Check 3: Role-based override (managers/editors)
  const roleOverrides = collaboration.role_overrides || {};
  if (user.role === 'manager' && roleOverrides.managers_can_edit !== false) {
    return {
      allowed: true,
      message: 'Manager has access',
    };
  }
  if (user.role === 'editor' && roleOverrides.editors_can_edit !== false) {
    return {
      allowed: true,
      message: 'Editor has access',
    };
  }
  
  // Check 4: Plan requirement
  const permissionKey = `${action}_permissions` as 'pin_permissions' | 'area_permissions' | 'post_permissions' | 'click_permissions';
  const permissions = collaboration[permissionKey];
  const requiredPlan = permissions?.required_plan;
  
  // If no plan requirement, allow (backward compatibility)
  if (requiredPlan === null || requiredPlan === undefined) {
    return {
      allowed: true,
      message: 'No plan restriction',
    };
  }
  
  // Normalize requiredPlan to valid PlanLevel (handle legacy professional/business/plus plans)
  const normalizedRequiredPlan: PlanLevel = 
    requiredPlan === 'professional' || requiredPlan === 'business' || requiredPlan === 'plus'
      ? 'contributor'
      : (requiredPlan === 'hobby' || requiredPlan === 'contributor' ? requiredPlan : 'contributor');
  
  // Check subscription status
  const isActive = user.subscription_status === 'active' || user.subscription_status === 'trialing';
  
  if (!isActive) {
    const actionLabels = {
      pins: 'add pins',
      areas: 'draw areas',
      posts: 'create posts',
      clicks: 'click on the map',
    };
    
    return {
      allowed: false,
      reason: 'subscription_inactive',
      requiredPlan: normalizedRequiredPlan,
      currentPlan: user.plan,
      message: `Your subscription is not active. Please activate your ${user.plan} plan to ${actionLabels[action]}.`,
    };
  }
  
  // Check if user's plan meets requirement
  const userPlanOrder = PLAN_ORDER[user.plan] || 0;
  const requiredPlanOrder = PLAN_ORDER[normalizedRequiredPlan];
  
  if (userPlanOrder < requiredPlanOrder) {
    const actionLabels = {
      pins: 'add pins',
      areas: 'draw areas',
      posts: 'create posts',
      clicks: 'click on the map',
    };
    
    return {
      allowed: false,
      reason: 'plan_required',
      requiredPlan: normalizedRequiredPlan,
      currentPlan: user.plan,
      message: `This map requires a ${normalizedRequiredPlan} plan to ${actionLabels[action]}.`,
    };
  }
  
  return {
    allowed: true,
    message: 'Access granted',
  };
}

/**
 * Get plan order for comparison
 */
export function getPlanOrder(plan: PlanLevel): number {
  return PLAN_ORDER[plan] || 0;
}

/**
 * Check if plan meets requirement
 */
export function planMeetsRequirement(
  userPlan: PlanLevel,
  requiredPlan: PlanLevel | null
): boolean {
  if (requiredPlan === null) return true;
  return getPlanOrder(userPlan) >= getPlanOrder(requiredPlan);
}
