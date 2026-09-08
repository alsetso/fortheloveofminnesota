/**
 * Resolve existing contact rows by identity — recomputes address keys so
 * older saved rows still match after normalizer upgrades.
 * Address soft keys (street|*|state|ZIP) catch city aliases like Medina↔Hamel.
 */
import {
  addressIdentityKey,
  addressIdentityKeys,
  personIdentityKey,
} from '@/features/contacts/logic/identifyCandidates';
import { getContactsServiceDb } from '@/lib/wallet/walletDb';

export type MatchedContact = {
  kind: 'person' | 'address';
  id: string;
  title: string;
  tag: string | null;
  identityKey: string;
};

export async function matchContactsByIdentityKeys(input: {
  accountId: string;
  keys: string[];
}): Promise<Record<string, MatchedContact>> {
  const keys = [...new Set(input.keys.map((k) => k.trim()).filter(Boolean))];
  if (keys.length === 0) return {};

  const keySet = new Set(keys);
  const db = getContactsServiceDb();
  const matches: Record<string, MatchedContact> = {};

  const [{ data: people }, { data: addresses }] = await Promise.all([
    db
      .from('people')
      .select('id, display_name, identity_key, tag, emails, phones, linked_account_id, first_name, last_name')
      .eq('account_id', input.accountId)
      .limit(300),
    db
      .from('addresses')
      .select('id, label, identity_key, tag, line1, city, state, postal_code')
      .eq('account_id', input.accountId)
      .limit(300),
  ]);

  for (const row of people ?? []) {
    const recomputed = personIdentityKey({
      linkedAccountId: (row.linked_account_id as string | null) ?? undefined,
      emails: (row.emails as string[] | null) ?? [],
      phones: (row.phones as string[] | null) ?? [],
      firstName: (row.first_name as string | null) ?? undefined,
      lastName: (row.last_name as string | null) ?? undefined,
      displayName: row.display_name as string,
    });
    const stored = row.identity_key as string;
    for (const key of keys) {
      if (key === stored || key === recomputed) {
        matches[key] = {
          kind: 'person',
          id: row.id as string,
          title: row.display_name as string,
          tag: (row.tag as string | null) ?? null,
          identityKey: recomputed,
        };
      }
    }
    if (stored !== recomputed && !keySet.has(stored)) {
      // Self-heal drifted keys when safe (no conflicting row).
      void db
        .from('people')
        .update({ identity_key: recomputed })
        .eq('id', row.id)
        .eq('account_id', input.accountId);
    }
  }

  for (const row of addresses ?? []) {
    const parts = {
      line1: (row.line1 as string | null) ?? undefined,
      city: (row.city as string | null) ?? undefined,
      state: (row.state as string | null) ?? undefined,
      postalCode: (row.postal_code as string | null) ?? undefined,
      label: row.label as string,
    };
    const recomputed = addressIdentityKey(parts);
    const rowKeys = new Set(addressIdentityKeys(parts));
    rowKeys.add(row.identity_key as string);
    rowKeys.add(recomputed);
    const stored = row.identity_key as string;
    for (const key of keys) {
      if (rowKeys.has(key)) {
        matches[key] = {
          kind: 'address',
          id: row.id as string,
          title: row.label as string,
          tag: (row.tag as string | null) ?? null,
          identityKey: recomputed,
        };
      }
    }
    if (stored !== recomputed) {
      void db
        .from('addresses')
        .update({ identity_key: recomputed })
        .eq('id', row.id)
        .eq('account_id', input.accountId);
    }
  }

  return matches;
}
