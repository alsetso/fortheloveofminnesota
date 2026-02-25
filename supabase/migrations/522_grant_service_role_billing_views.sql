-- Grant service_role SELECT on public billing views
-- GET /api/billing/plans uses createServiceClient() (service_role) so /pricing works for non-auth and auth

GRANT SELECT ON public.billing_plans TO service_role;
GRANT SELECT ON public.billing_features TO service_role;
GRANT SELECT ON public.billing_plan_features TO service_role;
