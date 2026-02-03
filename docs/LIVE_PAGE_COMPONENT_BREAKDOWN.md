# Live Page Component Breakdown

This document provides a clear reference for discussing specific areas of the `/live` page without confusion.

## Component Hierarchy

```
LivePage (src/app/live/page.tsx)
├── LiveHeaderThemeSync (wrapper for HeaderThemeContext)
│   └── AppContainer
│       ├── MapPage (the actual map)
│       ├── AppContentWidth (overlay container)
│       │   ├── MapInteractionArea (empty space for map clicks)
│       │   └── FooterContainer
│       │       ├── FooterStatusBar (transparent loading states)
│       │       │   └── LiveMapFooterStatus
│       │       └── AppFooter (iOS Maps-style slide-up panel)
│       │           ├── DragHandle (top bar with gray rounded handle)
│       │           ├── FooterHeader (always visible)
│       │           │   ├── AppHeader
│       │           │   │   ├── AccountDropdown (left)
│       │           │   │   ├── MapSearchInput (center)
│       │           │   │   └── UniversalCloseButton (right, conditional)
│       │           │   └── HeaderMentionTypeCards (below header, when not searching)
│       │           └── FooterContentArea (scrollable, conditional)
│       │               ├── SearchStateContent (when isSearchActive)
│       │               │   ├── PinPeriodFilter (24h/7d/all tabs)
│       │               │   └── SearchPinsList (all pins matching search)
│       │               └── MainStateContent (when not searching)
│       │                   ├── MainActionContainer (children prop)
│       │                   │   ├── LivePinCard (when pin selected)
│       │                   │   ├── MapInfo (when location selected)
│       │                   │   └── MentionTypeInfoCard (when type selected)
│       │                   └── NearbyPinsSection (when zoomed in)
│       └── AppMenu (left sidebar, slides in from left)
```

## Named Areas (for quick reference)

### 1. **MapPage**
- **File**: `src/app/map/[id]/page.tsx`
- **Purpose**: The actual Mapbox map instance
- **Key Props**: `onLocationSelect`, `onLivePinSelect`, `onMapInstanceReady`
- **What it does**: Renders the map, handles map interactions, passes map instance up

---

### 2. **AppContentWidth**
- **File**: `src/components/layout/AppContentWidth.tsx`
- **Purpose**: Overlay container (max-width 500px) positioned over the map
- **Key Props**: `footerContent`, `footerStatusContent`, `footerTargetState`, `onUniversalClose`
- **What it does**: 
  - Provides the centered overlay container
  - Contains the footer and status bar
  - Manages pointer events (map area vs footer area)

---

### 3. **FooterStatusBar** (transparent loading states)
- **File**: `src/components/layout/LiveMapFooterStatus.tsx` (rendered as `footerStatusContent`)
- **Purpose**: Transparent status bar above the white footer showing loading states
- **Key Props**: `status` (LiveMapFooterStatusState), `onItemClick`
- **What it does**: 
  - Shows loading indicators (map data, pins, boundaries)
  - Collapsible "Review" accordion with clicked items
  - Appears above the white footer panel

---

### 4. **AppFooter** (iOS Maps-style panel)
- **File**: `src/components/layout/AppFooter.tsx`
- **Purpose**: The draggable slide-up panel at the bottom
- **Three States**:
  - **`low`**: Collapsed (120px) - only shows header
  - **`main`**: 40vh - shows header + content + nearby pins
  - **`search`**: 90vh - shows header + search results
- **Key Props**: `targetState`, `onStateChange`, `onUniversalClose`, `hasSelection`, `children`
- **What it does**: 
  - Manages panel height and drag interactions
  - Conditionally renders content based on state
  - Fetches nearby pins when zoomed in

---

### 5. **DragHandle**
- **Location**: Top of `AppFooter`
- **Purpose**: Visual handle for dragging the panel up/down
- **Appearance**: Gray rounded bar (w-12 h-1 bg-gray-400)
- **Behavior**: Click/drag to resize panel, snaps to nearest state

---

### 6. **FooterHeader** (always visible)
- **Location**: Inside `AppFooter`, below drag handle
- **Components**:
  - `AppHeader` (account + search + close button)
  - `HeaderMentionTypeCards` (emoji type filters, hidden when searching)

---

### 7. **AppHeader**
- **File**: `src/components/layout/AppHeader.tsx`
- **Purpose**: Header row with account, search, and close button
- **Layout**:
  - **Left**: `AccountDropdown` (opens AppMenu or account dropdown)
  - **Center**: `MapSearchInput` (search input field)
  - **Right**: `UniversalCloseButton` (X icon, conditional)
- **Key Props**: `onAccountImageClick`, `onUniversalClose`, `showCloseIcon`
- **What it does**: 
  - Shows close icon when `showCloseIcon` is true (search active OR selection exists)
  - Close button calls `onUniversalClose` (clears search + selections + collapses footer)

---

### 8. **HeaderMentionTypeCards**
- **File**: `src/components/layout/HeaderMentionTypeCards.tsx`
- **Purpose**: Horizontal row of emoji buttons for filtering by mention type
- **Visibility**: Hidden when `isSearchActive` is true
- **What it does**: Filters pins by mention type (emoji buttons)

---

### 9. **FooterContentArea** (scrollable content)
- **Location**: Inside `AppFooter`, below header
- **Visibility**: Only shown when panel is expanded beyond `low` state
- **Two Modes**:

#### 9a. **SearchStateContent** (when `isSearchActive`)
- **Components**:
  - `PinPeriodFilter`: Tabs for "24h" / "7d" / "All"
  - `SearchPinsList`: List of all pins matching search criteria
- **Height**: 90vh (SEARCH_HEIGHT)
- **Background**: Light gray (`bg-gray-50`)

#### 9b. **MainStateContent** (when not searching)
- **Components**:
  - `MainActionContainer`: The `children` prop from `LivePage`
    - `LivePinCard`: When a pin is selected (from URL `?pin=`)
    - `MapInfo`: When a location is selected (from URL `?layer=&id=` or map click)
    - `MentionTypeInfoCard`: When a mention type is selected (from URL `?type=`)
  - `NearbyPinsSection`: List of pins near map center (when zoomed in)
- **Height**: 40vh (MAIN_HEIGHT)
- **Background**: White

---

### 10. **MainActionContainer**
- **Location**: `children` prop passed to `AppFooter` from `LivePage`
- **Purpose**: Shows the selected entity (pin, location, or mention type)
- **Components** (mutually exclusive):
  - **LivePinCard**: Shows when `pinIdFromUrl` exists
  - **MapInfo**: Shows when `selectedLocation` exists
  - **MentionTypeInfoCard**: Shows when `typeSlugFromUrl` exists and no location selected

---

### 11. **LivePinCard**
- **File**: `src/components/layout/LivePinCard.tsx`
- **Purpose**: Displays details of a selected pin
- **Key Props**: `pinId`, `pin`, `currentAccountId`
- **What it shows**: Profile photo, username, pin content, image, location, time ago
- **Note**: Close icon removed (now uses universal close in header)

---

### 12. **MapInfo**
- **File**: `src/components/layout/MapInfo.tsx`
- **Purpose**: Displays details of a selected location (boundary or map click)
- **Key Props**: `location`, `zoom`, `onAddToMap`, `mentionType`
- **What it shows**: Location name, coordinates, boundary info, "Add to Map" button
- **Note**: Close icon removed (now uses universal close in header)

---

### 13. **MentionTypeInfoCard**
- **File**: `src/components/layout/MentionTypeInfoCard.tsx`
- **Purpose**: Shows info about a selected mention type filter
- **Key Props**: `typeSlug`
- **What it shows**: Emoji, type name, description

---

### 14. **NearbyPinsSection**
- **Location**: Inside `AppFooter`, below `MainActionContainer`
- **Purpose**: Shows pins near the current map center
- **Visibility**: Only when zoomed in (`currentZoom > 12`) and panel is open
- **What it shows**: List of up to 20 nearby pins with emoji, content preview

---

### 15. **SearchPinsList**
- **Location**: Inside `AppFooter`, when `isSearchActive`
- **Purpose**: Shows all pins matching search criteria
- **Filtering**: Can filter by time period (24h/7d/all)
- **What it shows**: List of pins with image, caption, location

---

### 16. **AppMenu** (left sidebar)
- **File**: `src/components/layout/AppMenu.tsx`
- **Purpose**: Sidebar menu that slides in from the left
- **Trigger**: Click on account image in `AppHeader`
- **What it contains**: Settings, filters, boundary layer toggles, etc.

---

## State Management

### Footer States
- **`footerTargetState`**: Programmatic control (`'low' | 'main' | 'search' | null`)
- **`panelHeight`**: Actual pixel height of the panel
- **`isOpen`**: Boolean for whether footer is expanded
- **`isSearchActive`**: Boolean from `HeaderThemeContext` (when URL hash is `#search`)

### Selection States (in LivePage)
- **`selectedPin`**: Currently selected pin data
- **`selectedLocation`**: Currently selected location (boundary or map click)
- **`pinIdFromUrl`**: Pin ID from URL query param `?pin=`
- **`typeSlugFromUrl`**: Mention type slug from URL query param `?type=`

---

## Key Interactions

1. **Map Click** → Sets `footerTargetState` to `'main'` → Shows `MapInfo`
2. **Pin Click** → Sets `footerTargetState` to `'main'` → Shows `LivePinCard`
3. **Search Activation** → Sets `footerTargetState` to `'search'` → Shows `SearchPinsList`
4. **Close Button Click** → Calls `onUniversalClose` → Clears selections + sets `footerTargetState` to `'low'`
5. **Drag Handle** → User manually adjusts `panelHeight` → Snaps to nearest state on release

---

## Quick Reference: Component Files

- **LivePage**: `src/app/live/page.tsx`
- **AppContentWidth**: `src/components/layout/AppContentWidth.tsx`
- **AppFooter**: `src/components/layout/AppFooter.tsx`
- **AppHeader**: `src/components/layout/AppHeader.tsx`
- **LiveMapFooterStatus**: `src/components/layout/LiveMapFooterStatus.tsx`
- **LivePinCard**: `src/components/layout/LivePinCard.tsx`
- **MapInfo**: `src/components/layout/MapInfo.tsx`
- **HeaderMentionTypeCards**: `src/components/layout/HeaderMentionTypeCards.tsx`
- **AppMenu**: `src/components/layout/AppMenu.tsx`
