import { createServiceRoleClient } from '@/lib/supabase/server';

/** Service-role client scoped to the `page` schema. */
export function createPageServiceClient() {
  return createServiceRoleClient('page');
}
