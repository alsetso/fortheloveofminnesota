# Map-to-Mention State System

## System Breakdown

**Map-to-mention state machine: five states (idle, location-selected, form-expanded, submitting, success) with single-click activation—removing double-click entirely—where a map click immediately triggers location reverse-geocoding, adds a temporary red pin marker, and conditionally auto-expands the mention form if authenticated (or shows "Mention" button for guests), with the form state (`isDropHeartExpanded`) controlling visibility and the temporary pin lifecycle (created on click, persists through form interactions, removed on successful submission or explicit cancel/close, and updates position when clicking elsewhere on the map), while handling edge cases like clicking existing mentions (no new pin), clicking atlas entities (preserves atlas metadata), form validation errors (keeps pin and form open), authentication gates (welcome modal for guests, auto-expand for authenticated users), and cleanup on unmount or navigation, with state transitions managed through a single source of truth that coordinates `locationData`, `isDropHeartExpanded`, `temporaryPinRef`, and form field state, ensuring atomic updates and preventing race conditions during async operations like reverse geocoding or mention creation, with the simplest flow being: single click → location loads + pin appears + form auto-expands (if auth) → user fills form → submit → mention created + pin removed + form collapses + location optionally persists for quick successive mentions, and closing/canceling resets to idle state while clicking elsewhere updates location and resets form state, creating a fluid, single-interaction path from map exploration to mention creation without modal interruptions or multi-step confirmations.**

## State Definitions

### 1. **Idle State**
- No location selected
- No temporary pin visible
- Form collapsed (`isDropHeartExpanded: false`)
- `locationData: null`
- User sees: empty map, no sidebar content

### 2. **Location Selected State**
- Map clicked, location reverse-geocoded
- Temporary red pin marker visible at coordinates
- `locationData` populated with address, city, coordinates
- Form collapsed (shows "Mention" button if not authenticated)
- User sees: location details in sidebar, temporary pin on map

### 3. **Form Expanded State**
- `isDropHeartExpanded: true`
- Temporary pin still visible
- Form fields visible (description, visibility, post date, file upload)
- User can fill form or cancel
- User sees: expanded mention form in sidebar

### 4. **Submitting State**
- Form submission in progress
- `isPinSubmitting: true`
- Temporary pin remains visible
- Form disabled (prevents double-submission)
- User sees: "Posting..." button, disabled form

### 5. **Success State**
- Mention created successfully
- Temporary pin removed
- Form collapsed
- Location data optionally cleared or persisted
- User sees: success feedback, map updates with new mention

## State Transitions

### Single Click on Map (Empty Area)
1. **Idle → Location Selected**
   - Reverse geocode coordinates
   - Add temporary pin marker
   - Set `locationData`
   - If authenticated: auto-expand form (Idle → Form Expanded)
   - If guest: show "Mention" button

### Click "Mention" Button (Guest)
1. **Location Selected → Form Expanded**
   - If not authenticated: open welcome modal
   - If authenticated: expand form (`setIsDropHeartExpanded(true)`)

### Submit Form
1. **Form Expanded → Submitting**
   - Validate form
   - Create mention via API
2. **Submitting → Success**
   - Remove temporary pin
   - Collapse form
   - Clear or persist location data
   - Refresh mentions layer

### Cancel/Close Form
1. **Form Expanded → Location Selected** (or **Idle**)
   - Remove temporary pin
   - Collapse form
   - Optionally clear location data

### Click Elsewhere on Map
1. **Any State → Location Selected**
   - Update `locationData` with new coordinates
   - Move temporary pin to new location
   - Reset form if expanded
   - Reverse geocode new location

### Click Existing Mention
1. **Any State → Mention Popup**
   - No temporary pin created
   - Show mention details popup
   - Location sidebar shows mention info (not creation form)

## Temporary Pin Lifecycle

### Creation
- Created on map click (empty area)
- Red pulsing marker at clicked coordinates
- Stored in `temporaryPinRef` or similar ref

### Persistence
- Remains visible during form expansion
- Remains visible during form editing
- Remains visible during submission (until success)

### Removal
- On successful mention creation
- On explicit cancel/close action
- On clicking elsewhere (replaced by new pin)
- On component unmount
- On navigation away

## Edge Cases

### Clicking Existing Mention
- **Behavior**: No temporary pin, no form expansion
- **State**: Show mention popup, location sidebar shows mention details
- **Implementation**: Check `queryRenderedFeatures` for mention layers before creating pin

### Clicking Atlas Entity
- **Behavior**: Preserve atlas metadata in `atlas_meta`
- **State**: Location Selected with `atlasEntityData` populated
- **Implementation**: Handle `atlas-entity-click` event, merge with location data

### Authentication Gates
- **Guest User**: Show "Mention" button, open welcome modal on click
- **Authenticated User**: Auto-expand form on map click
- **Implementation**: Check `user` state, conditionally expand form

### Form Validation Errors
- **Behavior**: Keep pin visible, keep form expanded, show error message
- **State**: Form Expanded (with error state)
- **Implementation**: Set `pinError`, prevent pin removal

### Concurrent Map Clicks
- **Behavior**: Cancel in-flight reverse geocode, update to new location
- **State**: Latest click wins, previous state discarded
- **Implementation**: Use abort controllers, refs for latest state

### Component Unmount
- **Behavior**: Clean up temporary pin, cancel async operations
- **Implementation**: Cleanup in `useEffect` return function

## Implementation Requirements

### Single Source of Truth
- Centralized state management for all map-mention interactions
- Single state object or hook managing: `locationData`, `isDropHeartExpanded`, `temporaryPinRef`, form fields
- Atomic state updates to prevent race conditions

### Remove Double-Click
- Remove all `dblclick` event handlers
- Single `click` handler for map interactions
- Immediate form expansion on click (if authenticated)

### Temporary Pin Management
- Ref-based storage for pin marker instance
- Cleanup on all exit paths
- Visual feedback (red pulsing) during creation flow

### Form State Management
- Auto-expand on authenticated map click
- Reset form when location changes
- Preserve form data during submission
- Clear form on success or cancel

### Location Data Management
- Reverse geocode on every map click
- Cache location data per coordinates
- Update location data atomically with state changes
- Handle async operations with proper cleanup

## User Experience Flow

### Authenticated User
1. Click map → Location loads + Pin appears + Form auto-expands
2. Fill form → Submit
3. Mention created → Pin removed + Form collapses
4. Optionally: Location persists for quick successive mentions

### Guest User
1. Click map → Location loads + Pin appears + "Mention" button shown
2. Click "Mention" → Welcome modal opens
3. After sign-in → Form auto-expands
4. Fill form → Submit
5. Mention created → Pin removed + Form collapses

### Quick Successive Mentions
1. Create mention → Success
2. Location persists (optional)
3. Click elsewhere → New location + New pin + Form resets
4. Create another mention

## Technical Implementation Notes

### State Coordination
```typescript
interface MapMentionState {
  locationData: LocationData | null;
  isFormExpanded: boolean;
  temporaryPinRef: RefObject<Marker | null>;
  formFields: {
    description: string;
    visibility: 'public' | 'only_me';
    postDate: string | null;
    file: File | null;
  };
  isSubmitting: boolean;
  error: string | null;
}
```

### Event Flow
1. Map click → `handleMapClick`
2. Check for existing mentions/atlas entities
3. Reverse geocode → Set `locationData`
4. Add temporary pin → Store in ref
5. If authenticated → Auto-expand form
6. User interaction → Form submission or cancel
7. Success → Remove pin, reset state

### Cleanup Strategy
- Remove temporary pin on: success, cancel, location change, unmount
- Cancel async operations on: new click, unmount
- Reset form state on: location change, success, cancel


