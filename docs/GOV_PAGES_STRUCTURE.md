# Gov Pages Structure & Hierarchy

## Overview

The Minnesota Government Directory is organized into a hierarchical structure with main pages, detail pages, branch pages, and administrative interfaces.

---

## Route Structure

```
/gov
├── /gov                          # Main directory page (tables view)
├── /gov/admin                    # Admin interface (full editing)
├── /gov/org/[slug]               # Organization detail page
├── /gov/person/[slug]            # Person detail page
├── /gov/legislative              # Legislative branch page
├── /gov/executive                # Executive branch page
├── /gov/judicial                 # Judicial branch page
└── /gov/checkbook                # State checkbook (financial data)
    ├── /gov/checkbook/budget
    ├── /gov/checkbook/payments
    ├── /gov/checkbook/payroll
    └── /gov/checkbook/contracts
```

---

## Page Hierarchy

### Level 1: Main Entry Point

#### `/gov` - Main Directory Page
**File**: `src/app/gov/page.tsx`  
**Component**: `GovTablesClient.tsx`

**Purpose**: Primary entry point for the government directory

**Features**:
- Community banner explaining community-built nature
- Three tabbed tables:
  - **Orgs Table**: All organizations
  - **People Table**: All people/officials
  - **Roles Table**: All roles linking people to organizations
- Inline editing for authenticated users
- Links to detail pages
- Sign-in prompts for unauthenticated users

**Navigation**: Accessible from sidebar "Gov" menu item

---

### Level 2: Branch Pages

#### `/gov/legislative` - Legislative Branch
**File**: `src/app/gov/legislative/page.tsx`

**Purpose**: Display legislative branch organizations and structure

**Content**:
- Legislative branch overview
- Organization chart
- Links to individual organizations

#### `/gov/executive` - Executive Branch
**File**: `src/app/gov/executive/page.tsx`

**Purpose**: Display executive branch organizations and structure

**Content**:
- Executive branch overview
- Organization chart
- Links to individual organizations

#### `/gov/judicial` - Judicial Branch
**File**: `src/app/gov/judicial/page.tsx`

**Purpose**: Display judicial branch organizations and structure

**Content**:
- Judicial branch overview
- Organization chart
- Links to individual organizations

---

### Level 3: Detail Pages

#### `/gov/org/[slug]` - Organization Detail
**Files**:
- `src/app/gov/org/[slug]/page.tsx` (Server component)
- `src/app/gov/org/[slug]/OrgPageClient.tsx` (Client component)
- `src/app/gov/org/[slug]/OrgEditModal.tsx` (Edit modal)

**Purpose**: Display full details of a single organization

**Content**:
- Organization name, type, description
- Website link
- All current roles with people
- Child organizations (if any)
- Parent organization link (if any)
- Last edited indicator
- Full edit history with contributors
- Edit button (authenticated users)

**Features**:
- Community editing enabled
- Edit history visible to all
- Breadcrumb navigation

#### `/gov/person/[slug]` - Person Detail
**Files**:
- `src/app/gov/person/[slug]/page.tsx` (Server component)
- `src/app/gov/person/[slug]/PersonPageClient.tsx` (Client component)
- `src/app/gov/person/[slug]/PersonEditModal.tsx` (Edit modal)

**Purpose**: Display all roles a person holds across organizations

**Content**:
- Person name, party, photo
- Contact information (email, phone, address)
- All current roles across all orgs
- Grouped by organization
- Last edited indicator
- Full edit history with contributors
- Edit button (authenticated users)

**Features**:
- Community editing enabled
- Edit history visible to all
- Breadcrumb navigation

---

### Level 4: Administrative Interface

#### `/gov/admin` - Admin Interface
**Files**:
- `src/app/gov/admin/page.tsx`
- `src/app/gov/admin/GovAdminClient.tsx`
- `src/app/gov/admin/OrgTable.tsx`
- `src/app/gov/admin/PersonTable.tsx`
- `src/app/gov/admin/RoleTable.tsx`

**Purpose**: Full administrative editing interface

**Features**:
- Three tabbed tables (Orgs, People, Roles)
- Full editing access for admins
- Can edit all fields including admin-only fields
- Permission-based field editing
- Edit logging for editable fields
- Direct updates for admin-only fields

**Access**: Admin role required

---

### Level 5: Financial Data

#### `/gov/checkbook` - State Checkbook
**Files**:
- `src/app/gov/checkbook/page.tsx`
- `src/app/gov/checkbook/budget/page.tsx`
- `src/app/gov/checkbook/payments/page.tsx`
- `src/app/gov/checkbook/payroll/page.tsx`
- `src/app/gov/checkbook/contracts/page.tsx`

**Purpose**: Display state financial data

**Content**:
- Budget information
- Payment records
- Payroll data
- Contract information

---

## Component Architecture

### Core Components

#### `GovTablesClient.tsx`
**Location**: `src/app/gov/GovTablesClient.tsx`

**Purpose**: Main table view component

**Features**:
- Tabbed interface (Orgs, People, Roles)
- Inline editing for authenticated users
- Community banner
- Sign-in prompts
- Links to detail pages

#### `OrgPageClient.tsx`
**Location**: `src/app/gov/org/[slug]/OrgPageClient.tsx`

**Purpose**: Client-side functionality for org detail pages

**Features**:
- Edit modal management
- Edit history display
- Last edited indicator

#### `PersonPageClient.tsx`
**Location**: `src/app/gov/person/[slug]/PersonPageClient.tsx`

**Purpose**: Client-side functionality for person detail pages

**Features**:
- Edit modal management
- Edit history display
- Last edited indicator

---

### Shared Components

#### `EntityEditHistory.tsx`
**Location**: `src/features/civic/components/EntityEditHistory.tsx`

**Purpose**: Display complete edit history for an entity

**Features**:
- All edits (not just recent)
- Contributor list with edit counts
- Expandable/collapsible view
- Full before/after values

#### `LastEditedIndicator.tsx`
**Location**: `src/features/civic/components/LastEditedIndicator.tsx`

**Purpose**: Quick "last edited" display

**Features**:
- Shows who last edited
- Relative timestamp
- Compact display

#### `CommunityBanner.tsx`
**Location**: `src/features/civic/components/CommunityBanner.tsx`

**Purpose**: Prominent community messaging

**Features**:
- Explains community-built nature
- Sign-in prompt for unauthenticated users

#### `InlineEditField.tsx`
**Location**: `src/features/civic/components/InlineEditField.tsx`

**Purpose**: Inline editing component

**Features**:
- Click to edit
- Auto-save on blur
- Loading states
- Error handling

#### `ImageUpload.tsx`
**Location**: `src/features/civic/components/ImageUpload.tsx`

**Purpose**: Image upload for photos

**Features**:
- Drag and drop
- Click to upload
- Image preview
- Upload progress

---

## Navigation Flow

### Primary Navigation Paths

1. **Sidebar → Gov → Main Directory**
   - User clicks "Gov" in sidebar
   - Opens `/gov` main page
   - Sees three tabbed tables

2. **Main Directory → Organization Detail**
   - User clicks org name or slug in table
   - Navigates to `/gov/org/[slug]`
   - Sees full org details, roles, edit history

3. **Main Directory → Person Detail**
   - User clicks person name in table
   - Navigates to `/gov/person/[slug]`
   - Sees person details, all roles, edit history

4. **Detail Page → Edit**
   - Authenticated user clicks edit button
   - Opens edit modal
   - Can edit allowed fields
   - Changes logged to edit history

5. **Branch Pages → Organizations**
   - User navigates to `/gov/legislative`, `/gov/executive`, or `/gov/judicial`
   - Sees branch-specific organization chart
   - Can navigate to individual org detail pages

---

## Data Flow

### Reading Data

1. **Server Components** (`page.tsx` files)
   - Fetch data using `civicService.ts` functions
   - Pass data to client components
   - Handle metadata and SEO

2. **Client Components**
   - Receive initial data as props
   - Can fetch additional data client-side
   - Handle user interactions

### Writing Data

1. **Community Users**
   - Use `updateCivicFieldWithLogging()` for editable fields
   - Edits logged to `civic.events` table
   - Can only edit allowed fields

2. **Admin Users**
   - Use `updateCivicFieldWithLogging()` for editable fields
   - Use direct Supabase updates for admin-only fields
   - All edits logged for transparency

---

## File Structure

```
src/app/gov/
├── page.tsx                      # Main directory page
├── GovTablesClient.tsx           # Main tables component
├── GovContent.tsx                # Legacy content component
├── GovMindmapClient.tsx         # Legacy mindmap component
├── GovOrgChart.tsx              # Org chart component
│
├── admin/                        # Admin interface
│   ├── page.tsx
│   ├── GovAdminClient.tsx
│   ├── OrgTable.tsx
│   ├── PersonTable.tsx
│   ├── RoleTable.tsx
│   └── types.ts
│
├── org/[slug]/                   # Organization detail pages
│   ├── page.tsx
│   ├── OrgPageClient.tsx
│   └── OrgEditModal.tsx
│
├── person/[slug]/                # Person detail pages
│   ├── page.tsx
│   ├── PersonPageClient.tsx
│   └── PersonEditModal.tsx
│
├── legislative/                  # Branch pages
│   └── page.tsx
├── executive/
│   └── page.tsx
├── judicial/
│   └── page.tsx
│
├── checkbook/                    # Financial data
│   ├── page.tsx
│   ├── budget/page.tsx
│   ├── payments/page.tsx
│   ├── payroll/page.tsx
│   └── contracts/page.tsx
│
└── components/                    # Shared components
    ├── GovPageViewTracker.tsx
    ├── PowerHierarchy.tsx
    └── StateCheckbook.tsx
```

---

## Component Dependencies

### Main Directory Page
```
/gov/page.tsx (Server)
  └── GovTablesClient.tsx (Client)
      ├── CommunityBanner.tsx
      ├── InlineEditField.tsx
      ├── ImageUpload.tsx
      ├── EditableFieldBadge.tsx
      └── updateCivicFieldWithLogging()
```

### Organization Detail Page
```
/gov/org/[slug]/page.tsx (Server)
  ├── OrgPageClient.tsx (Client)
  │   ├── EditButton.tsx
  │   ├── OrgEditModal.tsx
  │   ├── LastEditedIndicator.tsx
  │   └── EntityEditHistory.tsx
  └── OrgChart.tsx
```

### Person Detail Page
```
/gov/person/[slug]/page.tsx (Server)
  ├── PersonPageClient.tsx (Client)
  │   ├── EditButton.tsx
  │   ├── PersonEditModal.tsx
  │   ├── LastEditedIndicator.tsx
  │   └── EntityEditHistory.tsx
  └── PersonAvatar.tsx
```

### Admin Interface
```
/gov/admin/page.tsx (Server)
  └── GovAdminClient.tsx (Client)
      ├── OrgTable.tsx
      ├── PersonTable.tsx
      ├── RoleTable.tsx
      └── updateCivicFieldWithLogging()
```

---

## Services Layer

### `civicService.ts`
**Location**: `src/features/civic/services/civicService.ts`

**Functions**:
- `getCivicOrgs()` - Fetch all organizations
- `getCivicPeople()` - Fetch all people
- `getCivicRoles()` - Fetch all roles with joins
- `getCivicOrgTree()` - Build organizational hierarchy
- `getCivicPersonBySlug()` - Get person with roles
- `getCivicOrgBySlug()` - Get org with roles and children

### `civicEditLogger.ts`
**Location**: `src/features/civic/utils/civicEditLogger.ts`

**Functions**:
- `updateCivicFieldWithLogging()` - Single field update with logging
- `updateCivicFieldsWithLogging()` - Multiple fields with logging
- `getCivicEditHistory()` - Get edit history for record
- `getUserCivicEdits()` - Get user's edit history

### `permissions.ts`
**Location**: `src/features/civic/utils/permissions.ts`

**Functions**:
- `isFieldEditable()` - Check if field is editable
- `getEditableFields()` - Get list of editable fields
- `getAdminOnlyFields()` - Get admin-only fields

---

## URL Patterns

### Static Routes
- `/gov` - Main directory
- `/gov/admin` - Admin interface
- `/gov/legislative` - Legislative branch
- `/gov/executive` - Executive branch
- `/gov/judicial` - Judicial branch
- `/gov/checkbook` - State checkbook

### Dynamic Routes
- `/gov/org/[slug]` - Organization by slug
- `/gov/person/[slug]` - Person by slug

### Nested Routes
- `/gov/checkbook/budget`
- `/gov/checkbook/payments`
- `/gov/checkbook/payroll`
- `/gov/checkbook/contracts`

---

## Access Control

### Public Access
- ✅ View all pages
- ✅ View all data
- ✅ View edit history
- ✅ View contributor information

### Authenticated Users
- ✅ All public access
- ✅ Edit allowed fields
- ✅ Upload images
- ✅ View own edit history

### Admin Users
- ✅ All authenticated access
- ✅ Edit all fields (including admin-only)
- ✅ Access admin interface
- ✅ Full data management

---

## Summary

The gov system is organized in a clear hierarchy:

1. **Main Directory** (`/gov`) - Entry point with tables
2. **Branch Pages** (`/gov/legislative`, etc.) - Branch-specific views
3. **Detail Pages** (`/gov/org/[slug]`, `/gov/person/[slug]`) - Individual entity pages
4. **Admin Interface** (`/gov/admin`) - Full editing access
5. **Financial Data** (`/gov/checkbook/*`) - State financial information

All pages support community editing with full audit trails, making it a transparent, community-maintained directory of Minnesota government.

