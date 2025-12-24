# Admin Branch Project Prompt

## Project Overview

Create a new admin branch application for "For the Love of Minnesota" - a comprehensive administrative interface for managing the platform's content, users, and data. This is a separate Next.js application that shares the same Supabase backend but provides admin-only functionality.

## Core Requirements

### 1. Authentication & Authorization

- **Admin-only access**: All routes and API endpoints must verify admin role via `accounts.role = 'admin'`
- **Server-side protection**: Use `requireServerAdmin()` from `@/lib/authServer` in server components
- **API route protection**: Use `requireAdminApiAccess()` from `@/lib/adminHelpers` in API routes
- **RLS bypass**: Admin operations use service role client (`createServiceClient()`) to bypass RLS for write operations
- **Redirect behavior**: Non-admin users attempting to access admin routes should be redirected to homepage with appropriate message

### 2. Tech Stack

- **Framework**: Next.js 15.5.9 (App Router)
- **Language**: TypeScript 5+ (strict mode, zero errors)
- **Styling**: Tailwind CSS 3.4+ with custom design system
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with `@supabase/ssr`
- **State Management**: React Server Components + Client Components as needed
- **Icons**: Heroicons (`@heroicons/react`)
- **Utilities**: `clsx`, `tailwind-merge`, `date-fns`

### 3. Design System: Compact Government-Style Minimalism

Apply the feed design system aesthetic to all admin UI components:

**Spacing**:
- Use `gap-2` (8px) or `gap-3` (12px) for element spacing
- Use `p-[10px]` for card padding
- Use `space-y-3` (12px) for vertical stacks
- Never exceed these values unless necessary for touch targets

**Typography**:
- Primary text: `text-xs` (12px)
- Headings: `text-sm` (14px) with `font-semibold` or `font-medium`
- Page titles: `text-base` (16px) or `text-lg` (18px) maximum
- Body text: `text-gray-600`
- Headings: `text-gray-900`
- Metadata: `text-gray-500`

**Visual Elements**:
- Cards: `border border-gray-200` with `rounded-md` (6px), `bg-white`
- Hover states: `hover:bg-gray-50`, `hover:text-gray-900` with `transition-colors`
- No shadows, gradients, or depth effects
- Icons: `w-3 h-3` (12px) or `w-4 h-4` (16px) maximum, `text-gray-500` → `text-gray-700` on hover

**Color Palette**:
- Limit to: `gray-50`, `gray-100`, `gray-200`, `gray-500`, `gray-600`, `gray-700`, `gray-900`
- Accent colors only when necessary for status indicators (success/error/warning)

**Interactions**:
- Subtle hover effects only (`hover:bg-gray-50`, `hover:text-gray-900`)
- No transforms, scale effects, or animations beyond color transitions

### 4. Architecture & Code Organization

**Feature-Based Structure**:
```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          # Admin layout with navigation
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── accounts/           # Account management
│   │   ├── mentions/           # Mentions management
│   │   ├── posts/              # Posts management
│   │   ├── atlas/              # Atlas entities (cities, counties)
│   │   ├── faqs/               # FAQ management
│   │   └── analytics/          # Analytics dashboard
│   └── api/
│       └── admin/               # Admin API routes
├── features/
│   └── admin/
│       ├── components/          # Admin-specific UI components
│       ├── services/            # Admin services (extend BaseAdminService)
│       ├── hooks/               # Admin-specific hooks
│       └── types.ts             # Admin type definitions
├── components/
│   ├── ui/                      # Shared UI components (Modal, Button, etc.)
│   └── layout/                  # Layout components
└── lib/
    ├── authServer.ts            # Server auth utilities
    └── adminHelpers.ts         # Admin access helpers
```

**Service Pattern**:
- All admin services extend `BaseAdminService<T, CreateT, UpdateT>`
- Services use service role client for write operations (bypasses RLS)
- Services use authenticated client for read operations (respects RLS)
- Services handle auth retry logic via `withAuthRetry()`

**Component Pattern**:
- Server Components by default
- Client Components only when needed (interactivity, hooks, browser APIs)
- Use `'use client'` directive sparingly
- Type-safe props with TypeScript interfaces

### 5. Database Schema Understanding

**Core Tables**:
- `accounts`: User accounts with `role` enum ('general', 'admin')
- `mentions`: Location-based mentions with visibility settings
- `posts`: User posts with media attachments
- `atlas.cities`: City entities
- `atlas.counties`: County entities
- `faqs`: FAQ questions and answers
- `collections`: User collections for organizing content
- `pages`: Dynamic page content

**Admin Functions**:
- `is_admin()`: PostgreSQL function checking `accounts.role = 'admin'` for current user
- RLS policies allow admins to view/update all records via service role client

### 6. Admin Features to Implement

**Dashboard** (`/admin`):
- Overview statistics (total users, mentions, posts, etc.)
- Recent activity feed
- Quick actions
- System health indicators

**Account Management** (`/admin/accounts`):
- List all accounts with filters (role, status, date range)
- View account details
- Edit account information
- Change user roles (promote to admin, demote)
- View account activity (posts, mentions, views)

**Content Management**:
- **Mentions** (`/admin/mentions`): List, view, edit, archive, delete mentions
- **Posts** (`/admin/posts`): List, view, edit, moderate posts
- **FAQs** (`/admin/faqs`): CRUD operations for FAQ items

**Atlas Management** (`/admin/atlas`):
- Manage cities and counties
- Edit location data
- Update favorites
- Bulk operations

**Analytics** (`/admin/analytics`):
- User growth metrics
- Content statistics
- Engagement metrics
- Export capabilities

### 7. Code Quality Standards

**TypeScript**:
- Strict mode enabled
- Zero type errors
- Proper type definitions for all data structures
- Use generated Supabase types from `src/types/supabase.ts`

**Error Handling**:
- All async operations wrapped in try/catch
- User-friendly error messages
- Logging for debugging (console.error in development)
- Never expose internal errors to users

**Performance**:
- Server Components for data fetching
- Client Components only when necessary
- Optimistic updates where appropriate
- Proper loading states

**Security**:
- Never expose service role key to client
- Always verify admin status server-side
- Sanitize user inputs
- Use parameterized queries (Supabase handles this)

### 8. Development Setup

**Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server-side only)
- `NEXT_PUBLIC_SITE_URL`: Site URL for metadata

**Local Development**:
- Use existing Supabase local instance (if available)
- Or connect to production Supabase (with admin account)
- Run `npm run dev` to start development server
- Run `npm run type-check` to verify TypeScript

**Database Access**:
- Use existing migrations from `supabase/migrations/`
- Do not create new migrations unless adding admin-specific tables
- Use existing schema and RLS policies

### 9. Implementation Priorities

**Phase 1: Foundation**
1. Create admin layout with navigation
2. Implement admin dashboard with basic stats
3. Set up admin route protection
4. Create base admin components (DataTable, AdminCard, etc.)

**Phase 2: Account Management**
1. Account listing with filters
2. Account detail view
3. Account editing
4. Role management

**Phase 3: Content Management**
1. Mentions management
2. Posts management
3. FAQs management

**Phase 4: Advanced Features**
1. Atlas management
2. Analytics dashboard
3. Bulk operations
4. Export functionality

### 10. Key Files to Reference

**Authentication**:
- `src/lib/authServer.ts`: Server auth utilities
- `src/lib/adminHelpers.ts`: Admin access helpers
- `src/lib/supabaseServer.ts`: Supabase server clients

**Admin Services**:
- `src/features/admin/services/baseAdminService.ts`: Base service class
- `src/features/admin/services/cityAdminService.ts`: Example implementation
- `src/features/admin/services/countyAdminService.ts`: Example implementation

**Design System**:
- `docs/FEED_DESIGN_SYSTEM.md`: Complete design system documentation
- `tailwind.config.js`: Tailwind configuration
- `src/app/globals.css`: Global styles

**Architecture**:
- `docs/ARCHITECTURE_ORGANIZATION.md`: Code organization patterns
- `src/features/`: Existing feature implementations

### 11. Success Criteria

- All admin routes protected with proper authorization
- Admin UI follows compact government-style design system
- All CRUD operations work correctly with proper error handling
- TypeScript compiles with zero errors
- Code follows existing architecture patterns
- Services extend BaseAdminService correctly
- RLS policies respected for reads, bypassed for writes (via service role)
- Responsive design (mobile-friendly)
- Loading and error states implemented
- Accessible UI (keyboard navigation, screen readers)

### 12. Notes

- This is a **new branch** - start fresh but follow existing patterns
- Reuse existing utilities and services where possible
- Maintain consistency with main application's code style
- Document any new patterns or conventions
- Test thoroughly with admin and non-admin accounts
- Ensure proper error handling for unauthorized access attempts

---

**Start by creating the admin layout, dashboard, and basic navigation structure. Then implement account management as the first feature.**


