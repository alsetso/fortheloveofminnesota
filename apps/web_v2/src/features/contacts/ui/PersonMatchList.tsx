'use client';

import { useState } from 'react';
import type { PersonMatch } from '@/features/contacts/logic/personMatches';
import { IconUser } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import {
  ToolCostNote,
  ToolEmptyState,
  ToolPrimaryButton,
} from '@/features/tools/core/toolUi';

export type DeepenedPersonRef = {
  enrichmentId: string;
  label: string;
};

/**
 * Expandable people list from owner / public-records results.
 * One action: Add to Contacts. Deepen (Get Info) lives on the saved contact.
 */
export function PersonMatchList({
  matches,
  deepenedByPeoId = {},
  onViewDeepened,
  onSavePerson,
  emptyTitle = 'No people in this result',
  emptySubtitle = 'Nothing to expand or save.',
}: {
  matches: PersonMatch[];
  deepenedByPeoId?: Record<string, DeepenedPersonRef>;
  onViewDeepened?: (ref: DeepenedPersonRef) => void;
  onSavePerson?: (match: PersonMatch) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (matches.length === 0) {
    return <ToolEmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => {
        const open = expandedKey === match.key;
        const deepened = match.peoId ? deepenedByPeoId[match.peoId] : undefined;

        return (
          <div
            key={match.key}
            className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpandedKey(open ? null : match.key)}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lake-blue/10 text-lake-blue">
                <IconUser className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-foreground">
                  {match.displayName}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">
                  {[match.subtitle, deepened ? 'Already deepened' : null]
                    .filter(Boolean)
                    .join(' · ') || 'Person match'}
                </span>
              </span>
              <span
                className={`shrink-0 text-[12px] font-semibold text-lake-blue transition ${
                  open ? 'rotate-90' : ''
                }`}
                aria-hidden
              >
                ›
              </span>
            </button>

            {open ? (
              <div className="space-y-3 border-t border-black/[0.06] px-3.5 py-3">
                {match.facts.length === 0 ? (
                  <p className="text-[13px] text-foreground-muted">
                    No structured fields on this match.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {match.facts.map((fact) => (
                      <div
                        key={`${match.key}:${fact.label}:${fact.value}`}
                        className="flex items-baseline justify-between gap-3 py-1"
                      >
                        <span className="shrink-0 text-[12px] text-foreground-muted">
                          {fact.label}
                        </span>
                        <span className="min-w-0 break-words text-right text-[13px] font-medium text-foreground">
                          {fact.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {deepened && onViewDeepened ? (
                    <ToolPrimaryButton
                      variant="secondary"
                      onClick={() => onViewDeepened(deepened)}
                    >
                      View details
                    </ToolPrimaryButton>
                  ) : null}

                  {onSavePerson ? (
                    <ToolPrimaryButton onClick={() => onSavePerson(match)}>
                      Add to Contacts
                    </ToolPrimaryButton>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      <ToolCostNote>Expand a match to review, then Add to Contacts.</ToolCostNote>
    </div>
  );
}
