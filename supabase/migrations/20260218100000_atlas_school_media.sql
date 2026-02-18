-- atlas.school_media: logo, cover, and photo_gallery for schools
-- Replaces atlas.schools.logo_media_id with a single junction table.

CREATE TABLE IF NOT EXISTS atlas.school_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES atlas.schools(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES atlas.media(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('logo', 'cover', 'gallery')),
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_school_media_school_role ON atlas.school_media(school_id, role);
CREATE INDEX IF NOT EXISTS idx_school_media_media_id ON atlas.school_media(media_id);

-- At most one logo and one cover per school
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_media_one_logo
  ON atlas.school_media(school_id) WHERE role = 'logo';
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_media_one_cover
  ON atlas.school_media(school_id) WHERE role = 'cover';

-- Migrate existing logo_media_id into school_media
INSERT INTO atlas.school_media (school_id, media_id, role, sort_order)
SELECT id, logo_media_id, 'logo', 0
FROM atlas.schools
WHERE logo_media_id IS NOT NULL
ON CONFLICT (school_id, media_id) DO NOTHING;

-- Drop legacy column and FK
ALTER TABLE atlas.schools DROP CONSTRAINT IF EXISTS fk_schools_logo_media;
ALTER TABLE atlas.schools DROP COLUMN IF EXISTS logo_media_id;

-- RLS
ALTER TABLE atlas.school_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read school_media" ON atlas.school_media FOR SELECT USING (true);

COMMENT ON TABLE atlas.school_media IS 'School assets: logo (1), cover (1), gallery (many). role in (logo, cover, gallery); sort_order for gallery order.';
