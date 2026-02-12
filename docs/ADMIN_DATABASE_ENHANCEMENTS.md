# Admin Database Dashboard - Performance & UX Enhancements

## Priority 1: Core Performance & Usability (Immediate Impact)

### 1.1 Search & Filtering
**Current**: No search/filtering capability
**Enhancement**:
- **Global Search**: Search across all visible columns with debounced input
- **Column Filters**: Dropdown filters per column (text, number, date, enum)
- **Filter Presets**: Save common filter combinations
- **URL State**: Persist filters in URL query params for bookmarking

**Implementation**:
- Add `search` and `filters` query params to API route
- Extend `admin.query_table` RPC to accept WHERE clause conditions
- Client-side filter UI above table header

### 1.2 Column Sorting
**Current**: No sorting
**Enhancement**:
- Click column header to sort (asc/desc/toggle)
- Multi-column sorting (shift-click)
- Visual indicators (↑↓) in header
- Default sorting by primary key or `created_at`

**Implementation**:
- Add `orderBy` and `orderDirection` to API route
- Extend RPC function to accept ORDER BY clause

### 1.3 Smart Column Display
**Current**: All columns shown, truncated values
**Enhancement**:
- **Column Visibility Toggle**: Show/hide columns via dropdown
- **Column Width Control**: Resizable columns, auto-fit content
- **Column Pinning**: Pin important columns (id, name) to left
- **Data Type Awareness**: Format dates, JSON, URLs, UUIDs, booleans appropriately
- **Expandable Cells**: Click truncated cells to see full content in modal

**Implementation**:
- Store column preferences in localStorage
- Detect data types from sample values
- Format based on type (date formatting, JSON prettify, URL links)

### 1.4 Virtual Scrolling / Infinite Scroll
**Current**: Pagination (100 rows/page)
**Enhancement**:
- Virtual scrolling for tables with 1000+ rows
- Infinite scroll with loading states
- Keep pagination as fallback for smaller tables

**Implementation**:
- Use `react-window` or `@tanstack/react-virtual`
- Load more data as user scrolls

---

## Priority 2: Data Operations (High Value)

### 2.1 Inline Editing
**Current**: Read-only table
**Enhancement**:
- Double-click cell to edit inline
- Save individual cell changes
- Bulk edit selected rows
- Validation feedback (red border for invalid)
- Undo/redo support

**Implementation**:
- POST/PATCH endpoint for single cell updates
- Optimistic UI updates
- Show edit indicators (pencil icon, changed state)

### 2.2 Row Selection & Bulk Operations
**Current**: No selection
**Enhancement**:
- Checkbox column for row selection
- Select all/none
- Bulk delete with confirmation
- Bulk update (set field value for all selected)
- Export selected rows

**Implementation**:
- Selection state management
- Bulk API endpoints
- Confirmation modals for destructive actions

### 2.3 Export Functionality
**Current**: No export
**Enhancement**:
- Export visible/filtered data as CSV
- Export as JSON
- Export selected rows only
- Include current filters in export

**Implementation**:
- Client-side CSV generation
- Download via blob URL

### 2.4 Quick Actions Menu
**Current**: No row actions
**Enhancement**:
- Right-click context menu per row
- Actions: Edit, Delete, Duplicate, View Details
- Keyboard shortcuts (Delete key, Ctrl+D duplicate)

---

## Priority 3: Data Intelligence (Medium Priority)

### 3.1 Relationship Visualization
**Current**: No FK awareness
**Enhancement**:
- Detect foreign keys from column names (`*_id`, `*_uuid`)
- Click FK cell → show related record in sidebar/modal
- Show "Related Records" panel (e.g., all pins for a map)
- Visual FK indicators (🔗 icon)

**Implementation**:
- Query `information_schema` for FK constraints
- Related records API endpoint
- Sidebar panel for related data

### 3.2 Table Metadata Panel
**Current**: No metadata shown
**Enhancement**:
- Show table info: row count, size, indexes, constraints
- Column details: type, nullable, default, FK relationships
- Performance metrics: query time, slow query warnings
- Index suggestions for frequently filtered columns

**Implementation**:
- Query `pg_stat_user_tables` for size/stats
- Query `information_schema.columns` for column metadata
- Sidebar or collapsible panel

### 3.3 Data Validation Indicators
**Current**: No validation feedback
**Enhancement**:
- Highlight invalid data (NULL in NOT NULL columns, invalid UUIDs)
- Show constraint violations
- Data quality score per table
- Missing required fields indicator

---

## Priority 4: Advanced Features (Nice to Have)

### 4.1 Query Builder
**Enhancement**:
- Visual SQL query builder
- Save custom queries
- Execute raw SQL (with safety checks)

### 4.2 Audit Trail Integration
**Enhancement**:
- Show `created_at`, `updated_at`, `created_by` columns prominently
- Click to view edit history
- Highlight recently modified rows

### 4.3 Data Comparison
**Enhancement**:
- Compare two rows side-by-side
- Diff view for changes
- Version history (if audit table exists)

### 4.4 Advanced Filtering
**Enhancement**:
- Date range pickers
- Numeric range sliders
- Multi-select dropdowns for enums
- Regex search
- NULL/NOT NULL filters

---

## Implementation Order (Recommended)

**Phase 1** (Week 1):
1. Column sorting
2. Global search
3. Column visibility toggle
4. Better data formatting (dates, JSON, URLs)

**Phase 2** (Week 2):
5. Column filters
6. Row selection
7. Bulk delete
8. Export CSV

**Phase 3** (Week 3):
9. Inline editing
10. Relationship visualization
11. Table metadata panel

**Phase 4** (Week 4):
12. Virtual scrolling
13. Advanced filtering
14. Query performance indicators

---

## Technical Considerations

### Database Functions Needed
- Extend `admin.query_table` to accept:
  - `p_where_clause TEXT` (for filters)
  - `p_order_by TEXT` (for sorting)
  - `p_search TEXT` (for global search)

### Performance Optimizations
- Add indexes on commonly filtered columns (detect via usage)
- Cache table metadata (refresh on schema change)
- Debounce search inputs (300ms)
- Lazy load related records

### Security
- Validate all filter/order inputs server-side
- Sanitize search terms (prevent SQL injection)
- Rate limit bulk operations
- Audit log all admin data modifications

### UI/UX Patterns
- Follow feed design system (compact, minimal)
- Use existing color scheme (gray scale, lake-blue accents)
- Maintain consistent spacing (`gap-2`, `p-[10px]`)
- Keyboard navigation support (arrow keys, tab, enter)
