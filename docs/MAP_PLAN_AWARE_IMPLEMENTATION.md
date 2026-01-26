# Map Plan-Aware Implementation Breakdown

## Overview

This document breaks down the UI updates and service logic needed to make maps plan-aware, with proper permission checking and user-friendly upgrade prompts.

**Visual Indicators (Temporary - Remove Before Production):**
- 🔵 **Blue border**: Plan-based features/permissions (requires specific plan level)
- 🔴 **Red border**: Owner-granted permissions (map owner enabled this feature)

---

## 1️⃣ Maps Must Become Plan-Aware

### Current State

**Maps currently know:**
- `owner` (account_id)
- `roles` (owner/manager/editor via map_members)
- Binary toggles: `allow_pins`, `allow_areas`, `allow_posts`

**Maps do NOT know:**
- What plan level is required for each action
- Whether permissions are plan-based or owner-granted

### Required Changes

#### Database Schema

**Add to `map.settings.collaboration`:**

```typescript
// Current structure
settings: {
  collaboration: {
    allow_pins: boolean,
    allow_areas: boolean,
    allow_posts: boolean,
  }
}

// New structure
settings: {
  collaboration: {
    // Legacy: binary toggles (for backward compatibility)
    allow_pins: boolean,
    allow_areas: boolean,
    allow_posts: boolean,
    
    // NEW: Plan-based permissions
    pin_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null,
      // null = no plan restriction (any authenticated user if allow_pins is true)
    },
    area_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null,
    },
    post_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null,
    },
    
    // Role-based overrides (managers/editors always have access)
    role_overrides: {
      managers_can_edit: boolean, // default: true
      editors_can_edit: boolean,   // default: true
    }
  }
}
```

#### Migration Strategy

```sql
-- Migration: Add plan-based permissions to existing maps
-- Default: null (no restriction) for backward compatibility

UPDATE public.map
SET settings = jsonb_set(
  settings,
  '{collaboration,pin_permissions}',
  '{"required_plan": null}'::jsonb,
  true
)
WHERE settings->'collaboration'->'pin_permissions' IS NULL;

UPDATE public.map
SET settings = jsonb_set(
  settings,
  '{collaboration,area_permissions}',
  '{"required_plan": null}'::jsonb,
  true
)
WHERE settings->'collaboration'->'area_permissions' IS NULL;

UPDATE public.map
SET settings = jsonb_set(
  settings,
  '{collaboration,post_permissions}',
  '{"required_plan": null}'::jsonb,
  true
)
WHERE settings->'collaboration'->'post_permissions' IS NULL;

-- Add role overrides defaults
UPDATE public.map
SET settings = jsonb_set(
  settings,
  '{collaboration,role_overrides}',
  '{"managers_can_edit": true, "editors_can_edit": true}'::jsonb,
  true
)
WHERE settings->'collaboration'->'role_overrides' IS NULL;
```

#### TypeScript Types

**Update `src/types/map.ts`:**

```typescript
export interface MapSettings {
  appearance?: {
    map_style?: 'street' | 'satellite' | 'light' | 'dark';
    map_layers?: MapLayers;
    meta?: MapMeta;
  };
  collaboration?: {
    // Legacy binary toggles
    allow_pins?: boolean;
    allow_areas?: boolean;
    allow_posts?: boolean;
    
    // NEW: Plan-based permissions
    pin_permissions?: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null;
    };
    area_permissions?: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null;
    };
    post_permissions?: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null;
    };
    
    // Role overrides
    role_overrides?: {
      managers_can_edit?: boolean;
      editors_can_edit?: boolean;
    };
  };
  presentation?: {
    hide_creator?: boolean;
    is_featured?: boolean;
  };
}
```

---

## 2️⃣ Editor Actions Must Be Permission-Checked

### Current Flow (Broken)

**Today:**
```
User clicks "Add Pin"
  ↓
Check: isOwner OR (isPublic AND allow_pins)
  ↓
If true → Allow
If false → Block
```

**Problem:** No plan checking. A Hobby user can add pins if the map allows it.

### Required Flow (Fixed)

**New:**
```
User clicks "Add Pin"
  ↓
1. Check: Is action enabled? (allow_pins === true)
  ↓
2. Check: What plan is required? (pin_permissions.required_plan)
  ↓
3. Check: Does user meet requirement? (user.plan >= required_plan)
  ↓
4. Check: Is user a member with override? (role === 'manager' || role === 'editor')
  ↓
If all checks pass → Allow
If any check fails → Block + Show upgrade prompt
```

### Implementation: Permission Check Function

**Create `src/lib/maps/permissions.ts`:**

```typescript
import type { MapData } from '@/types/map';
import type { Account } from '@/types/account';

type PlanLevel = 'hobby' | 'contributor' | 'professional' | 'business';

const PLAN_ORDER: Record<PlanLevel, number> = {
  hobby: 1,
  contributor: 2,
  professional: 3,
  business: 4,
};

interface PermissionCheckResult {
  allowed: boolean;
  reason?: 'disabled' | 'plan_required' | 'not_member';
  requiredPlan?: PlanLevel;
  currentPlan?: PlanLevel;
  message: string;
}

/**
 * Check if user can perform an action on a map
 */
export function canUserPerformMapAction(
  action: 'pins' | 'areas' | 'posts',
  map: MapData,
  user: {
    accountId: string;
    plan: PlanLevel;
    subscription_status: string | null;
    role?: 'owner' | 'manager' | 'editor' | null;
  },
  isOwner: boolean
): PermissionCheckResult {
  const collaboration = map.settings?.collaboration || {};
  
  // Check 1: Is action enabled?
  const allowKey = `allow_${action}` as 'allow_pins' | 'allow_areas' | 'allow_posts';
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
  const permissionKey = `${action}_permissions` as 'pin_permissions' | 'area_permissions' | 'post_permissions';
  const permissions = collaboration[permissionKey];
  const requiredPlan = permissions?.required_plan;
  
  // If no plan requirement, allow (backward compatibility)
  if (requiredPlan === null || requiredPlan === undefined) {
    return {
      allowed: true,
      message: 'No plan restriction',
    };
  }
  
  // Check if user's plan meets requirement
  const userPlanOrder = PLAN_ORDER[user.plan] || 0;
  const requiredPlanOrder = PLAN_ORDER[requiredPlan];
  
  // Check subscription status
  const isActive = user.subscription_status === 'active' || user.subscription_status === 'trialing';
  
  if (userPlanOrder < requiredPlanOrder || !isActive) {
    return {
      allowed: false,
      reason: 'plan_required',
      requiredPlan,
      currentPlan: user.plan,
      message: `This map requires a ${requiredPlan} plan to ${action === 'pins' ? 'add pins' : action === 'areas' ? 'draw areas' : 'create posts'}.`,
    };
  }
  
  return {
    allowed: true,
    message: 'Access granted',
  };
}
```

### Backend API Updates

**Update `/api/maps/[id]/pins/route.ts`:**

```typescript
// Add plan check before allowing pin creation
const permissionCheck = canUserPerformMapAction(
  'pins',
  mapData,
  {
    accountId,
    plan: account.plan,
    subscription_status: account.subscription_status,
    role: memberRole,
  },
  isOwner
);

if (!permissionCheck.allowed) {
  return createErrorResponse(
    permissionCheck.message,
    403,
    {
      reason: permissionCheck.reason,
      requiredPlan: permissionCheck.requiredPlan,
      currentPlan: permissionCheck.currentPlan,
    }
  );
}
```

**Update `/api/maps/[id]/areas/route.ts`:** (Same pattern)

**Update `/api/posts/route.ts`:** (Check post_permissions when map_data is included)

---

## 3️⃣ The UI Must Explain the Lock

### Visual Indicators (Temporary)

**Add borders to UI elements:**

- **Blue border** (`border-2 border-blue-500`): Plan-based feature/permission
- **Red border** (`border-2 border-red-500`): Owner-granted permission

### UI Components to Update

#### 1. MapInfoCard (Pin/Draw Buttons)

**File:** `src/app/map/[id]/components/MapInfoCard.tsx`

```typescript
// Add props
interface MapInfoCardProps {
  // ... existing props
  pinPermissions?: { required_plan: PlanLevel | null };
  areaPermissions?: { required_plan: PlanLevel | null };
  userPlan?: PlanLevel;
  isOwner: boolean;
}

// In component
const pinPermissionCheck = canUserPerformMapAction(
  'pins',
  { settings: { collaboration: { allow_pins, pin_permissions: pinPermissions } } },
  { accountId: '', plan: userPlan || 'hobby', subscription_status: null },
  isOwner
);

const areaPermissionCheck = canUserPerformMapAction(
  'areas',
  { settings: { collaboration: { allow_areas, area_permissions: areaPermissions } } },
  { accountId: '', plan: userPlan || 'hobby', subscription_status: null },
  isOwner
);

// Add border classes
const pinBorderClass = pinPermissions?.required_plan 
  ? 'border-2 border-blue-500' // Plan-based
  : allowOthersToPostPins && !isOwner
  ? 'border-2 border-red-500' // Owner-granted
  : '';

const areaBorderClass = areaPermissions?.required_plan
  ? 'border-2 border-blue-500' // Plan-based
  : allowOthersToAddAreas && !isOwner
  ? 'border-2 border-red-500' // Owner-granted
  : '';

// Apply to buttons
<button
  onClick={onPinClick}
  className={`${pinBorderClass} ...existing classes...`}
  disabled={!pinPermissionCheck.allowed}
>
  <MapPinIcon className="w-4 h-4" />
  <span className="hidden sm:inline">Pin</span>
</button>
```

#### 2. JoinMapSidebar (Member Benefits)

**File:** `src/app/map/[id]/components/JoinMapSidebar.tsx`

```typescript
// Add props
interface JoinMapSidebarProps {
  // ... existing props
  pinPermissions?: { required_plan: PlanLevel | null };
  areaPermissions?: { required_plan: PlanLevel | null };
  postPermissions?: { required_plan: PlanLevel | null };
  userPlan?: PlanLevel;
}

// Add border classes to benefit items
{allowPins && (
  <div className={`flex items-center gap-1.5 p-2 rounded ${
    pinPermissions?.required_plan 
      ? 'border-2 border-blue-500' // Plan-based
      : 'border-2 border-red-500' // Owner-granted
  }`}>
    <MapPinIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
    <span className="text-xs text-gray-700">Add pins to the map</span>
    {pinPermissions?.required_plan && (
      <span className="text-[10px] text-blue-600 font-medium">
        ({pinPermissions.required_plan}+)
      </span>
    )}
  </div>
)}
```

#### 3. MapSettingsSidebar (Permission Controls)

**File:** `src/app/map/[id]/components/MapSettingsSidebar.tsx`

```typescript
// Add visual indicators to permission toggles
<div className={`p-[10px] border rounded-md ${
  formData.settings.collaboration.pin_permissions?.required_plan
    ? 'border-2 border-blue-500' // Plan-based
    : formData.settings.collaboration.allow_pins
    ? 'border-2 border-red-500' // Owner-granted
    : 'border-gray-200'
}`}>
  <label>Allow others to add pins</label>
  {/* ... existing toggle ... */}
  
  {/* Plan requirement selector */}
  {formData.settings.collaboration.allow_pins && (
    <select
      value={formData.settings.collaboration.pin_permissions?.required_plan || 'any'}
      onChange={(e) => {
        const value = e.target.value === 'any' ? null : e.target.value;
        setFormData({
          ...formData,
          settings: {
            ...formData.settings,
            collaboration: {
              ...formData.settings.collaboration,
              pin_permissions: { required_plan: value },
            },
          },
        });
      }}
    >
      <option value="any">Any authenticated user</option>
      <option value="hobby">Hobby plan or higher</option>
      <option value="contributor">Contributor plan or higher</option>
      <option value="professional">Professional plan or higher</option>
      <option value="business">Business plan only</option>
    </select>
  )}
</div>
```

### Upgrade Prompt Component

**Create `src/components/maps/MapActionUpgradePrompt.tsx`:**

```typescript
'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface MapActionUpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'pins' | 'areas' | 'posts';
  requiredPlan: 'hobby' | 'contributor' | 'professional' | 'business';
  currentPlan?: 'hobby' | 'contributor' | 'professional' | 'business';
}

export default function MapActionUpgradePrompt({
  isOpen,
  onClose,
  action,
  requiredPlan,
  currentPlan,
}: MapActionUpgradePromptProps) {
  if (!isOpen) return null;

  const actionLabels = {
    pins: 'add pins',
    areas: 'draw areas',
    posts: 'create posts',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full mx-4 p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Plan Required
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-xs text-gray-600 mb-4">
          This map requires a <strong>{requiredPlan}</strong> plan to {actionLabels[action]}.
          {currentPlan && (
            <> You currently have a <strong>{currentPlan}</strong> plan.</>
          )}
        </p>
        
        <div className="flex items-center gap-2">
          <Link
            href={`/billing#plan-${requiredPlan}`}
            className="flex-1 px-3 py-2 text-xs font-semibold bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-center"
          >
            Upgrade to {requiredPlan}
          </Link>
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Integration in Map Page

**Update `src/app/map/[id]/page.tsx`:**

```typescript
// Add state for upgrade prompt
const [upgradePrompt, setUpgradePrompt] = useState<{
  isOpen: boolean;
  action: 'pins' | 'areas' | 'posts';
  requiredPlan: PlanLevel;
  currentPlan?: PlanLevel;
}>({
  isOpen: false,
  action: 'pins',
  requiredPlan: 'contributor',
});

// Wrap action handlers
const handlePinClick = () => {
  if (!mapData || !account) return;
  
  const permissionCheck = canUserPerformMapAction(
    'pins',
    mapData,
    {
      accountId: account.id,
      plan: account.plan as PlanLevel,
      subscription_status: account.subscription_status,
      role: currentUserRole,
    },
    isOwner
  );
  
  if (!permissionCheck.allowed) {
    if (permissionCheck.reason === 'plan_required') {
      setUpgradePrompt({
        isOpen: true,
        action: 'pins',
        requiredPlan: permissionCheck.requiredPlan!,
        currentPlan: permissionCheck.currentPlan,
      });
      return;
    }
    // Show other error
    return;
  }
  
  // Proceed with pin action
  setPinMode(!pinMode);
};

// Render upgrade prompt
{upgradePrompt.isOpen && (
  <MapActionUpgradePrompt
    isOpen={upgradePrompt.isOpen}
    onClose={() => setUpgradePrompt({ ...upgradePrompt, isOpen: false })}
    action={upgradePrompt.action}
    requiredPlan={upgradePrompt.requiredPlan}
    currentPlan={upgradePrompt.currentPlan}
  />
)}
```

---

## Implementation Checklist

### Phase 1: Database & Types
- [ ] Add `collaboration_permissions` structure to `MapSettings` type
- [ ] Create migration to add default plan permissions to existing maps
- [ ] Update API validation schemas to accept new permission structure

### Phase 2: Permission Logic
- [ ] Create `canUserPerformMapAction` function
- [ ] Add plan checking to `/api/maps/[id]/pins` endpoint
- [ ] Add plan checking to `/api/maps/[id]/areas` endpoint
- [ ] Add plan checking to `/api/posts` endpoint (for map_data)
- [ ] Update RLS policies if needed

### Phase 3: UI Updates
- [ ] Add visual borders to MapInfoCard buttons
- [ ] Add visual borders to JoinMapSidebar benefits
- [ ] Add visual borders to MapSettingsSidebar controls
- [ ] Create MapActionUpgradePrompt component
- [ ] Integrate upgrade prompts in map page
- [ ] Add plan requirement selectors to map settings

### Phase 4: Testing
- [ ] Test Hobby user on map with no restrictions
- [ ] Test Hobby user on map requiring Contributor
- [ ] Test Contributor user on map requiring Professional
- [ ] Test owner override (should always work)
- [ ] Test manager/editor role overrides
- [ ] Test backward compatibility (maps without plan permissions)

### Phase 5: Cleanup (Before Production)
- [ ] Remove all blue/red border classes
- [ ] Remove visual indicator comments
- [ ] Update documentation

---

## Key Files to Modify

### Backend
1. `src/types/map.ts` - Add permission types
2. `src/lib/maps/permissions.ts` - NEW: Permission checking logic
3. `src/app/api/maps/[id]/pins/route.ts` - Add plan check
4. `src/app/api/maps/[id]/areas/route.ts` - Add plan check
5. `src/app/api/posts/route.ts` - Add plan check for map_data
6. `supabase/migrations/XXX_add_map_plan_permissions.sql` - NEW: Migration

### Frontend
1. `src/app/map/[id]/page.tsx` - Add upgrade prompts
2. `src/app/map/[id]/components/MapInfoCard.tsx` - Add borders + permission checks
3. `src/app/map/[id]/components/JoinMapSidebar.tsx` - Add borders + plan indicators
4. `src/app/map/[id]/components/MapSettingsSidebar.tsx` - Add plan selectors
5. `src/components/maps/MapActionUpgradePrompt.tsx` - NEW: Upgrade prompt component

---

## Example User Flows

### Flow 1: Hobby User on Restricted Map

1. User (Hobby plan) views map
2. Map requires Contributor plan for pins
3. User clicks "Add Pin" button
4. System checks: Hobby < Contributor → Block
5. Upgrade prompt appears: "This map requires a Contributor plan to add pins"
6. User can: Upgrade or Learn More

### Flow 2: Contributor User on Restricted Map

1. User (Contributor plan) views map
2. Map requires Professional plan for posts
3. User tries to create post with map data
4. System checks: Contributor < Professional → Block
5. Upgrade prompt appears: "This map requires a Professional plan to create posts"
6. User can: Upgrade or Learn More

### Flow 3: Owner Override

1. Map owner (Hobby plan) views their map
2. Map requires Contributor plan for pins
3. Owner clicks "Add Pin"
4. System checks: isOwner → Allow (override)
5. Action proceeds normally

---

## Summary

**Three Core Requirements:**

1. **Maps become plan-aware** → Add `collaboration_permissions` to map settings
2. **Actions are permission-checked** → Check plan requirements before allowing actions
3. **UI explains locks** → Show upgrade prompts with clear messaging

**Visual Indicators (Temporary):**
- Blue border = Plan-based permission
- Red border = Owner-granted permission

**Critical:** Remove all border colors before production. They are for development/debugging only.
