# Civic Wiki Edit System - Complete Frontend Implementation Plan

## Overview

This document outlines all frontend updates needed to implement community-editable civic tables (orgs, people, roles) with full audit logging via `civic.events` table.

## Editable Fields Summary

### Orgs Table
**Editable by Community:**
- `description` (TEXT)
- `website` (TEXT)

**Admin-Only (NOT editable by community):**
- `name`, `slug`, `org_type`, `parent_id`, `id`

### People Table
**Editable by Community:**
- `photo_url` (TEXT)
- `party` (TEXT)
- `district` (TEXT)
- `email` (TEXT)
- `phone` (TEXT)
- `address` (TEXT)

**Admin-Only (NOT editable by community):**
- `name`, `slug`, `id`

### Roles Table
**Editable by Community:**
- `title` (TEXT)
- `start_date` (DATE)
- `end_date` (DATE)
- `is_current` (BOOLEAN)

**Admin-Only (NOT editable by community):**
- `person_id`, `org_id`, `id`

---

## 1. Core Utility Updates

### ✅ Already Created
- `src/features/civic/utils/civicEditLogger.ts` - Helper functions for logging edits

### Required Updates
- **File**: `src/features/civic/utils/civicEditLogger.ts`
- **Action**: Verify function names match migration (`log_civic_event`)

---

## 2. Admin Components (Keep Admin-Only Editing)

### 2.1 GovAdminClient.tsx
**File**: `src/app/gov/admin/GovAdminClient.tsx`

**Current State**: Updates fields directly without logging

**Required Changes**:
1. Import `updateCivicFieldWithLogging` from `civicEditLogger`
2. Update `handleOrgUpdate` to:
   - Only allow editing of `description` and `website` for community
   - Use `updateCivicFieldWithLogging` for editable fields
   - Keep direct updates for admin-only fields (name, slug, org_type, parent_id)
   - Get `accountId` from auth context
3. Update `handlePersonUpdate` to:
   - Only allow editing of `photo_url`, `party`, `district`, `email`, `phone`, `address` for community
   - Use `updateCivicFieldWithLogging` for editable fields
   - Keep direct updates for admin-only fields (name, slug)
   - Get `accountId` from auth context
4. Update `handleRoleUpdate` to:
   - Only allow editing of `title`, `start_date`, `end_date`, `is_current` for community
   - Use `updateCivicFieldWithLogging` for editable fields
   - Keep direct updates for admin-only fields (person_id, org_id)
   - Get `accountId` from auth context

**Code Pattern**:
```typescript
import { updateCivicFieldWithLogging } from '@/features/civic/utils/civicEditLogger';
import { useAuthStateSafe } from '@/features/auth';

const { account } = useAuthStateSafe();

const handleOrgUpdate = async (id: string, field: keyof OrgRecord, value: string | null) => {
  const editableFields = ['description', 'website'];
  const isEditable = editableFields.includes(field);
  
  if (isEditable && account?.id) {
    // Use logging function for community-editable fields
    const { error } = await updateCivicFieldWithLogging({
      table: 'orgs',
      recordId: id,
      field,
      newValue: value,
      accountId: account.id,
      supabase
    });
    // ... error handling
  } else {
    // Direct update for admin-only fields (if user is admin)
    // ... existing admin update logic
  }
};
```

### 2.2 OrgTable.tsx
**File**: `src/app/gov/admin/OrgTable.tsx`

**Required Changes**:
1. Disable editing for admin-only fields (`name`, `slug`, `org_type`, `parent_id`) unless user is admin
2. Add visual indicator (read-only styling) for non-editable fields
3. Keep existing editable cell functionality for editable fields

### 2.3 PersonTable.tsx
**File**: `src/app/gov/admin/PersonTable.tsx`

**Required Changes**:
1. Disable editing for admin-only fields (`name`, `slug`) unless user is admin
2. Add visual indicator for non-editable fields
3. Keep existing editable cell functionality for editable fields

### 2.4 RoleTable.tsx
**File**: `src/app/gov/admin/RoleTable.tsx`

**Required Changes**:
1. Disable editing for admin-only fields (`person_id`, `org_id`) unless user is admin
2. Add visual indicator for non-editable fields
3. Keep existing editable cell functionality for editable fields

---

## 3. Public View Components (Make Editable)

### 3.1 GovTablesClient.tsx
**File**: `src/app/gov/GovTablesClient.tsx`

**Current State**: Read-only display tables

**Required Changes**:
1. Add edit functionality to make tables editable
2. Import `updateCivicFieldWithLogging` and `useAuthStateSafe`
3. Add "Edit" buttons or inline editing for editable fields
4. Show edit history component (see section 5)
5. Add authentication check - show "Sign in to edit" if not authenticated

**Implementation**:
- Add edit mode toggle or inline editing
- Use `EditableCell` component for editable fields
- Use `updateCivicFieldWithLogging` for all updates
- Show edit button only for authenticated users
- Display edit history below each table

### 3.2 OrgPageClient.tsx
**File**: `src/app/gov/org/[slug]/OrgPageClient.tsx`

**Current State**: Admin-only edit button

**Required Changes**:
1. Remove admin check - show edit button for all authenticated users
2. Update `OrgEditModal` to only show editable fields (description, website)
3. Hide admin-only fields (name, slug, org_type) from modal
4. Use `updateCivicFieldsWithLogging` for bulk updates
5. Add edit history display component

**Code Changes**:
```typescript
// Remove: if (!isAdmin) return null;
// Change to: if (!account) return null; // Show sign in prompt

// Update modal to only show editable fields
```

### 3.3 PersonPageClient.tsx
**File**: `src/app/gov/person/[slug]/PersonPageClient.tsx`

**Current State**: Admin-only edit button

**Required Changes**:
1. Remove admin check - show edit button for all authenticated users
2. Update `PersonEditModal` to only show editable fields
3. Hide admin-only fields (name, slug) from modal or make read-only
4. Use `updateCivicFieldsWithLogging` for bulk updates
5. Add edit history display component

### 3.4 OrgEditModal.tsx
**File**: `src/app/gov/org/[slug]/OrgEditModal.tsx`

**Current State**: Shows all fields including admin-only

**Required Changes**:
1. Add `isAdmin` prop to determine which fields to show
2. Hide or disable `name`, `slug`, `org_type` fields for non-admin users
3. Only show `description` and `website` for community users
4. Replace direct update with `updateCivicFieldsWithLogging`
5. Get `accountId` from auth context

**Code Pattern**:
```typescript
interface OrgEditModalProps {
  isOpen: boolean;
  org: CivicOrg;
  onClose: () => void;
  onSave: () => void;
  isAdmin?: boolean; // NEW
}

// In component:
const { account } = useAuthStateSafe();
const showAdminFields = isAdmin ?? false;

// Conditionally render fields:
{showAdminFields && (
  <FormInput label="Name" ... />
  <FormInput label="Slug" ... />
  <FormSelect label="Type" ... />
)}
<FormTextarea label="Description" ... />
<FormInput label="Website" ... />
```

### 3.5 PersonEditModal.tsx
**File**: `src/app/gov/person/[slug]/PersonEditModal.tsx`

**Current State**: Shows all fields including admin-only

**Required Changes**:
1. Add `isAdmin` prop
2. Hide or disable `name`, `slug` fields for non-admin users
3. Show only editable fields for community users
4. Replace direct update with `updateCivicFieldsWithLogging`
5. Get `accountId` from auth context

---

## 4. New Components to Create

### 4.1 EditHistory Component
**File**: `src/features/civic/components/EditHistory.tsx`

**Purpose**: Display edit history for a civic record

**Props**:
```typescript
interface EditHistoryProps {
  tableName: 'orgs' | 'people' | 'roles';
  recordId: string;
  limit?: number;
}
```

**Features**:
- Fetch events from `civic_events` view
- Display in compact feed design system style
- Show: account username, field name, old value → new value, timestamp
- Format dates using existing date utilities
- Show "No edit history" if empty

**Design**:
- Compact list with `space-y-1.5`
- Each event: `text-xs`, `p-[10px]`, `border border-gray-200`
- Account name in `font-semibold text-gray-900`
- Field name in `text-gray-600`
- Values in `text-gray-700`
- Timestamp in `text-[10px] text-gray-500`

### 4.2 InlineEditField Component
**File**: `src/features/civic/components/InlineEditField.tsx`

**Purpose**: Inline editing for civic fields in public views

**Props**:
```typescript
interface InlineEditFieldProps {
  table: 'orgs' | 'people' | 'roles';
  recordId: string;
  field: string;
  value: string | null;
  label?: string;
  type?: 'text' | 'textarea' | 'url' | 'email' | 'tel' | 'date';
  accountId: string;
  onUpdate?: () => void;
}
```

**Features**:
- Click to edit, blur to save
- Uses `updateCivicFieldWithLogging`
- Shows loading state during save
- Error handling with toast
- Follows feed design system

### 4.3 EditableFieldBadge Component
**File**: `src/features/civic/components/EditableFieldBadge.tsx`

**Purpose**: Visual indicator that a field is editable

**Usage**: Show small "Edit" icon next to editable fields in public views

---

## 5. Public Table Views (GovTablesClient)

### 5.1 Make Tables Editable

**File**: `src/app/gov/GovTablesClient.tsx`

**Required Changes**:

1. **Add Authentication Check**:
   ```typescript
   const { account } = useAuthStateSafe();
   const isAuthenticated = !!account;
   ```

2. **Add Edit Handlers**:
   ```typescript
   const handleOrgFieldEdit = async (orgId: string, field: string, newValue: string | null) => {
     if (!account?.id) return;
     await updateCivicFieldWithLogging({
       table: 'orgs',
       recordId: orgId,
       field,
       newValue,
       accountId: account.id,
       supabase
     });
     // Refresh data
   };
   ```

3. **Replace Static Cells with InlineEditField**:
   - For orgs: `description`, `website` columns
   - For people: `photo_url`, `party`, `district`, `email`, `phone`, `address` columns
   - For roles: `title`, `start_date`, `end_date`, `is_current` columns

4. **Add Edit History Section**:
   - Below each table, show `EditHistory` component
   - Or add expandable "View Edit History" button

5. **Add Auth Prompt**:
   - Show "Sign in to edit" message if not authenticated
   - Link to sign in modal

---

## 6. Detail Page Updates

### 6.1 Org Detail Page
**File**: `src/app/gov/org/[slug]/page.tsx` and `OrgPageClient.tsx`

**Required Changes**:
1. Show edit button for all authenticated users (not just admin)
2. Add `EditHistory` component below org details
3. Make `description` and `website` inline-editable
4. Update `OrgEditModal` to respect admin vs community permissions

### 6.2 Person Detail Page
**File**: `src/app/gov/person/[slug]/page.tsx` and `PersonPageClient.tsx`

**Required Changes**:
1. Show edit button for all authenticated users
2. Add `EditHistory` component
3. Make editable fields inline-editable
4. Update `PersonEditModal` to respect permissions

---

## 7. UI/UX Enhancements

### 7.1 Visual Indicators

**Editable Fields**:
- Add small "Edit" icon (pencil) next to editable fields
- Hover state: `hover:bg-gray-50` on editable cells
- Cursor: `cursor-text` on editable fields

**Read-Only Fields**:
- Grayed out text: `text-gray-400`
- No hover effect
- Cursor: `cursor-default`

### 7.2 Edit States

**Loading State**:
- Show spinner or "Saving..." text during update
- Disable input during save

**Success State**:
- Brief success message or checkmark
- Auto-hide after 2 seconds

**Error State**:
- Show error message below field
- Use existing `ErrorToast` component

### 7.3 Authentication Prompts

**Not Signed In**:
- Show "Sign in to edit" button/link
- Opens account modal with sign in tab
- Place near editable fields

---

## 8. Permission System

### 8.1 Field-Level Permissions

**Create Helper Function**:
```typescript
// src/features/civic/utils/permissions.ts

export function isFieldEditable(
  table: 'orgs' | 'people' | 'roles',
  field: string,
  isAdmin: boolean
): boolean {
  const editableFields = {
    orgs: ['description', 'website'],
    people: ['photo_url', 'party', 'district', 'email', 'phone', 'address'],
    roles: ['title', 'start_date', 'end_date', 'is_current']
  };
  
  const adminOnlyFields = {
    orgs: ['name', 'slug', 'org_type', 'parent_id'],
    people: ['name', 'slug'],
    roles: ['person_id', 'org_id']
  };
  
  if (isAdmin) return true; // Admins can edit everything
  if (adminOnlyFields[table].includes(field)) return false;
  return editableFields[table].includes(field);
}
```

### 8.2 Component Permission Checks

**Pattern for All Edit Components**:
```typescript
const { account } = useAuthStateSafe();
const isAdmin = account?.role === 'admin';
const canEdit = isFieldEditable(table, field, isAdmin);

if (!canEdit && !isAdmin) {
  // Show read-only or hide field
}
```

---

## 9. Edit History Display

### 9.1 EditHistory Component Implementation

**Location**: `src/features/civic/components/EditHistory.tsx`

**Features**:
- Fetch from `civic_events` view
- Group by field or show chronologically
- Show account username/name
- Format: "username changed description from 'old' to 'new' 2 hours ago"
- Compact design system styling
- Expandable/collapsible for long histories

### 9.2 Integration Points

**Add to**:
1. `GovTablesClient.tsx` - Below each table
2. `OrgPageClient.tsx` - Below org details
3. `PersonPageClient.tsx` - Below person details
4. Admin pages - Show full history

---

## 10. Migration Checklist

### Phase 1: Core Infrastructure ✅
- [x] Create `civic.events` table migration
- [x] Create `log_civic_event` function
- [x] Create `civicEditLogger.ts` utility
- [x] Update RLS policies for authenticated updates

### Phase 2: Admin Components
- [ ] Update `GovAdminClient.tsx` to use logging
- [ ] Update `OrgTable.tsx` with permission checks
- [ ] Update `PersonTable.tsx` with permission checks
- [ ] Update `RoleTable.tsx` with permission checks

### Phase 3: Public Edit Components
- [ ] Create `EditHistory.tsx` component
- [ ] Create `InlineEditField.tsx` component
- [ ] Create `EditableFieldBadge.tsx` component
- [ ] Create `permissions.ts` utility

### Phase 4: Public Views
- [ ] Update `GovTablesClient.tsx` with inline editing
- [ ] Update `OrgPageClient.tsx` for community editing
- [ ] Update `PersonPageClient.tsx` for community editing
- [ ] Update `OrgEditModal.tsx` with field restrictions
- [ ] Update `PersonEditModal.tsx` with field restrictions

### Phase 5: UI Polish
- [ ] Add edit indicators to editable fields
- [ ] Add authentication prompts
- [ ] Add loading/success/error states
- [ ] Add edit history displays
- [ ] Test all edit flows

---

## 11. Testing Checklist

### Functional Tests
- [ ] Authenticated user can edit editable fields
- [ ] Non-authenticated user sees sign-in prompt
- [ ] Admin can edit all fields
- [ ] Community user cannot edit admin-only fields
- [ ] All edits are logged to `civic.events`
- [ ] Edit history displays correctly
- [ ] Multiple field updates work correctly
- [ ] Error handling works for failed updates

### UI Tests
- [ ] Edit indicators show on editable fields
- [ ] Hover states work correctly
- [ ] Loading states display during saves
- [ ] Success/error messages appear
- [ ] Edit history is readable and formatted correctly

---

## 12. Files Summary

### Files to Modify (15 files)
1. `src/app/gov/admin/GovAdminClient.tsx`
2. `src/app/gov/admin/OrgTable.tsx`
3. `src/app/gov/admin/PersonTable.tsx`
4. `src/app/gov/admin/RoleTable.tsx`
5. `src/app/gov/GovTablesClient.tsx`
6. `src/app/gov/org/[slug]/OrgPageClient.tsx`
7. `src/app/gov/org/[slug]/OrgEditModal.tsx`
8. `src/app/gov/person/[slug]/PersonPageClient.tsx`
9. `src/app/gov/person/[slug]/PersonEditModal.tsx`

### Files to Create (4 files)
1. `src/features/civic/components/EditHistory.tsx`
2. `src/features/civic/components/InlineEditField.tsx`
3. `src/features/civic/components/EditableFieldBadge.tsx`
4. `src/features/civic/utils/permissions.ts`

### Files Already Created ✅
1. `supabase/migrations/343_create_civic_events_audit_log.sql`
2. `src/features/civic/utils/civicEditLogger.ts`
3. `docs/CIVIC_WIKI_EDIT_SYSTEM.md`

---

## 13. Implementation Priority

### High Priority (Core Functionality)
1. Update admin components to use logging
2. Create `EditHistory` component
3. Create `InlineEditField` component
4. Update `GovTablesClient` with inline editing
5. Add permission checks

### Medium Priority (User Experience)
1. Update detail page edit modals
2. Add edit indicators
3. Add authentication prompts
4. Polish loading/error states

### Low Priority (Enhancements)
1. Edit history grouping/filtering
2. Edit diff visualization
3. Edit approval workflow (future)
4. Edit comments/reasons (future)

---

## 14. Key Design Decisions

### Single Events Table
- ✅ Simple, unified audit log
- ✅ Easy to query all edits
- ✅ No data loss - complete history

### Field-Level Permissions
- ✅ Clear separation: editable vs admin-only
- ✅ Community can improve data without breaking structure
- ✅ Admins retain full control

### Inline Editing
- ✅ Fast, intuitive editing
- ✅ No modal overhead for simple changes
- ✅ Matches wiki-style editing

### Edit History Display
- ✅ Transparent - shows who changed what
- ✅ Builds trust in community editing
- ✅ Allows reverting bad edits (future)

---

## 15. Code Patterns

### Update Pattern (All Components)
```typescript
import { updateCivicFieldWithLogging } from '@/features/civic/utils/civicEditLogger';
import { useAuthStateSafe } from '@/features/auth';
import { isFieldEditable } from '@/features/civic/utils/permissions';

const { account } = useAuthStateSafe();
const isAdmin = account?.role === 'admin';

const handleUpdate = async (recordId: string, field: string, newValue: string | null) => {
  if (!account?.id) {
    // Show sign in prompt
    return;
  }
  
  if (!isFieldEditable(table, field, isAdmin)) {
    // Show permission error
    return;
  }
  
  const { error } = await updateCivicFieldWithLogging({
    table,
    recordId,
    field,
    newValue,
    accountId: account.id,
    supabase
  });
  
  if (error) {
    // Show error toast
  } else {
    // Refresh data or update local state
  }
};
```

### Edit History Pattern
```typescript
import EditHistory from '@/features/civic/components/EditHistory';

<EditHistory 
  tableName="orgs" 
  recordId={org.id} 
  limit={10} 
/>
```

---

This completes the systematic frontend implementation plan for the civic wiki edit system.

