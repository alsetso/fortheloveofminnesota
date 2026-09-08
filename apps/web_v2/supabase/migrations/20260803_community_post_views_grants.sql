-- community.post_views had RLS policies but no grants for API roles,
-- so live map seen_by_me lookups failed with "permission denied for table post_views".

GRANT USAGE ON SCHEMA community TO anon, authenticated, service_role;

GRANT SELECT, INSERT ON TABLE community.post_views TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE community.post_views TO service_role;
