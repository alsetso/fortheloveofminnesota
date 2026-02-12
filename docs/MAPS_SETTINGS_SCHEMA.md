# Maps Settings Schema

After dropping `memberships`, `reactions`, and `requests` tables, all map configuration is stored in `maps.maps.settings` JSONB column.

## Settings Structure

```typescript
interface MapSettings {
  // Membership settings (if needed in future)
  auto_approve_members?: boolean;
  membership_rules?: string;
  membership_questions?: string[];
  
  // Map behavior
  allow_pins?: boolean;
  allow_areas?: boolean;
  pin_permissions?: 'public' | 'members_only' | 'owner_only';
  area_permissions?: 'public' | 'members_only' | 'owner_only';
  
  // Display settings
  default_zoom?: number;
  default_center?: { lat: number; lng: number };
  map_style?: string;
  
  // Custom settings
  [key: string]: any;
}
```

## Usage Examples

### Reading Settings

```typescript
const { data: map } = await supabase
  .schema('maps')
  .from('maps')
  .select('id, name, settings')
  .eq('slug', 'live')
  .single();

const settings = map.settings || {};
const autoApprove = settings.auto_approve_members ?? false;
```

### Updating Settings

```typescript
await supabase
  .schema('maps')
  .from('maps')
  .update({
    settings: {
      ...map.settings,
      auto_approve_members: true,
      pin_permissions: 'public',
    }
  })
  .eq('id', mapId);
```

## Migration Notes

- **Dropped Tables:**
  - `maps.memberships`
  - `maps.reactions`
  - `maps.requests`
  - `maps.membership_requests`

- **RLS Policies Updated:**
  - `maps.maps` SELECT policy: Removed membership checks
  - `maps.pins` SELECT policy: Removed membership checks

- **Simplified Access Control:**
  - Public/unlisted maps: Visible to everyone
  - Private maps: Only visible to owner
  - Pins: Follow map visibility + pin-level `visibility` field
