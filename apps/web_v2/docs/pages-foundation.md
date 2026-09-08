# Pages foundation (ios-2)

User-generated directory pages from `page.pages` — not civic entity pages, not `app.pages`.

## Isolation

```sql
page_type = ANY(USER_GENERATED + legacy 'business')
AND entity_id IS NULL
AND visibility = 'public'
```

Taxonomy: `src/lib/directory/pageTypes.ts`.

## Where UI lives

| Intent | Surface | Notes |
|--------|---------|--------|
| **View** | Dock **card** `page` (`PageDockCard`) | Tap logo pin → contact-book style sheet |
| **Community pin** | Dock **card** `pin` (`PinDockCard`) | Same card host pattern |
| **Map layer toggles** | Dock **card** `controls` → subcards | Directory pages / Community pins are link rows → nested cards with Show on map + search + list |
| **Create** | Dock subpage `page-launch` · Own scroll `/pages/new` | Entry from My Pages, Discover +, or Page card |
| **My Pages** | Own scroll `/pages` | Account ownership hub (drawer). Optional `?intent=advertise` when deep-linked from ads CTAs |
| **Manage** | Own scroll `/page/:slug/manage` · dock `page-manage` | Listing editor (title, contact, publish) |
| **Advertise** | Own scroll `/page/:slug/advertise` | Page-scoped ads entry (credits / creatives / placements). Not a peer of My Pages |

Full-screen Next routes (`/page/[slug]`, `/pages`, advertise/manage) sit alongside dock-native cards.

Legacy `/ads/manager` redirects to `/pages?intent=advertise`.

## Core tables

| Table | Use now |
|-------|---------|
| `page.pages` | Identity, lat/lng, icon, about |
| `page.page_media` | `role=logo` / `cover` |
| `page.service_areas` | Phase 1.5 (extra building pins) |
| `page.page_favorites` | Phase 2 |

## APIs

- `GET /api/directory/pages` — map pins (UG + coords + logo)
- `GET /api/directory/pages/[id]` — detail enrich for dock

## Map

`MAP_SOURCE_IDS.pages` → `DirectoryPagesProvider` + `DirectoryPagesLayer` (community-pins pattern: custom `addImage` logos, not `SHELL_LAYER_SPECS`).
