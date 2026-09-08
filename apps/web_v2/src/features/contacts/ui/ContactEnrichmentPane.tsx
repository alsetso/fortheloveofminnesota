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
import {
  PersonMatchList,
  type DeepenedPersonRef,
} from '@/features/contacts/ui/PersonMatchList';
import { PersonDetailSections } from '@/features/contacts/ui/PersonDetailSections';
import {
  personMatchToCandidate,
  personMatchesFromEnrichment,
} from '@/features/contacts/logic/personMatches';
import OutOfCreditsDialog from '@/features/tools/wallet/OutOfCreditsDialog';
import { useWalletSummary } from '@/features/tools/wallet/useWalletSummary';
import { formatCredits, TOOL_CREDIT_COSTS } from '@/features/tools/core/toolCreditCosts';
import {
  ToolCostNote,
  ToolEmptyState,
  ToolPrimaryButton,
  ToolResultRow,
  ToolStatusLine,
} from '@/features/tools/core/toolUi';

type EnrichmentDetail = {
  id: string;
  kind: string;
  label: string;
  creditsCharged: number;
  toolLookupKind: 'people' | 'properties' | null;
  toolLookupId: string | null;
  parentEnrichmentId: string | null;
  personId: string | null;
  addressId: string | null;
  summary: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

type ChildPersonDetail = {
  id: string;
  label: string;
  peoId: string | null;
  summary: Record<string, unknown> | null;
};

type Phase =
  | { step: 'detail' }
  | { step: 'confirm'; candidate: ContactCandidate };

/**
 * Durable enrichment viewer — list/expand people when present, then Identify → Save.
 */
export default function ContactEnrichmentPane({
  pane,
}: {
  pane: Extract<DockPane, { id: 'subpage' }>;
}) {
  const { openSubpage } = useMapDock();
  const { refresh: refreshWallet } = useWalletSummary();
  const enrichmentId = pane.slug?.startsWith('enrichment:')
    ? pane.slug.slice('enrichment:'.length)
    : pane.slug;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentDetail | null>(null);
  const [candidates, setCandidates] = useState<ContactCandidate[]>([]);
  const [childPersonDetails, setChildPersonDetails] = useState<ChildPersonDetail[]>([]);
  const [phase, setPhase] = useState<Phase>({ step: 'detail' });
  const [status, setStatus] = useState<string | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);

  const load = useCallback(async () => {
    if (!enrichmentId) {
      setError('Missing enrichment');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPhase({ step: 'detail' });
    try {
      const res = await fetch(`/api/contacts/enrichments/${enrichmentId}`, {
        credentials: 'include',
      });
      const json = (await res.json()) as {
        enrichment?: EnrichmentDetail;
        candidates?: ContactCandidate[];
        childPersonDetails?: ChildPersonDetail[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load enrichment');
      setEnrichment(json.enrichment ?? null);
      setCandidates(json.candidates ?? []);
      setChildPersonDetails(json.childPersonDetails ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setEnrichment(null);
      setCandidates([]);
      setChildPersonDetails([]);
    } finally {
      setLoading(false);
    }
  }, [enrichmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const facts = useMemo(
    () => (enrichment ? enrichmentFacts(enrichment.kind, enrichment.payload) : []),
    [enrichment],
  );

  const propertyImage = useMemo(
    () =>
      enrichment && (enrichment.kind === 'property' || enrichment.kind === 'owner')
        ? propertyImageFromPayload(enrichment.payload)
        : null,
    [enrichment],
  );

  const personMatches = useMemo(
    () =>
      enrichment
        ? personMatchesFromEnrichment(enrichment.kind, enrichment.payload)
        : [],
    [enrichment],
  );

  const listKinds = enrichment?.kind === 'owner' || enrichment?.kind === 'public_records';

  const deepenedByPeoId = useMemo(() => {
    const map: Record<string, DeepenedPersonRef> = {};
    for (const child of childPersonDetails) {
      if (!child.peoId) continue;
      if (!map[child.peoId]) {
        map[child.peoId] = { enrichmentId: child.id, label: child.label };
      }
    }
    return map;
  }, [childPersonDetails]);

  /** Address candidates — drop the subject address when this trail is already on a saved contact. */
  const addressCandidates = useMemo(() => {
    const addrs = candidates.filter((c) => c.kind === 'address');
    if (enrichment?.addressId && (enrichment.kind === 'property' || enrichment.kind === 'owner')) {
      return [];
    }
    return addrs;
  }, [candidates, enrichment]);

  const identifyCandidates = useMemo(() => {
    if (!enrichment) return [];
    if (enrichment.kind === 'person_detail' || listKinds) return addressCandidates;
    if (enrichment.addressId && enrichment.kind === 'property') {
      return candidates.filter((c) => c.kind === 'person');
    }
    return candidates;
  }, [enrichment, listKinds, addressCandidates, candidates]);

  const showOwnerNextStep =
    enrichment?.kind === 'property' && Boolean(enrichment.addressId);

  function openEnrichment(id: string, title: string) {
    openSubpage({
      title,
      subtitle: 'Enrichment',
      kind: 'contact-enrichment',
      slug: `enrichment:${id}`,
    });
  }

  function onSaved(result: ConfirmSaveResult) {
    openSavedContactDetail(openSubpage, result);
  }

  async function onGetOwnerInformation() {
    if (!enrichment?.addressId || ownerBusy) return;
    const address =
      (typeof enrichment.payload.address === 'string' && enrichment.payload.address) ||
      enrichment.label;
    setOwnerBusy(true);
    setStatus('Looking up owners…');
    try {
      const res = await fetch('/api/realestate/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          address,
          mode: 'skiptrace',
          contactAddressId: enrichment.addressId,
          parentEnrichmentId: enrichment.id,
        }),
      });
      let json: {
        enrichmentId?: string | null;
        lookupId?: string | null;
        alreadyEnriched?: boolean;
        cached?: boolean;
        creditsCharged?: number;
        address?: string;
        error?: string;
      };
      try {
        json = (await res.json()) as typeof json;
      } catch {
        throw new Error(
          res.ok ? 'Lookup returned an invalid response' : `Lookup failed (${res.status})`,
        );
      }
      if (res.status === 402) {
        setOutOfCredits(true);
        setStatus('Not enough credits.');
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Owner lookup failed');
      await refreshWallet();
      setStatus(
        json.alreadyEnriched
          ? 'Already on file · opening enrichment'
          : json.cached
            ? 'Cached result · no credits used'
            : `Charged ${json.creditsCharged ?? 1} credit`,
      );
      if (json.enrichmentId) {
        openEnrichment(json.enrichmentId, json.address ?? address);
        return;
      }
      if (json.lookupId) {
        openSubpage({
          title: json.address ?? address,
          subtitle: 'Owners',
          kind: 'tool-result',
          slug: `properties:${json.lookupId}`,
        });
        return;
      }
      throw new Error('Lookup succeeded but no result id returned');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Owner lookup failed');
    } finally {
      setOwnerBusy(false);
    }
  }

  return (
    <DockPaneShell>
      <OutOfCreditsDialog open={outOfCredits} onClose={() => setOutOfCredits(false)} />
      <div className="space-y-5 pb-6">
        {loading ? (
          <DockSection title="Enrichment">
            <DockSkeletonRows count={4} />
          </DockSection>
        ) : null}

        {error ? (
          <DockSection title="Enrichment">
            <ToolEmptyState title="Couldn’t open enrichment" subtitle={error} />
            <ToolPrimaryButton variant="secondary" onClick={() => void load()}>
              Retry
            </ToolPrimaryButton>
          </DockSection>
        ) : null}

        {!loading && !error && enrichment && phase.step === 'detail' ? (
          <>
            <DockSection
              title={enrichment.label}
              subtitle={`${enrichmentKindLabel(enrichment.kind)} · ${formatCredits(enrichment.creditsCharged)} · ${new Date(enrichment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
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
              ) : enrichment.kind === 'person_detail' ? (
                <p className="px-0.5 text-[13px] text-foreground-muted">
                  Deep person pull · structured sections below
                </p>
              ) : facts.length === 0 ? (
                <ToolEmptyState
                  title="No structured facts"
                  subtitle="Payload is saved on this contact — use Identify & save below when people or addresses are present."
                />
              ) : (
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
              )}
            </DockSection>

            {status ? <ToolStatusLine>{status}</ToolStatusLine> : null}

            {enrichment.kind === 'person_detail' ? (
              <PersonDetailSections
                payload={enrichment.payload}
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
                  deepenedByPeoId={deepenedByPeoId}
                  onViewDeepened={(ref) => openEnrichment(ref.enrichmentId, ref.label)}
                  onSavePerson={(m) =>
                    setPhase({
                      step: 'confirm',
                      candidate: personMatchToCandidate(m),
                    })
                  }
                />
              </DockSection>
            ) : null}

            {showOwnerNextStep ? (
              <DockSection
                title="Next step"
                subtitle="Property details are on this saved address. Pull owners when you’re ready."
              >
                <ToolPrimaryButton
                  credits={TOOL_CREDIT_COSTS.realEstateOwner}
                  disabled={ownerBusy}
                  loading={ownerBusy}
                  onClick={() => void onGetOwnerInformation()}
                >
                  Get owner information
                </ToolPrimaryButton>
                <ToolCostNote>1 credit · once per address · opens matches to review</ToolCostNote>
              </DockSection>
            ) : null}

            {!showOwnerNextStep || identifyCandidates.length > 0 ? (
              <DockSection
                title="Identify & save"
                subtitle={
                  enrichment.kind === 'person_detail'
                    ? 'Extra people or addresses from this pull — or use + on a section row above.'
                    : listKinds
                      ? 'Addresses from this enrichment, or use Save person on an expanded match.'
                      : 'Optional — save new people or addresses from this enrichment into your book.'
                }
              >
                <ContactCandidateList
                  candidates={identifyCandidates}
                  emptyTitle={
                    enrichment.kind === 'person_detail' || listKinds
                      ? 'No extra addresses'
                      : 'Nothing to identify'
                  }
                  emptySubtitle={
                    enrichment.kind === 'person_detail'
                      ? 'Use the section + buttons above for people and addresses from this pull.'
                      : listKinds
                        ? 'People are listed above — expand a match to save them.'
                        : 'No clear person or address fields.'
                  }
                  onSelect={(c) => setPhase({ step: 'confirm', candidate: c })}
                />
              </DockSection>
            ) : null}

            {enrichment.toolLookupId && enrichment.toolLookupKind ? (
              <ToolPrimaryButton
                variant="secondary"
                onClick={() =>
                  openSubpage({
                    title: enrichment.label,
                    subtitle: 'Tool result',
                    kind: 'tool-result',
                    slug: `${enrichment.toolLookupKind}:${enrichment.toolLookupId}`,
                  })
                }
              >
                Reopen tools archive
              </ToolPrimaryButton>
            ) : null}

            {(enrichment.personId || enrichment.addressId) && (
              <ToolPrimaryButton
                variant="secondary"
                onClick={() =>
                  openSubpage({
                    title: enrichment.label,
                    subtitle: 'Contact',
                    kind: 'contact-detail',
                    slug: enrichment.personId
                      ? `person:${enrichment.personId}`
                      : `address:${enrichment.addressId}`,
                  })
                }
              >
                Back to contact
              </ToolPrimaryButton>
            )}
          </>
        ) : null}

        {phase.step === 'confirm' && enrichment ? (
          <ContactConfirmSave
            candidate={phase.candidate}
            source="tool_lookup"
            sourceLookupId={enrichment.toolLookupId}
            sourceLookupKind={enrichment.toolLookupKind}
            onBack={() => setPhase({ step: 'detail' })}
            onSaved={onSaved}
          />
        ) : null}
      </div>
    </DockPaneShell>
  );
}

/** Compact trail row for contact detail lists. */
export function EnrichmentTrailRow({
  kind,
  label,
  creditsCharged,
  createdAt,
  summaryLine,
  onClick,
}: {
  kind: string;
  label: string;
  creditsCharged: number;
  createdAt: string;
  summaryLine?: string;
  onClick: () => void;
}) {
  return (
    <ToolResultRow
      title={label}
      subtitle={[
        enrichmentKindLabel(kind),
        formatCredits(creditsCharged),
        summaryLine,
        new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ]
        .filter(Boolean)
        .join(' · ')}
      onClick={onClick}
    />
  );
}
