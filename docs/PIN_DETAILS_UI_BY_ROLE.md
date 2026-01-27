# Pin Details UI by Role

## UI Differences

### **Map Owner** (owns the map)
**Visible:**
- All pin details (description, location, media, badges, dates, view count)
- Edit button (menu)
- Delete button (menu)

**Actions:**
- Edit pin
- Delete pin
- Copy URL

### **Map Member** (not owner, but member of map)
**Visible:**
- All pin details (description, location, media, badges, dates, view count)
- Copy URL button (menu)

**Actions:**
- Copy URL only
- No edit/delete (API restricts to map owner only)

### **Pin Owner** (created the pin, but not map owner)
**Visible:**
- All pin details (description, location, media, badges, dates, view count)
- Copy URL button (menu)

**Actions:**
- Copy URL only
- No edit/delete (API restricts to map owner only)

### **Viewer** (not owner or member)
**Visible:**
- All pin details (description, location, media, badges, dates, view count)
- Copy URL button (menu)

**Actions:**
- Copy URL only

---

## Key Point

**All users see the same pin details** - the only difference is available actions:
- **Map Owner**: Can edit/delete
- **Everyone else**: View only (copy URL)

API enforces: Only map owners can edit/delete pins (not pin owners).
