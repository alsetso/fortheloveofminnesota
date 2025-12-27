# Codebase Organization Architecture

## Current Problems

### 1. **Inconsistent Structure**
- `components/feed/` has 40+ files mixed together (components, hooks, utils)
- `features/feed/` has services/hooks but components are elsewhere
- `features/posts/` has components but imports from `components/feed/`
- Hooks scattered: `components/feed/hooks/` vs `features/feed/hooks/`

### 2. **Circular Dependencies**
- `features/posts/components/PostCreationCard.tsx` → imports `components/feed/PostPublisherModal`
- `features/feed/services/mediaUploadService.ts` → imports `components/feed/utils/videoThumbnail`
- Unclear dependency direction

### 3. **Unclear Boundaries**
- When to use `components/feed/` vs `features/feed/` vs `features/posts/`?
- Why duplicate `PostCreationCard` in both places?
- Where do hooks belong?

---

## Proposed Clear Organization

### **Rule: Features are Self-Contained Modules**

Each feature should be a complete, independent module:

```
src/features/[feature-name]/
├── components/          # Feature-specific UI components
├── hooks/              # Feature-specific hooks
├── services/           # Business logic & API calls
├── utils/             # Feature-specific utilities
├── types.ts           # Feature type definitions
├── constants.ts       # Feature constants (optional)
└── index.ts           # Public API exports
```

### **Rule: Components are Shared/Generic UI**

`components/` should only contain:
- **Shared/generic UI components** (used across multiple features)
- **Layout components** (PageLayout, SimpleNav, etc.)
- **Domain-specific pages** (feed homepage, profile page, etc.)

---

## Reorganization Plan

### **Feature Modules** (Self-Contained)

#### `features/feed/` - Feed Feature Module
```
features/feed/
├── components/
│   ├── FeedPost.tsx              # Post display component
│   ├── FeedList.tsx              # Post list component
│   ├── PostCreationCard.tsx      # Post creation UI
│   ├── PostPublisherModal.tsx    # Post publish modal
│   ├── PostMapModal.tsx          # Post map editor
│   ├── PostMapRenderer.tsx       # Post map display
│   ├── MediaUploadEditor.tsx     # Media upload UI
│   ├── EditPostModal.tsx         # Edit post modal
│   └── CreatePostForm.tsx        # Post form component
├── hooks/
│   ├── usePostCreation.ts        # Post creation logic
│   ├── useMediaUpload.ts         # Media upload logic
│   ├── usePostMapBase.ts         # Post map logic
│   └── useUrlMapState.ts         # URL map state
├── services/
│   ├── postService.ts            # Post API calls
│   └── mediaUploadService.ts     # Media upload API
├── utils/
│   ├── feedHelpers.ts            # Feed utilities
│   ├── mapStaticImage.ts         # Map image utils
│   └── videoThumbnail.ts         # Video thumbnail utils
├── types.ts                      # Feed types
└── index.ts                       # Export: components, hooks, services, types
```

#### `features/homepage/` - Homepage Feature Module
```
features/homepage/
├── components/
│   ├── FeedMapClient.tsx         # Main homepage map
│   ├── LocationSidebar.tsx        # Location sidebar
│   ├── MapControls.tsx            # Map controls
│   ├── TopNav.tsx                 # Top navigation
│   ├── WelcomeModal.tsx           # Welcome modal
│   └── HomepageStatsHandle.tsx   # Stats display
├── hooks/
│   └── useHomepageState.ts        # Homepage state management
└── index.ts
```

#### `features/map/` - Map Feature Module
```
features/map/
├── components/
│   ├── PinsLayer.tsx              # Pin visualization
│   └── CreatePinModal.tsx         # Pin creation modal
├── services/
│   ├── publicMapPinService.ts     # Pin CRUD operations
│   ├── locationLookupService.ts   # Location lookup
│   └── addressParser.ts           # Address parsing
├── utils/
│   └── mapboxLoader.ts            # Mapbox loading
├── config.ts                      # Map configuration
└── index.ts
```

#### `features/profile/` - Profile Feature Module
```
features/profile/
├── components/
│   ├── ProfileSidebar.tsx
│   ├── ProfileMapClient.tsx
│   ├── ProfileMapControls.tsx
│   └── ProfilePinsLayer.tsx
├── hooks/
│   └── useProfileOwnership.ts
├── services/
│   └── profileService.ts
└── index.ts
```

#### `features/account/` - Account Feature Module
```
features/account/
├── components/
│   ├── AccountModal.tsx
│   ├── AccountSwitcherDropdown.tsx
│   ├── AccountViewsCard.tsx
│   ├── OnboardingModal.tsx
│   └── SettingsClient.tsx
├── services/
│   └── accountService.ts
└── index.ts
```

---

### **Shared Components** (Generic/Reusable)

```
components/
├── ui/                    # Generic UI components
│   ├── Modal.tsx
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Views.tsx
├── layout/                # Layout components
│   ├── PageLayout.tsx
│   ├── SimpleNav.tsx
│   └── SimplePageLayout.tsx
├── shared/                # Shared utilities
│   └── ProfilePhoto.tsx
└── ErrorBoundary.tsx
```

---

## Migration Strategy

### Phase 1: Consolidate Feed Feature
1. Move all `components/feed/` files into `features/feed/components/`
2. Move hooks from `components/feed/hooks/` to `features/feed/hooks/`
3. Move utils from `components/feed/utils/` to `features/feed/utils/`
4. Update `features/feed/index.ts` to export everything
5. Update all imports

### Phase 2: Create Homepage Feature
1. Create `features/homepage/`
2. Move homepage-specific components from `components/feed/`
3. Move `useHomepageState.ts` to `features/homepage/hooks/`

### Phase 3: Consolidate Map Feature
1. Move map components from `components/map/` to `features/map/components/`
2. Ensure all map services are in `features/map/services/`

### Phase 4: Clean Up Components
1. Keep only shared/generic components in `components/`
2. Remove feature-specific components from `components/`

---

## Benefits

1. **Clear Boundaries**: Each feature is self-contained
2. **No Circular Dependencies**: Features don't import from each other's components
3. **Easy to Find**: Everything for a feature is in one place
4. **Reusable**: Features can be imported as modules: `import { FeedPost, usePostCreation } from '@/features/feed'`
5. **Testable**: Features can be tested in isolation

---

## Import Patterns

### ✅ Good: Feature imports from feature
```typescript
// features/feed/components/PostCreationCard.tsx
import { usePostCreation } from '@/features/feed/hooks/usePostCreation';
import { PostService } from '@/features/feed/services/postService';
```

### ✅ Good: Page imports from feature
```typescript
// app/page.tsx
import { FeedMapClient } from '@/features/homepage';
import { FeedPost } from '@/features/feed';
```

### ❌ Bad: Feature imports from components
```typescript
// DON'T: features/posts/components/PostCreationCard.tsx
import PostPublisherModal from '@/components/feed/PostPublisherModal'; // ❌
```

### ❌ Bad: Circular feature dependencies
```typescript
// DON'T: features/feed imports from features/posts
import { PostCreationCard } from '@/features/posts'; // ❌
```

---

## File Location Decision Tree

**Is it a reusable UI component used across multiple features?**
- ✅ Yes → `components/ui/` or `components/shared/`
- ❌ No → Continue...

**Is it business logic, API calls, or state management?**
- ✅ Yes → `features/[feature-name]/services/` or `features/[feature-name]/hooks/`
- ❌ No → Continue...

**Is it specific to one feature?**
- ✅ Yes → `features/[feature-name]/components/`
- ❌ No → `components/[domain]/` (temporary, migrate later)





