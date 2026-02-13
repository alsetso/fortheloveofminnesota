# Analytics Schema and User Tracking

This document isolates and explains the analytics system: schema structure, what is tracked, how data flows, and what users see.

---

## 1. Schema Overview

### Single source of truth: `analytics.events`

All analytics events are stored in `analytics.events`. The `analytics.url_visits` view is a thin projection over `events` for backward compatibility.

| Column          | Type                     | Description |
|-----------------|--------------------------|-------------|
| `id`            | UUID                     | Primary key |
| `account_id`    | UUID (FK → accounts)     | Viewer account; NULL for anonymous |
| `session_id`    | UUID                     | Device ID (localStorage `analytics_device_id`) for anonymous tracking |
| `entity_type`   | TEXT                     | One of: `map`, `pin`, `profile`, `post`, `page`, `other` |
| `entity_id`     | UUID                     | FK to the entity; NULL for `page` or `other` |
| `url`           | TEXT                     | Original URL visited |
| `viewed_at`     | TIMESTAMPTZ              | When the view occurred |
| `user_agent`    | TEXT                     | Browser user agent |
| `referrer_url`  | TEXT                     | HTTP referrer |
| `metadata`      | JSONB                    | Extra data (default `{}`) |

### View: `analytics.url_visits` (read-only projection)

```
SELECT id, url, account_id, viewed_at, user_agent, referrer_url, session_id
FROM analytics.events
```

### Public compatibility view: `public.url_visits`

Points to `analytics.url_visits`. Used by PostgREST and analytics page queries.

---

## 2. URL → Entity Mapping

`analytics.extract_entity_from_url(url)` maps URLs to `(entity_type, entity_id)`:

| URL pattern                     | entity_type | entity_id |
|---------------------------------|-------------|-----------|
| `/map/{uuid}` or `/map/{slug}`  | `map`       | map UUID  |
| `/map?pin={id}` or `/map?pinId={id}` | `pin`  | pin/mention UUID |
| `/mention/{id}`                 | `pin`       | mention UUID |
| `/post/{id}`                    | `post`      | post UUID |
| `/profile/{username}` or `/{username}` | `profile` | account UUID |
| `/`, `/feed`, `/maps`, `/settings`, etc. | `page` | NULL |
| Unmatched                       | `other`     | NULL |

---

## 3. What Is Being Tracked

### 3.1 Recording flows

| Trigger                          | API / Hook                     | URL stored            | Notes |
|----------------------------------|--------------------------------|------------------------|-------|
| Any page view                    | `usePageView` → `POST /api/analytics/view` | `page_url` (pathname) | Skips if account is admin |
| Map page load                    | `POST /api/analytics/map-view` | `/map/{map_id}`       | map_id is UUID |
| Pin/mention view (map click, etc.) | `POST /api/analytics/pin-view` | `/map?pin={pin_id}`   | Also increments `mentions.view_count` |
| Profile view                     | Via `record_url_visit`         | `/{username}` or `/profile/{username}` | Also increments `accounts.view_count` |

### 3.2 Where recording is used

- `usePageView`: Most pages (feed, maps, profile, mention detail, etc.)
- `MapIDBox`, `MentionsLayer`, `ProfileMap`: Pin views when user focuses a pin
- `useMapPageData`, `HomePageContent`: Map views on map load
- `record_url_visit`: Called by all analytics APIs and by DB trigger on `url_visits` inserts

### 3.3 Side effects in `record_url_visit`

- **Profile**: Increments `accounts.view_count` when someone views another user’s profile (no self-views).
- **Pin**: Increments the pin’s view_count (target table varies by migration history: `public.mentions` or `maps.pins`).

### 3.4 Mention detail page (`/mention/[id]`) — objective and view separation

**Objective:** The mention id page is the canonical, shareable page for a single pin. Its purpose is to give each pin a stable URL for linking and SEO, show full content (media, description, type, owner), and support edit/delete for owners. We keep the page focused: server-rendered metadata for crawlers, one main data fetch for the pin, and `usePageView` for analytics. No extra complexity; optimization is “one pin, one page, one view event.”

**Pin views vs mention (detail) page views — kept separate:**

- **Pin view (map):** When a user opens the pin popup on the map, the client calls `POST /api/analytics/pin-view` with the pin id. That API records a visit with URL `/map?pin={id}` via `record_url_visit`. Only this flow increments `map_pins.view_count`. So “pin views” = map popup opens only.
- **Mention (detail) page view:** When a user lands on `/mention/[id]`, the page uses `usePageView({ page_url: \`/mention/${id}\` })`, which posts to `POST /api/analytics/view`. That records a visit with URL `/mention/{id}` in the events table. We do **not** use that to increment `map_pins.view_count`; detail-page traffic is distinct and can be queried from events/url_visits by URL pattern (`/mention/` vs `/map?pin=`). So “mention id page views” = visits to the dedicated pin page; “pin views” = map popup only. Keeping them separate gives accurate map-engagement vs deep-link/share metrics.

---

## 4. API Surface

| Endpoint                       | Method | Purpose |
|--------------------------------|--------|---------|
| `/api/analytics/view`          | POST   | Record generic page view |
| `/api/analytics/pin-view`      | POST   | Record pin/mention view |
| `/api/analytics/map-view`      | POST   | Record map view |
| `/api/analytics/pin-stats`      | GET    | Get stats for a pin (via `get_entity_stats`) |
| `/api/analytics/account`       | GET    | Account-level analytics |
| `/api/analytics/user-mentions`  | GET    | User’s mention analytics |
| `/api/analytics/homepage-stats` | GET    | Homepage stats |

### RPC functions (Postgres)

| Function                        | Purpose |
|---------------------------------|---------|
| `record_url_visit(url, account_id, user_agent, referrer_url, session_id)` | Insert event, update profile/mention view counts |
| `get_entity_stats(entity_type, entity_id, hours)` | Stats for a given entity (e.g. pin) |
| `get_mention_stats(mention_id, hours)` | Pin/mention stats |
| `get_profile_viewers(username, limit, offset)` | List profile viewers |
| `get_map_viewers(map_id, limit, offset)` | List map viewers |
| `get_user_analytics_events`     | User’s own visit history |
| `count_user_analytics_events`   | Count of user’s events |
| `analytics.get_account_map_views` | Map views for an account |
| `analytics.get_account_map_views_count` | Map view counts for an account |

---

## 5. What the User Sees (Analytics Page `/analytics`)

### Access

- Requires auth.
- Middleware restricts `/analytics` to `role === 'admin'`.

### Stats cards (core, visible to everyone)

| Card              | Data source                       | Description |
|-------------------|-----------------------------------|-------------|
| **Profile views** | `url_visits` where `url LIKE '/{username}%'` | Views of profile pages |
| **Pin views**     | `url_visits` where `url` matches `/map?pin={id}` or `/map?pinId={id}` | Map click-throughs to pins |
| **Mention views** | `url_visits` where `url` matches `/mention/{id}` | Detail page views |
| **Map views**     | `url_visits` where `url` matches `/map/{id}` or `/map/{slug}` | Map page views |
| **Post views**    | `url_visits` where `url` matches `/post/{id}` | Post page views |
| **Live mentions** | `maps.pins` on live map, owned by account | Count of pins on live map |
| **Total pins**    | `maps.pins` owned by account      | All active pins |

### Time filters

24h, 7d, 30d, 90d, all. Applied to `viewed_at` in all queries.

### Visit history (“Where you visited”)

- Events where `account_id = current user`.
- Shows which content the user viewed, and whose analytics they contribute to.
- Columns: type (profile/mention/post/map), content title/preview, link, viewed time.
- Optional viewer info if `visitor_identities` feature is enabled (Contributor+).

### Map views list

- Events where `entity_type = 'map'` and `entity_id` is one of the user’s maps.
- Shows who viewed the user’s maps, with same viewer/identity rules.

### Card visibility

- Core cards: visible to all users (`CORE_CARDS` in `lib/analytics/cardVisibility.ts`).
- Admin-only cards: visible only when `account.role === 'admin'` (`ADMIN_ONLY_CARDS`).

---

## 6. Feature Gating

| Feature             | Plan       | Effect |
|---------------------|-----------|--------|
| `visitor_analytics` | Contributor+ | Access to profile/mention/map analytics |
| `visitor_identities`| Contributor+ | See viewer username, avatar, plan instead of “Upgrade to View” |

---

## 7. Anonymous Tracking

- `session_id` stores a device UUID from `localStorage.getItem('analytics_device_id')`.
- Set once per device; shared across tabs.
- Used when `account_id` is NULL to count unique anonymous viewers.

---

## 8. Admin Behavior

- `usePageView` skips tracking when `account?.role === 'admin'` to avoid polluting analytics.
- Admins can still use admin tools and impersonation (e.g. `account_id` override in `/api/analytics/view`).

---

## 9. Data Flow Summary

```
User action (page load, pin focus, map view)
    → Client calls /api/analytics/view, pin-view, or map-view
    → record_url_visit(url, account_id, session_id, ...)
    → Insert into analytics.events
    → Optional: update accounts.view_count or mentions.view_count

Analytics page load
    → Server queries url_visits (analytics.events) with filters
    → Joins to accounts, maps.pins, content.posts for titles/previews
    → Passes counts + visit history to AnalyticsClient
```

---

## 10. Migrations

| Migration                          | Change |
|------------------------------------|--------|
| `506_create_analytics_events_table.sql` | Create `analytics.events`, `extract_entity_from_url`, `get_entity_stats` |
| `512_move_url_visits_to_analytics_schema.sql` | Move `url_visits` to `analytics` schema |
| `513_consolidate_analytics_to_events.sql` | Make `url_visits` a view over `events`; drop `map_views`; update `record_url_visit` and stats functions |
