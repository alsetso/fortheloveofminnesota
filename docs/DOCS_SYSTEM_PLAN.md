# Documentation System Plan

Public help and guides for Love of Minnesota, backed by Supabase with codebase-aligned content.

## Alignment

- **Storage:** Supabase `docs` schema (no hardcoded doc content in the app).
- **Read:** Anon and authenticated users can SELECT all rows (public docs).
- **Write:** Full CRUD only when `accounts.role = 'admin'` (via RLS using `public.is_admin()`).

## Schema: `docs.pages`

| Column       | Type         | Purpose |
|-------------|--------------|---------|
| `id`        | UUID PK      | Primary key. |
| `slug`      | TEXT UNIQUE  | URL fragment for `/docs?doc=<slug>`. |
| `title`     | TEXT         | Display title (sidebar + header). |
| `body`      | TEXT         | **Markdown** content. |
| `icon`      | TEXT         | Optional icon name for sidebar. |
| `sort_order`| INT          | Order in sidebar and prev/next. |
| `created_at`| TIMESTAMPTZ  | Set on insert. |
| `updated_at`| TIMESTAMPTZ  | Set on insert/update. |

**RLS**

- **SELECT:** `USING (true)` — everyone can read.
- **INSERT / UPDATE / DELETE:** `USING (public.is_admin())` — only admin.

**Grants**

- `anon`, `authenticated`: `USAGE` on schema `docs`, `SELECT` on `docs.pages`.
- `authenticated`: `INSERT`, `UPDATE`, `DELETE` on `docs.pages` (RLS enforces admin).

## Content Format: Markdown

- **Why:** Renders to structured HTML (headings, lists, code, links). Single source of truth as plain text; easy to version and paste.
- **Read path:** App fetches `body` from Supabase → render with `react-markdown` (or similar) → consistent preview and styling.
- **Admin editing:** Store raw Markdown in `body`. Editor can be:
  - Textarea + live preview (sidebar or split view), or
  - Rich Markdown editor (e.g. MDXEditor, TipTap with Markdown export) for WYSIWYG-style editing.

No HTML or JSX in the database; keep all structure in Markdown.

## App Integration (Next Steps)

1. **Public `/docs` route**
   - Fetch `docs.pages` (order by `sort_order`, then `slug`). Use `slug` for `?doc=` and for prev/next.
   - Replace hardcoded `DocsLeftSidebar` list with this list; replace `DocsContent` body with Markdown render of `body` for the selected slug.
   - Optional: shared config or hook that maps slug → page and derives prev/next from ordered list.

2. **Admin docs UI**
   - Route (e.g. `/admin/docs` or `/settings/docs` for admins) to list/create/edit/delete `docs.pages`.
   - Form: slug, title, body (Markdown textarea or rich editor), icon, sort_order. Save via Supabase client (RLS enforces admin).

3. **Seed data**
   - Migration or script to INSERT initial rows (e.g. getting-started, create-account, …) with current copy from `DocsContent.tsx`, converted to Markdown, so the app can switch to Supabase-backed docs immediately.

## Codebase as Source of Truth

When writing or updating doc content, tie steps to the real app:

- **Routes:** Use actual paths (e.g. `/signup`, `/settings/privacy`, `/map/[id]`).
- **Flows:** Describe the real flow (e.g. “Create pin: Map page → tap Add → form → POST `/api/maps/[id]/pins`”).
- **Settings:** Reference real sidebar labels and routes from `SettingsLeftSidebar` / `SettingsPageWrapper`.

This keeps docs verifiable and in sync with the codebase.
