# Civic schema in production

The gov dashboard (organizations, people, buildings) uses the **civic** schema. To avoid 403 on PATCH/INSERT:

1. **Expose the civic schema**  
   In [Supabase Dashboard](https://supabase.com/dashboard) → Project → **Settings** → **API** → **Exposed schemas**, add `civic` (alongside `public`, etc.). Save.

2. **RLS and `is_admin()`**  
   Migration `civic_is_admin_wrapper_for_rls` adds `civic.is_admin()` so RLS policies on `civic.people`, `civic.orgs`, and `civic.buildings` can resolve `is_admin()`. Ensure that migration has been applied in production.

Local dev: `supabase/config.toml` already includes `civic` in `[api] schemas`.
