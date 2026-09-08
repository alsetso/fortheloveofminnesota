'use client';

import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  setContactConfirmDraft,
  type ContactSaveSource,
} from '@/features/contacts/state/contactConfirmDraft';
import type { ContactCandidate } from '@/features/contacts/logic/identifyCandidates';

/** Open the shared confirm-save shell with a prebuilt candidate (never writes yet). */
export function useOpenContactConfirm() {
  const { openSubpage } = useMapDock();

  return function openContactConfirm(
    candidate: ContactCandidate,
    source: ContactSaveSource,
    opts?: {
      sourceLookupId?: string | null;
      sourceLookupKind?: 'people' | 'properties' | null;
    },
  ) {
    setContactConfirmDraft({
      candidate,
      source,
      sourceLookupId: opts?.sourceLookupId ?? null,
      sourceLookupKind: opts?.sourceLookupKind ?? null,
    });
    openSubpage({
      title: 'Confirm save',
      subtitle:
        candidate.kind === 'person'
          ? candidate.displayName
          : candidate.label,
      kind: 'contact-confirm',
    });
  }
}
