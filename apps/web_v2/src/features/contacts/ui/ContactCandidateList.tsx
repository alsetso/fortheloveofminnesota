'use client';

import type { ContactCandidate } from '@/features/contacts/logic/identifyCandidates';
import { addressIdentityKeys } from '@/features/contacts/logic/identifyCandidates';
import { ContactSaveBadge } from '@/features/contacts/ui/ContactSaveBadge';
import { useContactMatches } from '@/features/contacts/state/useContactMatches';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconHome, IconUser } from '@/features/map/dockCore/core/icons';
import { ToolCostNote, ToolEmptyState, ToolResultRow } from '@/features/tools/core/toolUi';

function candidateMatchKeys(c: ContactCandidate): string[] {
  if (c.kind === 'person') return [c.key];
  return addressIdentityKeys({
    line1: c.line1,
    city: c.city,
    state: c.state,
    postalCode: c.postalCode,
    label: c.label,
  });
}

/**
 * Shared person/address list — Save or Already saved (identity match).
 */
export function ContactCandidateList({
  candidates,
  emptyTitle = 'Nothing to identify',
  emptySubtitle = 'No clear person or address fields.',
  note = 'Step 1 — pick a person or address. Step 2 — confirm before it lands in your book.',
  onSelect,
}: {
  candidates: ContactCandidate[];
  emptyTitle?: string;
  emptySubtitle?: string;
  note?: string;
  onSelect: (candidate: ContactCandidate) => void;
}) {
  const { openSubpage } = useMapDock();
  const keys = candidates.flatMap(candidateMatchKeys);
  const { matches } = useContactMatches(keys);

  if (candidates.length === 0) {
    return <ToolEmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <div className="space-y-2">
      {candidates.map((c) => {
        const match =
          matches[c.key] ??
          candidateMatchKeys(c)
            .map((k) => matches[k])
            .find(Boolean);
        const title = c.kind === 'person' ? c.displayName : c.label;
        return (
          <ToolResultRow
            key={`${c.kind}:${c.key}`}
            title={title}
            subtitle={
              match
                ? `Already saved${match.tag ? ` · ${match.tag}` : ''}`
                : c.kind === 'person'
                  ? c.subtitle ?? (c.linkedAccountId ? 'Linked account' : 'Person')
                  : c.subtitle ?? 'Address'
            }
            icon={
              c.kind === 'person' ? (
                <IconUser className="h-5 w-5" />
              ) : (
                <IconHome className="h-5 w-5" />
              )
            }
            trailing={
              <ContactSaveBadge
                match={match}
                kind={c.kind}
                onSave={() => onSelect(c)}
              />
            }
            onClick={() => {
              if (match) {
                openSubpage({
                  title: match.title,
                  subtitle: 'Contact',
                  kind: 'contact-detail',
                  slug: `${match.kind}:${match.id}`,
                });
                return;
              }
              onSelect(c);
            }}
          />
        );
      })}
      {note ? <ToolCostNote>{note}</ToolCostNote> : null}
    </div>
  );
}
