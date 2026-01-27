# Map Page Sidebar & Icon Audit

## Current State vs. Recommended State

### User States
1. **Not Authenticated** (no auth)
2. **Authenticated, Not Member** (auth, no member)
3. **Member** (editor/manager role)
4. **Owner**

---

## Current Implementation

### Header Icons/Buttons (MapPageHeaderButtons)

| Icon | Condition | Current Logic |
|------|-----------|---------------|
| **Filter** | Always | `showFilter={false}` (hidden) |
| **Settings** | Owner only | `showSettings={isOwner}` |
| **Join** | Auth + Not Member | `showJoin={!isMember && !isOwner && currentAccountId !== null}` |
| **Members** | Owner/Manager | `showMembers={showMembers}` (from useMapMembership) |
| **Posts** | Always | `showPosts={true}` |

### Sidebar Configs (sidebarConfigs)

| Sidebar | Condition | Current Logic |
|---------|-----------|---------------|
| **Filter** | Always | Always added |
| **Settings** | Member OR Owner OR Auth | `if (isMember || isOwner || currentAccountId)` |
| **Members** | Owner/Manager | `if (showMembers)` |
| **Join** | Auth + Not Member + Not Owner | `if (!isMember && !isOwner && currentAccountId)` |
| **Posts** | Always | Always added |

---

## Issues Identified

### Issue 1: Settings Sidebar Logic Inconsistent
**Problem:** Settings sidebar shows for `isMember || isOwner || currentAccountId`, but Settings button only shows for `isOwner`.

**Current:**
- Settings button: Only for owners
- Settings sidebar: For members, owners, OR any authenticated user

**Impact:** Authenticated non-members can open settings sidebar via other means, but can't via button.

### Issue 2: Filter Button Hidden
**Problem:** Filter button is always hidden (`showFilter={false}`), but Filter sidebar always exists.

**Current:**
- Filter button: Always hidden
- Filter sidebar: Always available

**Impact:** Users can't easily access filter functionality.

### Issue 3: Members Button Logic
**Problem:** `showMembers` comes from `useMapMembership` hook - need to verify it's correct.

**Current:** `showMembers` from hook (likely `isOwner || isManager`)

### Issue 4: Settings Visible to Non-Members
**Problem:** Settings sidebar shows for any authenticated user, even if not a member.

**Current:** `if (isMember || isOwner || currentAccountId)`

**Should be:** Only members/owners should see settings (read-only for members, editable for owners).

---

## Recommended State

### Header Icons/Buttons

| Icon | Not Auth | Auth, Not Member | Member | Owner |
|------|----------|------------------|--------|-------|
| **Filter** | ❌ Hidden | ✅ Show | ✅ Show | ✅ Show |
| **Settings** | ❌ Hidden | ❌ Hidden | ✅ Show (read-only) | ✅ Show (editable) |
| **Join** | ❌ Hidden | ✅ Show (red dot) | ❌ Hidden | ❌ Hidden |
| **Members** | ❌ Hidden | ❌ Hidden | ❌ Hidden (unless manager) | ✅ Show |
| **Posts** | ✅ Show | ✅ Show | ✅ Show | ✅ Show |

### Sidebar Configs

| Sidebar | Not Auth | Auth, Not Member | Member | Owner |
|---------|----------|------------------|--------|-------|
| **Filter** | ✅ Available | ✅ Available | ✅ Available | ✅ Available |
| **Settings** | ❌ Not available | ❌ Not available | ✅ Read-only | ✅ Editable |
| **Members** | ❌ Not available | ❌ Not available | ❌ Not available (unless manager) | ✅ Available |
| **Join** | ❌ Not available | ✅ Available | ❌ Not available | ❌ Not available |
| **Posts** | ✅ Available | ✅ Available | ✅ Available | ✅ Available |

---

## Detailed Recommendations

### 1. Filter Button
**Current:** Always hidden
**Should:** Always visible (for all authenticated users)

```typescript
// In MapPageHeaderButtons
showFilter={true}  // Change from false to true
```

### 2. Settings Button & Sidebar
**Current:** 
- Button: Owner only
- Sidebar: Member OR Owner OR Auth

**Should:**
- Button: Member OR Owner
- Sidebar: Member OR Owner (read-only for members, editable for owners)

```typescript
// In page.tsx
showSettings={isMember || isOwner}  // Change from isOwner only

// In sidebarConfigs
if (isMember || isOwner) {  // Remove currentAccountId check
  configs.push({
    type: 'settings',
    // ...
  });
}
```

### 3. Join Button & Sidebar
**Current:** ✅ Correct
- Button: `!isMember && !isOwner && currentAccountId !== null`
- Sidebar: `!isMember && !isOwner && currentAccountId`

**Should:** Keep as-is (only for authenticated non-members)

### 4. Members Button & Sidebar
**Current:** Uses `showMembers` from hook - **BUG FOUND**: Line 79 shows `showMembers: isOwner || isMember` (should be `isOwner || isManager`)

**Should:** 
- Button: Owner OR Manager
- Sidebar: Owner OR Manager

```typescript
// In useMapMembership.ts line 79 - FIX NEEDED:
showMembers: isOwner || isManager,  // Change from: isOwner || isMember
```

### 5. Posts Button & Sidebar
**Current:** ✅ Correct (always available)

**Should:** Keep as-is

---

## Implementation Changes

### Change 1: Show Filter Button
```typescript
// In MapPageHeaderButtons component call
<SidebarHeaderButtons
  onFilterClick={onFilterClick}
  onSettingsClick={onSettingsClick}
  showFilter={true}  // Change from false
  showSettings={isMember || isOwner}  // Change from isOwner only
  filterLabel="Filter map"
  settingsLabel="Map settings"
/>
```

### Change 2: Fix Settings Sidebar Condition
```typescript
// In sidebarConfigs
// Settings visible to members and owners only (read-only for members, editable for owners)
if (isMember || isOwner) {  // Remove: || currentAccountId
  configs.push({
    type: 'settings' as const,
    title: 'Map Settings',
    content: (
      <MapSettingsSidebar
        // ... props
        isOwner={isOwner}
        userRole={isOwner ? 'owner' : (isManager ? 'manager' : (isMember ? 'editor' : null))}
      />
    ),
    popupType: 'settings',
  });
}
```

### Change 3: Verify Members Logic
```typescript
// In useMapMembership hook, ensure:
const showMembers = isOwner || isManager;

// This should already be correct, but verify
```

---

## Summary Table

### What We Currently Show

| User State | Filter | Settings | Join | Members | Posts |
|------------|--------|----------|------|---------|-------|
| **Not Auth** | ❌ Hidden | ❌ Hidden | ❌ Hidden | ❌ Hidden | ✅ Show |
| **Auth, Not Member** | ❌ Hidden | ❌ Hidden | ✅ Show | ❌ Hidden | ✅ Show |
| **Member** | ❌ Hidden | ✅ Show (button hidden) | ❌ Hidden | ❌ Hidden | ✅ Show |
| **Owner** | ❌ Hidden | ✅ Show | ❌ Hidden | ✅ Show | ✅ Show |

### What We Should Show

| User State | Filter | Settings | Join | Members | Posts |
|------------|--------|----------|------|---------|-------|
| **Not Auth** | ❌ Hidden | ❌ Hidden | ❌ Hidden | ❌ Hidden | ✅ Show |
| **Auth, Not Member** | ✅ Show | ❌ Hidden | ✅ Show | ❌ Hidden | ✅ Show |
| **Member** | ✅ Show | ✅ Show (read-only) | ❌ Hidden | ❌ Hidden (unless manager) | ✅ Show |
| **Owner** | ✅ Show | ✅ Show (editable) | ❌ Hidden | ✅ Show | ✅ Show |

---

## Action Items

1. ✅ **Show Filter Button** - Change `showFilter={false}` to `showFilter={true}`
2. ✅ **Fix Settings Button** - Change `showSettings={isOwner}` to `showSettings={isMember || isOwner}`
3. ✅ **Fix Settings Sidebar** - Remove `|| currentAccountId` condition
4. ✅ **Verify Members Logic** - Ensure `showMembers = isOwner || isManager`
5. ✅ **Test All States** - Verify icons/sidebars show correctly for each user state
