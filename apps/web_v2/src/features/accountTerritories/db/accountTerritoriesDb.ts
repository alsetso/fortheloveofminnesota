import { createServiceRoleClient } from '@/lib/supabase/server';

/** Service-role client for public.account_places / account_home_units. */
export function getAccountPlacesDb() {
  return createServiceRoleClient();
}
