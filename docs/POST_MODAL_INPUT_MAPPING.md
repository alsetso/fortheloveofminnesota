# Post Modal Input Mapping

This document maps modal input fields to their show/hide logic and database table columns.

## Input Field Mapping

| Modal Input | Pin Mode | Post Mode | Table | Column(s) | Required | Notes |
|------------|----------|-----------|-------|-----------|----------|-------|
| **Content/Description** | ✅ Show | ✅ Show | `map_pins`<br>`posts` | `description`<br>`content` | ✅ Pin<br>✅ Post | Pin uses `description`, Post uses `content` |
| **Title** | ❌ Hide | ✅ Show | `posts` | `title` | ❌ | Only available for posts |
| **Mention Type Selector** | ✅ Show (Required) | ✅ Show (Optional) | `map_pins`<br>`posts` | `mention_type_id` | ✅ Pin<br>❌ Post | Pin requires selection, Post optional |
| **Map Selector** | ✅ Show | ✅ Show | `map_pins`<br>`posts` | `map_id` | ❌ | Optional for both, defaults to "live" map for pins |
| **Map View (Location)** | ✅ Show (Auto-opens, Required) | ✅ Show (Optional) | `map_pins`<br>`posts` | `lat`, `lng`<br>`map_data` | ✅ Pin<br>❌ Post | Pin stores in `lat`/`lng`, Post stores in `map_data` JSONB |
| **Photo/Video Upload** | ✅ Show | ✅ Show | `map_pins`<br>`posts` | `image_url`, `video_url`, `media_type`<br>`images` (JSONB) | ❌ | Pin: single media, Post: array in JSONB |
| **Mentions List** | ❌ Hide | ✅ Show | `posts` | `mention_ids` (JSONB array) | ❌ | Only posts can reference other mentions |
| **Location Button** | ❌ Hide | ✅ Show | N/A | N/A | N/A | Opens mentions list (post-only feature) |
| **Privacy/Visibility** | ✅ Show | ✅ Show | `map_pins`<br>`posts` | `visibility` | ✅ | Pin: `'public'` or `'only_me'`<br>Post: `'public'` or `'draft'` |

## Detailed Field Breakdown

### Content/Description
- **Pin Mode**: 
  - Field: `content` (state variable)
  - Maps to: `map_pins.description`
  - Required: ✅ Yes
  - Max length: 240 characters (UI limit)
  
- **Post Mode**:
  - Field: `content` (state variable)
  - Maps to: `posts.content`
  - Required: ✅ Yes
  - Max length: 10,000 characters (DB constraint)

### Title
- **Pin Mode**: 
  - Hidden ❌
  - Not stored
  
- **Post Mode**:
  - Field: `title` (state variable)
  - Maps to: `posts.title`
  - Required: ❌ No (nullable)
  - Max length: 200 characters (DB constraint)

### Mention Type
- **Pin Mode**:
  - Field: `selectedMentionTypeId`
  - Maps to: `map_pins.mention_type_id`
  - Required: ✅ Yes
  - Validation: Must select before submit
  
- **Post Mode**:
  - Field: `selectedMentionTypeId`
  - Maps to: `posts.mention_type_id`
  - Required: ❌ No (nullable)
  - Validation: Optional

### Map Selector
- **Pin Mode**:
  - Field: `selectedMapId`
  - Maps to: `map_pins.map_id`
  - Required: ❌ No
  - Default: "live" map (if not provided)
  
- **Post Mode**:
  - Field: `selectedMapId`
  - Maps to: `posts.map_id`
  - Required: ❌ No (nullable)
  - Default: null

### Map View / Location
- **Pin Mode**:
  - Field: `mapData` (state)
  - Maps to: 
    - `map_pins.lat` (required)
    - `map_pins.lng` (required)
    - `map_pins.map_meta` (JSONB: `{ type, geometry, screenshot }`)
  - Required: ✅ Yes
  - Auto-opens: ✅ Yes (when modal opens)
  - Validation: Must have `mapData.center.lat` and `mapData.center.lng`
  
- **Post Mode**:
  - Field: `mapData` (state)
  - Maps to: `posts.map_data` (JSONB)
  - Structure: `{ lat, lng, type, geometry, screenshot, address, place_name }`
  - Required: ❌ No (nullable)
  - Auto-opens: ❌ No

### Photo/Video Upload
- **Pin Mode**:
  - Field: `images` (state array)
  - Maps to:
    - `map_pins.image_url` (single image)
    - `map_pins.video_url` (single video)
    - `map_pins.media_type` (`'image'` | `'video'` | `'none'`)
  - Required: ❌ No
  - Limit: Only one media item (excludes map screenshot)
  - Restrictions: Cannot have both images and mentions selected
  
- **Post Mode**:
  - Field: `images` (state array)
  - Maps to: `posts.images` (JSONB array)
  - Structure: `[{ url, alt?, width?, height? }]`
  - Required: ❌ No (nullable)
  - Limit: Multiple images allowed
  - Restrictions: None (can combine with other media)

### Mentions List
- **Pin Mode**:
  - Hidden ❌
  - Not applicable (pins ARE mentions)
  
- **Post Mode**:
  - Field: `selectedMentionIds` (state array)
  - Maps to: `posts.mention_ids` (JSONB array of UUIDs)
  - Required: ❌ No (nullable)
  - References: `map_pins.id` values
  - Validation: All IDs must exist and be active

### Privacy/Visibility
- **Pin Mode**:
  - Field: `visibility` (state: `'public'` | `'draft'`)
  - Maps to: `map_pins.visibility`
  - Values: `'public'` | `'only_me'`
  - Required: ✅ Yes (defaults to `'public'`)
  - Conversion: `'draft'` → `'only_me'` for pins
  
- **Post Mode**:
  - Field: `visibility` (state: `'public'` | `'draft'`)
  - Maps to: `posts.visibility`
  - Values: `'public'` | `'draft'`
  - Required: ✅ Yes (defaults to `'public'`)

## Data Flow Summary

### Pin Creation Flow
```
Modal Inputs → Validation → MentionService.createMention() → map_pins table
```

**Required Fields:**
- `description` (from `content`)
- `lat`, `lng` (from `mapData.center`)
- `mention_type_id` (from `selectedMentionTypeId`)

**Optional Fields:**
- `map_id` (from `selectedMapId`, defaults to "live")
- `image_url`, `video_url`, `media_type` (from `images` array)
- `visibility` (from `visibility`, defaults to `'public'`)
- `map_meta` (from `mapData.geometry`, `mapData.type`, `mapData.screenshot`)

### Post Creation Flow
```
Modal Inputs → Validation → /api/posts → posts table
```

**Required Fields:**
- `content` (from `content`)

**Optional Fields:**
- `title` (from `title`, nullable)
- `mention_type_id` (from `selectedMentionTypeId`, nullable)
- `mention_ids` (from `selectedMentionIds`, nullable JSONB array)
- `map_id` (from `selectedMapId`, nullable)
- `images` (from `images`, nullable JSONB array)
- `map_data` (from `mapData`, nullable JSONB)
- `visibility` (from `visibility`, defaults to `'public'`)

## UI State Management

### Conditional Rendering Logic

```typescript
// Title input
{createMode === 'post' && showTitle && <TitleInput />}

// Mention type selector
<MentionTypeSelector required={createMode === 'pin'} />

// Mentions list
{createMode === 'post' && <MentionsList />}

// Location button (opens mentions list)
{createMode === 'post' && <LocationButton />}

// Map view auto-open
useEffect(() => {
  if (isOpen && createMode === 'pin' && !mapData?.center) {
    setShowMapView(true); // Auto-open for pins
  }
}, [isOpen, createMode, mapData]);
```

### Media Type Restrictions

**Pin Mode:**
- Only one media type allowed at a time
- If map selected → cannot add images/mentions
- If images selected → cannot add map/mentions
- If mentions selected → cannot add map/images

**Post Mode:**
- Multiple media types allowed simultaneously
- Can combine: images + map + mentions
- No restrictions

## Validation Rules

### Pin Mode Validation
```typescript
if (!content.trim()) {
  error: 'Please enter a description'
}
if (!mapData?.center?.lat || !mapData?.center?.lng) {
  error: 'Please select a location on the map'
}
if (!selectedMentionTypeId) {
  error: 'Please select a mention type'
}
```

### Post Mode Validation
```typescript
if (!content.trim()) {
  error: 'Please enter some content'
}
// All other fields are optional
```
