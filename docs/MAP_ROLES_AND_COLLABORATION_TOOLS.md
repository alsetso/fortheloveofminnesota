# Map Roles & Collaboration Tools Guide

## Map Roles

### **Owner**
- **Who**: Creator of the map (`map.account_id === user.account_id`)
- **Abilities**: Full control over all map features
- **Settings Access**: Can edit all map settings
- **Members Management**: Can add/remove members, assign roles, approve requests

### **Manager**
- **Who**: Member with `role: 'manager'` assigned by owner
- **Abilities**: Can manage members and edit map content
- **Settings Access**: Read-only view of settings
- **Members Management**: Can view members, approve/deny requests, assign roles

### **Editor**
- **Who**: Member with `role: 'editor'` assigned by owner
- **Abilities**: Can add content (pins, areas, posts) if enabled
- **Settings Access**: Read-only view of settings
- **Members Management**: No access

### **Member** (no specific role)
- **Who**: Member with no role assigned (default)
- **Abilities**: Same as editor, subject to collaboration settings
- **Settings Access**: Read-only view of settings
- **Members Management**: No access

---

## Collaboration Tools

### **Tools Available**
1. **Click** - Click on map to add location mentions
2. **Drag** - Pan/zoom the map (always available)
3. **Pin** - Add pins to the map
4. **Draw** - Draw areas/polygons on the map

### **Tool Visibility**
- **Shown to**: Authenticated members and owners only
- **Hidden from**: Unauthenticated users, non-members

---

## Tool Access Logic

### **Owner**
- ✅ **Always has access** to all tools regardless of settings
- ✅ **Can use tools even if** `allow_pins`, `allow_areas`, `allow_clicks` are `false`
- ✅ **No plan restrictions** apply
- **Visual**: All tools fully enabled (no disabled state)

### **Manager**
- ✅ **Has access if**:
  - Feature is enabled (`allow_pins: true`, etc.) **AND**
  - `role_overrides.managers_can_edit !== false` (default: true)
- ✅ **Bypasses** plan requirements (no plan check)
- ⚠️ **Still requires** feature to be enabled by owner
- **Visual**: Tools enabled if feature is on, disabled if feature is off

### **Editor**
- ✅ **Has access if**:
  - Feature is enabled (`allow_pins: true`, etc.) **AND**
  - `role_overrides.editors_can_edit !== false` (default: true)
- ✅ **Bypasses** plan requirements (no plan check)
- ⚠️ **Still requires** feature to be enabled by owner
- **Visual**: Tools enabled if feature is on, disabled if feature is off

### **Member** (no role)
- ⚠️ **Subject to** `allow_pins/allow_areas/allow_clicks` settings
- ⚠️ **Subject to** plan requirements (`pin_permissions.required_plan`, etc.)
- **Visual**: Tools show as disabled if:
  - Feature is disabled by owner (`allow_pins: false`)
  - User's plan doesn't meet requirement
  - Blue dot indicator if feature enabled but plan insufficient

---

## Visual Indicators

### **Enabled Tool**
- Normal opacity (100%)
- White icon (`text-white/70`)
- Hover: `hover:text-white hover:bg-white/10`
- Active: `bg-white/20 text-white`
- Clickable cursor

### **Disabled Tool**
- Reduced opacity (`opacity-40`)
- Muted icon (`text-white/40`)
- `cursor-not-allowed`
- Tooltip: "{Tool} is disabled"

### **Owner Override Indicator**
- **Blue dot badge** (`bg-blue-500`) on top-right of icon
- **Shown when**: Feature is enabled by owner BUT user doesn't have permission
- **Meaning**: Owner wants this enabled, but user needs to upgrade plan

---

## Settings Hierarchy

### **Owner Controls**
1. **Enable/Disable Features**: `allow_pins`, `allow_areas`, `allow_clicks`, `allow_posts`
2. **Plan Requirements**: Set `pin_permissions.required_plan`, `area_permissions.required_plan`, etc.
3. **Role Overrides**: `role_overrides.managers_can_edit`, `role_overrides.editors_can_edit`

### **What Happens When Owner Toggles Off**

**Scenario**: Owner sets `allow_pins: false`

- **Owner**: ✅ Still can create pins (owner override - bypasses settings)
- **Manager**: ❌ Cannot create pins (requires `allow_pins: true`)
- **Editor**: ❌ Cannot create pins (requires `allow_pins: true`)
- **Member**: ❌ Cannot create pins (disabled)
- **Visual**: Manager/Editor/Member all see Pin tool as disabled (opacity-40)

**Key Point**: Only owners bypass the `allow_*` settings. Managers/editors bypass plan requirements but still need features enabled.

---

## Permission Check Flow

**In CollaborationToolsNav component:**
```
1. Is user the owner?
   → YES: Allow immediately (bypass ALL checks - never calls permission function)
   
2. Is feature enabled? (allow_pins/allow_areas/allow_clicks)
   → NO: Deny (disabled state) - affects managers/editors/members
   
3. Call canUserPerformMapAction() which checks:
   a. Is user a manager/editor?
      → YES: Check role_overrides
        → If enabled: Allow (bypass plan requirements)
        → If disabled: Continue to plan check
   
   b. Is plan requirement set?
      → NO: Allow (no restriction)
      → YES: Check user's plan
        → Meets requirement: Allow
        → Doesn't meet: Deny (show upgrade prompt)
```

**Note**: Owner check happens in component BEFORE permission function, so owners never hit the `allow_*` check.

---

## Summary Table

| Role | Settings Access | Members Access | Tool Access | Plan Restrictions |
|------|----------------|----------------|-------------|-------------------|
| **Owner** | ✅ Full edit | ✅ Full control | ✅ Always (bypasses `allow_*` settings) | ❌ None |
| **Manager** | 👁️ Read-only | ✅ View/manage | ⚠️ Requires `allow_*: true` (bypasses plan) | ❌ None |
| **Editor** | 👁️ Read-only | ❌ No access | ⚠️ Requires `allow_*: true` (bypasses plan) | ❌ None |
| **Member** | 👁️ Read-only | ❌ No access | ⚠️ Requires `allow_*: true` + plan requirement | ✅ Yes |

---

## Key Takeaways

1. **Owner always wins**: Owners can use all tools regardless of `allow_*` settings
2. **Managers/Editors bypass plans**: Role-based access ignores plan requirements but still needs `allow_*: true`
3. **Settings affect everyone except owner**: `allow_pins: false` blocks managers, editors, and members (but not owner)
4. **Plan requirements**: Only apply to regular members (owners/managers/editors bypass)
5. **Visual feedback**: 
   - Disabled tools show reduced opacity (`opacity-40`)
   - Blue dot badge indicates feature enabled but plan insufficient
   - Active tools show solid icon with white background
