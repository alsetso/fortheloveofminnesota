-- Add home_based flag to page.pages.
-- Marks a local business as operating from a home address so the exact
-- location is suppressed from public display.

ALTER TABLE page.pages
  ADD COLUMN IF NOT EXISTS home_based boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN page.pages.home_based IS
  'True when the business operates from a home address — suppresses exact location display.';
