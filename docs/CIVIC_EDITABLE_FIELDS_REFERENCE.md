# Civic Editable Fields Reference

## Quick Reference Table

| Table | Field | Editable by Community | Editable by Admin | Data Type | Notes |
|-------|-------|------------------------|-------------------|-----------|-------|
| **orgs** | `id` | ❌ | ✅ | UUID | Primary key |
| **orgs** | `name` | ❌ | ✅ | TEXT | Core identifier |
| **orgs** | `slug` | ❌ | ✅ | TEXT | URL identifier |
| **orgs** | `org_type` | ❌ | ✅ | ENUM | branch/agency/department/court |
| **orgs** | `parent_id` | ❌ | ✅ | UUID | Relationship |
| **orgs** | `description` | ✅ | ✅ | TEXT | **Community editable** |
| **orgs** | `website` | ✅ | ✅ | TEXT | **Community editable** |
| **orgs** | `created_at` | ❌ | ❌ | TIMESTAMPTZ | System field |
| **people** | `id` | ❌ | ✅ | UUID | Primary key |
| **people** | `name` | ❌ | ✅ | TEXT | Core identifier |
| **people** | `slug` | ❌ | ✅ | TEXT | URL identifier |
| **people** | `photo_url` | ✅ | ✅ | TEXT | **Community editable** |
| **people** | `party` | ✅ | ✅ | TEXT | **Community editable** |
| **people** | `district` | ✅ | ✅ | TEXT | **Community editable** |
| **people** | `email` | ✅ | ✅ | TEXT | **Community editable** |
| **people** | `phone` | ✅ | ✅ | TEXT | **Community editable** |
| **people** | `address` | ✅ | ✅ | TEXT | **Community editable** |
| **people** | `created_at` | ❌ | ❌ | TIMESTAMPTZ | System field |
| **roles** | `id` | ❌ | ✅ | UUID | Primary key |
| **roles** | `person_id` | ❌ | ✅ | UUID | Relationship |
| **roles** | `org_id` | ❌ | ✅ | UUID | Relationship |
| **roles** | `title` | ✅ | ✅ | TEXT | **Community editable** |
| **roles** | `start_date` | ✅ | ✅ | DATE | **Community editable** |
| **roles** | `end_date` | ✅ | ✅ | DATE | **Community editable** |
| **roles** | `is_current` | ✅ | ✅ | BOOLEAN | **Community editable** |
| **roles** | `created_at` | ❌ | ❌ | TIMESTAMPTZ | System field |

## Summary by Table

### Orgs (2 editable fields)
- ✅ `description`
- ✅ `website`

### People (6 editable fields)
- ✅ `photo_url`
- ✅ `party`
- ✅ `district`
- ✅ `email`
- ✅ `phone`
- ✅ `address`

### Roles (4 editable fields)
- ✅ `title`
- ✅ `start_date`
- ✅ `end_date`
- ✅ `is_current`

## Implementation Notes

1. **All edits must use `updateCivicFieldWithLogging()`** - Never update directly
2. **Check permissions before showing edit UI** - Use `isFieldEditable()` helper
3. **Log all changes** - Even admin edits should be logged for transparency
4. **Show edit history** - Display `EditHistory` component on detail pages
5. **Authenticate users** - Require sign-in for any edits

