# Map Plan & Feature Correlation Breakdown

## Overview

This document breaks down how **user plans**, **billing features**, and **map owner settings** correlate to determine what actions users can perform on maps.

---

## Three-Layer Permission Model

The system uses a **three-layer permission model** that evaluates permissions in this order:

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: User's Billing Plan                           │
│ What features does the user's plan include?             │
│ (e.g., map_edit_pins, map_create_posts)                │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Map Owner Settings                            │
│ What does the map owner require?                        │
│ (e.g., pin_permissions.required_plan: 'contributor')   │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Map Membership Role                           │
│ What role does the user have on this map?               │
│ (owner/manager/editor/non-member)                      │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: User's Billing Plan & Features

### Plan Hierarchy

```
hobby (1) < contributor (2) < professional (3) < business (4)
```

Higher-tier plans inherit all features from lower tiers.

### Feature Assignment by Plan

#### Hobby Plan ($0/month)
**Map Ownership:**
- ✅ `custom_maps` (limit: 3 maps)
- ❌ No analytics
- ❌ No export
- ❌ No advanced collaboration tools

**Map Editing:**
- ✅ `map_edit_pins` (can add pins if map allows)
- ✅ `map_edit_areas` (can draw areas if map allows)
- ❌ `map_create_posts` (cannot create posts)
- ❌ `map_advanced_editing`

#### Contributor Plan ($20/month)
**Map Ownership:**
- ✅ `unlimited_maps` (unlimited map creation)
- ✅ `map_analytics` (basic analytics on owned maps)
- ✅ `map_collaboration_tools` (can set plan-based permissions)
- ❌ `map_export` (no export)

**Map Editing:**
- ✅ `map_edit_pins` (can add pins)
- ✅ `map_edit_areas` (can draw areas)
- ✅ `map_create_posts` (can create posts)
- ❌ `map_advanced_editing`

#### Professional Plan ($60/month)
**Map Ownership:**
- ✅ All Contributor ownership features
- ✅ `map_export` (export map data to CSV/GeoJSON)
- ✅ `map_advanced_analytics` (time-series, geographic insights)

**Map Editing:**
- ✅ All Contributor editing features
- ✅ `map_advanced_editing` (bulk operations, advanced tools)

#### Business Plan ($200/month)
**Map Ownership:**
- ✅ All Professional ownership features
- ✅ `map_team_management` (manage team members)
- ✅ `map_white_label` (remove branding)
- ✅ `map_api_access` (API access for maps)

**Map Editing:**
- ✅ All Professional editing features
- ✅ `map_manager_role` (can be assigned manager role)
- ✅ `map_cross_map_analytics` (see contributions across maps)

---

## Layer 2: Map Owner Settings

Map owners configure collaboration permissions in `map.settings.collaboration`:

```typescript
settings: {
  collaboration: {
    // Binary toggles (enable/disable features)
    allow_pins: boolean,
    allow_areas: boolean,
    allow_posts: boolean,
    allow_clicks: boolean,
    
    // Plan-based requirements (optional restrictions)
    pin_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null
      // null = no plan restriction (any authenticated user if allow_pins is true)
    },
    area_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null
    },
    post_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null
    },
    click_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null
    },
    
    // Role-based overrides
    role_overrides: {
      managers_can_edit: boolean,  // default: true
      editors_can_edit: boolean,   // default: true
    }
  }
}
```

### Owner Settings Breakdown

#### 1. Binary Toggles (`allow_*`)
- **Purpose**: Enable/disable features for all users
- **Default**: `false` (disabled)
- **Effect**: If `allow_pins: false`, no one can add pins (except owner)

#### 2. Plan-Based Permissions (`*_permissions.required_plan`)
- **Purpose**: Restrict features to specific plan levels
- **Default**: `null` (no restriction)
- **Effect**: If `pin_permissions.required_plan: 'contributor'`, only Contributor+ users can add pins
- **Note**: Only works if the corresponding `allow_*` toggle is `true`

#### 3. Role Overrides (`role_overrides`)
- **Purpose**: Grant access to managers/editors regardless of plan
- **Default**: `managers_can_edit: true`, `editors_can_edit: true`
- **Effect**: Managers/editors bypass plan requirements (but still need billing features)

---

## Layer 3: Map Membership Roles

### Role Hierarchy

```
owner > manager > editor > non-member
```

### Role Permissions

#### Owner
- **Always has access** to all features
- Can modify map settings
- Can delete map
- Bypasses all plan requirements

#### Manager
- **Always has access** to editing features (if `role_overrides.managers_can_edit !== false`)
- Can modify map settings (except delete)
- Can manage members
- Bypasses plan requirements (but still needs billing features)

#### Editor
- **Conditional access** based on:
  - User's billing features (Layer 1)
  - Map owner settings (Layer 2)
  - `role_overrides.editors_can_edit` setting
- Cannot modify map settings
- Cannot manage members

#### Non-Member
- **Conditional access** based on:
  - User's billing features (Layer 1)
  - Map owner settings (Layer 2)
  - Map visibility (`public` vs `private`)
- No special privileges

---

## Permission Resolution Flow

### Decision Tree: Can User Add Pins?

```
START: User wants to add pin
│
├─ Is user the owner?
│  └─ YES → ✅ ALLOWED (owner always has access)
│
├─ Is user a manager?
│  ├─ YES → Check role_overrides.managers_can_edit
│  │   ├─ true → ✅ ALLOWED (if has map_edit_pins feature)
│  │   └─ false → Continue to next check
│  │
│  └─ NO → Continue to next check
│
├─ Is user an editor?
│  ├─ YES → Check role_overrides.editors_can_edit
│  │   ├─ true → Continue to feature check
│  │   └─ false → ❌ DENIED
│  │
│  └─ NO → Continue to feature check
│
├─ Does user have map_edit_pins billing feature?
│  └─ NO → ❌ DENIED (upgrade to Contributor+)
│
├─ Is allow_pins enabled?
│  └─ NO → ❌ DENIED (map owner disabled pins)
│
├─ Does map require a plan level?
│  ├─ pin_permissions.required_plan === null → ✅ ALLOWED
│  │
│  └─ pin_permissions.required_plan !== null
│      ├─ Check: user's plan >= required_plan
│      │   ├─ YES → ✅ ALLOWED
│      │   └─ NO → ❌ DENIED (upgrade to required plan)
│
└─ END
```

### Decision Tree: Can User Create Posts?

```
START: User wants to create post
│
├─ Is user the owner?
│  └─ YES → ✅ ALLOWED (owner always has access)
│
├─ Is user a manager?
│  ├─ YES → Check role_overrides.managers_can_edit
│  │   ├─ true → ✅ ALLOWED (if has map_create_posts feature)
│  │   └─ false → Continue to next check
│  │
│  └─ NO → Continue to next check
│
├─ Is user an editor?
│  ├─ YES → Check role_overrides.editors_can_edit
│  │   ├─ true → Continue to feature check
│  │   └─ false → ❌ DENIED
│  │
│  └─ NO → Continue to feature check
│
├─ Does user have map_create_posts billing feature?
│  └─ NO → ❌ DENIED (upgrade to Contributor+)
│
├─ Is allow_posts enabled?
│  └─ NO → ❌ DENIED (map owner disabled posts)
│
├─ Does map require a plan level?
│  ├─ post_permissions.required_plan === null → ✅ ALLOWED
│  │
│  └─ post_permissions.required_plan !== null
│      ├─ Check: user's plan >= required_plan
│      │   ├─ YES → ✅ ALLOWED
│      │   └─ NO → ❌ DENIED (upgrade to required plan)
│
└─ END
```

---

## Code Implementation

### Permission Check Function

Located in: `/src/lib/maps/permissions.ts`

```typescript
export function canUserPerformMapAction(
  action: 'pins' | 'areas' | 'posts' | 'clicks',
  map: MapData,
  user: UserContext,
  isOwner: boolean
): PermissionCheckResult {
  const collaboration = map.settings?.collaboration || {};
  
  // Check 1: Is action enabled?
  const allowKey = `allow_${action}`;
  const isEnabled = collaboration[allowKey] === true;
  
  if (!isEnabled) {
    return { allowed: false, reason: 'disabled', message: `This map does not allow ${action}.` };
  }
  
  // Check 2: Owner always has access
  if (isOwner) {
    return { allowed: true, message: 'Owner has full access' };
  }
  
  // Check 3: Role-based override (managers/editors)
  const roleOverrides = collaboration.role_overrides || {};
  if (user.role === 'manager' && roleOverrides.managers_can_edit !== false) {
    return { allowed: true, message: 'Manager has access' };
  }
  if (user.role === 'editor' && roleOverrides.editors_can_edit !== false) {
    return { allowed: true, message: 'Editor has access' };
  }
  
  // Check 4: Plan requirement
  const permissionKey = `${action}_permissions`;
  const permissions = collaboration[permissionKey];
  const requiredPlan = permissions?.required_plan;
  
  // If no plan requirement, allow (backward compatibility)
  if (requiredPlan === null || requiredPlan === undefined) {
    return { allowed: true, message: 'No plan restriction' };
  }
  
  // Check subscription status
  const isActive = user.subscription_status === 'active' || user.subscription_status === 'trialing';
  if (!isActive) {
    return { allowed: false, reason: 'subscription_inactive', ... };
  }
  
  // Check if user's plan meets requirement
  const userPlanOrder = PLAN_ORDER[user.plan] || 0;
  const requiredPlanOrder = PLAN_ORDER[requiredPlan];
  
  if (userPlanOrder < requiredPlanOrder) {
    return { allowed: false, reason: 'plan_required', ... };
  }
  
  return { allowed: true, message: 'Access granted' };
}
```

**Note**: This function currently does NOT check billing features (Layer 1). The billing feature check should be added before the map settings check.

---

## Example Scenarios

### Scenario 1: Hobby User on Open Map

**User:**
- Plan: `hobby`
- Features: `map_edit_pins`, `map_edit_areas`
- Role: `non-member`
- Subscription: `active`

**Map:**
- `allow_pins: true`
- `pin_permissions.required_plan: null` (no restriction)

**Result:** ✅ **ALLOWED**
- User has `map_edit_pins` feature
- Map allows pins
- No plan requirement

---

### Scenario 2: Hobby User on Restricted Map

**User:**
- Plan: `hobby`
- Features: `map_edit_pins`, `map_edit_areas`
- Role: `non-member`
- Subscription: `active`

**Map:**
- `allow_pins: true`
- `pin_permissions.required_plan: 'contributor'`

**Result:** ❌ **DENIED**
- User has `map_edit_pins` feature ✅
- Map allows pins ✅
- Map requires Contributor plan ❌
- User has Hobby plan (order 1 < 2)

**Message:** "This map requires a contributor plan to add pins."

---

### Scenario 3: Contributor User Creating Post

**User:**
- Plan: `contributor`
- Features: `map_edit_pins`, `map_edit_areas`, `map_create_posts`
- Role: `non-member`
- Subscription: `active`

**Map:**
- `allow_posts: true`
- `post_permissions.required_plan: null`

**Result:** ✅ **ALLOWED**
- User has `map_create_posts` feature ✅
- Map allows posts ✅
- No plan requirement ✅

---

### Scenario 4: Hobby User Trying to Create Post

**User:**
- Plan: `hobby`
- Features: `map_edit_pins`, `map_edit_areas` (no `map_create_posts`)
- Role: `non-member`
- Subscription: `active`

**Map:**
- `allow_posts: true`
- `post_permissions.required_plan: null`

**Result:** ❌ **DENIED**
- User does NOT have `map_create_posts` feature ❌
- (Map settings check never reached)

**Message:** "Your plan does not include map post creation. Upgrade to Contributor to create posts."

---

### Scenario 5: Editor Member on Private Map

**User:**
- Plan: `hobby`
- Features: `map_edit_pins`, `map_edit_areas`
- Role: `editor`
- Subscription: `active`

**Map:**
- `allow_pins: true`
- `pin_permissions.required_plan: 'contributor'`
- `role_overrides.editors_can_edit: true`

**Result:** ✅ **ALLOWED**
- User has `map_edit_pins` feature ✅
- Map allows pins ✅
- User is editor with override enabled ✅
- (Plan requirement bypassed by role)

---

### Scenario 6: Professional User on Business-Only Map

**User:**
- Plan: `professional`
- Features: All Professional features
- Role: `non-member`
- Subscription: `active`

**Map:**
- `allow_pins: true`
- `pin_permissions.required_plan: 'business'`

**Result:** ❌ **DENIED**
- User has `map_edit_pins` feature ✅
- Map allows pins ✅
- Map requires Business plan ❌
- User has Professional plan (order 3 < 4)

**Message:** "This map requires a business plan to add pins."

---

## Correlation Matrix

### Map Owner Settings → User Plan Requirements

| Map Setting | Hobby | Contributor | Professional | Business |
|------------|-------|-------------|--------------|----------|
| `pin_permissions.required_plan: null` | ✅ (if has feature) | ✅ | ✅ | ✅ |
| `pin_permissions.required_plan: 'hobby'` | ✅ (if has feature) | ✅ | ✅ | ✅ |
| `pin_permissions.required_plan: 'contributor'` | ❌ | ✅ | ✅ | ✅ |
| `pin_permissions.required_plan: 'professional'` | ❌ | ❌ | ✅ | ✅ |
| `pin_permissions.required_plan: 'business'` | ❌ | ❌ | ❌ | ✅ |

### User Plan → Available Features

| Feature | Hobby | Contributor | Professional | Business |
|---------|-------|-------------|--------------|----------|
| `map_edit_pins` | ✅ | ✅ | ✅ | ✅ |
| `map_edit_areas` | ✅ | ✅ | ✅ | ✅ |
| `map_create_posts` | ❌ | ✅ | ✅ | ✅ |
| `map_advanced_editing` | ❌ | ❌ | ✅ | ✅ |
| `map_analytics` | ❌ | ✅ | ✅ | ✅ |
| `map_export` | ❌ | ❌ | ✅ | ✅ |
| `map_collaboration_tools` | ❌ | ✅ | ✅ | ✅ |

---

## Key Takeaways

1. **Billing features are checked first** - Users must have the feature in their plan
2. **Map owner settings are checked second** - Even with the feature, the map may restrict access
3. **Role overrides apply last** - Managers/editors can bypass plan requirements (but still need billing features)
4. **Owner always has access** - Map owners bypass all checks
5. **Plan hierarchy matters** - Higher plans inherit lower plan features
6. **Null = no restriction** - If `required_plan: null`, any user with the billing feature can access

---

## Implementation Status

### ✅ Implemented
- Map settings structure with plan-based permissions
- Permission checking function (`canUserPerformMapAction`)
- Role-based overrides
- Plan order comparison

### ⚠️ Partially Implemented
- Billing feature checks (should be added to permission function)
- UI for setting plan-based permissions (exists but may need refinement)

### ❌ Not Yet Implemented
- Billing features for map editing (`map_edit_pins`, `map_create_posts`, etc.)
- Database migration to add map editing features to plans
- API endpoint updates to check billing features before map settings

---

## Next Steps

1. **Add billing features** to `billing.features` table
2. **Assign features to plans** in `billing.plan_features`
3. **Update permission function** to check billing features first
4. **Update API endpoints** to use updated permission checks
5. **Add upgrade prompts** in UI when users lack required features/plans
