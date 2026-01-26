# Map Plan-Aware Implementation Status

## ✅ Completed Implementation

### 1. Permission Check Function
**File:** `src/lib/maps/permissions.ts`

- ✅ Created `canUserPerformMapAction()` function
- ✅ Checks: action enabled → plan requirement → user's plan → role overrides
- ✅ Returns detailed `PermissionCheckResult` with reason and upgrade info
- ✅ Helper functions: `getPlanOrder()`, `planMeetsRequirement()`

### 2. Upgrade Prompt Component
**File:** `src/components/maps/MapActionUpgradePrompt.tsx`

- ✅ Created reusable upgrade prompt modal
- ✅ Shows required plan vs current plan
- ✅ Links to billing page and plans page
- ✅ Handles all three actions: pins, areas, posts

### 3. Visual Indicators (Temporary)
**Files:** 
- `src/app/map/[id]/components/MapInfoCard.tsx`
- `src/app/map/[id]/components/JoinMapSidebar.tsx`

- ✅ Blue border (`border-2 border-blue-500`): Plan-based permissions
- ✅ Red border (`border-2 border-red-500`): Owner-granted permissions
- ✅ Plan requirement badges (e.g., "contributor+")
- ✅ All marked with `// TEMPORARY - remove before production` comments

### 4. API Endpoint Updates
**Files:**
- `src/app/api/maps/[id]/pins/route.ts`
- `src/app/api/maps/[id]/areas/route.ts`

- ✅ Added plan permission checks before allowing pin/area creation
- ✅ Checks subscription status
- ✅ Returns detailed error with `reason`, `requiredPlan`, `currentPlan`
- ✅ Backward compatible (null plan requirement = no restriction)

### 5. Map Page Integration
**File:** `src/app/map/[id]/page.tsx`

- ✅ Added upgrade prompt state management
- ✅ Created permission check handlers (`handlePinAction`, `handleAreaAction`, `handlePostAction`)
- ✅ Passes permission props to components
- ✅ Listens for permission denied events from API errors
- ✅ Renders `MapActionUpgradePrompt` component

### 6. Map Settings - Plan Selectors
**File:** `src/app/map/[id]/components/MapSettingsSidebar.tsx`

- ✅ Added plan requirement selectors for pins, areas, posts
- ✅ Only shows when corresponding toggle is enabled
- ✅ Options: Any user, Hobby+, Contributor+, Professional+, Business only
- ✅ Updates form data with plan requirements
- ✅ API validation schema updated to accept new structure

### 7. Type Updates
**Files:**
- `src/types/map.ts` (via MapData interface in page.tsx)
- `src/app/api/maps/[id]/route.ts` (validation schema)

- ✅ Added `pin_permissions`, `area_permissions`, `post_permissions` to collaboration settings
- ✅ Added `role_overrides` for manager/editor overrides
- ✅ Updated API validation to accept new permission structure

### 8. MapIDBox Integration
**File:** `src/app/map/[id]/components/MapIDBox.tsx`

- ✅ Added permission props to interface
- ✅ Created `handlePinModeToggle` and `handleAreaDrawToggle` with permission checks
- ✅ Permission checks before enabling pin mode
- ✅ Error handling for API permission failures
- ✅ Dispatches custom events for upgrade prompts

---

## 🔄 How It Works

### Permission Check Flow

```
User clicks "Add Pin"
  ↓
Frontend: handlePinAction() checks permissions
  ↓
If not allowed → Show upgrade prompt
If allowed → Enable pin mode
  ↓
User clicks map to create pin
  ↓
Backend: API checks permissions again (enforcement)
  ↓
If not allowed → Return 403 with plan info
Frontend: Show upgrade prompt via event
```

### Visual Indicators

**Blue Border (Plan-Based):**
- Shown when `pin_permissions.required_plan !== null`
- Indicates: "This requires a specific plan level"

**Red Border (Owner-Granted):**
- Shown when `allow_pins === true` AND `pin_permissions.required_plan === null`
- Indicates: "Owner enabled this, no plan restriction"

### Upgrade Prompt Triggers

1. **Frontend Check** - Before enabling pin/area mode
2. **API Error** - When API returns 403 with `reason: 'plan_required'`
3. **Custom Event** - Components dispatch `map-action-permission-denied` event

---

## 📋 Remaining Tasks

### Database Migration
- [ ] Create migration to add default plan permissions to existing maps
- [ ] Set all existing maps to `null` (no restriction) for backward compatibility

### Testing
- [ ] Test Hobby user on map with no restrictions
- [ ] Test Hobby user on map requiring Contributor
- [ ] Test Contributor user on map requiring Professional
- [ ] Test owner override (should always work)
- [ ] Test manager/editor role overrides
- [ ] Test subscription inactive scenarios
- [ ] Test backward compatibility (maps without plan permissions)

### UI Polish
- [ ] Connect pin/draw buttons to permission handlers (if MapInfoCard is re-enabled)
- [ ] Add permission checks to post creation flow
- [ ] Add visual indicators to other UI elements that show permissions

### Cleanup (Before Production)
- [ ] Remove all blue/red border classes
- [ ] Remove `// TEMPORARY` comments
- [ ] Remove visual indicator code

---

## 🎯 Key Features Implemented

1. **Three-Layer Permission Model**
   - Billing features (user's plan)
   - Map owner settings (plan requirements)
   - Role overrides (managers/editors)

2. **Transparent Upgrade Path**
   - Clear error messages
   - Upgrade prompts with plan comparison
   - Direct links to billing/plans pages

3. **Backward Compatible**
   - Existing maps work without changes
   - Default to `null` (no restriction)
   - Gradual migration path

4. **Visual Debugging**
   - Blue borders = plan-based
   - Red borders = owner-granted
   - Easy to identify permission sources

---

## 📝 Usage Examples

### Setting Plan Requirements (Owner)

```typescript
// In MapSettingsSidebar
settings: {
  collaboration: {
    allow_pins: true,
    pin_permissions: {
      required_plan: 'contributor' // Only Contributor+ can add pins
    }
  }
}
```

### Checking Permissions (Developer)

```typescript
import { canUserPerformMapAction } from '@/lib/maps/permissions';

const result = canUserPerformMapAction(
  'pins',
  mapData,
  {
    accountId: account.id,
    plan: account.plan,
    subscription_status: account.subscription_status,
    role: userRole,
  },
  isOwner
);

if (!result.allowed) {
  // Show upgrade prompt
  setUpgradePrompt({
    isOpen: true,
    action: 'pins',
    requiredPlan: result.requiredPlan!,
    currentPlan: result.currentPlan,
  });
}
```

---

## 🚨 Important Notes

1. **Visual Indicators are Temporary**
   - All blue/red borders must be removed before production
   - They are for development/debugging only
   - Search for `TEMPORARY` comments to find all instances

2. **Backward Compatibility**
   - Maps without plan permissions default to `null` (no restriction)
   - Existing maps continue to work as before
   - Migration sets defaults, doesn't break anything

3. **Role Overrides**
   - Managers/editors can bypass plan requirements (if enabled)
   - Owners always have full access
   - Role checks happen after plan checks

4. **Subscription Status**
   - Inactive subscriptions block access even if plan level is correct
   - Check both plan level AND subscription status

---

## 🔗 Related Documents

- `docs/MAP_BILLING_ALIGNMENT.md` - Full alignment strategy
- `docs/MAP_PLANS_VALUE_PROPOSITION.md` - Value proposition breakdown
- `docs/MAP_PLAN_AWARE_IMPLEMENTATION.md` - Original implementation plan
