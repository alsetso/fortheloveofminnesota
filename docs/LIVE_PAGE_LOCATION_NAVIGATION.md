# Live Page Location Navigation & Mention Sheet

## Overview

When users click on mentions in feed posts, they navigate to `/live` with coordinates. The page automatically zooms to that location and opens a sheet displaying all mentions at that location.

## Implementation

### 1. MentionCard Navigation

**File:** `src/components/feed/MentionCard.tsx`

**Changes:**
- Changed from `<Link>` to `<button>` with `onClick` handler
- Navigates to `/live?lat={lat}&lng={lng}` instead of `/map?lat=...&lng=...`
- Uses `router.push()` for programmatic navigation

**Behavior:**
- Clicking a mention card navigates to `/live` page
- URL includes `lat` and `lng` parameters
- Optional `zoom` parameter (defaults to 15)

### 2. URL State Hook

**File:** `src/features/homepage/hooks/useLiveUrlState.ts`

**Features:**
- Parses `lat`, `lng`, and `zoom` from URL parameters
- Provides `updateUrl()` and `clearUrlParams()` methods
- Tracks `hasProcessedUrl` to prevent duplicate processing
- Resets when navigating away from `/live` page

**Usage:**
```tsx
const { urlState, hasProcessedUrl, setHasProcessedUrl, clearUrlParams } = useLiveUrlState();
// urlState: { lat: number | null, lng: number | null, zoom: number | null }
```

### 3. Location Mentions Sheet

**File:** `src/components/live/LocationMentionsSheet.tsx`

**Features:**
- Slide-up sheet component (similar to `MapEntitySlideUp`)
- Fetches mentions within radius of coordinates (default: 500m)
- Displays mentions sorted by distance (closest first)
- Shows mention type, description, account info, and thumbnails
- Links to individual mention detail pages

**Props:**
- `isOpen`: Controls sheet visibility
- `onClose`: Callback when sheet closes
- `lat`: Latitude of location
- `lng`: Longitude of location
- `radius`: Search radius in kilometers (default: 0.5)

**UI:**
- Drag handle at top
- Header with mention count
- Scrollable list of mentions
- Loading and error states
- Empty state when no mentions found

### 4. Live Page Integration

**File:** `src/app/live/page.tsx`

**Changes:**
- Added `useLiveUrlState` hook
- Added `LocationMentionsSheet` component
- Added `useEffect` to watch URL parameters
- Handles map zooming and sheet opening

**Flow:**
1. User clicks mention in feed → navigates to `/live?lat=...&lng=...`
2. `useLiveUrlState` detects URL parameters
3. `useEffect` triggers when `lat`/`lng` present and not yet processed
4. Map flies to location (waits for map load if needed)
5. Mentions sheet opens automatically
6. Sheet fetches mentions within 500m radius
7. When sheet closes, URL parameters are cleared

## User Experience

### From Feed Post

1. **User sees mention in post:**
   - Mention card shows type emoji, description, thumbnail
   - Card is clickable (hover effect)

2. **User clicks mention:**
   - Navigates to `/live?lat=44.9778&lng=-93.2650`
   - Page loads with map

3. **Map behavior:**
   - Map flies to location (1.5s animation)
   - Zooms to level 15 (or custom zoom from URL)
   - Mentions sheet slides up from bottom

4. **Mentions sheet:**
   - Shows all mentions within 500m
   - Sorted by distance (closest first)
   - Each mention is clickable → goes to `/mention/[id]`
   - Can close sheet → clears URL parameters

### URL Parameters

**Format:** `/live?lat={latitude}&lng={longitude}&zoom={zoom}`

**Examples:**
- `/live?lat=44.9778&lng=-93.2650` - Navigate to Minneapolis
- `/live?lat=44.9778&lng=-93.2650&zoom=18` - Navigate with custom zoom

**Parameters:**
- `lat` (required): Latitude coordinate
- `lng` (required): Longitude coordinate
- `zoom` (optional): Map zoom level (default: 15)

## Technical Details

### Mention Fetching

**Method:** `MentionService.getMentions({ bbox })`

**Bounding Box Calculation:**
- Uses radius (default: 0.5 km) to calculate bounding box
- Approximates: 1° latitude ≈ 111 km
- For Minnesota (~45°N): 1° longitude ≈ 78 km
- Creates bounding box: `{ minLat, maxLat, minLng, maxLng }`

**Sorting:**
- Mentions sorted by Euclidean distance from center
- Closest mentions appear first

### Map Zooming

**Method:** `map.flyTo({ center, zoom, duration })`

**Behavior:**
- Waits for map to load before zooming
- Uses 1.5s animation duration
- Default zoom: 15 (street level)
- Custom zoom from URL parameter if provided

### Sheet State Management

**State:**
- `isMentionsSheetOpen`: Controls sheet visibility
- `hasProcessedUrl`: Prevents duplicate processing
- Resets when navigating away from `/live`

**Lifecycle:**
1. URL parameters detected
2. `hasProcessedUrl` checked (prevents re-processing)
3. Map zooms to location
4. Sheet opens
5. Mentions fetched and displayed
6. On close: URL parameters cleared, sheet closes

## Edge Cases

### Map Not Loaded
- Waits for `map.loaded` event
- Registers listener if map not ready
- Processes navigation once map is ready

### Invalid Coordinates
- URL parameters validated (must be valid numbers)
- Invalid coordinates ignored
- No error shown (graceful degradation)

### No Mentions Found
- Shows "No mentions found at this location" message
- Sheet still opens (for consistency)
- User can close sheet to clear URL

### Multiple Clicks
- `hasProcessedUrl` flag prevents duplicate processing
- Only processes URL once per page load
- Resets when navigating away and back

## Future Enhancements

1. **Radius Control:**
   - Allow users to adjust search radius
   - Add slider or input in sheet header

2. **Time Filter:**
   - Filter mentions by time (24h, 7d, all)
   - Integrate with existing time filter

3. **Mention Type Filter:**
   - Filter by mention type in sheet
   - Show only specific types

4. **Map Marker:**
   - Add temporary marker at location
   - Highlight center point

5. **Share URL:**
   - Add share button to copy URL
   - Include mention count in URL

6. **Pagination:**
   - If many mentions, add pagination
   - Load more on scroll

## Testing

### Manual Testing

1. **From Feed:**
   - [ ] Click mention in feed post
   - [ ] Verify navigation to `/live?lat=...&lng=...`
   - [ ] Verify map zooms to location
   - [ ] Verify sheet opens automatically
   - [ ] Verify mentions are displayed
   - [ ] Verify mentions are sorted by distance

2. **Direct URL:**
   - [ ] Navigate directly to `/live?lat=44.9778&lng=-93.2650`
   - [ ] Verify map zooms and sheet opens
   - [ ] Verify URL parameters are cleared on sheet close

3. **Edge Cases:**
   - [ ] Test with invalid coordinates
   - [ ] Test with no mentions at location
   - [ ] Test with map not loaded
   - [ ] Test multiple rapid clicks

4. **Sheet Interaction:**
   - [ ] Click mention in sheet → navigates to `/mention/[id]`
   - [ ] Close sheet → URL parameters cleared
   - [ ] Scroll through mentions
   - [ ] Verify loading state
   - [ ] Verify error state
