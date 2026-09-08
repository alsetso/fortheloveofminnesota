-- Add status column to page.pages for draft / active lifecycle.
-- Existing pages default to 'active' so nothing breaks.
-- New pages created through the launch flow can be saved as drafts
-- before being made publicly visible.

ALTER TABLE page.pages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE page.pages
  DROP CONSTRAINT IF EXISTS pages_status_check;

ALTER TABLE page.pages
  ADD CONSTRAINT pages_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'active'::text]));

COMMENT ON COLUMN page.pages.status IS
  'draft = not publicly visible yet; active = live on the directory.';
