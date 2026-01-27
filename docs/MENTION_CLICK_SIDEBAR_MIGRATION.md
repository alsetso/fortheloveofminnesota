# Mention Click → Sidebar Migration Plan

## Current State

### **Mention Clicks (MentionsLayer)**
- Dispatches `mention-click` event with mention data
- Currently: No handler on custom map page (event is ignored)
- Live map: Updates URL params, shows MentionLocationSheet

### **Map Pins/Areas (MapIDBox)**
- Click → `setSelectedEntity` → `MapEntitySlideUp` component
- **MapEntitySlideUp**: iOS-style bottom sheet (mobile) / modal overlay (desktop)
- **Issues**: 
  - Covers map on desktop
  - Separate component (1200+ lines)
  - Not integrated with unified sidebar system

---

## Proposed Solution: Unified Entity Sidebar

### **Architecture**

1. **Create `MentionDetailSidebar` component**
   - Reuse existing `PostDetailClient` or create focused component
   - Handles mention display, edit, delete
   - Lazy load for performance

2. **Extend unified sidebar system**
   - Add `'mention'` type to `UnifiedSidebarType`
   - Add `'entity'` type for map pins/areas (or merge with mention)
   - Single sidebar handles all entity types

3. **Event-driven approach**
   - MentionsLayer continues dispatching `mention-click`
   - Map page listens and opens sidebar
   - MapIDBox dispatches `entity-click` for pins/areas
   - Single event handler opens appropriate sidebar

---

## Implementation Steps

### **Phase 1: Create Mention Sidebar Component**
```typescript
// src/app/map/[id]/components/MentionDetailSidebar.tsx
// - Reuse PostDetailClient logic
// - Or create lightweight version
// - Lazy load
```

### **Phase 2: Add Entity Sidebar to Config**
```typescript
// In useMapSidebarConfigs.tsx
// Add conditional sidebar for mentions/entities
if (selectedMentionId || selectedEntityId) {
  configs.push({
    type: 'mention' | 'entity',
    title: 'Mention Details' | 'Pin Details' | 'Area Details',
    content: <MentionDetailSidebar /> | <EntityDetailSidebar />,
    popupType: 'account',
  });
}
```

### **Phase 3: Replace MapEntitySlideUp**
- Remove `MapEntitySlideUp` component usage
- Convert to sidebar-based approach
- Update MapIDBox to dispatch events instead of setting state

### **Phase 4: Event Handler Hook**
```typescript
// src/app/map/[id]/hooks/useEntitySidebar.ts
// - Listens to 'mention-click' and 'entity-click' events
// - Manages selectedMentionId/selectedEntityId state
// - Opens sidebar automatically
```

---

## Benefits

### **Performance**
- ✅ Lazy load entity detail components
- ✅ No modal overlays (better rendering)
- ✅ Sidebar uses CSS transforms (no layout shifts)
- ✅ Single component instance (not recreated per click)

### **Code Reduction**
- ✅ Remove `MapEntitySlideUp` (1200+ lines)
- ✅ Consolidate mention/pin/area views
- ✅ Single event handler pattern
- ✅ Reuse unified sidebar infrastructure

### **UX Improvements**
- ✅ Map stays visible (sidebar on right, doesn't cover)
- ✅ Consistent with other sidebars (settings, posts, etc.)
- ✅ Better mobile experience (bottom sheet via UnifiedSidebarContainer)
- ✅ Can view map while reading entity details

### **Functionality**
- ✅ All entity types in one system
- ✅ Easy to add new entity types
- ✅ Consistent navigation patterns
- ✅ Better state management (unified with sidebar system)

---

## Code Structure

### **New Files**
```
src/app/map/[id]/components/
  - MentionDetailSidebar.tsx (new)
  - EntityDetailSidebar.tsx (new, or merge with MentionDetailSidebar)

src/app/map/[id]/hooks/
  - useEntitySidebar.ts (new)
```

### **Modified Files**
```
src/app/map/[id]/page.tsx
  - Add useEntitySidebar hook
  - Add entity sidebar to sidebarConfigs

src/app/map/[id]/components/MapIDBox.tsx
  - Remove MapEntitySlideUp usage
  - Dispatch 'entity-click' events instead

src/app/map/[id]/hooks/useMapSidebarConfigs.tsx
  - Add entity/mention sidebar config
```

### **Removed Files**
```
src/app/map/[id]/components/MapEntitySlideUp.tsx (delete after migration)
```

---

## Event Flow

```
User clicks mention pin
  ↓
MentionsLayer.handleMentionClick()
  ↓
window.dispatchEvent('mention-click', { mention })
  ↓
useEntitySidebar hook listens
  ↓
Sets selectedMentionId state
  ↓
useMapSidebarConfigs includes mention sidebar
  ↓
UnifiedSidebarContainer shows MentionDetailSidebar
```

---

## Migration Checklist

- [ ] Create MentionDetailSidebar component
- [ ] Create useEntitySidebar hook
- [ ] Add entity sidebar to useMapSidebarConfigs
- [ ] Update MapIDBox to use events instead of MapEntitySlideUp
- [ ] Test mention clicks on custom map page
- [ ] Test pin/area clicks
- [ ] Remove MapEntitySlideUp component
- [ ] Update any references to MapEntitySlideUp
