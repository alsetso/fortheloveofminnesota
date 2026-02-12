-- Add missing systems to ensure all routes are covered
-- This ensures full control over all page routes except homepage
-- Using unique schema_name identifiers (route-based names where schemas don't exist)

INSERT INTO admin.system_visibility (schema_name, system_name, primary_route, display_order, description) VALUES
  ('public', 'Settings', '/settings', 11, 'User settings and preferences'),
  ('content', 'Posts', '/post', 13, 'Post content pages'),
  ('mentions', 'Mentions', '/mention', 14, 'Mention detail pages'),
  ('collections', 'Collections', '/collections', 15, 'Collections system'),
  ('people', 'People', '/people', 16, 'People directory'),
  ('saved', 'Saved', '/saved', 17, 'Saved items'),
  ('memories', 'Memories', '/memories', 18, 'Memories feature'),
  ('marketplace', 'Marketplace', '/marketplace', 19, 'Marketplace/e-commerce'),
  ('explore', 'Explore', '/explore', 20, 'Explore and discovery'),
  ('contribute', 'Contribute', '/contribute', 21, 'Contribution system'),
  ('news', 'News', '/news', 22, 'News and articles'),
  ('admin', 'Admin', '/admin', 23, 'Admin dashboard and tools'),
  ('billing', 'Billing', '/billing', 24, 'Billing and subscriptions'),
  ('auth', 'Auth', '/login', 25, 'Authentication pages (login, signup, onboarding)')
ON CONFLICT (schema_name) DO NOTHING;

-- Note: Profile routes (/{username}) are handled by homepage system visibility check
-- They're accessible when systems are disabled as they're part of core user functionality

COMMENT ON TABLE admin.system_visibility IS 
  'Systems control access to page routes. Disabling a system blocks all routes under its primary_route. Homepage (/) is always accessible.';
