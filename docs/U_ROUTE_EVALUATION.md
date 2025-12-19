# `/u` Route Evaluation: Owner-Only Management View

## Proposed Approach

**Route:** `/profile/[username]/u`
- Protected route (owner-only access)
- Redirects from `/profile/[username]` when viewing own profile
- Shows "visitor view" (not visually set up for owner)
- Purpose: Let owners see exactly what visitors see

## Current State

**Public Profile:** `/profile/[username]`
- Shows public pins
- Shows profile info
- Anyone can view
- Owners see additional controls (create pin, edit, etc.)

**Owner View Mode:**
- Current: Toggle between "owner" and "visitor" view modes
- Uses `useProfileOwnership` hook with `viewMode` state
- Client-side toggle, no route change

## Proposed `/u` Route Benefits

### ✅ Advantages

1. **Shareable URL**: Owners can share `/profile/[username]/u` to show visitor view
2. **Bookmarkable**: Can bookmark the "visitor view" state
3. **Clear Separation**: Route-based separation of concerns
4. **SEO Friendly**: Different URL = different content (if needed)
5. **Analytics**: Can track owner vs visitor views separately
6. **No State Management**: No client-side toggle state needed

### ⚠️ Considerations

1. **Route Protection**: Need middleware/auth check
2. **Redirect Logic**: When to redirect vs when to show toggle?
3. **URL Structure**: `/profile/[username]/u` vs `/u/[username]`?
4. **Backward Compatibility**: Existing bookmarks/links
5. **Visual Design**: "Not visually set up for owner" - what does this mean?

## Implementation Options

### Option 1: Separate Route with Redirect (Recommended)

**Structure:**
```
/profile/[username]          → Public view (anyone)
/profile/[username]/u        → Owner-only visitor view
```

**Behavior:**
- If owner visits `/profile/[username]` → Show owner view (with toggle)
- If owner visits `/profile/[username]/u` → Show visitor view (no owner controls)
- If non-owner visits `/profile/[username]/u` → Redirect to `/profile/[username]` or 404

**Implementation:**
```typescript
// src/app/profile/[slug]/u/page.tsx
export default async function ProfileVisitorViewPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerClientWithAuth();
  
  // Get account
  const { data: account } = await supabase
    .from('accounts')
    .select('id, user_id, ...')
    .eq('username', slug)
    .single();
  
  // Check ownership
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user && account?.user_id === user.id;
  
  if (!isOwner) {
    redirect(`/profile/${slug}`); // Redirect non-owners
  }
  
  // Force visitor view mode
  return (
    <ProfileMapClient 
      account={account}
      pins={pins}
      isOwnProfile={true}
      forceVisitorView={true} // New prop
    />
  );
}
```

**Pros:**
- Clear separation
- Shareable URLs
- No client-side state needed

**Cons:**
- Duplicate route logic
- Need to maintain two pages

---

### Option 2: Query Parameter Approach

**Structure:**
```
/profile/[username]           → Owner view (if owner)
/profile/[username]?view=visitor → Visitor view (if owner)
```

**Behavior:**
- Same route, different query param
- Server checks ownership
- Client reads query param

**Implementation:**
```typescript
// In ProfileMapClient
const searchParams = useSearchParams();
const viewMode = searchParams.get('view') === 'visitor' ? 'visitor' : 'owner';

// If owner and view=visitor, force visitor mode
```

**Pros:**
- Single route
- Simple implementation
- Shareable URLs

**Cons:**
- Less clear separation
- Query params can be manipulated

---

### Option 3: Subdomain or Path Prefix

**Structure:**
```
/profile/[username]     → Public view
/u/[username]          → Owner-only visitor view
```

**Behavior:**
- Completely separate routes
- `/u` prefix indicates "user view"

**Pros:**
- Very clear separation
- Short URLs
- Easy to remember

**Cons:**
- Different path structure
- Need to update all profile links

---

## Recommendation: Option 1 (Separate Route)

### Why?

1. **Clear Intent**: `/u` suffix clearly indicates "user view"
2. **Protection**: Easy to add middleware/auth checks
3. **Flexibility**: Can add more owner-only routes later (`/u/settings`, `/u/analytics`)
4. **SEO**: Different URLs for different content
5. **Analytics**: Track owner vs visitor views separately

### Implementation Plan

1. **Create `/profile/[slug]/u/page.tsx`**
   - Server component
   - Check ownership
   - Redirect non-owners
   - Pass `forceVisitorView={true}` to client

2. **Update ProfileMapClient**
   - Add `forceVisitorView?: boolean` prop
   - If true, always use visitor view (ignore toggle)
   - Hide owner controls when forced

3. **Add Redirect Logic (Optional)**
   - In `/profile/[slug]/page.tsx`
   - If owner, show link/button to `/u` route
   - Or auto-redirect (if desired)

4. **Update Navigation**
   - Add "View as Visitor" link in owner toolbar
   - Links to `/profile/[username]/u`

### Code Structure

```
src/app/profile/[slug]/
  ├── page.tsx              # Public/owner view
  ├── u/
  │   └── page.tsx          # Owner-only visitor view
  └── not-found.tsx
```

### Security Considerations

1. **Server-Side Check**: Always verify ownership on server
2. **Middleware**: Add route protection in middleware
3. **RLS**: Ensure database RLS still applies
4. **Client-Side**: Hide owner controls, but don't rely on it for security

### Visual Design

**"Not visually set up for owner" means:**
- No "Create Pin" button
- No edit controls
- No view mode toggle
- No debug info
- Clean, minimal visitor experience
- Same as what a visitor would see

---

## Alternative: Keep Current Toggle, Add `/u` Route

**Hybrid Approach:**
- Keep current toggle for quick switching
- Add `/u` route for shareable/bookmarkable visitor view
- Both serve different purposes:
  - Toggle: Quick switching while editing
  - `/u` route: Share with others, bookmark, permanent link

**Best of Both Worlds:**
- Toggle for convenience
- Route for permanence

---

## Decision Matrix

| Feature | Current Toggle | `/u` Route | Hybrid |
|---------|---------------|------------|--------|
| Quick Switching | ✅ | ❌ | ✅ |
| Shareable URL | ❌ | ✅ | ✅ |
| Bookmarkable | ❌ | ✅ | ✅ |
| Route Protection | N/A | ✅ | ✅ |
| Code Complexity | Low | Medium | Medium |
| User Experience | Good | Better | Best |

## Final Recommendation

**Implement Hybrid Approach:**
1. Keep current toggle for quick switching
2. Add `/u` route for shareable visitor view
3. Add "View as Visitor" link in owner toolbar → `/profile/[username]/u`
4. Auto-redirect owners from `/profile/[username]` to `/profile/[username]/u` (optional, via query param or button)

This gives owners:
- Quick toggle for editing
- Shareable link for showing visitor view
- Bookmarkable state
- Clear separation of concerns

