# Map Settings, RLS, and Permission System Consolidation Plan

## Objective

**Create a simple, unified system that connects:**
1. **Map owner settings** (what the map allows)
2. **User billing features** (what the user's plan includes)
3. **RLS policies** (database-level access control)
4. **Frontend UI** (Join sidebar, plan cards, account dropdown)
5. **Backend API** (permission checks, membership approval)

**Goal:** Users see accurate, real-time information about what they can do, and the system enforces permissions consistently across all layers.

---

## Current Map Table Structure

### Owner-Controlled Columns (Direct Settings)

```sql
-- Identity & Visibility
name TEXT NOT NULL                    -- Map name
slug TEXT UNIQUE NOT NULL            -- URL slug
description TEXT                     -- Map description
visibility TEXT NOT NULL             -- 'public' | 'private'
is_active BOOLEAN DEFAULT true      -- Soft delete flag

-- Membership Control
auto_approve_members BOOLEAN DEFAULT false  -- Auto-approve join requests
membership_rules TEXT                        -- Custom rules/terms
membership_questions JSONB DEFAULT '[]'     -- Join request questions

-- Settings JSONB (Owner-Controlled)
settings JSONB DEFAULT '{}'::jsonb
```

### Settings JSONB Structure (Owner-Controlled)

```typescript
settings: {
  // Appearance (affects all viewers)
  appearance?: {
    map_style?: 'street' | 'satellite' | 'light' | 'dark'
    map_layers?: {
      congressional_districts?: boolean
      ctu_boundaries?: boolean
      state_boundary?: boolean
      county_boundaries?: boolean
    }
    meta?: {
      buildingsEnabled?: boolean
      pitch?: number
      terrainEnabled?: boolean
      center?: [number, number]
      zoom?: number
    }
  }
  
  // Collaboration (owner controls who can edit)
  collaboration?: {
    // Binary toggles (enable/disable features)
    allow_pins?: boolean
    allow_areas?: boolean
    allow_posts?: boolean
    allow_clicks?: boolean
    
    // Plan-based requirements (optional restrictions)
    pin_permissions?: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null
    }
    area_permissions?: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null
    }
    post_permissions?: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null
    }
    click_permissions?: {
      required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null
    }
    
    // Role-based overrides
    role_overrides?: {
      managers_can_edit?: boolean  // default: true
      editors_can_edit?: boolean    // default: true
    }
  }
  
  // Presentation (affects display)
  presentation?: {
    hide_creator?: boolean
    is_featured?: boolean
    emoji?: string
  }
}
```

---

## Feature Alignment Matrix

### Map-Level Features (Ownership)

| Feature | Billing Feature | Owner Setting | RLS Check |
|---------|----------------|---------------|-----------|
| Create Map | `custom_maps` (limit: 3) or `unlimited_maps` | N/A | User authenticated |
| View Map | N/A | `visibility: 'public'` or member | RLS: public OR member |
| Edit Map Settings | N/A | Owner/manager role | RLS: owner/manager |
| Delete Map | N/A | Owner only | RLS: owner only |
| View Analytics | `map_analytics` | Owner only | RLS: owner only |
| Export Map | `map_export` | Owner only | RLS: owner only |
| Set Plan Requirements | `map_collaboration_tools` | Owner only | RLS: owner only |

### Content-Level Features (Editing)

| Feature | Billing Feature | Owner Setting | RLS Check |
|---------|----------------|---------------|-----------|
| Add Pins | `map_edit_pins` | `allow_pins: true` + `pin_permissions.required_plan` | Member OR (public + allow_pins + plan check) |
| Draw Areas | `map_edit_areas` | `allow_areas: true` + `area_permissions.required_plan` | Member OR (public + allow_areas + plan check) |
| Create Posts | `map_create_posts` | `allow_posts: true` + `post_permissions.required_plan` | Member OR (public + allow_posts + plan check) |
| Click Map | N/A | `allow_clicks: true` + `click_permissions.required_plan` | Member OR (public + allow_clicks + plan check) |

---

## RLS Logic Hierarchy (Simple)

### 1. Map Access (Who Can See the Map)

```
Can View Map?
├─ Is map active? (is_active = true)
│  └─ NO → ❌ DENIED
│
├─ Is map public? (visibility = 'public')
│  └─ YES → ✅ ALLOWED (anon + authenticated)
│
└─ Is map private?
   ├─ Is user authenticated?
   │  └─ NO → ❌ DENIED
   │
   └─ Is user a member? (map_members table)
      ├─ YES → ✅ ALLOWED
      └─ NO → ❌ DENIED
```

**RLS Policy:**
```sql
-- Public maps: visible to everyone
CREATE POLICY "maps_select_public"
  ON public.map FOR SELECT
  TO anon, authenticated
  USING (visibility = 'public' AND is_active = true);

-- Private maps: visible to members only
CREATE POLICY "maps_select_private_members"
  ON public.map FOR SELECT
  TO authenticated
  USING (
    visibility = 'private'
    AND is_active = true
    AND public.is_map_member(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );
```

### 2. Map Membership (Who Can Join)

```
Can Join Map?
├─ Is user authenticated?
│  └─ NO → ❌ DENIED (must sign in)
│
├─ Is user already a member?
│  └─ YES → ❌ DENIED (already member)
│
├─ Does user have pending request?
│  └─ YES → ❌ DENIED (request pending)
│
├─ Is map public + auto-approve?
│  └─ YES → ✅ AUTO-JOIN (add to map_members)
│
└─ Is map private OR manual approval?
   └─ YES → ✅ CREATE REQUEST (add to map_membership_requests)
```

**RLS Policy:**
```sql
-- Users can join themselves on auto-approve public maps
-- Managers/owners can add any member (for approving requests)
CREATE POLICY "map_members_insert"
  ON public.map_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Case 1: User joining themselves (auto-approve)
      (
        account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.map
          WHERE id = map_id
          AND visibility = 'public'
          AND is_active = true
          AND auto_approve_members = true
        )
      )
      -- Case 2: Manager/owner adding any member
      OR EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.user_id = auth.uid()
        AND (
          public.is_map_manager(map_id, accounts.id)
          OR EXISTS (
            SELECT 1 FROM public.map
            WHERE map.id = map_id AND map.account_id = accounts.id
          )
        )
      )
    )
  );
```

### 3. Content Editing (Who Can Add Pins/Areas/Posts)

```
Can Add Pin/Area/Post?
├─ Is user the owner?
│  └─ YES → ✅ ALLOWED (bypass all checks)
│
├─ Is user a manager?
│  ├─ YES → Check role_overrides.managers_can_edit
│  │   ├─ false → Continue to feature check
│  │   └─ true → ✅ ALLOWED (if has billing feature)
│  │
│  └─ NO → Continue to feature check
│
├─ Is user an editor?
│  ├─ YES → Check role_overrides.editors_can_edit
│  │   ├─ false → ❌ DENIED
│  │   └─ true → Continue to feature check
│  │
│  └─ NO → Continue to feature check
│
├─ Does user have billing feature? (map_edit_pins, etc.)
│  └─ NO → ❌ DENIED (upgrade prompt)
│
├─ Is feature enabled? (allow_pins, allow_areas, allow_posts)
│  └─ NO → ❌ DENIED (map owner disabled)
│
├─ Does map require plan level?
│  ├─ required_plan === null → ✅ ALLOWED
│  │
│  └─ required_plan !== null
│      ├─ user's plan >= required_plan → ✅ ALLOWED
│      └─ user's plan < required_plan → ❌ DENIED (upgrade prompt)
│
└─ END
```

**RLS Policy (for map_pins, map_areas, map_posts):**
```sql
-- Users can insert if they can edit the map
CREATE POLICY "map_pins_insert"
  ON public.map_pins FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.map
      WHERE id = map_id
      AND is_active = true
      AND (
        -- Owner always allowed
        account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
        OR
        -- Member with edit permission
        (
          public.is_map_member(map_id, (
            SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
          ))
          AND (
            -- Check collaboration settings via function
            public.can_user_edit_map(map_id, (
              SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
            ), 'pins')
          )
        )
        OR
        -- Public map with collaboration enabled
        (
          visibility = 'public'
          AND settings->'collaboration'->>'allow_pins' = 'true'
          AND public.can_user_edit_map(map_id, (
            SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
          ), 'pins')
        )
      )
    )
  );
```

---

## Current Issues & Improvements

### Issue 1: RLS Doesn't Check Billing Features
**Problem:** RLS policies check map settings but not user's billing features.

**Solution:** Create helper function that checks both:
```sql
CREATE OR REPLACE FUNCTION public.can_user_edit_map(
  p_map_id UUID,
  p_account_id UUID,
  p_action TEXT -- 'pins', 'areas', 'posts'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_map_settings JSONB;
  v_allow_key TEXT;
  v_permission_key TEXT;
  v_required_plan TEXT;
  v_user_plan TEXT;
  v_user_has_feature BOOLEAN;
BEGIN
  -- Get map settings
  SELECT settings INTO v_map_settings
  FROM public.map
  WHERE id = p_map_id;
  
  -- Check if action is enabled
  v_allow_key := 'allow_' || p_action;
  IF (v_map_settings->'collaboration'->>v_allow_key)::boolean != true THEN
    RETURN false;
  END IF;
  
  -- Check billing feature
  v_user_has_feature := EXISTS (
    SELECT 1 FROM billing.get_account_feature_limit(p_account_id, 'map_edit_' || p_action)
    WHERE has_feature = true
  );
  
  IF NOT v_user_has_feature THEN
    RETURN false;
  END IF;
  
  -- Check plan requirement
  v_permission_key := p_action || '_permissions';
  v_required_plan := v_map_settings->'collaboration'->v_permission_key->>'required_plan';
  
  IF v_required_plan IS NOT NULL THEN
    SELECT plan INTO v_user_plan FROM public.accounts WHERE id = p_account_id;
    -- Compare plan levels (hobby=1, contributor=2, professional=3, business=4)
    IF (CASE v_user_plan WHEN 'hobby' THEN 1 WHEN 'contributor' THEN 2 WHEN 'professional' THEN 3 WHEN 'business' THEN 4 ELSE 0 END) <
       (CASE v_required_plan WHEN 'hobby' THEN 1 WHEN 'contributor' THEN 2 WHEN 'professional' THEN 3 WHEN 'business' THEN 4 ELSE 0 END) THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Issue 2: Frontend Shows Map Settings, Not User Capabilities
**Problem:** Join sidebar shows what map allows, not what user can actually do.

**Solution:** ✅ Already fixed in JoinMapSidebar - now checks billing features and plan.

### Issue 3: API Endpoints Don't Check Billing Features
**Problem:** API routes check map settings but not user's billing features.

**Solution:** Update API routes to use unified permission check:
```typescript
// In /api/maps/[id]/pins/route.ts
import { canUserPerformMapAction } from '@/lib/maps/permissions';
import { getAccountFeatureLimit } from '@/lib/billing/featureLimits';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... get map, user, etc ...
  
  // Check billing feature first
  const featureLimit = await getAccountFeatureLimit(accountId, 'map_edit_pins');
  if (!featureLimit.has_feature) {
    return createErrorResponse('Your plan does not include map editing. Upgrade to Contributor.', 403);
  }
  
  // Check map permissions
  const permissionResult = canUserPerformMapAction('pins', map, user, isOwner);
  if (!permissionResult.allowed) {
    return createErrorResponse(permissionResult.message, 403);
  }
  
  // Proceed with pin creation
  // ...
}
```

### Issue 4: Inconsistent Permission Checks
**Problem:** Different places check permissions differently.

**Solution:** Create single source of truth:
```typescript
// src/lib/maps/permissions.ts
export async function canUserPerformMapActionWithBilling(
  action: 'pins' | 'areas' | 'posts' | 'clicks',
  map: MapData,
  accountId: string
): Promise<PermissionCheckResult> {
  // 1. Check billing feature
  const featureSlug = `map_edit_${action}`;
  const featureLimit = await getAccountFeatureLimit(accountId, featureSlug);
  if (!featureLimit.has_feature) {
    return {
      allowed: false,
      reason: 'feature_required',
      message: `Your plan does not include ${action}. Upgrade to Contributor.`,
    };
  }
  
  // 2. Check map settings (existing logic)
  return canUserPerformMapAction(action, map, user, isOwner);
}
```

---

## Actionable Implementation Plan

### Phase 1: Backend Permission Function (Week 1)

**Task 1.1:** Create unified permission check function
- [ ] Add `canUserPerformMapActionWithBilling()` to `src/lib/maps/permissions.ts`
- [ ] Combines billing feature check + map settings check
- [ ] Returns clear error messages for upgrade prompts

**Task 1.2:** Create database helper function
- [ ] Add `can_user_edit_map()` SQL function
- [ ] Checks billing features via `billing.get_account_feature_limit()`
- [ ] Checks map settings from `map.settings` JSONB
- [ ] Used by RLS policies

**Task 1.3:** Update RLS policies
- [ ] Update `map_pins_insert` policy to use `can_user_edit_map()`
- [ ] Update `map_areas_insert` policy
- [ ] Update `map_posts_insert` policy (if exists)

### Phase 2: API Endpoint Updates (Week 1-2)

**Task 2.1:** Update pin creation endpoint
- [ ] Use `canUserPerformMapActionWithBilling()` in `/api/maps/[id]/pins/route.ts`
- [ ] Return clear error messages
- [ ] Test with different plan levels

**Task 2.2:** Update area creation endpoint
- [ ] Use `canUserPerformMapActionWithBilling()` in `/api/maps/[id]/areas/route.ts`
- [ ] Return clear error messages

**Task 2.3:** Update post creation endpoint
- [ ] Use `canUserPerformMapActionWithBilling()` in `/api/posts/route.ts` (if map-related)
- [ ] Return clear error messages

### Phase 3: Frontend UI Updates (Week 2)

**Task 3.1:** Join Map Sidebar ✅ (Already Done)
- [x] Shows user capabilities based on billing features
- [x] Shows plan requirements
- [x] Shows upgrade prompts

**Task 3.2:** Account Dropdown
- [ ] Show map editing features in feature list
- [ ] Show usage: "X / unlimited maps" or "X / 3 maps"
- [ ] Link to upgrade if at limit

**Task 3.3:** Plan Cards
- [ ] Highlight map editing features
- [ ] Show which plan unlocks which features
- [ ] Clear value proposition

**Task 3.4:** Map Settings Sidebar
- [ ] Show plan requirement selectors (already exists)
- [ ] Show which features require which plans
- [ ] Preview what users will see

### Phase 4: Testing & Documentation (Week 2-3)

**Task 4.1:** Test Scenarios
- [ ] Hobby user on open map (can add pins/areas)
- [ ] Hobby user on restricted map (can't add, sees upgrade)
- [ ] Contributor user on restricted map (can add)
- [ ] Manager/editor role overrides
- [ ] Auto-approve vs manual approval

**Task 4.2:** Documentation
- [ ] Update API documentation
- [ ] Update RLS policy documentation
- [ ] Create user-facing help docs

---

## Simple UI Hierarchy

### Who Can Join What Maps?

```
┌─────────────────────────────────────────┐
│ Public Map                               │
│ ├─ Auto-Approve: ON                      │
│ │  └─ Anyone can join instantly         │
│ │                                       │
│ └─ Auto-Approve: OFF                    │
│    └─ Anyone can request, owner approves│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Private Map                             │
│ ├─ Auto-Approve: ON                     │
│ │  └─ Members can invite others         │
│ │                                       │
│ └─ Auto-Approve: OFF                    │
│    └─ Request required, owner approves  │
└─────────────────────────────────────────┘
```

### Map Permissions Flow

```
User Action
    ↓
Check Billing Feature (Layer 1)
    ├─ NO → Show Upgrade Prompt
    └─ YES → Continue
         ↓
Check Map Settings (Layer 2)
    ├─ Feature Disabled → Show "Map owner disabled this"
    └─ Feature Enabled → Continue
         ↓
Check Plan Requirement (Layer 2)
    ├─ Plan Too Low → Show Upgrade Prompt
    └─ Plan OK → Continue
         ↓
Check Role Override (Layer 3)
    ├─ Manager/Editor Override → ✅ ALLOWED
    └─ No Override → Continue
         ↓
✅ ALLOWED
```

---

## Success Criteria

1. **Consistency:** Same permission logic in RLS, API, and frontend
2. **Clarity:** Users always know why they can/can't do something
3. **Simplicity:** No duplicate checks, single source of truth
4. **Performance:** Permission checks are fast (cached where possible)
5. **Maintainability:** Easy to add new features/permissions

---

## Next Steps

1. **Review this plan** - Confirm approach is correct
2. **Prioritize tasks** - Which phase is most critical?
3. **Start Phase 1** - Create unified permission function
4. **Test incrementally** - Don't change everything at once
5. **Document as you go** - Keep docs updated
