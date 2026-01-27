# Map Pin Sidebar Data & Actions Specification

## Pin Data Fields to Display

Based on `map_pins` schema and current implementation:

### **Core Content**
- `emoji` - Emoji icon (display as large icon, fallback: 📍)
- `caption` - Pin caption/name (primary text)
- `description` - Additional description text (if different from caption)
- `image_url` - Photo/image (if present)
- `video_url` - Video (if present)
- `media_type` - 'image' | 'video' | 'none' (determines what to show)

### **Location Data**
- `lat`, `lng` - Coordinates (display as formatted lat/lng)
- `full_address` - Reverse geocoded address (if available)
- `map_meta` - JSON metadata with place details (if available)
- `atlas_meta` - Atlas entity metadata (if available)

### **Metadata**
- `account_id` - Pin owner (fetch account info: username, image_url, first_name)
- `created_at` - Creation date (format: "Month Day, Year")
- `updated_at` - Last update date
- `view_count` - Number of views (if available)

### **Optional/Conditional**
- `collection_id` - Collection info (if linked)
- `mention_type_id` - Mention type info (if linked)
- `post_date` - Event date (if different from created_at)

---

## Action Icons Based on User Role

### **Map Owner** (owns the map)
**Actions Available:**
- ✏️ **Edit** - Edit pin (emoji, caption, image, video, coordinates)
- 🗑️ **Delete** - Delete pin (with confirmation)

**Icon Location:** Header (right side, next to close button)

### **Pin Owner** (created the pin, but not map owner)
**Actions Available:**
- ❌ **None** - View only (API only allows map owner to edit/delete)

**Icon Location:** No action icons shown

### **Viewer** (not owner of map or pin)
**Actions Available:**
- ❌ **None** - View only

**Icon Location:** No action icons shown

---

## Implementation Notes

### **API Permissions** (from `/api/maps/[id]/pins/[pinId]/route.ts`)
- **GET**: Anyone can view (RLS handles visibility)
- **PUT**: Map owner only
- **DELETE**: Map owner only

**Important:** Pin ownership (`account_id`) does NOT grant edit/delete permissions. Only map ownership does.

### **Sidebar Header Actions**
```tsx
// Map owner sees:
<EditIcon /> <DeleteIcon /> <CloseIcon />

// Pin owner or viewer sees:
<CloseIcon />
```

### **Data Fetching**
When pin is clicked, fetch:
```typescript
{
  id, emoji, caption, description,
  image_url, video_url, media_type,
  lat, lng, full_address, map_meta, atlas_meta,
  account_id, created_at, updated_at, view_count,
  collection_id, mention_type_id, post_date
}
```

Also fetch account info for `account_id`:
```typescript
{
  id, username, first_name, last_name, image_url
}
```

---

## Current Implementation Status

**EntityDetailSidebar** currently shows:
- ✅ Emoji
- ✅ Caption
- ✅ Media (image/video)
- ✅ Coordinates
- ❌ Missing: Account info, dates, address, view count
- ❌ Missing: Edit functionality
- ✅ Delete (map owner only, but needs confirmation UI)

**Next Steps:**
1. Add account info display (pin owner)
2. Add created/updated dates
3. Add full_address display
4. Add view_count display
5. Add Edit button/functionality (map owner only)
6. Improve delete confirmation UI
