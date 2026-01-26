# Map Billing & Permissions Alignment

## Executive Summary

This document aligns the billing schema with map functionality, creating a unified permission model that considers:
1. **User's billing plan** (what features they have)
2. **Map owner settings** (what the map allows)
3. **Map membership role** (owner/manager/editor)

---

## Current State Analysis

### Billing Schema Structure

**Plans:**
- `hobby` ($0/month) - Display order: 1
- `contributor` ($20/month) - Display order: 2
- `professional` ($60/month) - Display order: 3
- `business` ($200/month) - Display order: 4

**Feature Inheritance:**
- Higher-tier plans inherit all features from lower tiers
- Features are assigned via `billing.plan_features` junction table
- Limits are stored in `plan_features.limit_value` and `plan_features.limit_type`

**Current Map-Related Features:**
- `unlimited_maps` / `custom_maps` - Map creation capability
- No features for map editing permissions (pins/areas/posts)

### Current Map Permission Model

**Map Creation:**
- Gated by `custom_maps` feature
- Hobby: 3 maps (count limit)
- Contributor+: Unlimited maps

**Map Editing (Pins/Areas):**
- **Members** (owner/manager/editor): Always allowed
- **Non-members**: Allowed if:
  - Map is `public` AND
  - `settings.collaboration.allow_pins` = true (for pins)
  - `settings.collaboration.allow_areas` = true (for areas)
- **No plan-based differentiation** - All authenticated users have same permissions

**Map Posts:**
- Similar to pins/areas, gated by `settings.collaboration.allow_posts`
- No plan-based differentiation

---

## Proposed Alignment: Three-Layer Permission Model

### Layer 1: Billing Features (User's Plan)

**Map Ownership Features:**
- `custom_maps` - Can create maps (with limits)
- `unlimited_maps` - Unlimited map creation
- `map_analytics` - View analytics on owned maps (NEW)
- `map_export` - Export map data (NEW)
- `map_collaboration_tools` - Advanced collaboration settings (NEW)

**Map Editing Features:**
- `map_edit_pins` - Can add pins to maps (NEW)
- `map_edit_areas` - Can draw areas on maps (NEW)
- `map_create_posts` - Can create posts on maps (NEW)
- `map_advanced_editing` - Advanced editing features (NEW)

### Layer 2: Map Owner Settings

**Collaboration Permissions (Enhanced):**
```typescript
settings: {
  collaboration: {
    // Current: binary toggles
    allow_pins: boolean,
    allow_areas: boolean,
    allow_posts: boolean,
    
    // Proposed: plan-based permissions
    pin_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null,
      // null = no restriction (any authenticated user)
    },
    area_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null,
    },
    post_permissions: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null,
    },
    
    // Advanced: role-based overrides
    role_overrides: {
      // Managers/editors always have access regardless of plan
      managers_can_edit: boolean, // default: true
      editors_can_edit: boolean,  // default: true
    }
  }
}
```

### Layer 3: Map Membership

**Roles:**
- `owner` - Full control (always has access)
- `manager` - Full control except delete (always has access)
- `editor` - Can edit if map allows it (subject to plan + map settings)

---

## Feature Assignment by Plan

### Hobby Plan ($0/month)

**Map Ownership:**
- ✅ `custom_maps` (limit: 3 maps)
- ❌ No analytics
- ❌ No export
- ❌ No advanced collaboration

**Map Editing:**
- ✅ `map_edit_pins` (can add pins if map allows)
- ✅ `map_edit_areas` (can draw areas if map allows)
- ❌ `map_create_posts` (cannot create posts)
- ❌ `map_advanced_editing`

### Contributor Plan ($20/month)

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

### Professional Plan ($60/month)

**Map Ownership:**
- ✅ All Contributor ownership features
- ✅ `map_export` (export map data to CSV/GeoJSON)
- ✅ `map_advanced_analytics` (time-series, geographic insights)
- ✅ `map_custom_domains` (future)

**Map Editing:**
- ✅ All Contributor editing features
- ✅ `map_advanced_editing` (bulk operations, advanced tools)
- ✅ `map_edit_priority` (priority in membership requests)

### Business Plan ($200/month)

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

## Permission Resolution Logic

### For Map Creation

```typescript
function canCreateMap(userPlan: string, currentMapCount: number): boolean {
  // Check feature access
  const featureLimit = getFeatureLimit(userPlan, 'custom_maps');
  
  if (!featureLimit.has_feature) {
    return false;
  }
  
  if (featureLimit.is_unlimited) {
    return true;
  }
  
  if (featureLimit.limit_type === 'count') {
    return currentMapCount < featureLimit.limit_value;
  }
  
  return false;
}
```

### For Map Editing (Pins/Areas/Posts)

```typescript
function canEditMap(
  userPlan: string,
  mapSettings: MapSettings,
  userRole: 'owner' | 'manager' | 'editor' | null,
  action: 'pins' | 'areas' | 'posts'
): boolean {
  // Layer 1: Check user's billing feature
  const featureSlug = `map_edit_${action}`;
  const hasFeature = hasBillingFeature(userPlan, featureSlug);
  
  if (!hasFeature) {
    return false; // User's plan doesn't allow this action
  }
  
  // Layer 2: Check map owner settings
  const collaboration = mapSettings.collaboration || {};
  const permissionKey = `${action}_permissions`;
  const requiredPlan = collaboration[permissionKey]?.required_plan;
  
  if (requiredPlan !== null) {
    // Map requires specific plan level
    const planOrder = { hobby: 1, contributor: 2, professional: 3, business: 4 };
    const userPlanOrder = planOrder[userPlan] || 0;
    const requiredPlanOrder = planOrder[requiredPlan] || 0;
    
    if (userPlanOrder < requiredPlanOrder) {
      return false; // User's plan is too low
    }
  }
  
  // Layer 3: Check membership role
  if (userRole === 'owner' || userRole === 'manager') {
    // Owners/managers always have access (if they have the billing feature)
    return true;
  }
  
  if (userRole === 'editor') {
    // Editors can edit if map allows it
    const roleOverrides = collaboration.role_overrides || {};
    return roleOverrides.editors_can_edit !== false; // default: true
  }
  
  // Non-members: check if map allows public editing
  const allowKey = `allow_${action}`;
  return collaboration[allowKey] === true;
}
```

---

## Database Schema Changes

### 1. Add New Billing Features

```sql
-- Map editing features
INSERT INTO billing.features (slug, name, description, category) VALUES
  ('map_edit_pins', 'Edit Map Pins', 'Add pins to maps', 'maps'),
  ('map_edit_areas', 'Edit Map Areas', 'Draw areas on maps', 'maps'),
  ('map_create_posts', 'Create Map Posts', 'Create posts on maps', 'maps'),
  ('map_advanced_editing', 'Advanced Map Editing', 'Access to advanced map editing tools', 'maps'),
  ('map_analytics', 'Map Analytics', 'View analytics on owned maps', 'maps'),
  ('map_export', 'Export Map Data', 'Export map data to CSV/GeoJSON', 'maps'),
  ('map_collaboration_tools', 'Map Collaboration Tools', 'Advanced collaboration settings', 'maps')
ON CONFLICT (slug) DO NOTHING;
```

### 2. Assign Features to Plans

```sql
-- Hobby: Basic editing only
INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'hobby'
  AND f.slug IN ('map_edit_pins', 'map_edit_areas')
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Contributor: Full editing + ownership features
INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'contributor'
  AND f.slug IN (
    'map_edit_pins',
    'map_edit_areas',
    'map_create_posts',
    'map_analytics',
    'map_collaboration_tools'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Professional: Advanced features
INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'professional'
  AND f.slug IN (
    'map_advanced_editing',
    'map_export'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Business: Enterprise features
INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'business'
  AND f.slug IN (
    'map_team_management',
    'map_white_label',
    'map_api_access'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;
```

### 3. Update Map Settings Schema

```sql
-- Add plan-based permissions to map settings
-- This is stored in the existing settings JSONB column
-- No schema change needed, just document the new structure

-- Example migration to add default values:
UPDATE public.map
SET settings = jsonb_set(
  settings,
  '{collaboration,pin_permissions}',
  '{"required_plan": null}'::jsonb,
  true
)
WHERE settings->'collaboration'->'pin_permissions' IS NULL;
```

---

## API Changes

### 1. Map Creation Endpoint

**Current:** Checks `custom_maps` feature limit
**No change needed** - Already aligned with billing schema

### 2. Pin/Area/Post Creation Endpoints

**Current:** Checks membership OR public map with collaboration settings
**Proposed:** Add billing feature check before map settings check

```typescript
// In /api/maps/[id]/pins/route.ts
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... existing code ...
  
  // NEW: Check user's billing feature
  const { data: account } = await supabase
    .from('accounts')
    .select('plan, subscription_status')
    .eq('id', accountId)
    .single();
  
  const hasEditPinsFeature = await checkBillingFeature(accountId, 'map_edit_pins');
  
  if (!hasEditPinsFeature) {
    return createErrorResponse(
      'Your plan does not include map editing. Upgrade to Contributor to add pins.',
      403
    );
  }
  
  // Existing: Check map settings
  const requiredPlan = collaboration.pin_permissions?.required_plan;
  if (requiredPlan) {
    const planOrder = { hobby: 1, contributor: 2, professional: 3, business: 4 };
    const userPlanOrder = planOrder[account.plan] || 0;
    const requiredPlanOrder = planOrder[requiredPlan] || 0;
    
    if (userPlanOrder < requiredPlanOrder) {
      return createErrorResponse(
        `This map requires ${requiredPlan} plan or higher to add pins.`,
        403
      );
    }
  }
  
  // Existing: Check membership/collaboration settings
  // ... rest of existing code ...
}
```

---

## UI Changes

### 1. Map Settings Sidebar

**Add Plan-Based Permission Controls:**

```typescript
// In MapSettingsSidebar.tsx
const [pinPermissions, setPinPermissions] = useState({
  required_plan: null as 'hobby' | 'contributor' | 'professional' | 'business' | null,
});

// UI Component
<div className="space-y-2">
  <label className="text-xs font-medium text-gray-700">
    Who can add pins?
  </label>
  <select
    value={pinPermissions.required_plan || 'any'}
    onChange={(e) => {
      const value = e.target.value === 'any' ? null : e.target.value;
      setPinPermissions({ required_plan: value });
    }}
    className="text-xs border rounded-md px-2 py-1"
  >
    <option value="any">Any authenticated user</option>
    <option value="hobby">Hobby plan or higher</option>
    <option value="contributor">Contributor plan or higher</option>
    <option value="professional">Professional plan or higher</option>
    <option value="business">Business plan only</option>
  </select>
  <p className="text-[10px] text-gray-500">
    {pinPermissions.required_plan 
      ? `Only users with ${pinPermissions.required_plan} plan or higher can add pins`
      : 'Any authenticated user can add pins (if enabled below)'}
  </p>
</div>
```

### 2. Map Editing UI

**Show Upgrade Prompts:**

```typescript
// When user tries to add pin but doesn't have feature
if (!hasBillingFeature('map_edit_pins')) {
  return (
    <UpgradePrompt
      title="Upgrade to add pins"
      message="Contributor plan required to add pins to maps"
      plan="contributor"
    />
  );
}

// When map requires higher plan
if (mapSettings.collaboration.pin_permissions?.required_plan) {
  const requiredPlan = mapSettings.collaboration.pin_permissions.required_plan;
  if (userPlanOrder < requiredPlanOrder) {
    return (
      <UpgradePrompt
        title={`This map requires ${requiredPlan} plan`}
        message={`Upgrade to ${requiredPlan} to add pins to this map`}
        plan={requiredPlan}
      />
    );
  }
}
```

---

## Migration Strategy

### Phase 1: Add Billing Features (Non-Breaking)

1. Add new map editing features to `billing.features`
2. Assign features to plans
3. **Don't enforce yet** - Just add the features

### Phase 2: Update Map Settings (Backward Compatible)

1. Add plan-based permission fields to map settings
2. Default to `null` (no restriction) for existing maps
3. Update UI to show new controls (but don't require them)

### Phase 3: Enforce Billing Features (Breaking)

1. Update API endpoints to check billing features
2. Show upgrade prompts in UI
3. Update documentation

### Phase 4: Enforce Map Owner Settings (Breaking)

1. Update API endpoints to check map owner's plan requirements
2. Show plan-specific upgrade prompts
3. Update map settings UI to require plan selection

---

## Example Scenarios

### Scenario 1: Hobby User on Public Map

**User:** Hobby plan
**Map:** Public, `allow_pins: true`, `pin_permissions.required_plan: null`
**Result:** ✅ Can add pins (has `map_edit_pins` feature, map allows it)

### Scenario 2: Hobby User on Restricted Map

**User:** Hobby plan
**Map:** Public, `allow_pins: true`, `pin_permissions.required_plan: 'contributor'`
**Result:** ❌ Cannot add pins (map requires Contributor plan)
**UI:** Shows upgrade prompt to Contributor

### Scenario 3: Contributor User Creating Post

**User:** Contributor plan
**Map:** Public, `allow_posts: true`, `post_permissions.required_plan: null`
**Result:** ✅ Can create posts (has `map_create_posts` feature, map allows it)

### Scenario 4: Hobby User Trying to Create Post

**User:** Hobby plan
**Map:** Public, `allow_posts: true`
**Result:** ❌ Cannot create posts (doesn't have `map_create_posts` feature)
**UI:** Shows upgrade prompt to Contributor

### Scenario 5: Editor Member on Private Map

**User:** Hobby plan, Editor role
**Map:** Private, `pin_permissions.required_plan: 'contributor'`
**Result:** ✅ Can add pins (Editor role override, but still needs billing feature)
**Note:** If user doesn't have `map_edit_pins`, they still can't add pins

### Scenario 6: Professional User on Business Map

**User:** Professional plan
**Map:** Public, `pin_permissions.required_plan: 'business'`
**Result:** ❌ Cannot add pins (map requires Business plan, user has Professional)
**UI:** Shows upgrade prompt to Business

---

## Benefits of This Alignment

### For Users

1. **Clear Upgrade Path:** Know exactly what each plan unlocks
2. **Value at Every Tier:** Both ownership AND editing value increase
3. **Flexible Collaboration:** Can join maps that match their plan level

### For Map Owners

1. **Quality Control:** Restrict editing to paid users
2. **Monetization:** Encourage upgrades through map restrictions
3. **Flexible Settings:** Choose who can contribute based on plan

### For Platform

1. **Revenue Driver:** Clear upgrade incentives at every tier
2. **Engagement:** Paid users more likely to contribute quality content
3. **Differentiation:** Clear value proposition for each plan tier
4. **Scalability:** Database-driven, admin-configurable

---

## Implementation Checklist

### Database
- [ ] Add new map editing features to `billing.features`
- [ ] Assign features to plans in `billing.plan_features`
- [ ] Update map settings structure documentation
- [ ] Create migration to add default plan permissions

### Backend
- [ ] Create helper function `checkBillingFeature(accountId, featureSlug)`
- [ ] Update `/api/maps/[id]/pins` to check `map_edit_pins`
- [ ] Update `/api/maps/[id]/areas` to check `map_edit_areas`
- [ ] Update `/api/maps/[id]/posts` to check `map_create_posts`
- [ ] Add plan requirement checks to all editing endpoints
- [ ] Update error messages to include upgrade prompts

### Frontend
- [ ] Add plan-based permission controls to MapSettingsSidebar
- [ ] Create UpgradePrompt component for map editing
- [ ] Update JoinMapSidebar to show plan requirements
- [ ] Add feature checks before showing edit buttons
- [ ] Update map creation flow to show plan benefits

### Testing
- [ ] Test Hobby user on maps with different permission levels
- [ ] Test Contributor user on restricted maps
- [ ] Test Professional user on Business-only maps
- [ ] Test Editor role overrides
- [ ] Test backward compatibility with existing maps

---

## Future Enhancements

1. **Map Analytics by Plan:** Owners see which plan tiers contribute most
2. **Plan-Based Discovery:** Filter maps by required plan level
3. **Contribution Tracking:** Track contributions by plan tier
4. **Team Management:** Business plan owners can assign manager roles
5. **API Access:** Business plan owners can access maps via API

---

## Summary

This alignment creates a **three-layer permission model**:

1. **Billing Features** (what the user's plan allows)
2. **Map Owner Settings** (what the map requires)
3. **Map Membership** (role-based overrides)

The result is a flexible, scalable system where:
- Users know what their plan unlocks
- Map owners can control who contributes
- The platform has clear upgrade incentives at every tier
