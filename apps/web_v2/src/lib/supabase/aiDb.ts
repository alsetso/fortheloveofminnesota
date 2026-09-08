import { createServiceRoleClient } from '@/lib/supabase/server';

/** Service-role client for `ai.*` subject threads / memory / citations. */
export function createAiServerClient() {
  return createServiceRoleClient('ai');
}
