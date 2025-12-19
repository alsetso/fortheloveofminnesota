-- Fix permission denied error for service_role when updating cities view
-- The public.cities view was missing service_role grants for INSERT, UPDATE, DELETE

-- Grant all permissions on public.cities view to service_role
GRANT ALL ON public.cities TO service_role;

-- Grant all permissions on public.counties view to service_role (for consistency)
GRANT ALL ON public.counties TO service_role;

-- Also ensure the trigger functions have proper security context
-- The triggers use SECURITY DEFINER which should run as the function owner (postgres)
-- But we need to ensure the view itself allows the operations

-- Add comment for documentation
COMMENT ON VIEW public.cities IS 'Public-facing view of atlas.cities with INSTEAD OF triggers for CRUD operations. Service role has full access.';
COMMENT ON VIEW public.counties IS 'Public-facing view of atlas.counties with INSTEAD OF triggers for CRUD operations. Service role has full access.';

