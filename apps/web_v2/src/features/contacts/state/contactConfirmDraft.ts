/**
 * Pending contact confirm draft — set before opening contact-confirm subpage.
 * Keeps large candidate payloads out of the pane stack.
 */

import type { ContactCandidate } from '@/features/contacts/logic/identifyCandidates';

export type ContactSaveSource = 'tool_lookup' | 'map' | 'find_me' | 'search' | 'manual';

export type ContactConfirmDraft = {
  candidate: ContactCandidate;
  source: ContactSaveSource;
  sourceLookupId?: string | null;
  sourceLookupKind?: 'people' | 'properties' | null;
};

let draft: ContactConfirmDraft | null = null;

export function setContactConfirmDraft(next: ContactConfirmDraft): void {
  draft = next;
}

export function getContactConfirmDraft(): ContactConfirmDraft | null {
  return draft;
}

export function clearContactConfirmDraft(): void {
  draft = null;
}
