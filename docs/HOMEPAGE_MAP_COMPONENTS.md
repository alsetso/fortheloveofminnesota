# Homepage Map Components - User-Visible & Interactive

Complete list of all map components that users see and interact with on the homepage.

## Map Layers (Rendered on Map Canvas)

### 1. **MentionsLayer** (`MentionsLayer.tsx`)
- **Visual**: Red heart icons (❤️) with labels showing mention descriptions
- **Interaction**:
  - **Hover**: Highlights mention, shows in CursorTracker
  - **Click**: Opens popup with mention details
  - **Popup Content**:
    - Account avatar + username
    - Mention description
    - Post date (if available)
    - "See who else" link (if multiple mentions at location)
    - Manage menu (for own mentions): Edit, Archive, Delete
  - **Double-click on map**: Creates new mention at location
- **Features**:
  - Filters by year (from URL param `?year=2024`)
  - Real-time updates via Supabase subscriptions
  - Click-through to mention detail pages


## UI Components (Overlays & Controls)

### 3. **Sidebar** (`Sidebar.tsx`)
Left-side navigation panel (always visible)

- **Mobile**: Hamburger menu at top
- **Desktop**: Fixed left sidebar
- **Navigation Items**:
  - **Explore** 🌐 - Browse cities/counties
  - **Mentions** ❤️ - View/manage mentions
  - **Controls** ⚙️ - Map 3D controls
  - **POI** 📍 - POI management (admin only)
  - **FAQs** ❓ - Frequently asked questions
  - **News** 📰 - News updates
- **Secondary Sidebar**: Slides out when nav item clicked
- **Account Section**: Profile photo, sign in/out

### 4. **FloatingMapContainer** (`FloatingMapContainer.tsx`)
Bottom-centered floating sidebar (main interaction panel)

**Components**:
- **CursorTracker** - Shows hovered feature/mention info (desktop only)
- **Toolbar**:
  - Menu button (hamburger) → About/Moderation/Press tabs
  - Map Controls button → Controls panel
  - MapScreenshotEditor → Screenshot capture
  - Search input → Location search with suggestions
- **Content Sections** (when expanded):
  - **Mention Heart Button** → Expandable mention creation form
  - **Location Details** → Address, hierarchy, coordinates
  - **Map Feature Metadata** → Feature type, layer info, properties
  - **Atlas Entity Details** → Entity info, admin actions
  - **Intelligence Button** → Property intelligence (for houses)
  - **Admin Panel** → City editing tools

**Interactions**:
- Search locations via Mapbox Geocoding
- Create mentions with caption, year, visibility
- View location details from map clicks
- Access map controls (zoom, 3D, rotation, etc.)

### 5. **HomepageStatsHandle** (`HomepageStatsHandle.tsx`)
Small handle at top center of map

- **Visual**: Year display (e.g., "2024") with chevron
- **When filtered**: Shows year + mention count (e.g., "2024 (1,234)")
- **Click**: Opens HomepageStatsModal
- **Modal Content**:
  - Total mentions count
  - Year filter input
  - Mentions by year breakdown

### 6. **AccountDropdown** (`AccountDropdown.tsx`)
Top-right floating dropdown (desktop only)

- **Visual**: Account avatar or "Sign In" button
- **Click**: Opens account menu or welcome modal
- **Hidden on mobile** (account in Sidebar nav)

### 7. **MapScreenshotEditor** (`MapScreenshotEditor.tsx`)
Screenshot capture tool in FloatingMapContainer toolbar

- **Visual**: Camera icon button
- **Click**: Opens screenshot editor overlay
- **Features**: Capture, edit, download map screenshots

## Map Interactions

### Direct Map Interactions

1. **Pan**: Click + drag to move map
2. **Zoom**: Scroll wheel or pinch gesture
3. **Rotate**: Right-click + drag (or Ctrl + drag)
4. **Pitch**: Right-click + drag vertically (3D tilt)
5. **Double-click**: Select location for mention creation
6. **Click on mention**: Opens mention popup
7. **Click on atlas entity**: Shows entity details in sidebar
8. **Hover on mention**: Highlights + shows in CursorTracker
9. **Hover on map features**: Shows feature info in CursorTracker

### Map Controls (via FloatingMapContainer)

- **Zoom In/Out**: Buttons in Controls panel
- **3D/2D Toggle**: Switch between 3D and 2D view
- **Reset Rotation**: Reset map rotation to north
- **Road Labels Toggle**: Show/hide road labels
- **Spin Map**: Animate map rotation
- **Year Filter**: Filter mentions by year


## Loading States

### Map Loading Overlay
- **Visual**: Spinner + "Loading map..." text
- **Error States**:
  - Missing Mapbox token
  - Map initialization error
  - Map load error

## Event System

The map uses a custom event system for component communication:

- `mention-created` - Refresh mentions layer
- `mention-hover-start` - Show mention in CursorTracker
- `mention-hover-end` - Clear mention from CursorTracker
- `mention-popup-opening` - Handle popup interactions
- `atlas-entity-click` - Show entity in FloatingMapContainer
- `show-location-for-mention` - Show location in sidebar
- `select-mention-by-id` - Select mention from URL param

## URL Parameters

- `?year=2024` - Filter mentions by year
- `?mention=mention-id` - Select specific mention
- `?tab=poi` - Enable POI creation mode
- `?tab=explore|mentions|controls|faqs|news` - Open sidebar tab

## Summary

**Total User-Visible Components**: 7 main UI components + 1 map layer

**Interactive Elements**:
- Map canvas (pan, zoom, rotate, pitch)
- Mentions (click, hover, popup)
- Atlas entities (click for details)
- FloatingMapContainer (search, create mentions, view details)
- Sidebar (navigation, secondary panels)
- HomepageStatsHandle (year filter, stats)
- AccountDropdown (account management)
- MapScreenshotEditor (screenshot capture)

**Map Layers**:
- MentionsLayer (heart icons with popups)
