# Collaboration Tools Non-Member Implementation

## Summary

Implemented non-member view of collaboration tools with mandatory join prompts on mobile and desktop overlay. Owners can now preview exactly what non-members see.

## Changes Made

### 1. CollaborationToolsNav Component (`src/app/map/[id]/components/CollaborationToolsNav.tsx`)

**Added:**
- `isMember` prop to determine membership status
- `onJoinClick` prop to trigger join flow
- Non-member view detection: `isNonMemberView` computed from `isOwner && viewAsRole === 'non-member'` or `!isOwner && !isMember`
- Non-member tool behavior:
  - All tools shown in disabled state (opacity-60, clickable)
  - Tooltip shows "Join to use [tool name]"
  - Clicking any tool triggers `onJoinClick()` to open join sidebar
  - Visual: Black background (no gradient), disabled styling

**Behavior:**
- **Members/Owners**: Normal tool functionality
- **Non-Members**: Disabled tools with join prompt on click
- **Owner View As Non-Member**: Shows non-member view for preview

### 2. MapIDBox Component (`src/app/map/[id]/components/MapIDBox.tsx`)

**Added:**
- Mobile detection: `isMobile` state (viewport < 768px)
- CollaborationToolsNav now shows for all authenticated users (members, owners, and non-members)
- Passes `isMember` and `onJoinClick` props to CollaborationToolsNav

**Desktop Overlay:**
- Updated condition: `!isMember && !isOwner && mapLoaded && activeSidebar === null && !isMobile`
- Shows centered overlay card with map info, collaboration tools preview, and join button
- Only visible on desktop (mobile uses mandatory popup)

**Mobile Mandatory Popup:**
- Full-screen modal overlay (`z-50`)
- Cannot be dismissed without joining
- Shows: Map title, description, visibility badge, collaboration tools preview, join message
- Fixed bottom action bar with join/sign-in button
- Condition: `!isMember && !isOwner && mapLoaded && isMobile && activeSidebar !== 'join'`
- Automatically hides when join sidebar opens

### 3. Map Page (`src/app/map/[id]/page.tsx`)

**Updated:**
- Passes `effectiveIsMember` instead of `isMember` to MapIDBox
- Ensures owner preview mode works correctly (when viewing as non-member, `effectiveIsMember` is false)

## User Experience

### Non-Member Experience

**Desktop:**
1. Map overlay card appears centered on map
2. Collaboration tools shown at top (disabled state, black background)
3. Clicking any tool opens join sidebar
4. Overlay shows map info and available tools preview
5. "Join Map" button opens join sidebar

**Mobile:**
1. Full-screen mandatory popup appears
2. Cannot dismiss without joining
3. Shows map info and collaboration tools preview
4. "Join Map" or "Sign In to Join" button at bottom
5. Popup closes when join sidebar opens

### Owner Preview Mode

**When owner selects "View As: Non-Member":**
1. Collaboration tools show in non-member view (disabled, black background)
2. Desktop overlay appears (if not mobile)
3. Mobile popup appears (if mobile)
4. All member-only features hidden
5. Exact non-member experience previewed

## Technical Details

### Non-Member Detection Logic

```typescript
const isNonMemberView = useMemo(() => {
  // If owner is viewing as non-member, show non-member view
  if (isOwner && viewAsRole === 'non-member') return true;
  // If not owner and not member, show non-member view
  if (!isOwner && !isMember) return true;
  return false;
}, [isOwner, isMember, viewAsRole]);
```

### Tool Permission for Non-Members

```typescript
if (isNonMemberView) {
  const ownerEnabled = isFeatureEnabled(tool);
  return { 
    allowed: false, 
    reason: 'non_member' as const,
    isOwnerOverride: ownerEnabled,
  };
}
```

### Mobile Detection

```typescript
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  if (typeof window === 'undefined') return;
  
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };
  
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);
```

## What's Superior

### Previous Approach
- ❌ Collaboration tools completely hidden for non-members
- ❌ No preview of available tools
- ❌ Optional join prompt (could be dismissed)
- ❌ Owner couldn't preview non-member experience

### Current Approach
- ✅ Collaboration tools visible but disabled (teaser/preview)
- ✅ Clear indication of what tools are available
- ✅ Mandatory interaction on mobile (better conversion)
- ✅ Desktop overlay with tool preview (better UX)
- ✅ Owner can preview exact non-member experience
- ✅ Clicking tools triggers join flow (intuitive)

## Testing Checklist

- [ ] Non-member sees disabled collaboration tools on desktop
- [ ] Non-member sees disabled collaboration tools on mobile
- [ ] Clicking tools opens join sidebar
- [ ] Desktop overlay appears for non-members
- [ ] Mobile popup appears for non-members (mandatory)
- [ ] Owner viewing as non-member sees non-member experience
- [ ] Mobile popup closes when join sidebar opens
- [ ] Desktop overlay shows collaboration tools preview
- [ ] Mobile popup shows collaboration tools preview
- [ ] Join flow works from both overlay and tools
