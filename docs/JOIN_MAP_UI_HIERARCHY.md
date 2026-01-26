# Join Map UI Hierarchy (Non-Members on Custom Map Page)

## Current Structure

### 1. **Floating Button** (Map Container)
**Location:** `src/app/map/[id]/components/MapIDBox.tsx` (line ~1327)
- **Position:** Absolute, bottom-right corner of map
- **Visibility:** Only if `!isMember && !isOwner && logged in && map setup complete`
- **Content:**
  - Icon: UserPlusIcon
  - Text: "Join Map"
  - Action: Opens JoinMapSidebar

---

### 2. **JoinMapSidebar** (Full Sidebar)
**Location:** `src/app/map/[id]/components/JoinMapSidebar.tsx`
**Triggered by:** Clicking floating button or sidebar menu

#### **Sidebar Structure:**

```
JoinMapSidebar
├── SidebarHeader
│   ├── Title: "Join Map"
│   └── Close button + Menu
│
├── Content Area (scrollable, px-3 py-3 space-y-3)
│   │
│   ├── [1] Header Message (text-xs text-gray-600)
│   │   └── Auto-approve: "Join this map to collaborate and contribute."
│   │   └── Request: "Request to join this map. Your request will be reviewed..."
│   │
│   ├── [2] Member Benefits Section
│   │   ├── Label: "Member Benefits" (text-[10px] font-medium text-gray-500)
│   │   └── Card (bg-gray-50 border rounded-md p-[10px] space-y-2)
│   │       │
│   │       ├── [2a] Collaboration Features (if any enabled)
│   │       │   ├── Label: "You can:" (text-[10px] font-medium text-gray-600)
│   │       │   └── Feature List (space-y-1)
│   │       │       ├── Allow Pins (if allowPins)
│   │       │       │   ├── MapPinIcon
│   │       │       │   ├── Text: "Add pins to the map"
│   │       │       │   └── Plan badge (if pinPermissions.required_plan)
│   │       │       │
│   │       │       ├── Allow Areas (if allowAreas)
│   │       │       │   ├── Square3Stack3DIcon
│   │       │       │   ├── Text: "Draw areas on the map"
│   │       │       │   └── Plan badge (if areaPermissions.required_plan)
│   │       │       │
│   │       │       └── Allow Posts (if allowPosts)
│   │       │           ├── DocumentTextIcon
│   │       │           ├── Text: "Create posts and mentions"
│   │       │           └── Plan badge (if postPermissions.required_plan)
│   │       │
│   │       ├── [2b] Map Layers (if any enabled) - border-t separator
│   │       │   ├── Label: "Map includes:" (text-[10px] font-medium text-gray-600)
│   │       │   └── Layer List (space-y-1)
│   │       │       ├── Congressional districts (if enabled)
│   │       │       ├── CTU boundaries (if enabled)
│   │       │       ├── State boundary (if enabled)
│   │       │       └── County boundaries (if enabled)
│   │       │
│   │       ├── [2c] Member Count (if > 0) - border-t separator
│   │       │   ├── UsersIcon
│   │       │   └── Text: "{count} member(s)"
│   │       │
│   │       └── [2d] View Access - border-t separator
│   │           ├── EyeIcon
│   │           └── Text: "View all map content and members"
│   │
│   ├── [3] Membership Rules (if membershipRules exists)
│   │   ├── Label: "Membership Rules" (text-[10px] font-medium text-gray-500)
│   │   └── Card (bg-gray-50 border rounded-md p-[10px])
│   │       └── Rules text (text-xs text-gray-700 whitespace-pre-wrap)
│   │
│   ├── [4] Questions Section
│   │   ├── If questions exist:
│   │   │   ├── Label: "Questions" (text-[10px] font-medium text-gray-500)
│   │   │   └── Question List (space-y-3)
│   │   │       └── For each question:
│   │   │           ├── Label (text-xs font-medium text-gray-900)
│   │   │           └── Textarea (rows=3, placeholder="Your answer...")
│   │   │
│   │   └── If no questions:
│   │       └── Message: "No questions required" (text-xs text-gray-500, centered, py-4)
│   │
│   ├── [5] Error Message (if error exists)
│   │   └── Error card (bg-red-50 border-red-200 rounded-md p-2)
│   │       └── Error text (text-xs text-red-600)
│   │
│   └── [6] Submit Button Section (pt-2)
│       ├── If logged in:
│       │   └── Button: "Join Map" or "Request to Join"
│       │       └── Disabled state: "Submitting..."
│       │
│       └── If not logged in:
│           └── Message: "Please sign in to join this map" (text-xs text-gray-600)
```

---

## Issues / Complexity

1. **Too many sections** - 6 major sections in one sidebar
2. **Member Benefits is verbose** - Shows collaboration features, layers, member count, view access all in one card
3. **Redundant information** - Map layers might not be relevant for joining
4. **Plan badges** - Temporary debug styling (border-2 border-blue-500/red-500) that should be removed
5. **Questions section** - Shows "No questions required" message even when not needed
6. **Header message** - Could be more concise

---

## Suggested Simplification

**Core needs:**
1. What they can do (collaboration features)
2. Terms/rules (if set)
3. Questions (if set)
4. Join button

**Remove/reduce:**
- Map layers (not relevant for joining decision)
- Member count (nice-to-have, not essential)
- "View access" (obvious benefit, doesn't need explicit callout)
- "No questions required" message (just don't show the section)
