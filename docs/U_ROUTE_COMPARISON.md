# `/u` Route Implementation Comparison

## Current Implementation (Complex)

### Structure
```
/profile/[slug]          → Owner view with toggle
/profile/[slug]/u        → Owner-only visitor view (separate route)
```

### Features
- Separate route file (`/u/page.tsx`)
- Server-side ownership check with redirect
- `forceVisitorView` prop passed through components
- Multiple effective variables (`effectiveCanEdit`, `effectiveCanCreatePin`, etc.)
- Banner showing "Visitor View" on `/u` route
- Link in toolbar to `/u` route

### Code Complexity
- **New Files**: 1 (`/u/page.tsx` - ~120 lines)
- **Modified Components**: 2 (`ProfileMapClient`, `ProfileMapToolbar`)
- **New Props**: `forceVisitorView` prop threading
- **Logic Overhead**: Effective variables, conditional rendering based on route

### Issues
1. **Prop Threading**: `forceVisitorView` passed through multiple components
2. **Duplicate Logic**: Server filters pins, then client filters again
3. **Route Duplication**: Two routes doing similar things
4. **State Management**: Effective variables add complexity
5. **Navigation**: Need to maintain links between routes

---

## Elite Alternative: Query Parameter Approach (Simpler)

### Structure
```
/profile/[slug]              → Owner view (default)
/profile/[slug]?view=visitor → Visitor view (query param)
```

### Implementation

**Single Route File** (`/profile/[slug]/page.tsx`):
```typescript
export default async function ProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const view = searchParams.view === 'visitor' ? 'visitor' : 'owner';
  
  // Check ownership
  const isOwnProfile = user && account.user_id === user.id;
  
  // If non-owner tries visitor view, redirect
  if (view === 'visitor' && !isOwnProfile) {
    redirect(`/profile/${slug}`);
  }
  
  // Filter pins based on view
  const pinsQuery = supabase.from('pins')...;
  if (view === 'visitor' || !isOwnProfile) {
    pinsQuery.eq('visibility', 'public');
  }
  
  return (
    <ProfileMapClient 
      account={account}
      pins={pins}
      isOwnProfile={isOwnProfile}
      initialViewMode={view} // Pass view mode
    />
  );
}
```

**Simplified Client Component**:
```typescript
export default function ProfileMapClient({ 
  account, 
  pins: initialPins, 
  isOwnProfile,
  initialViewMode = 'owner', // Simple prop
}: ProfileMapClientProps) {
  const ownership = useProfileOwnership({ account, serverIsOwnProfile: isOwnProfile });
  
  // Use initialViewMode to set initial state
  const [viewMode, setViewMode] = useState<'owner' | 'visitor'>(initialViewMode);
  
  // Simple: if viewMode is visitor, hide owner controls
  const showOwnerControls = isOwnProfile && viewMode === 'owner';
  
  // Filter pins
  const displayPins = showOwnerControls ? localPins : filterPinsForVisitor(localPins);
  
  // ... rest of component
}
```

**Toolbar Link**:
```typescript
// Simple link to same route with query param
<a href={`/profile/${username}?view=visitor`}>
  View as Visitor
</a>
```

### Code Complexity
- **New Files**: 0 (uses existing route)
- **Modified Components**: 1 (`ProfileMapClient` - minimal changes)
- **New Props**: 1 (`initialViewMode` - simple string)
- **Logic Overhead**: Minimal - just check query param and set initial state

### Benefits
1. **Single Route**: No route duplication
2. **No Prop Threading**: Query param handled at route level
3. **Simpler State**: No effective variables needed
4. **Shareable**: URL with `?view=visitor` is shareable
5. **Bookmarkable**: Query param persists in URL
6. **Less Code**: ~100 lines less code
7. **Easier Navigation**: Just change query param, same route

### Trade-offs
1. **URL Aesthetics**: `/profile/username?view=visitor` vs `/profile/username/u`
2. **Route Protection**: Need to check query param server-side (but same security)
3. **SEO**: Query params might be treated differently (but both are client-side anyway)

---

## Even Simpler: Client-Side Only

### Structure
```
/profile/[slug] → Always same route, toggle controls visibility
```

### Implementation
- No server-side changes needed
- Use existing `useProfileOwnership` hook with view mode toggle
- Add "View as Visitor" button that sets `viewMode = 'visitor'`
- Shareable via URL hash: `/profile/username#visitor` (or query param)

### Benefits
- **Zero Route Changes**: Use existing route
- **Simplest**: Just UI toggle, no routing logic
- **Fast**: No server round-trip

### Trade-offs
- **Less Permanent**: View mode not in URL by default (but can add query param)
- **No Server Protection**: But client-side is fine for UI-only feature

---

## Recommendation: Query Parameter Approach

### Why It's Better

1. **Simpler Architecture**
   - Single route file
   - No route duplication
   - Less code to maintain

2. **Better UX**
   - Shareable URLs (`?view=visitor`)
   - Bookmarkable state
   - Browser back/forward works naturally

3. **Easier Implementation**
   - No prop threading
   - No effective variables
   - Server handles filtering once

4. **More Flexible**
   - Can add more view modes later (`?view=analytics`, etc.)
   - Query params are standard web pattern
   - Works with existing routing

### Implementation Steps

1. **Update Route** (`/profile/[slug]/page.tsx`):
   - Read `searchParams.view`
   - Filter pins based on view
   - Pass `initialViewMode` to client

2. **Update Client** (`ProfileMapClient.tsx`):
   - Accept `initialViewMode` prop
   - Use it to set initial `viewMode` state
   - Remove `forceVisitorView` prop and effective variables

3. **Update Toolbar**:
   - Change link to `?view=visitor` instead of `/u` route

4. **Remove**:
   - `/u/page.tsx` file
   - All `forceVisitorView` logic
   - Effective variables

### Code Reduction
- **Remove**: ~120 lines (`/u/page.tsx`)
- **Simplify**: ~50 lines (remove effective variables, prop threading)
- **Net Reduction**: ~170 lines of code

---

## Final Verdict

**Query Parameter Approach Wins** because:
- ✅ Simpler (single route, no duplication)
- ✅ Less code (~170 lines reduction)
- ✅ Better UX (shareable, bookmarkable)
- ✅ Standard web pattern
- ✅ Easier to maintain
- ✅ More flexible for future features

**Current `/u` Route Approach** is over-engineered for this use case.

