# Civic Wiki Edit System

## Overview

The civic tables (orgs, people, roles) are now community-editable with full audit logging. All edits are tracked in a single `civic.events` table, preserving complete history while allowing real-time updates.

## Architecture

### Single Events Table

All edits are logged to `civic.events` with:
- `table_name`: Which table was edited ('orgs', 'people', 'roles')
- `record_id`: The UUID of the record edited
- `field_name`: Which field was changed
- `account_id`: Who made the edit (references accounts table)
- `old_value`: What the value was before
- `new_value`: What the value is now
- `created_at`: When the edit was made

### Editable Fields

**Orgs:**
- `description` (TEXT)
- `website` (TEXT)

**People:**
- `photo_url` (TEXT)
- `party` (TEXT)
- `district` (TEXT)
- `email` (TEXT)
- `phone` (TEXT)
- `address` (TEXT)

**Roles:**
- `title` (TEXT)
- `start_date` (DATE)
- `end_date` (DATE)
- `is_current` (BOOLEAN)

**Note:** Core fields like `id`, `name`, `slug`, `parent_id`, `person_id`, `org_id` are NOT editable by community (admin-only).

## Implementation

### Database Function

Use `civic.log_event()` function to log changes:

```sql
SELECT civic.log_event(
  'orgs',                    -- table_name
  'uuid-of-org',            -- record_id
  'description',            -- field_name
  'uuid-of-account',        -- account_id
  'Old description',        -- old_value
  'New description'         -- new_value
);
```

### Application Pattern

When updating a record, log the event:

```typescript
// 1. Get current value
const current = await supabase
  .from('orgs')
  .select('description')
  .eq('id', orgId)
  .single();

// 2. Update the record
const { error } = await supabase
  .from('orgs')
  .update({ description: newValue })
  .eq('id', orgId);

// 3. Log the event
if (!error) {
  await supabase.rpc('log_event', {
    p_table_name: 'orgs',
    p_record_id: orgId,
    p_field_name: 'description',
    p_account_id: accountId,
    p_old_value: current.data.description,
    p_new_value: newValue
  });
}
```

### Helper Function (Recommended)

Create a wrapper function that handles both update and logging:

```typescript
async function updateCivicField(
  table: 'orgs' | 'people' | 'roles',
  recordId: string,
  field: string,
  newValue: string | null,
  accountId: string
) {
  const supabase = useSupabaseClient();
  
  // Get current value
  const { data: current } = await supabase
    .from(table)
    .select(field)
    .eq('id', recordId)
    .single();
  
  const oldValue = current?.[field] || null;
  
  // Update record
  const { error } = await supabase
    .from(table)
    .update({ [field]: newValue })
    .eq('id', recordId);
  
  if (error) throw error;
  
  // Log event (only if value actually changed)
  if (oldValue !== newValue) {
    await supabase.rpc('log_event', {
      p_table_name: table,
      p_record_id: recordId,
      p_field_name: field,
      p_account_id: accountId,
      p_old_value: oldValue,
      p_new_value: newValue
    });
  }
}
```

## Querying Edit History

### Get all edits for a record

```sql
SELECT 
  e.*,
  a.username,
  a.first_name,
  a.last_name
FROM civic.events e
LEFT JOIN public.accounts a ON e.account_id = a.id
WHERE e.table_name = 'orgs' 
  AND e.record_id = 'uuid-of-org'
ORDER BY e.created_at DESC;
```

### Get recent edits by a user

```sql
SELECT * FROM civic.events
WHERE account_id = 'uuid-of-account'
ORDER BY created_at DESC
LIMIT 50;
```

### Get edit history for a field

```sql
SELECT * FROM civic.events
WHERE table_name = 'orgs'
  AND record_id = 'uuid-of-org'
  AND field_name = 'description'
ORDER BY created_at DESC;
```

## UI Components

### Edit History Display

Show edit history in a component:

```typescript
const EditHistory = ({ tableName, recordId }) => {
  const { data: events } = useQuery({
    queryKey: ['civic-events', tableName, recordId],
    queryFn: () => supabase
      .from('civic_events')
      .select('*')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
  });
  
  return (
    <div>
      {events?.map(event => (
        <div key={event.id}>
          <span>{event.account_username}</span>
          <span>changed {event.field_name}</span>
          <span>from "{event.old_value}"</span>
          <span>to "{event.new_value}"</span>
          <span>{formatDate(event.created_at)}</span>
        </div>
      ))}
    </div>
  );
};
```

## Security

- **Read**: Anyone can view events (public edit history)
- **Write**: Only authenticated users can insert events
- **Update**: Authenticated users can update editable fields on orgs/people/roles
- **Admin**: Service role has full access to all tables

## Benefits

1. **Simple**: Single table for all edit tracking
2. **Complete**: Never loses data - full history preserved
3. **Transparent**: Public edit log shows who changed what
4. **Realtime**: Updates happen immediately, events logged asynchronously
5. **Flexible**: Easy to add new editable fields or tables

## Future Enhancements

- Add `edit_reason` or `edit_comment` field for edit summaries
- Add `reverted` boolean to track if an edit was undone
- Add `edit_type` enum ('create', 'update', 'delete') for more granular tracking
- Add diff view showing before/after side-by-side
- Add edit approval workflow for sensitive fields

