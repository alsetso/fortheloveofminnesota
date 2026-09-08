import { createClient } from '@supabase/supabase-js';

/** Server client for `territory.*` boundary tables. Prefers service role when set. */
export function createTerritoryServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key');
  }
  return createClient(url, key, {
    db: { schema: 'territory' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
