# Profile Page: Public-Schema Tables & API Lockdown

Goal: Keep all profile-page data and APIs in the **public** schema. One source of truth for profile pins and collections; maps/live can surface public pins from here.

---

## 1. Tables (public only)

| Table | Purpose | Profile usage |
|-------|---------|---------------|
| **accounts** | Profile identity, username, bio, plan | Read by username; RLS by `user_id` / account id |
| **collections** | Grouping of pins per account | Read by `account_id`; owner CRUD by `account_id` + auth |
| **map_pins** | Pins (lat/lng, description, visibility, collection_id, mention_type_id, account_id) | Read by `account_id` (+ visibility filter for public view); owner CRUD |
| **mention_types** | Lookup for pin type (emoji, name) | Read-only reference |

*(map_pins_likes omitted for MVP; can add later.)*

Optional (already public): **cities_and_towns** in `layers` is used for profile city name; can stay as-is or get a public view if we want zero cross-schema for profile.

---

## 2. Current vs desired data source for profile

- **Today:** Profile RSC uses `maps.pins` (and optionally `public.map_pins_likes`). `public.map_pins` already has the right shape (account_id, lat, lng, description, collection_id, mention_type_id, visibility).
- **Target:** Profile page (server + APIs) uses **only** `public`: `accounts`, `collections`, `map_pins`, `mention_types`. No `maps.*` in profile read/write path. No `map_pins_likes` for MVP.

---

## 3. API surface (profile-scoped, public schema only)

| API | Method | Table(s) | Auth / rules |
|-----|--------|----------|--------------|
| **GET /api/accounts/[id]** (or by username) | GET | public.accounts | Public read for profile; PATCH only for own account |
| **GET/POST/PATCH/DELETE /api/accounts/[id]/collections** | - | public.collections | Require auth; ensure `account_id` = authenticated account |
| **GET/POST/PATCH/DELETE /api/accounts/[id]/pins** | - | public.map_pins | Require auth; ensure `account_id` = authenticated account; filter by visibility for public listing |
| **GET /api/mention-types** | GET | public.mention_types | Read-only; anon or auth (for create-pin form) |

Use a single convention: **account-scoped** routes under e.g. `/api/accounts/[id]/collections` and `/api/accounts/[id]/pins` so all profile mutations are clearly tied to one account and one schema.

---

## 4. Lockdown checklist

- [x] **Profile RSC ([username]/page.tsx):** Pin fetch uses `public.map_pins`; [username]/[collection] same. No `map_pins_likes`; `likes_count` = 0 for MVP.
- [x] **RLS:** `public.collections` and `public.map_pins` have RLS: select by visibility/ownership; insert/update/delete only when `user_owns_account(account_id)`.
- [x] **APIs:** Account-scoped CRUD: `/api/accounts/[id]/collections` and `/api/accounts/[id]/pins`; `/api/pins` and `/api/pins/[pinId]` refactored to use `public.map_pins`.
- [ ] **Maps/live:** When showing profile/public pins, read from public.map_pins (visibility = public) so profile is source of truth.
---

## 5. Short summary

- **Tables:** public only for profile: `accounts`, `collections`, `map_pins`, `mention_types` (no `map_pins_likes` for MVP).
- **Profile page:** Fetches and renders from these tables only; no `maps.pins` in profile path.
- **APIs:** Account-scoped collections and pins CRUD; `/api/pins` and `/api/pins/[pinId]` use `public.map_pins`; auth enforces `account_id` = authenticated account.
- **Maps page:** Can consume `public.map_pins` (visibility = public) so profile is source of truth for account-owned pins.
