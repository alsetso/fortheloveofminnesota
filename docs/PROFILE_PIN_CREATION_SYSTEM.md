# Profile Pin Creation System

## Overview

The profile page allows owners to create new pins by clicking on the map. This document outlines the components and flow for pin creation.

## Components & Files

### 1. **ProfileMapClient.tsx** (Main orchestrator)
**Location:** `src/components/profile/ProfileMapClient.tsx`

**Responsibilities:**
- Manages map instance and temporary pin marker
- Handles map click events for pin creation
- Manages modal state (`modalState` with type `'create-pin'`)
- Coordinates between temporary marker and create modal

**Key Functions:**
- `addTemporaryPin(coordinates)` - Creates a pulsing red marker at clicked location
- `removeTemporaryPin()` - Removes the temporary marker
- `updateTemporaryPinColor(visibility)` - Updates marker color based on visibility selection
- `handleCloseCreatePinModal()` - Closes modal and removes temporary marker
- `handlePinCreated(pin)` - Handles successful pin creation, updates local state and URL

**State:**
- `temporaryMarkerRef` - Reference to the temporary Mapbox marker
- `modalState` - Consolidated modal state (`{ type: 'create-pin', coordinates }` or `{ type: 'none' }`)
- `isCreatePinModalOpen` - Derived from `modalState.type === 'create-pin'`

**Map Click Handler (lines 330-367):**
- Only active when: `showOwnerControls && ownership.canCreatePin`
- Checks if click hit a pin layer (if so, doesn't create new pin)
- Adds temporary marker and opens create modal

### 2. **CreatePinModal.tsx** (Pin creation form)
**Location:** `src/components/map/CreatePinModal.tsx`

**Responsibilities:**
- Form for pin creation (description, media upload, visibility)
- Handles file upload to Supabase storage
- Creates pin record in database
- Calls `onPinCreated` callback with new pin data

**Props:**
- `isOpen: boolean`
- `onClose: () => void`
- `coordinates: { lat: number; lng: number } | null`
- `onPinCreated: (pin?: CreatedPin) => void`
- `onBack?: () => void`
- `onVisibilityChange?: (visibility: 'public' | 'only_me') => void`

**Features:**
- Description textarea
- Image upload with preview
- Visibility toggle (public/private)
- Address lookup and display
- Form validation

### 3. **Temporary Pin Marker** (Visual feedback)
**Implementation:** Inline in `ProfileMapClient.tsx` (lines 84-141)

**Visual:**
- Red pulsing circle (`#ef4444`)
- White border
- Pulsing animation (CSS keyframes)
- 24px × 24px
- `pointer-events: none` (doesn't interfere with clicks)

**Lifecycle:**
- Created when user clicks map (if not clicking on existing pin)
- Removed when:
  - Modal closes
  - User switches to visitor view
  - Pin is successfully created
  - `pinId` appears in URL (user clicked on existing pin)

## Flow

### Creating a New Pin

1. **User clicks map** (when `showOwnerControls && canCreatePin`)
   - Map click handler checks if click hit a pin layer
   - If not a pin, extracts `lat`/`lng` from click event
   - Calls `addTemporaryPin({ lat, lng })` → Creates red pulsing marker
   - Sets `modalState = { type: 'create-pin', coordinates: { lat, lng } }`

2. **Temporary marker appears** on map at clicked location

3. **CreatePinModal opens** with coordinates

4. **User fills form** (description, uploads image, selects visibility)
   - `onVisibilityChange` updates temporary marker color (if implemented)

5. **User saves pin**
   - Modal uploads image to Supabase storage
   - Creates pin record in database
   - Calls `onPinCreated(newPin)`

6. **ProfileMapClient handles creation**
   - Updates `localPins` state with new pin
   - Removes temporary marker
   - Closes modal
   - Updates URL with `?pinId=newPinId` (opens popup for new pin)

### Closing/Canceling

- **User closes modal** → `handleCloseCreatePinModal()` → Removes marker, closes modal
- **User switches to visitor view** → Effect closes modal and removes marker
- **User clicks existing pin** → `pinId` in URL → Effect closes modal and removes marker

## Current Issues & Considerations

### Potential Refactor Benefits

1. **Separation of Concerns**
   - Temporary marker logic could be extracted to a hook (`useTemporaryPinMarker`)
   - Modal state management could use a reducer for more complex states

2. **Code Duplication**
   - Temporary marker creation logic is inline (could be reusable component)
   - Similar patterns exist in other map components

3. **State Management**
   - Multiple effects watching different conditions (visitor view, pinId in URL)
   - Could consolidate into a single effect with comprehensive conditions

4. **URL State Sync**
   - Currently clears `pinId` when closing modal (line 467-473)
   - New behavior: closes modal when `pinId` appears (prevents conflicts)

### Current Implementation Quality

**Strengths:**
- Clear separation between marker and modal
- Proper cleanup on unmount/view changes
- Handles edge cases (clicking on existing pin, switching views)

**Weaknesses:**
- Multiple effects with overlapping concerns
- Temporary marker logic is tightly coupled to ProfileMapClient
- No debouncing on map clicks (could accidentally create multiple markers)

## New Feature: Close Modal on Pin Click

**Implementation:** Added effect (lines 160-167) that watches `searchParams.get('pinId')` and closes modal if:
- `pinId` exists in URL
- Modal is currently open

**Rationale:** When user clicks an existing pin, the URL gets `?pinId=xxx`, which should open the pin popup. Having the create modal open simultaneously is confusing and conflicts with the pin popup.

**Behavior:**
- User clicks map → Modal opens, temporary marker appears
- User clicks existing pin → URL updates to `?pinId=xxx` → Modal closes, marker removed → Pin popup opens

## Files Summary

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `ProfileMapClient.tsx` | Main orchestrator, map click handler, temporary marker | ~655 | High |
| `CreatePinModal.tsx` | Pin creation form, file upload, database insert | ~540 | Medium |
| `ProfilePinsLayer.tsx` | Renders pins, handles pin clicks, popups | ~660 | High |

**Total:** ~1,855 lines across 3 main files

## Recommendations

1. **Extract Temporary Marker** → `useTemporaryPinMarker` hook or `TemporaryPinMarker` component
2. **Consolidate Effects** → Single effect watching all conditions (viewMode, pinId, modal state)
3. **Add Debouncing** → Prevent rapid map clicks from creating multiple markers
4. **Extract Modal State** → Use reducer or context for more complex modal management
5. **Consider URL State Management** → Centralized hook for URL param management

**Refactor Priority:** Medium
- Current implementation works but has room for improvement
- Not critical unless adding more modal types or complex state
- Would improve maintainability and testability
