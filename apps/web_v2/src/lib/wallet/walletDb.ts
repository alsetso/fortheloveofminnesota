import { createServiceRoleClient } from '@/lib/supabase/server';

/** Service-role client scoped to `wallet` (unified credit ledger). */
export function getWalletServiceDb() {
  return createServiceRoleClient('wallet');
}

/** Service-role client scoped to `tools` (TTL lookup archive). */
export function getToolsServiceDb() {
  return createServiceRoleClient('tools');
}

/** Service-role client scoped to `contacts` (durable contact book). */
export function getContactsServiceDb() {
  return createServiceRoleClient('contacts');
}

/** Service-role client on public / default (accounts + billing RPCs). */
export function getPublicServiceDb() {
  return createServiceRoleClient();
}
