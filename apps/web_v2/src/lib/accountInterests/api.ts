import { createClient } from '@/lib/supabase/client';
import {
  addSelectedInterestId,
  getSelectedInterestIds,
  getVisibleInterests,
  removeSelectedInterestId,
  removeVisibleInterest,
  setSelectedInterestIds,
  setVisibleInterests,
  upsertVisibleInterest,
} from '@/lib/accountInterests/store';
import {
  INTEREST_SELECT,
  cleanInterestName,
  isInterestSection,
  type Interest,
} from '@/lib/accountInterests/types';

export type { Interest, InterestSection } from '@/lib/accountInterests/types';
export {
  INTEREST_NAME_MAX,
  INTEREST_SECTION_LABEL,
  INTEREST_SECTIONS,
  cleanInterestName,
  isCivicInterest,
  isCustomInterest,
} from '@/lib/accountInterests/types';

function asInterest(row: unknown): Interest {
  const item = row as Interest;
  if (!isInterestSection(item.section)) {
    return { ...item, section: 'yours' };
  }
  return item;
}

function matchName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function listVisibleInterests(): Promise<Interest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('interests')
    .select(INTEREST_SELECT)
    .is('retired_at', null)
    .order('section', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message || 'Could not load interests.');
  const rows = (data ?? []).map(asInterest);
  setVisibleInterests(rows);
  return rows;
}

export async function listAccountInterestIds(accountId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('account_interests')
    .select('interest_id')
    .eq('account_id', accountId);
  if (error) throw new Error(error.message || 'Could not load your interests.');
  const ids = (data ?? []).map((row) => String((row as { interest_id: string }).interest_id));
  setSelectedInterestIds(accountId, ids);
  return ids;
}

export async function selectInterest(accountId: string, interestId: string): Promise<void> {
  addSelectedInterestId(interestId);
  const supabase = createClient();
  const { error } = await supabase.from('account_interests').insert({
    account_id: accountId,
    interest_id: interestId,
  });
  if (error) {
    removeSelectedInterestId(interestId);
    throw new Error(error.message || 'Could not save interest.');
  }
}

export async function unselectInterest(accountId: string, interestId: string): Promise<void> {
  removeSelectedInterestId(interestId);
  const supabase = createClient();
  const { error } = await supabase
    .from('account_interests')
    .delete()
    .eq('account_id', accountId)
    .eq('interest_id', interestId);
  if (error) {
    addSelectedInterestId(interestId);
    throw new Error(error.message || 'Could not remove interest.');
  }
}

export async function toggleInterest(accountId: string, interestId: string): Promise<void> {
  if (getSelectedInterestIds().has(interestId)) {
    await unselectInterest(accountId, interestId);
    return;
  }
  await selectInterest(accountId, interestId);
}

/**
 * Add a custom interest, or select the catalog match when the name already exists.
 */
export async function addCustomInterest(accountId: string, rawName: string): Promise<Interest> {
  const name = cleanInterestName(rawName);
  const existing = getVisibleInterests().find((row) => matchName(row.name, name));
  if (existing) {
    if (!getSelectedInterestIds().has(existing.id)) {
      await selectInterest(accountId, existing.id);
    }
    return existing;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('interests')
    .insert({
      name,
      section: 'yours',
      owner_account_id: accountId,
      sort_order: 0,
    })
    .select(INTEREST_SELECT)
    .single();
  if (error || !data) {
    if (error?.code === '23505') {
      await listVisibleInterests();
      const retry = getVisibleInterests().find((row) => matchName(row.name, name));
      if (retry) {
        if (!getSelectedInterestIds().has(retry.id)) {
          await selectInterest(accountId, retry.id);
        }
        return retry;
      }
    }
    throw new Error(error?.message || 'Could not add interest.');
  }
  const row = asInterest(data);
  upsertVisibleInterest(row);
  await selectInterest(accountId, row.id);
  return row;
}

export async function deleteCustomInterest(accountId: string, interest: Interest): Promise<void> {
  if (interest.owner_account_id !== accountId) {
    throw new Error('You can only remove interests you added.');
  }
  const wasSelected = getSelectedInterestIds().has(interest.id);
  removeVisibleInterest(interest.id);
  const supabase = createClient();
  const { error } = await supabase
    .from('interests')
    .delete()
    .eq('id', interest.id)
    .eq('owner_account_id', accountId);
  if (error) {
    upsertVisibleInterest(interest);
    if (wasSelected) addSelectedInterestId(interest.id);
    throw new Error(error.message || 'Could not remove interest.');
  }
}
