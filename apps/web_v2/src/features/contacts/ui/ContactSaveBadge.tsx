'use client';

import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  IconContactBook,
  IconHomePlus,
  IconUserPlus,
} from '@/features/map/dockCore/core/icons';
import type { ContactMatch } from '@/features/contacts/state/useContactMatches';

export type ContactSaveKind = 'person' | 'address';

/**
 * Trailing icon control — person+/house+ to save, contact book when already saved.
 */
export function ContactSaveBadge({
  match,
  kind = 'person',
  onSave,
  onOpenMatch,
}: {
  match?: ContactMatch | null;
  kind?: ContactSaveKind;
  onSave: () => void;
  /** Override default contact-detail open (e.g. close a dock card first). */
  onOpenMatch?: (match: ContactMatch) => void;
}) {
  const { openSubpage } = useMapDock();
  const saveKind: ContactSaveKind = match?.kind ?? kind;

  if (match) {
    return (
      <button
        type="button"
        aria-label="Open saved address"
        title="Saved"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-map-ink-subtle text-foreground-muted transition hover:bg-map-ink-subtle hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenMatch) {
            onOpenMatch(match);
            return;
          }
          if (saveKind === 'address') {
            onSave();
            return;
          }
          openSubpage({
            title: match.title,
            subtitle: 'Contact',
            kind: 'contact-detail',
            slug: `${match.kind}:${match.id}`,
          });
        }}
      >
        <IconContactBook className="h-4 w-4" />
      </button>
    );
  }

  const SaveIcon = saveKind === 'address' ? IconHomePlus : IconUserPlus;
  const label = saveKind === 'address' ? 'Save address' : 'Save person';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue transition hover:bg-lake-blue/15"
      onClick={(e) => {
        e.stopPropagation();
        onSave();
      }}
    >
      <SaveIcon className="h-4 w-4" />
    </button>
  );
}
