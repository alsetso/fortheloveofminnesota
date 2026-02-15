-- Public documentation pages: anon/auth read, admin-only full CRUD.
-- Content stored as Markdown for easy preview and admin editing.

CREATE SCHEMA IF NOT EXISTS docs;

CREATE TABLE docs.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_docs_pages_slug ON docs.pages(slug);
CREATE INDEX idx_docs_pages_sort ON docs.pages(sort_order);

ALTER TABLE docs.pages ENABLE ROW LEVEL SECURITY;

-- Read: anon and authenticated can view all published docs
CREATE POLICY "Docs pages are readable by everyone"
  ON docs.pages FOR SELECT
  USING (true);

-- Write: only accounts with role = admin
CREATE POLICY "Only admins can insert docs pages"
  ON docs.pages FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update docs pages"
  ON docs.pages FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Only admins can delete docs pages"
  ON docs.pages FOR DELETE
  USING (public.is_admin());

GRANT USAGE ON SCHEMA docs TO anon, authenticated;
GRANT SELECT ON docs.pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON docs.pages TO authenticated;

COMMENT ON SCHEMA docs IS 'Public help/docs content; anon+auth read, admin CRUD';
COMMENT ON TABLE docs.pages IS 'Documentation pages; body is Markdown';
COMMENT ON COLUMN docs.pages.slug IS 'URL fragment e.g. getting-started (?doc=slug)';
COMMENT ON COLUMN docs.pages.icon IS 'Optional icon name for sidebar (e.g. InformationCircleIcon)';
COMMENT ON COLUMN docs.pages.sort_order IS 'Order in sidebar and prev/next';

-- IMPORTANT: The 'docs' schema must be added to the project's exposed schemas
-- in Supabase Dashboard → Settings → API → Exposed schemas.
-- This allows the client to use supabase.schema('docs').from('pages').
