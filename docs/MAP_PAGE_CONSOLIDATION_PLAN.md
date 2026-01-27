# Map Page Consolidation & Effectiveness Improvements

## Current Issues

### 1. **Repeated Membership/Auth Checks**
- `isMember || isOwner` appears 8+ times
- `currentAccountId` computed inline in multiple places
- `isOwner ? 'owner' : (isManager ? 'manager' : (isMember ? userRole : null))` repeated

### 2. **Unused/Redundant State**
- `timeFilter` - set but never used
- `checkingMembership` - set but never read
- `hasPendingRequest` - checked but not used in UI

### 3. **Duplicate Logic**
- Account ID computation: `activeAccountId || account?.id || null` (2x)
- Permission handlers: 3 identical callbacks
- Sidebar handlers: 5 identical callbacks
- User role computation: repeated pattern

### 4. **Scattered Concerns**
- Membership status check separate from membership hook
- Toast logic mixed with component logic
- Hash/URL management inline
- Header button visibility logic scattered

## Consolidation Strategy

### Phase 1: Create Unified Access Hook
**File**: `src/app/map/[id]/hooks/useMapAccess.ts`
- Consolidate: `isOwner`, `isMember`, `isManager`, `currentAccountId`, `userRole`
- Compute: `canViewSettings`, `canViewPosts`, `canViewMembers`, `showJoinButton`
- Include: pending request check

### Phase 2: Extract Toast Logic
**File**: `src/app/map/[id]/hooks/useMapMembershipToast.ts`
- Move toast logic out of main component
- Handle all membership status notifications

### Phase 3: Extract URL/Hash Management
**File**: `src/app/map/[id]/hooks/useContributeOverlay.ts`
- Handle hash detection
- Handle URL params
- Handle overlay state

### Phase 4: Consolidate Handlers
- Create `useMapSidebarHandlers` hook
- Create `useMapPermissionHandlers` hook (or merge into permissions hook)

### Phase 5: Remove Unused State
- Remove `timeFilter` if truly unused
- Remove `checkingMembership` if not displayed
- Use `hasPendingRequest` or remove it

## Expected Benefits

1. **Reduced Complexity**: Main component goes from 500 lines to ~300 lines
2. **Better Performance**: Fewer re-renders from consolidated hooks
3. **Easier Maintenance**: Single source of truth for access checks
4. **Better Testability**: Isolated hooks easier to test
5. **Type Safety**: Centralized types for access patterns
