# Profile Page Structure Analysis

## Current Structure Problems

### 1. **Wrong Layout Paradigm**
- **Current**: Sidebar + Content Area (traditional web app layout)
- **Problem**: Profile pages should be map-centric, not document-centric
- **Should be**: Full-screen map with floating UI elements

### 2. **Tab System is Misaligned**
- **Current**: Tabs switch between completely different views (Mentions map, List view, Maps grid)
- **Problem**: These are fundamentally different experiences, not tabs of the same view
- **Should be**: Full-screen map is the primary view, with floating profile card + collections

### 3. **Map is Constrained**
- **Current**: Map is in `aspect-square` container within ProfileMentionsContainer
- **Problem**: Map should be full viewport, not a small square
- **Should be**: Full-screen map that fills available space below nav

### 4. **Profile Card is Fixed Sidebar**
- **Current**: Profile card is in a fixed left sidebar (w-64 xl:w-80)
- **Problem**: Takes up valuable screen space, not map-centric
- **Should be**: Floating card in top-left corner of map

### 5. **Collections Management is Nested**
- **Current**: Collections panel is inside ProfileMentionsContainer, only shows on "mentions" tab
- **Problem**: Collections should be accessible from the main profile view
- **Should be**: Part of the floating profile card component

### 6. **Custom Navigation Instead of SimpleNav**
- **Current**: Uses ProfileTopbar (custom nav with sidebar toggle)
- **Problem**: Inconsistent with rest of site, adds unnecessary complexity
- **Should be**: SimpleNav at top (standard site navigation)

### 7. **Complex State Management**
- **Current**: Tab state, sidebar toggle state, collection selection, pin selection all mixed
- **Problem**: Too many moving parts for what should be a simple map view
- **Should be**: Simplified - just map state and floating UI state

### 8. **Content Switching Instead of Unified View**
- **Current**: Different containers for different tabs (ProfileMapsContainer, ProfileMentionsList, ProfileMentionsContainer)
- **Problem**: User has to switch tabs to see different content
- **Should be**: Map is always visible, floating UI provides context and controls

## What the Profile Page Should Be

### Core Structure:
```
┌─────────────────────────────────────┐
│ SimpleNav (standard site nav)      │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────┐                    │
│  │ Profile     │  Full Screen Map   │
│  │ Card +      │  (fills remaining) │
│  │ Collections │                    │
│  │ (floating)  │                    │
│  └─────────────┘                    │
│                                     │
└─────────────────────────────────────┘
```

### Key Principles:
1. **Map-first**: Full-screen map is the primary interface
2. **Floating UI**: Profile card and collections float on top of map
3. **No tabs**: Map is always visible, no switching between views
4. **Standard nav**: Use SimpleNav like rest of site
5. **Unified experience**: Everything accessible from one view

## Refactor Plan

1. Remove tab system entirely
2. Remove sidebar layout
3. Remove ProfileTopbar, use SimpleNav
4. Create full-screen map container
5. Create floating profile card with collections integrated
6. Simplify state management
7. Make map the primary view
