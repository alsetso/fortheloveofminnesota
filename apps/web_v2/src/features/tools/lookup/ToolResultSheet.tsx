'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DockPane } from '@/features/map/dockCore/core/dockPanes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DockPaneShell,
  DockSection,
  DockSkeletonRows,
} from '@/features/map/dockCore/panes/DockPaneShell';
import { ContactCandidateList } from '@/features/contacts/ui/ContactCandidateList';
import {
  ContactConfirmSave,
  type ConfirmSaveResult,
} from '@/features/contacts/ui/ContactConfirmSave';
import {
  enrichmentFacts,
  enrichmentKindLabel,
  propertyImageFromPayload,
} from '@/features/contacts/logic/enrichmentFacts';
import type { ContactCandidate } from '@/features/contacts/logic/identifyCandidates';
import { openSavedContactDetail } from '@/features/contacts/state/openSavedContactDetail';
import { PersonMatchList } from '@/features/contacts/ui/PersonMatchList';
import { PersonDetailSections } from '@/features/contacts/ui/PersonDetailSections';
import {
  personMatchToCandidate,
  personMatchesFromToolArchive,
} from '@/features/contacts/logic/personMatches';
import { formatCredits } from '@/features/tools/core/toolCreditCosts';
import {
  ToolEmptyState,
  ToolPrimaryButton,
} from '@/features/tools/core/toolUi';

type ToolResultResponse =
  | {
      available: true;
      archiveKind: 'people' | 'properties';
      lookupId: string;
      lookupKind?: string | null;
      label: string;
      detail: string;
      creditsCharged: number;
      createdAt: string;
      expiresAt: string;
      candidates: ContactCandidate[];
      property?: unknown;
      owner?: unknown;
      result?: unknown;
      query?: unknown;
    }
  | {
      available: false;
      reason: 'expired' | 'lookup_missing' | 'not_a_spend';
      label?: string;
      archiveKind?: string;
      lookupId?: string;
      transactionId?: string;
    };

type Phase =
  | { step: 'results' }
  | { step: 'confirm'; candidate: ContactCandidate };

function parseResultRef(slug: string | undefined): {
  transactionId?: string;
  kind?: 'people' | 'properties';
  lookupId?: string;
} {
  if (!slug) return {};
  if (slug.startsWith('people:')) {
    return { kind: 'people', lookupId: slug.slice('people:'.length) };
  }
  if (slug.startsWith('properties:')) {
    return { kind: 'properties', lookupId: slug.slice('properties:'.length) };
  }
  return { transactionId: slug };
}

function factsKind(data: Extract<ToolResultResponse, { available: true }>): string {
  if (data.archiveKind === 'properties') {
    return data.lookupKind === 'skiptrace' ? 'owner' : 'property';
  }
  if (data.lookupKind === 'person_detail') return 'person_detail';
  if (data.lookupKind === 'account') return 'account';
  return 'public_records';
}

function factsPayload(
  data: Extract<ToolResultResponse, { available: true }>,
): Record<string, unknown> {
  if (data.archiveKind === 'properties') {
    return {
      address: data.label,
      property: data.property,
      owner: data.owner,
      mode: data.lookupKind,
    };
  }
  return {
    result: data.result,
    ...(data.result && typeof data.result === 'object'
      ? (data.result as Record<string, unknown>)
      : {}),
  };
}

/**
 * Dynamic tool result sheet — people or property.
 * Owner / public-records: expand matches before Save; peo_id Enhance when present.
 *
 * Dock: pass `pane`. Own-tab: pass `resultSlug` + `onComplete`.
 */
export default function ToolResultSheet({
  pane,
  resultSlug,
  onComplete,
}: {
  pane?: Extract<DockPane, { id: 'subpage' }>;
  resultSlug?: string;
  /** When set (Own-tab), parent owns post-save navigation instead of the dock. */
  onComplete?: (result: ConfirmSaveResult) => void;
}) {
  const { openSubpage } = useMapDock();
  const ref = parseResultRef(resultSlug ?? pane?.slug);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ToolResultResponse | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: 'results' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPhase({ step: 'results' });
    try {
      const params = new URLSearchParams();
      if (ref.transactionId) params.set('transactionId', ref.transactionId);
      if (ref.kind && ref.lookupId) {
        params.set('kind', ref.kind);
        params.set('id', ref.lookupId);
      }
      const res = await fetch(`/api/tools/result?${params}`, { credentials: 'include' });
      const json = (await res.json()) as ToolResultResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load result');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ref.transactionId, ref.kind, ref.lookupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const kind = data?.available ? factsKind(data) : null;

  const facts = useMemo(() => {
    if (!data?.available || !kind) return [];
    return enrichmentFacts(kind, factsPayload(data));
  }, [data, kind]);

  const propertyImage = useMemo(() => {
    if (!data?.available) return null;
    if (kind !== 'property' && kind !== 'owner') return null;
    return propertyImageFromPayload(factsPayload(data));
  }, [data, kind]);

  const personMatches = useMemo(() => {
    if (!data?.available) return [];
    if (kind === 'owner' || kind === 'public_records' || kind === 'person_detail') {
      return personMatchesFromToolArchive({
        archiveKind: data.archiveKind,
        lookupKind: data.lookupKind,
        owner: data.owner,
        result: data.result,
      });
    }
    return [];
  }, [data, kind]);

  const listKinds = kind === 'owner' || kind === 'public_records';

  const addressCandidates = useMemo(
    () => (data?.available ? data.candidates.filter((c) => c.kind === 'address') : []),
    [data],
  );

  function onSaved(result: ConfirmSaveResult) {
    if (onComplete) {
      onComplete(result);
      return;
    }
    openSavedContactDetail(openSubpage, result);
  }

  return (
    <DockPaneShell>
      <div className="space-y-5 pb-6">
        {loading ? (
          <DockSection title="Loading result">
            <DockSkeletonRows count={4} />
          </DockSection>
        ) : null}

        {error ? (
          <DockSection title="Result">
            <ToolEmptyState title="Couldn’t open result" subtitle={error} />
            <ToolPrimaryButton variant="secondary" onClick={() => void load()}>
              Retry
            </ToolPrimaryButton>
          </DockSection>
        ) : null}

        {!loading && !error && data && !data.available ? (
          <DockSection title={data.label ?? 'Result'}>
            <ToolEmptyState
              title={
                data.reason === 'expired'
                  ? 'Result expired'
                  : data.reason === 'not_a_spend'
                    ? 'No tool result'
                    : 'Result unavailable'
              }
              subtitle={
                data.reason === 'expired'
                  ? 'Lookup archives purge on a TTL. Run the tool again to refresh — cached repeats are free when available.'
                  : data.reason === 'not_a_spend'
                    ? 'Grants and refunds don’t have lookup results.'
                    : 'This spend isn’t linked to a saved lookup (or it was already purged).'
              }
            />
          </DockSection>
        ) : null}

        {!loading && !error && data?.available && phase.step === 'results' ? (
          <>
            <DockSection
              title={enrichmentKindLabel(kind ?? 'public_records')}
              subtitle={`${data.detail} · ${formatCredits(data.creditsCharged)} · ${new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            >
              {propertyImage ? (
                <div className="mb-3 overflow-hidden rounded-xl bg-black/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={propertyImage}
                    alt=""
                    className="aspect-[16/10] w-full object-cover"
                  />
                </div>
              ) : null}
              {listKinds && personMatches.length > 0 ? (
                <p className="px-0.5 text-[13px] text-foreground-muted">
                  {personMatches.length} people match
                  {personMatches.length === 1 ? '' : 'es'} · expand to review before saving
                </p>
              ) : facts.length > 0 ? (
                facts.map((fact) => (
                  <div
                    key={`${fact.label}:${fact.value}`}
                    className="flex items-baseline justify-between gap-3 px-0.5 py-1.5"
                  >
                    <span className="shrink-0 text-[12px] text-foreground-muted">
                      {fact.label}
                    </span>
                    <span className="min-w-0 truncate text-right text-[13px] font-medium text-foreground">
                      {fact.value}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-0.5 text-[13px] text-foreground-muted">{data.label}</p>
              )}
            </DockSection>

            {kind === 'person_detail' ? (
              <PersonDetailSections
                payload={factsPayload(data)}
                onSaveCandidate={(c) => setPhase({ step: 'confirm', candidate: c })}
              />
            ) : null}

            {listKinds && personMatches.length > 0 ? (
              <DockSection
                title="People"
                subtitle="Expand a row to review, then Add to Contacts."
              >
                <PersonMatchList
                  matches={personMatches}
                  onSavePerson={(m) =>
                    setPhase({
                      step: 'confirm',
                      candidate: personMatchToCandidate(m),
                    })
                  }
                />
              </DockSection>
            ) : null}

            {!(listKinds && personMatches.length > 0) || addressCandidates.length > 0 ? (
            <DockSection
              title={listKinds && personMatches.length > 0 ? 'Addresses' : 'Add to Contacts'}
              subtitle={
                kind === 'person_detail'
                  ? 'Extra people or addresses — or use + on a section row above.'
                  : listKinds && personMatches.length > 0
                    ? 'Addresses from this result.'
                    : 'Save people or addresses from this result into your book.'
              }
            >
              <ContactCandidateList
                candidates={
                  kind === 'person_detail' || listKinds
                    ? addressCandidates
                    : data.candidates
                }
                emptyTitle={
                  kind === 'person_detail' || listKinds
                    ? 'No addresses'
                    : 'Nothing to identify'
                }
                emptySubtitle={
                  kind === 'person_detail'
                    ? 'Use the section + buttons above for people and addresses from this pull.'
                    : listKinds
                      ? 'People are listed above — expand a match to add them.'
                      : 'No clear person or address fields.'
                }
                onSelect={(c) => setPhase({ step: 'confirm', candidate: c })}
              />
            </DockSection>
            ) : null}
          </>
        ) : null}

        {phase.step === 'confirm' && data?.available ? (
          <ContactConfirmSave
            candidate={phase.candidate}
            source="tool_lookup"
            sourceLookupId={data.lookupId}
            sourceLookupKind={data.archiveKind}
            onBack={() => setPhase({ step: 'results' })}
            onSaved={onSaved}
          />
        ) : null}
      </div>
    </DockPaneShell>
  );
}
