# Collaboration Tools Non-Member Experience Analysis

## Current State

### What We Have

1. **CollaborationToolsNav Component**
   - Currently shown only when: `mapLoaded && current_account_id && (isMember || isOwner)`
   - Located in `MapIDBox.tsx` line 1497
   - Supports `viewAsRole` prop for owner preview mode
   - Shows tools with permission-based disabled states

2. **Non-Member Join Experience**
   - **Desktop**: Map overlay card (MapIDBox.tsx lines 1361-1567) showing:
     - Map title, description, visibility badge
     - Collaboration tools icons (if enabled)
     - Join button that opens JoinMapSidebar
   - **Mobile**: JoinMapSidebar can be opened via floating button or menu
   - JoinMapSidebar component exists and handles membership requests

3. **View As Role System**
   - Owners can view map as: Owner, Manager, Editor, Non-Member
   - `useViewAsRole` hook manages state
   - `useMapAccess` hook computes effective access based on viewAsRole
   - `effectiveIsMember` becomes false when viewing as non-member

4. **Device Detection**
   - `deviceDetection.ts` for server-side
   - `deviceDetectionClient.ts` for client-side
   - Breakpoint: `isSmallScreen = viewportWidth < 768`

### What's Missing

1. **Non-Member View of Collaboration Tools**
   - Tools are completely hidden for non-members
   - No preview of what tools would be available
   - Owners viewing as non-member don't see tools at all

2. **Mandatory Join Prompt**
   - Mobile: No mandatory popup - user can dismiss overlay
   - Desktop: Overlay can be dismissed by opening sidebar
   - No forced interaction to join

3. **Owner Preview Accuracy**
   - When owner views as non-member, they don't see the collaboration tools at all
   - Should show disabled tools with join prompt to match actual non-member experience

## Required Changes

### 1. Non-Member Collaboration Tools View

**Location**: `CollaborationToolsNav.tsx`

**Behavior**:
- Show tools in disabled state (opacity-40, cursor-not-allowed)
- All tools show "Join to use" tooltip
- Clicking any tool triggers join flow (opens JoinMapSidebar)
- Visual: Same black background, no gradient (non-member styling)

**Conditions**:
- Show when: `!effectiveIsMember && !effectiveIsOwner && currentAccountId !== null`
- Also show when: `isOwner && viewAsRole === 'non-member'` (for owner preview)

### 2. Mandatory Join Popup (Mobile)

**Location**: `MapIDBox.tsx` or new component

**Behavior**:
- Full-screen modal overlay on mobile
- Cannot be dismissed without joining or signing in
- Shows map info + collaboration tools preview
- "Join Map" button opens JoinMapSidebar
- "Sign In" button if not authenticated

**Conditions**:
- Show when: `!isMember && !isOwner && isMobile && mapLoaded`
- Hide when: User joins or sidebar is open

### 3. Desktop Map Overlay Enhancement

**Location**: `MapIDBox.tsx` (existing overlay)

**Behavior**:
- Keep existing overlay but make it more prominent
- Ensure it shows collaboration tools preview
- Clicking tools in overlay triggers join flow
- Overlay should not be easily dismissible (no close button)

**Conditions**:
- Show when: `!isMember && !isOwner && !isMobile && mapLoaded && activeSidebar === null`

### 4. Owner View As Non-Member

**Location**: Multiple components

**Behavior**:
- When `viewAsRole === 'non-member'`:
  - Show non-member collaboration tools view
  - Show map overlay (if not mobile)
  - Show mandatory popup (if mobile)
  - Hide all member-only features

**Implementation**:
- Use `effectiveIsMember` from `useMapAccess` hook
- Pass `viewAsRole` to all relevant components

## Implementation Plan

1. ✅ Update `CollaborationToolsNav` to support non-member view
2. ✅ Update `MapIDBox` to show collaboration tools for non-members
3. ✅ Create mandatory join popup component for mobile
4. ✅ Update desktop overlay to be non-dismissible
5. ✅ Ensure owner preview mode works correctly

## Superior Approach

**Current**: Tools hidden, optional join prompt
**Superior**: 
- Show disabled tools with join prompt (teaser/preview)
- Mandatory interaction on mobile (better conversion)
- Desktop overlay with tool preview (better UX)
- Owner can preview exact non-member experience
