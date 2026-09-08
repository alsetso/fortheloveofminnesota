import { createServiceRoleClient } from '@/lib/supabase/server';

export function getAdsServiceDb() {
  return createServiceRoleClient('ads');
}

export function getPageServiceDb() {
  return createServiceRoleClient('page');
}
