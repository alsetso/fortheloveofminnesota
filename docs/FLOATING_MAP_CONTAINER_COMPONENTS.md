# FloatingMapContainer Component Architecture

## Overview
The `FloatingMapContainer` (exported as `LocationSidebar`) is a bottom-centered floating sidebar that provides location search, details, and interaction features for the map.

## Component Structure

```
FloatingMapContainer (LocationSidebar)
│
├── CursorTracker (above sidebar)
│   └── Shows hovered feature/mention info (desktop only)
│
├── Sidebar Card Container
│   │
│   ├── Inline Panels (above toolbar, conditional)
│   │   ├── Menu Panel (isMenuOpen)
│   │   │   ├── Tabs: About | Moderation | Press
│   │   │   └── Tab Content
│   │   │
│   │   ├── Map Controls Panel (isMapControlsOpen)
│   │   │   ├── Controls:
│   │   │   │   ├── Zoom In/Out
│   │   │   │   ├── 3D Toggle
│   │   │   │   ├── Reset Rotation
│   │   │   │   ├── Road Labels Toggle
│   │   │   │   ├── Spin Map Toggle
│   │   │   │   └── Year Filter Input
│   │   │
│   │   └── Suggestions Panel (showSuggestions)
│   │       └── Mapbox Geocoding search results
│   │
│   ├── Toolbar Row
│   │   ├── Menu Button (hamburger/X)
│   │   ├── Map Controls Button
│   │   ├── MapScreenshotEditor
│   │   └── Search Input (with suggestions)
│   │
│   └── Content Sections (isExpanded && !panels open)
│       │
│       ├── PRIMARY ACTION: Mention Heart
│       │   ├── Collapsed: "Mention ❤️" button
│       │   └── Expanded: Create Mention Form
│       │       ├── Address header
│       │       ├── Account info
│       │       ├── Caption textarea (240 char limit)
│       │       ├── Post Date input (optional year)
│       │       ├── Visibility toggle (Public/Only Me)
│       │       └── Post button
│       │
│       ├── VIEWING: Location Details (accordion)
│       │   ├── Header: Address/Place name
│       │   └── Expanded Content:
│       │       ├── Address (click to copy)
│       │       ├── Location Hierarchy:
│       │       │   ├── Neighborhood badge
│       │       │   ├── Locality badge (village/township/etc)
│       │       │   ├── City badge (with explore link)
│       │       │   ├── Parent City (if applicable)
│       │       │   └── County badge (with explore link)
│       │       └── State/Zip + Coordinates
│       │
│       ├── VIEWING: Map Feature Metadata (accordion)
│       │   ├── Header: Feature icon + name
│       │   └── Expanded Content:
│       │       ├── Type badges (Home indicator, class, type)
│       │       ├── Layer info (layerId, sourceLayer, category)
│       │       └── Properties (key-value pairs)
│       │
│       ├── VIEWING: Atlas Entity Details (accordion)
│       │   ├── Header: Entity emoji + name + type
│       │   └── Expanded Content:
│       │       ├── Type + Details (school type, park type, etc.)
│       │       ├── Address + Contact (phone, website)
│       │       ├── Description
│       │       ├── Explore Links (city/county pages)
│       │       └── Admin Actions (delete button)
│       │
│       ├── SECONDARY ACTIONS
│       │   └── Property Intelligence button (for houses only)
│       │
│       └── ADMIN PANEL
│           └── City Edit (update coordinates)
│
└── Modals
    └── IntelligenceModal (property intelligence for houses)
```

## Key Features

### 1. **Search & Geocoding**
- Mapbox Geocoding API integration
- Real-time search suggestions
- Location selection from search results

### 2. **Location Interaction**
- Map click → reverse geocode → show location details
- Atlas entity click → show entity details
- Feature metadata extraction from map layers

### 3. **Mention Creation**
- Primary action: "Mention ❤️" button
- Expandable form with:
  - Caption (240 chars)
  - Optional event year
  - Visibility toggle (public/private)
  - Account attribution

### 4. **Map Controls**
- Zoom controls
- 3D/2D toggle
- Rotation controls
- Road labels toggle
- Spin animation toggle
- Year filter for mentions


### 6. **Feature Tracking**
- CursorTracker: Shows feature info on hover
- Feature extraction from map metadata layers
- Property intelligence for residential buildings

### 7. **Admin Features**
- Delete atlas entities
- Update city coordinates
- Edit city information

## State Management

### URL Params
- `tab=poi` - POI creation mode
- `year` - Filter mentions by year

### Local State
- `locationData` - Selected location from map click/search
- `selectedAtlasEntity` - Selected atlas entity
- `capturedFeature` - Extracted map feature metadata
- `isMenuOpen` / `isMapControlsOpen` - Panel visibility
- `isExpanded` - Sidebar expansion state
- `isDropHeartExpanded` - Mention form expansion

## Dependencies

### Services
- `MentionService` - Create mentions
- `LocationLookupService` - Reverse geocoding
- `POIService` - POI creation
- `atlasService` - Atlas entity operations

### Components
- `MapScreenshotEditor` - Screenshot capture
- `CursorTracker` - Feature hover tracking
- `IntelligenceModal` - Property intelligence

### Hooks
- `useFeatureTracking` - Feature extraction
- `useAuthStateSafe` - Authentication state
- `useAppModalContextSafe` - Modal management
- `useWindowManager` - Window management
