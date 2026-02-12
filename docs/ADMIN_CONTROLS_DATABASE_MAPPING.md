# Admin Controls → Database Mapping

## Systems Tab

**Toggle "Visible" checkbox:**
- **Table:** `admin.system_visibility`
- **Column:** `is_visible` (BOOLEAN)
- **Action:** UPDATE `is_visible = true/false` WHERE `id = systemId`

**Toggle "Enabled" checkbox:**
- **Table:** `admin.system_visibility`
- **Column:** `is_enabled` (BOOLEAN)
- **Action:** UPDATE `is_enabled = true/false` WHERE `id = systemId`

**Both also update:**
- **Column:** `updated_at` (TIMESTAMPTZ)

---

## Routes Tab

**Toggle "Published" checkbox:**
- **Table:** `admin.draft_routes` (TODO - doesn't exist yet)
- **Column:** `is_draft` (BOOLEAN)
- **Action:** UPDATE `is_draft = true/false` WHERE `route_path = routePath`

**Current Status:** Returns success but doesn't persist. Needs `admin.draft_routes` table:
```sql
CREATE TABLE admin.draft_routes (
  route_path TEXT PRIMARY KEY,
  is_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Navigation Tab

**Toggle "Visible" checkbox:**
- **Table:** `admin.navigation_items` (TODO - doesn't exist yet)
- **Column:** `is_visible` (BOOLEAN)
- **Action:** UPDATE `is_visible = true/false` WHERE `id = itemId`

**Current Status:** Returns success but doesn't persist. Needs `admin.navigation_items` table:
```sql
CREATE TABLE admin.navigation_items (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  location TEXT NOT NULL, -- 'left', 'right', 'header', 'footer'
  is_visible BOOLEAN DEFAULT true,
  requires_auth BOOLEAN DEFAULT false,
  requires_feature TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Tab

**Toggle "Enabled" checkbox:**
- **Table:** `admin.api_routes` (TODO - doesn't exist yet)
- **Column:** `is_enabled` (BOOLEAN)
- **Action:** UPDATE `is_enabled = true/false` WHERE `route_path = routePath` AND `method = method`

**Current Status:** Returns success but doesn't persist. Needs `admin.api_routes` table:
```sql
CREATE TABLE admin.api_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path TEXT NOT NULL,
  method TEXT NOT NULL, -- 'GET', 'POST', 'PATCH', 'DELETE'
  is_enabled BOOLEAN DEFAULT true,
  requires_auth BOOLEAN DEFAULT false,
  requires_feature TEXT,
  system TEXT, -- 'core', 'maps', 'feeds', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(route_path, method)
);
```

---

## Platform Settings Tab

**Toggle "Maintenance Mode":**
- **Table:** `admin.platform_settings` (TODO - doesn't exist yet)
- **Column:** `maintenance_mode` (BOOLEAN)
- **Action:** UPDATE `maintenance_mode = true/false`

**Update "Maintenance Message":**
- **Table:** `admin.platform_settings`
- **Column:** `maintenance_message` (TEXT)
- **Action:** UPDATE `maintenance_message = '...'`

**Toggle "Allow New Registrations":**
- **Table:** `admin.platform_settings`
- **Column:** `allow_new_registrations` (BOOLEAN)
- **Action:** UPDATE `allow_new_registrations = true/false`

**Toggle "Allow New Maps":**
- **Table:** `admin.platform_settings`
- **Column:** `allow_new_maps` (BOOLEAN)
- **Action:** UPDATE `allow_new_maps = true/false`

**Toggle "Allow New Pins":**
- **Table:** `admin.platform_settings`
- **Column:** `allow_new_pins` (BOOLEAN)
- **Action:** UPDATE `allow_new_pins = true/false`

**Toggle "Require Email Verification":**
- **Table:** `admin.platform_settings`
- **Column:** `require_email_verification` (BOOLEAN)
- **Action:** UPDATE `require_email_verification = true/false`

**Update "Max Pins Per Map":**
- **Table:** `admin.platform_settings`
- **Column:** `max_pins_per_map` (INTEGER, nullable)
- **Action:** UPDATE `max_pins_per_map = <number> OR NULL`

**Update "Max Maps Per Account":**
- **Table:** `admin.platform_settings`
- **Column:** `max_maps_per_account` (INTEGER, nullable)
- **Action:** UPDATE `max_maps_per_account = <number> OR NULL`

**Current Status:** Returns success but doesn't persist. Needs `admin.platform_settings` table:
```sql
CREATE TABLE admin.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Or single-row approach:
CREATE TABLE admin.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT,
  allow_new_registrations BOOLEAN DEFAULT true,
  allow_new_maps BOOLEAN DEFAULT true,
  allow_new_pins BOOLEAN DEFAULT true,
  require_email_verification BOOLEAN DEFAULT false,
  max_pins_per_map INTEGER,
  max_maps_per_account INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Insert single row: INSERT INTO admin.platform_settings (id) VALUES (gen_random_uuid());
```

---

## Summary

**Currently Working:**
- ✅ Systems Tab → `admin.system_visibility` (`is_visible`, `is_enabled`)

**Needs Database Tables:**
- ❌ Routes Tab → `admin.draft_routes` table needed
- ❌ Navigation Tab → `admin.navigation_items` table needed
- ❌ API Tab → `admin.api_routes` table needed
- ❌ Platform Settings Tab → `admin.platform_settings` table needed
