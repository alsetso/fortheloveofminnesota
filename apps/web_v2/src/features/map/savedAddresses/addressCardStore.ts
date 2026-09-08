'use client';

/**
 * Selection for the lightweight Address dock card (map / Find me save — not full contact book).
 */

import type { AddressCandidate } from '@/features/contacts/logic/identifyCandidates';
import type { ContactSaveSource } from '@/features/contacts/state/contactConfirmDraft';

/** Already-known saved row — skip /api/contacts/match when opening from a map pin. */
export type KnownSavedAddress = {
  id: string;
  title: string;
  tag: string | null;
};

export type AddressCardSelection = {
  candidate: AddressCandidate;
  source: ContactSaveSource;
  knownSaved?: KnownSavedAddress | null;
};

type Listener = () => void;

let selection: AddressCardSelection | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function getAddressCardSelection(): AddressCardSelection | null {
  return selection;
}

export function selectAddressForCard(
  candidate: AddressCandidate,
  source: ContactSaveSource,
  knownSaved?: KnownSavedAddress | null,
): void {
  selection = { candidate, source, knownSaved: knownSaved ?? null };
  emit();
}

export function clearAddressCardSelection(): void {
  if (selection == null) return;
  selection = null;
  emit();
}

export function subscribeAddressCard(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
