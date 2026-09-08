-- Harden world.element_types + world.world_placement_batches with RLS.
-- element_types: public read (iOS/admin map rings), admin write.
-- world_placement_batches: admin-only (service_role bypasses RLS for APIs).

ALTER TABLE world.element_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE world.world_placement_batches ENABLE ROW LEVEL SECURITY;

-- element_types --------------------------------------------------------------
DROP POLICY IF EXISTS element_types_public_read ON world.element_types;
CREATE POLICY element_types_public_read
  ON world.element_types
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS element_types_admin_write ON world.element_types;
CREATE POLICY element_types_admin_write
  ON world.element_types
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

GRANT SELECT ON world.element_types TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON world.element_types TO authenticated;

-- world_placement_batches ----------------------------------------------------
DROP POLICY IF EXISTS world_placement_batches_admin_all ON world.world_placement_batches;
CREATE POLICY world_placement_batches_admin_all
  ON world.world_placement_batches
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Revoke broad anon read; admins + service_role retain access.
REVOKE ALL ON world.world_placement_batches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON world.world_placement_batches TO authenticated;

COMMENT ON TABLE world.element_types IS
  'Category registry for world 3D models — slug/label/hex color drive admin + iOS placement pulse rings.';
