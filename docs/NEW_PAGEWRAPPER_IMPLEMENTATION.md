# New PageWrapper Implementation

## Overview

Implemented new three-column PageWrapper architecture with sticky sidebars, following the proposed technical format structure.

## Architecture

### Layout Structure
- **Fixed Header**: `pt-14` offset, `z-50`, 56px height (`h-14`)
- **Three-Column Flex Layout**: 
  - Left Sidebar: `sticky top-14`, `w-64`, `lg:` breakpoint (1024px)
  - Center Feed: `flex-1`, scrollable
  - Right Sidebar: `sticky top-14`, `w-80`, `xl:` breakpoint (1280px)

### Component Hierarchy
```
NewPageWrapper
├── Header (fixed, z-50)
├── LeftSidebar (sticky, scrollable, lg:)
├── Feed (flex-1, scrollable)
│   ├── Stories (horizontal scroll)
│   ├── PostComposer
│   └── PostCard[] (infinite scroll)
└── RightSidebar (sticky, scrollable, xl:)
```

## Design System

### CSS Variables (HSL)
Located in `src/app/globals.css`:
- `--surface`: White backgrounds
- `--surface-muted`: Off-white
- `--header`: Dark header background
- `--lake-blue`: Brand color (HSL 200 100% 30%)
- `--aurora-teal`: Brand accent (HSL 180 60% 45%)
- `--foreground`: Text colors
- `--border`: Border colors

### Tailwind Tokens
Mapped in `tailwind.config.js`:
- `bg-surface`, `bg-surface-muted`
- `bg-header`
- `text-foreground`, `text-foreground-muted`
- `border-border`, `border-border-muted`
- `bg-lake-blue`, `bg-aurora-teal`

**Zero hardcoded colors** - all components use semantic tokens.

## Components Created

### 1. NewPageWrapper (`src/components/layout/NewPageWrapper.tsx`)
- Fixed header with navigation
- Three-column flex layout
- Responsive breakpoints (`lg:`, `xl:`)
- Mobile bottom nav

### 2. LeftSidebar (`src/components/layout/LeftSidebar.tsx`)
- Sticky positioning (`sticky top-14`)
- Navigation shortcuts
- Scrollable content area
- Hidden on mobile (`hidden lg:block`)

### 3. RightSidebar (`src/components/layout/RightSidebar.tsx`)
- Sticky positioning (`sticky top-14`)
- Contextual content (contacts, ads)
- Scrollable content area
- Hidden until `xl:` breakpoint (`hidden xl:block`)

### 4. Feed Components

#### Stories (`src/components/feed/Stories.tsx`)
- Horizontal scrolling (`overflow-x-auto`)
- Avatar circles with gradient borders
- Mock data support

#### PostComposer (`src/components/feed/PostComposer.tsx`)
- Compact design (`text-xs`, `p-[10px]`)
- Textarea with action buttons
- Photo and location buttons
- Integrates with `/api/posts` POST endpoint

#### PostCard (`src/components/feed/PostCard.tsx`)
- Compact card design
- Avatar, username, timestamp
- Content with images
- Action buttons (Like, Comment, Share)

#### NewFeed (`src/components/feed/NewFeed.tsx`)
- Infinite scroll with Intersection Observer
- Fetches from `/api/posts`
- Stories + PostComposer + PostCard[]
- Loading and error states

## Routing

### Feed Page (`src/app/feed/page.tsx`)
- Uses `NewPageWrapper`
- Includes `LeftSidebar` and `RightSidebar`
- Renders `NewFeed` component

## Database Integration

### Existing API
- **GET `/api/posts`**: Fetches posts with pagination
- **POST `/api/posts`**: Creates new posts
- Uses existing `posts` table schema
- No new migrations required

### Post Type
Located in `src/types/post.ts`:
- Includes `account`, `map`, `mention_type` relations
- Supports `images`, `map_data`, `mention_ids`
- Visibility: `public` | `draft`

## Responsive Behavior

### Mobile (< 1024px)
- Header: Full width, compact nav
- Left Sidebar: Hidden
- Center Feed: Full width
- Right Sidebar: Hidden
- Bottom Nav: Fixed at bottom

### Desktop (≥ 1024px, < 1280px)
- Header: Full width
- Left Sidebar: Visible (`lg:block`)
- Center Feed: Flexible width
- Right Sidebar: Hidden
- Bottom Nav: Hidden

### Large Desktop (≥ 1280px)
- Header: Full width
- Left Sidebar: Visible
- Center Feed: Flexible width
- Right Sidebar: Visible (`xl:block`)
- Bottom Nav: Hidden

## UX Flow

1. **Header**: Global navigation anchor (always visible)
2. **Left Sidebar**: Shortcuts/navigation (desktop only)
3. **Center Feed**: Infinite-scroll feed pattern
4. **Right Sidebar**: Contextual contacts/ads (large desktop only)

## Design System Compliance

All components follow compact feed design system:
- Spacing: `gap-2` (8px), `gap-3` (12px), `p-[10px]`
- Typography: `text-xs` (12px), `text-sm` (14px)
- Borders: `border border-border`, `rounded-md`
- Colors: Semantic tokens only (no hardcoded colors)

## Next Steps

1. Add real Stories data from database
2. Implement Like/Comment/Share functionality
3. Add photo upload to PostComposer
4. Enhance RightSidebar with real contacts/ads
5. Add loading skeletons
6. Implement pull-to-refresh on mobile
