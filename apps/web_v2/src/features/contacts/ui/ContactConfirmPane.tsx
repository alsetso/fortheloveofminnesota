'use client';

import { useEffect, useState } from 'react';
import {
  clearContactConfirmDraft,
  getContactConfirmDraft,
  type ContactConfirmDraft,
} from '@/features/contacts/state/contactConfirmDraft';
import { ContactConfirmSave } from '@/features/contacts/ui/ContactConfirmSave';
import { openSavedContactDetail } from '@/features/contacts/state/openSavedContactDetail';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DockPaneShell,
  DockSection,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  ToolEmptyState,
  ToolPrimaryButton,
} from '@/features/tools/core/toolUi';

/**
 * Dock subpage for confirm-save from search / map / Find Me (draft store).
 * On save → opens the saved contact record for immediate enrichment.
 */
export default function ContactConfirmPane() {
  const { openSubpage, back } = useMapDock();
  const [draft, setDraft] = useState<ContactConfirmDraft | null>(null);

  useEffect(() => {
    setDraft(getContactConfirmDraft());
  }, []);

  if (!draft) {
    return (
      <DockPaneShell>
        <div className="space-y-5 pb-6">
          <DockSection title="Confirm save">
            <ToolEmptyState
              title="Nothing to save"
              subtitle="Pick a person or address from search, map, or a tool result."
            />
            <ToolPrimaryButton variant="secondary" onClick={() => back()}>
              Back
            </ToolPrimaryButton>
          </DockSection>
        </div>
      </DockPaneShell>
    );
  }

  return (
    <DockPaneShell>
      <div className="space-y-5 pb-6">
        <ContactConfirmSave
          candidate={draft.candidate}
          source={draft.source}
          sourceLookupId={draft.sourceLookupId}
          sourceLookupKind={draft.sourceLookupKind}
          onBack={() => {
            clearContactConfirmDraft();
            back();
          }}
          onSaved={(result) => {
            clearContactConfirmDraft();
            openSavedContactDetail(openSubpage, result);
          }}
        />
      </div>
    </DockPaneShell>
  );
}
