# Map pin data fields and display options

## Main data fields in `map_pins` (and API)

From the schema, TypeScript types, and `GET /api/maps/[id]/pins/[pinId]`:

| Field | Type | Source | Display today |
|-------|------|--------|----------------|
| **id** | UUID | table | Used in URL `?pin=` |
| **map_id** | UUID | table | Context |
| **lat, lng** | number | table | Shown in footer (coordinates) |
| **account_id** | UUID | table | — |
| **account** | relation | API join | Username + profile image in footer |
| **description** | text | table | Shown as snippet in footer (or caption/emoji fallback) |
| **caption** | text | table | Fallback for snippet |
| **emoji** | text | table | Fallback for snippet |
| **image_url** | text | table | Not shown in footer |
| **video_url** | text | table | Not shown in footer |
| **media_type** | enum | table | Not shown |
| **full_address** | text | table | Not shown |
| **mention_type_id** | UUID | table | — |
| **mention_type** | relation | API join (id, emoji, name) | Not shown |
| **collection_id** | UUID | table | — |
| **collection** | relation | API join (id, emoji, title) | Not shown |
| **post_date** | timestamp | table | Not shown (used for year filter) |
| **event_date** | date | table | Not shown |
| **visibility** | enum | table | Not shown |
| **view_count** | int | table | Not shown |
| **created_at, updated_at** | timestamp | table | Not shown |
| **map_meta** | JSONB | table | Not shown |
| **atlas_meta** | JSONB | table | Not shown |
| **location_metadata** | (typed) | table | Not shown |
| **tagged_account_ids** | UUID[] | table | Not shown |
| **hide_location** | bool | table | Not shown |

So we **show in the footer today**: account (image + username), one text snippet (description/caption/emoji), and lat/lng. Everything else is available in the API but not displayed.

---

## What could be shown (“more details”)

Candidates for a “More details” surface (footer expansion or dedicated page):

- **Media**: `image_url`, `video_url` (thumbnail or inline).
- **Address**: `full_address`.
- **Type**: `mention_type` (emoji + name).
- **Collection**: `collection` (emoji + title).
- **Dates**: `event_date`, `post_date`, `created_at`.
- **Engagement**: `view_count` (if we want to show it).
- **Full text**: full `description` / `caption` (no truncation).
- **Location**: `map_meta` / `atlas_meta` if we ever show “placed on X” or similar.
- **Tagged people**: resolved from `tagged_account_ids` (if we add that to the API).

---

## Unique URL for each pin

**Current:** Pin is identified by query: `/live?pin=<pinId>`. Same layout as live map; footer shows the pin card. No dedicated route for “this pin only.”

**Possible unique URLs:**

1. **Query (current):** `/live?pin=<pinId>`  
   - One URL per pin, but not a “path” URL.
2. **Path on live:** `/live/pin/[pinId]`  
   - e.g. `/live/pin/550e8400-e29b-41d4-a716-446655440000`  
   - Unique, shareable, good for SEO if we add metadata.
3. **Global pin path:** `/pin/[pinId]`  
   - Pin-centric; map is secondary (redirect or embed live map with pin selected).

Recommendation: use **`/live/pin/[pinId]`** so the URL is clearly “live map, this pin,” and keep `/live?pin=<pinId>` as a supported alias that redirects or renders the same content.

---

## Option A: More details inside the app footer

**Idea:** Keep a single layout (live map + footer). Pin card has a “More details” control that expands the same card to show extra fields.

**Pros:**

- No navigation; user stays on the same view (map + footer).
- Same URL (`/live?pin=<pinId>`); no new routes.
- Quick to add: expand section or small accordion in `LivePinCard`.

**Cons:**

- Footer is small; media (image/video) and long text are cramped.
- Hard to get a “share this pin” URL that opens *only* the expanded details (still same page).
- Less good for SEO or “pin as landing page” (no dedicated document).

**Best for:** Power users who want a bit more context without leaving the map.

**Implementation sketch:**

- In `LivePinCard`, add state `detailsExpanded`.
- Button/link “More details” toggles it.
- When expanded, render under the current row: full_address, mention_type, collection, event_date, full description, optional small image/thumbnail, view_count.
- Optional: “Open full page” link to `/live/pin/[pinId]` if we add that route.

---

## Option B: Dedicated pin page (own URL)

**Idea:** New route, e.g. `/live/pin/[pinId]`, that shows the pin as the main content (and optionally the live map as context).

**Pros:**

- One unique URL per pin: `/live/pin/<uuid>` (or `/pin/<uuid>`). Easy to share, bookmark, and use in analytics.
- Full layout: large media, full description, all metadata, related links (author, collection, type).
- Can set title/OG meta per pin for SEO and link previews.
- Clear “pin as its own thing” without squeezing everything into the footer.

**Cons:**

- New route and page (or heavy reuse of a detail view).
- User leaves the “live map + footer” context when they open the link (unless we embed the map on the pin page).

**Best for:** Sharing a single pin, SEO, and “pin as landing page.”

**Implementation sketch:**

- Add `src/app/live/pin/[pinId]/page.tsx` (or `src/app/pin/[pinId]/page.tsx`).
- Page fetches pin by ID (reuse API `GET /api/maps/live/pins/[pinId]` or a generic pin-by-id endpoint).
- Layout: pin hero (image/video if any), title/snippet, full description, address, mention_type, collection, dates, view_count, link to author profile, “View on map” → `/live?pin=<pinId>`.
- Optional: small embedded map or “Open in live map” CTA.
- `generateMetadata` for title/description/OG using pin fields.

---

## Comparison summary

| | **More details in footer (A)** | **Dedicated pin page (B)** |
|--|--------------------------------|----------------------------|
| **URL** | Same: `/live?pin=<id>` | New: `/live/pin/<id>` (or `/pin/<id>`) |
| **Layout** | Expand in-place in footer | Full page (or modal that feels like a page) |
| **Best for** | Quick extra context on same screen | Sharing, SEO, “pin as its own thing” |
| **Effort** | Small (one component, optional “Open full page” link) | Medium (new route, fetch, layout, metadata) |
| **Media / long text** | Cramped | Room for full display |

**Suggested approach:** Do both.

1. **Short term:** Add “More details” in the footer (Option A) and list the main fields we don’t show yet (address, type, collection, dates, full description, optional thumbnail). Optionally add a “Open full page” link that will point to the dedicated URL once it exists.
2. **Next:** Add `/live/pin/[pinId]` (Option B), use the same API response, and render all displayable fields there with a proper layout and metadata. Make `/live?pin=<id>` and `/live/pin/<id>` both valid (e.g. share link uses `/live/pin/<id>`).

That gives: quick in-footer details for current users, and a unique, shareable, SEO-friendly URL for each pin.
