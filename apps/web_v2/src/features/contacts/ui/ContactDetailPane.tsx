'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DockPane } from '@/features/map/dockCore/core/dockPanes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DockPaneShell,
  DockSection,
  DockSkeletonRows,
} from '@/features/map/dockCore/panes/DockPaneShell';
import { getPeoId } from '@/lib/people/personExpansion';
import { TOOL_CREDIT_COSTS } from '@/features/tools/core/toolCreditCosts';
import {
  ToolCostNote,
  ToolEmptyState,
  ToolPrimaryButton,
  ToolStatusLine,
} from '@/features/tools/core/toolUi';
import OutOfCreditsDialog from '@/features/tools/wallet/OutOfCreditsDialog';
import { useWalletSummary } from '@/features/tools/wallet/useWalletSummary';
import { AddressContactEditForm } from '@/features/contacts/ui/AddressContactEditForm';
import { ContactAvatarCircle } from '@/features/contacts/ui/ContactAvatarCircle';
import { InlineEnrichmentCards } from '@/features/contacts/ui/InlineEnrichmentCards';
import { PersonContactEditForm } from '@/features/contacts/ui/PersonContactEditForm';
import { uploadContactPersonAvatar } from '@/features/contacts/state/uploadContactPersonAvatar';
import { IconChevronRight } from '@/features/map/dockCore/core/icons';

type SavedPersonDetail = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  emails: string[] | null;
  phones: string[] | null;
  notes: string | null;
  tag: string | null;
  avatar_url: string | null;
  nickname: string | null;
  description: string | null;
  work: string | null;
  source: string;
  source_lookup_id: string | null;
  source_lookup_kind: 'people' | 'properties' | null;
  linked_account_id: string | null;
  raw: Record<string, unknown> | null;
  created_at: string;
};

type SavedAddressDetail = {
  id: string;
  label: string;
  line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  tag: string | null;
  source: string;
  source_lookup_id: string | null;
  source_lookup_kind: 'people' | 'properties' | null;
  raw: Record<string, unknown> | null;
  created_at: string;
};

type LinkedAddress = {
  id: string;
  label: string;
  line1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  tag: string | null;
  relationship: string;
};

type LinkedPerson = {
  id: string;
  displayName: string;
  tag: string | null;
  avatarUrl: string | null;
  relationship: string;
};

type EnrichmentListItem = {
  id: string;
  kind: string;
  label: string;
  credits_charged: number;
  tool_lookup_kind: 'people' | 'properties' | null;
  tool_lookup_id: string | null;
  parent_enrichment_id: string | null;
  summary: Record<string, unknown> | null;
  created_at: string;
  suggestions?: { phones: string[]; emails: string[] };
};

function parseContactRef(slug: string | undefined): {
  kind?: 'person' | 'address';
  id?: string;
} {
  if (!slug) return {};
  if (slug.startsWith('person:')) {
    return { kind: 'person', id: slug.slice('person:'.length) };
  }
  if (slug.startsWith('address:')) {
    return { kind: 'address', id: slug.slice('address:'.length) };
  }
  return {};
}

function formatSource(source: string): string {
  switch (source) {
    case 'tool_lookup':
      return 'Tool lookup';
    case 'find_me':
      return 'Find Me';
    case 'map':
      return 'Map';
    case 'search':
      return 'Search';
    default:
      return 'Manual';
  }
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-0.5 py-1.5">
      <span className="shrink-0 text-[12px] text-foreground-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

/** Quiet Get Info row — expand to choose a paid deepen (Contacts-style). */
function GetInfoSection({
  complete,
  open,
  onToggle,
  children,
}: {
  complete?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-black/[0.04]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] text-lake-blue">Get Info…</span>
          <span className="mt-0.5 block text-[13px] text-foreground-muted">
            {complete
              ? 'Record complete · open prior pulls above'
              : 'Public records, property, or owners'}
          </span>
        </span>
        <IconChevronRight
          className={`h-4 w-4 shrink-0 text-foreground-muted/40 transition ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-black/[0.06] px-4 py-3.5">{children}</div>
      ) : null}
    </section>
  );
}

function formatRelationship(value: string): string {
  switch (value) {
    case 'current':
      return 'Current';
    case 'previous':
      return 'Past';
    case 'owner':
      return 'Owner';
    case 'resident':
      return 'Resident';
    case 'associated':
      return 'Associated';
    default:
      return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }
}

/**
 * Saved contact detail — enrichment CTAs write a durable trail, then open the viewer.
 * Dock: `<ContactDetailPane pane={pane} />`
 * Sheet: `<ContactDetailPane embedded kind id onBack onSelectContact editing onEditingChange onTitleChange />`
 */
export default function ContactDetailPane(
  props:
    | { pane: Extract<DockPane, { id: 'subpage' }>; embedded?: false }
    | {
        embedded: true;
        kind: 'person' | 'address';
        id: string;
        onBack?: () => void;
        onSelectContact?: (kind: 'person' | 'address', id: string) => void;
        query?: string | null;
        editing?: boolean;
        onEditingChange?: (editing: boolean) => void;
        onTitleChange?: (title: string | null) => void;
      },
) {
  const embedded = props.embedded === true;
  const { openSubpage } = useMapDock();
  const { refresh: refreshWallet } = useWalletSummary();

  const refKind = embedded ? props.kind : parseContactRef(props.pane.slug).kind;
  const refId = embedded ? props.id : parseContactRef(props.pane.slug).id;
  const ref = { kind: refKind, id: refId };
  const onSelectContact = embedded ? props.onSelectContact : undefined;
  const onTitleChange = embedded ? props.onTitleChange : undefined;
  const [dockEditing, setDockEditing] = useState(false);
  const editing = embedded ? Boolean(props.editing) : dockEditing;
  const setEditing = (next: boolean) => {
    if (embedded) props.onEditingChange?.(next);
    else setDockEditing(next);
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<SavedPersonDetail | null>(null);
  const [address, setAddress] = useState<SavedAddressDetail | null>(null);
  const [enrichments, setEnrichments] = useState<EnrichmentListItem[]>([]);
  const [linkedAddresses, setLinkedAddresses] = useState<LinkedAddress[]>([]);
  const [linkedPeople, setLinkedPeople] = useState<LinkedPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [getInfoOpen, setGetInfoOpen] = useState(false);
  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!ref.kind || !ref.id) {
      setError('Missing contact reference');
      setLoading(false);
      return null;
    }
    if (!opts?.soft) {
      setLoading(true);
      setError(null);
      setPerson(null);
      setAddress(null);
      setLinkedAddresses([]);
      setLinkedPeople([]);
    }
    try {
      const res = await fetch(`/api/contacts/${ref.id}?kind=${ref.kind}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        person?: SavedPersonDetail;
        address?: SavedAddressDetail;
        enrichments?: EnrichmentListItem[];
        linkedAddresses?: LinkedAddress[];
        linkedPeople?: LinkedPerson[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load contact');
      if (ref.kind === 'person') {
        setPerson(json.person ?? null);
        setLinkedAddresses(json.linkedAddresses ?? []);
      } else {
        setAddress(json.address ?? null);
        setLinkedPeople(json.linkedPeople ?? []);
      }
      setEnrichments(json.enrichments ?? []);
      return json;
    } catch (err) {
      if (!opts?.soft) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } else {
        setStatus(err instanceof Error ? err.message : 'Could not refresh contact');
      }
      return null;
    } finally {
      if (!opts?.soft) setLoading(false);
    }
  }, [ref.kind, ref.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!onTitleChange) return;
    if (loading) {
      onTitleChange(null);
      return;
    }
    onTitleChange(person?.display_name ?? address?.label ?? null);
  }, [onTitleChange, loading, person?.display_name, address?.label]);

  const peoId = useMemo(() => getPeoId(person?.raw ?? null), [person]);

  const propertyEnrichment = useMemo(
    () => enrichments.find((e) => e.kind === 'property') ?? null,
    [enrichments],
  );
  const ownerEnrichment = useMemo(
    () => enrichments.find((e) => e.kind === 'owner') ?? null,
    [enrichments],
  );
  const publicRecordsEnrichment = useMemo(
    () => enrichments.find((e) => e.kind === 'public_records') ?? null,
    [enrichments],
  );
  const personDetailEnrichment = useMemo(
    () => enrichments.find((e) => e.kind === 'person_detail') ?? null,
    [enrichments],
  );

  // Promote existing deepen phones/emails onto the book record when opening a person.
  useEffect(() => {
    if (!embedded || ref.kind !== 'person' || !ref.id || !person || !personDetailEnrichment) {
      return;
    }
    const hasSuggestions =
      (personDetailEnrichment.suggestions?.phones?.length ?? 0) > 0 ||
      (personDetailEnrichment.suggestions?.emails?.length ?? 0) > 0;
    if (!hasSuggestions) return;
    void mergePersonDetailOntoContact(ref.id, person, enrichments);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merge once when detail enrichment arrives
  }, [embedded, ref.kind, ref.id, personDetailEnrichment?.id]);

  const addressComplete = Boolean(propertyEnrichment && ownerEnrichment);
  const peopleInfoComplete = Boolean(
    personDetailEnrichment || (publicRecordsEnrichment && !peoId),
  );

  const peoplePublicRecordsBody = useMemo(() => {
    if (!person) return null;
    const email = person.emails?.find((e) => e.includes('@'));
    if (email) return { type: 'email' as const, email };
    const phone = person.phones?.find((p) => p.replace(/\D/g, '').length >= 7);
    if (phone) return { type: 'phone' as const, phone };
    const name =
      [person.first_name, person.last_name].filter(Boolean).join(' ').trim() ||
      person.display_name.trim();
    if (name) return { type: 'name' as const, name };
    return null;
  }, [person]);

  /** Prefer structured street/city/state/zip for paid tools; fall back to label. */
  const addressQuery = useMemo(() => {
    if (!address) return '';
    const structured = [address.line1, address.city, address.state, address.postal_code]
      .filter(Boolean)
      .join(', ')
      .trim();
    if (structured.length >= 8) return structured;
    // Strip country suffix that confuses property APIs.
    return address.label
      .replace(/,\s*United States\s*$/i, '')
      .replace(/,\s*USA\s*$/i, '')
      .trim();
  }, [address]);

  function openEnrichment(enrichmentId: string, title: string) {
    openSubpage({
      title,
      subtitle: 'Enrichment',
      kind: 'contact-enrichment',
      slug: `enrichment:${enrichmentId}`,
    });
  }

  /** Own-tab: keep results on the contact. Dock: open enrichment / tool sheet. */
  async function presentLookupResult(opts: {
    title: string;
    enrichmentId?: string | null;
    lookupId?: string | null;
    archiveKind: 'people' | 'properties';
    subtitle: string;
  }) {
    setGetInfoOpen(false);
    const refreshed = await load({ soft: true });

    // Promote deepen phones/emails onto the book record so Edit + main details stay primary.
    if (embedded && ref.kind === 'person' && ref.id && refreshed?.person) {
      await mergePersonDetailOntoContact(ref.id, refreshed.person, refreshed.enrichments ?? []);
    }

    if (embedded) {
      // Stay on the contact header/fields — don't scroll enrichment over Edit + main details.
      return;
    }
    if (opts.enrichmentId) {
      openEnrichment(opts.enrichmentId, opts.title);
      return;
    }
    if (opts.lookupId) {
      openToolResult({
        title: opts.title,
        subtitle: opts.subtitle,
        archiveKind: opts.archiveKind,
        lookupId: opts.lookupId,
      });
    }
  }

  /** Pull phones/emails from person_detail enrichment into the book record when missing. */
  async function mergePersonDetailOntoContact(
    personId: string,
    current: SavedPersonDetail,
    currentEnrichments: EnrichmentListItem[],
  ) {
    const personDetail = currentEnrichments.find((e) => e.kind === 'person_detail') ?? null;
    const suggestedPhones = personDetail?.suggestions?.phones ?? [];
    const suggestedEmails = personDetail?.suggestions?.emails ?? [];
    if (suggestedPhones.length === 0 && suggestedEmails.length === 0) return;

    const existingPhones = (current.phones ?? []).filter(Boolean);
    const existingEmails = (current.emails ?? []).filter(Boolean);
    const phoneSet = new Set(existingPhones.map((p) => p.toLowerCase()));
    const emailSet = new Set(existingEmails.map((e) => e.toLowerCase()));
    const nextPhones = [...existingPhones];
    const nextEmails = [...existingEmails];
    for (const p of suggestedPhones) {
      const key = p.trim().toLowerCase();
      if (!key || phoneSet.has(key)) continue;
      phoneSet.add(key);
      nextPhones.push(p.trim());
    }
    for (const e of suggestedEmails) {
      const key = e.trim().toLowerCase();
      if (!key || emailSet.has(key)) continue;
      emailSet.add(key);
      nextEmails.push(e.trim());
    }

    if (
      nextPhones.length === existingPhones.length &&
      nextEmails.length === existingEmails.length
    ) {
      return;
    }

    const patchRes = await fetch(`/api/contacts/${personId}?kind=person`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        phones: nextPhones,
        emails: nextEmails,
      }),
    });
    const patchJson = (await patchRes.json()) as {
      person?: SavedPersonDetail;
      error?: string;
    };
    if (patchRes.ok && patchJson.person) {
      setPerson(patchJson.person);
    }
  }

  async function onPersonAvatar(file: File) {
    if (!person) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const url = await uploadContactPersonAvatar(person.id, file);
      const res = await fetch(`/api/contacts/${person.id}?kind=person`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatarUrl: url }),
      });
      const json = (await res.json()) as { person?: SavedPersonDetail; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not save photo');
      setPerson(json.person ?? { ...person, avatar_url: url });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAvatarUploading(false);
    }
  }

  function openToolResult(opts: {
    title: string;
    subtitle: string;
    archiveKind: 'people' | 'properties';
    lookupId: string;
  }) {
    openSubpage({
      title: opts.title,
      subtitle: opts.subtitle,
      kind: 'tool-result',
      slug: `${opts.archiveKind}:${opts.lookupId}`,
    });
  }

  async function onPersonDetailPull() {
    if (!person || !peoId || busy) return;
    setBusy(true);
    setStatus('Pulling full person details…');
    try {
      const res = await fetch('/api/people/public-records/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          peo_id: peoId,
          name: person.display_name,
          parent_lookup_id:
            person.source_lookup_kind === 'people'
              ? person.source_lookup_id ?? undefined
              : undefined,
          contactPersonId: person.id,
        }),
      });
      const json = (await res.json()) as {
        lookupId?: string | null;
        enrichmentId?: string | null;
        cached?: boolean;
        creditsCharged?: number;
        error?: string;
      };
      if (res.status === 402) {
        setOutOfCredits(true);
        setStatus('Not enough credits.');
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Detail pull failed');
      await refreshWallet();
      setStatus(
        json.cached
          ? 'Cached result · no credits used'
          : `Charged ${json.creditsCharged ?? 1} credit`,
      );
      await presentLookupResult({
        title: person.display_name,
        enrichmentId: json.enrichmentId,
        lookupId: json.lookupId,
        archiveKind: 'people',
        subtitle: 'Person detail',
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Detail pull failed');
    } finally {
      setBusy(false);
    }
  }

  async function onPersonPublicRecords() {
    if (!person || !peoplePublicRecordsBody || busy) return;
    setBusy(true);
    setStatus('Searching public records…');
    try {
      const res = await fetch('/api/people/public-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...peoplePublicRecordsBody,
          contactPersonId: person.id,
        }),
      });
      const json = (await res.json()) as {
        lookupId?: string | null;
        enrichmentId?: string | null;
        cached?: boolean;
        creditsCharged?: number;
        error?: string;
      };
      if (res.status === 402) {
        setOutOfCredits(true);
        setStatus('Not enough credits.');
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Public records failed');
      await refreshWallet();
      setStatus(
        json.cached
          ? 'Cached result · no credits used'
          : `Charged ${json.creditsCharged ?? 1} credit`,
      );
      await presentLookupResult({
        title: person.display_name,
        enrichmentId: json.enrichmentId,
        lookupId: json.lookupId,
        archiveKind: 'people',
        subtitle: 'Public records',
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Public records failed');
    } finally {
      setBusy(false);
    }
  }

  async function onAddressLookup(mode: 'zillow' | 'skiptrace') {
    if (!address || !addressQuery || busy) return;
    setBusy(true);
    setStatus(mode === 'zillow' ? 'Looking up property…' : 'Looking up owners…');
    try {
      const res = await fetch('/api/realestate/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          address: addressQuery,
          mode,
          contactAddressId: address.id,
        }),
      });
      let json: {
        lookupId?: string | null;
        enrichmentId?: string | null;
        cached?: boolean;
        alreadyEnriched?: boolean;
        creditsCharged?: number;
        address?: string;
        error?: string;
      };
      try {
        json = (await res.json()) as typeof json;
      } catch {
        throw new Error(
          res.ok
            ? 'Lookup returned an invalid response'
            : `Lookup failed (${res.status})`,
        );
      }
      if (res.status === 402) {
        setOutOfCredits(true);
        setStatus('Not enough credits.');
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Lookup failed');
      await refreshWallet();
      setStatus(
        json.alreadyEnriched
          ? 'Already on file'
          : json.cached
            ? 'Cached result · no credits used'
            : `Charged ${json.creditsCharged ?? 1} credit`,
      );
      if (!json.enrichmentId && !json.lookupId) {
        throw new Error('Lookup succeeded but no result id returned');
      }
      await presentLookupResult({
        title: json.address ?? address.label,
        enrichmentId: json.enrichmentId,
        lookupId: json.lookupId,
        archiveKind: 'properties',
        subtitle: mode === 'zillow' ? 'Property' : 'Owners',
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteContact() {
    if (!ref.kind || !ref.id || busy) return;
    const label =
      ref.kind === 'person'
        ? person?.display_name ?? 'this person'
        : address?.label ?? 'this address';
    if (!window.confirm(`Delete ${label} from your contact book?`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/contacts/${ref.id}?kind=${ref.kind}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not delete');
      if (embedded && props.embedded === true) props.onBack?.();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBusy(false);
    }
  }

  const body = (
      <div
        className={`space-y-5 ${
          embedded ? 'bg-[#f7f5f1] px-0 pb-12 pt-1' : 'pb-6'
        }`}
      >
        {loading ? (
          embedded ? (
            <div className="space-y-3 px-4 pt-6">
              <div className="mx-auto h-28 w-28 animate-pulse rounded-full bg-black/[0.06]" />
              <div className="mx-auto h-7 w-40 animate-pulse rounded bg-black/[0.06]" />
              <DockSkeletonRows count={3} />
            </div>
          ) : (
            <DockSection title="Contact">
              <DockSkeletonRows count={4} />
            </DockSection>
          )
        ) : null}

        {error ? (
          <div className={embedded ? 'px-4' : undefined}>
            <DockSection title="Contact">
              <ToolEmptyState title="Couldn’t open contact" subtitle={error} />
              <ToolPrimaryButton variant="secondary" onClick={() => void load()}>
                Retry
              </ToolPrimaryButton>
            </DockSection>
          </div>
        ) : null}

        {!loading && !error && person ? (
          <>
            <section className={embedded ? 'space-y-1' : 'space-y-3'}>
              {!embedded ? (
                <div className="flex items-start justify-between gap-3 px-0.5">
                  <div className="min-w-0">
                    <h2 className="truncate text-[1.15rem] font-semibold text-foreground">
                      {person.display_name}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-foreground-muted">
                      {[
                        person.nickname ? `“${person.nickname}”` : null,
                        person.tag ? `Tag · ${person.tag}` : null,
                        person.work ? `Work · ${person.work}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Saved person'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(!editing)}
                    className="shrink-0 rounded-full bg-lake-blue/10 px-3 py-1.5 text-[13px] font-semibold text-lake-blue transition active:scale-95"
                  >
                    {editing ? 'Done' : 'Edit'}
                  </button>
                </div>
              ) : null}

              <div className="flex flex-col items-center px-4 pb-1 pt-2">
                <ContactAvatarCircle
                  size={embedded ? 'xl' : 'lg'}
                  src={person.avatar_url}
                  name={person.display_name}
                  uploading={avatarUploading}
                  onFile={editing ? (file) => void onPersonAvatar(file) : undefined}
                />
                {embedded && editing ? (
                  <p className="mt-2 text-[14px] font-medium text-lake-blue">
                    {person.avatar_url ? 'Change Photo' : 'Add Photo'}
                  </p>
                ) : null}
                {embedded && !editing ? (
                  <>
                    <h2 className="mt-3 text-center text-[28px] font-bold leading-tight tracking-tight text-foreground">
                      {person.display_name}
                    </h2>
                    {person.nickname ? (
                      <p className="mt-0.5 text-[15px] text-foreground-muted">
                        “{person.nickname}”
                      </p>
                    ) : null}
                    {person.work ? (
                      <p className="text-[15px] text-foreground-muted">{person.work}</p>
                    ) : null}
                    {person.tag ? (
                      <p className="mt-0.5 text-[13px] text-foreground-muted">Tag · {person.tag}</p>
                    ) : null}
                  </>
                ) : null}
              </div>
              {avatarError ? (
                <p className="px-4 text-center text-[12px] text-red-600">{avatarError}</p>
              ) : null}
              {!embedded && person.linked_account_id ? (
                <MetaLine label="Account" value="Linked FTLOM user" />
              ) : null}
              {!embedded && !editing ? (
                <MetaLine label="Source" value={formatSource(person.source)} />
              ) : null}
            </section>

            <PersonContactEditForm
              person={person}
              editing={editing}
              chrome={embedded ? 'ios' : 'default'}
              formId="contact-person-edit"
              suggestions={personDetailEnrichment?.suggestions ?? null}
              onSaved={(next) =>
                setPerson((prev) => (prev ? { ...prev, ...next } : prev))
              }
              onDone={embedded ? () => setEditing(false) : undefined}
            />

            {linkedAddresses.length > 0 && !editing ? (
              embedded ? (
                <section className="space-y-2">
                  <p className="px-8 text-[13px] font-normal uppercase tracking-wide text-foreground-muted">
                    Linked addresses
                  </p>
                  <ul className="mx-4 overflow-hidden rounded-[10px] bg-white">
                    {linkedAddresses.map((link, i) => (
                      <li key={link.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectContact) {
                              onSelectContact('address', link.id);
                              return;
                            }
                            openSubpage({
                              title: link.label,
                              subtitle: 'Contact',
                              kind: 'contact-detail',
                              slug: `address:${link.id}`,
                            });
                          }}
                          className={`flex w-full items-center gap-3 bg-transparent px-4 py-3 text-left active:bg-black/[0.04] ${
                            i < linkedAddresses.length - 1
                              ? 'border-b border-black/[0.06]'
                              : ''
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[17px] text-foreground">
                              {link.label}
                            </span>
                            <span className="block text-[13px] text-foreground-muted">
                              {formatRelationship(link.relationship)}
                            </span>
                          </span>
                          <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/40" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <DockSection
                  title="Linked addresses"
                  subtitle="How this person connects to places in your book"
                >
                  {linkedAddresses.map((link) => (
                    <div key={link.id} className="space-y-1">
                      <MetaLine label="Relationship" value={formatRelationship(link.relationship)} />
                      <ToolPrimaryButton
                        variant="secondary"
                        onClick={() => {
                          if (onSelectContact) {
                            onSelectContact('address', link.id);
                            return;
                          }
                          openSubpage({
                            title: link.label,
                            subtitle: 'Contact',
                            kind: 'contact-detail',
                            slug: `address:${link.id}`,
                          });
                        }}
                      >
                        {link.label}
                      </ToolPrimaryButton>
                    </div>
                  ))}
                </DockSection>
              )
            ) : null}

            {!editing ? (
              <div className={embedded ? 'px-4' : undefined}>
                <GetInfoSection
                  complete={peopleInfoComplete}
                  open={getInfoOpen}
                  onToggle={() => setGetInfoOpen((v) => !v)}
                >
                  {!personDetailEnrichment && publicRecordsEnrichment && peoId ? (
                    <div className="space-y-2">
                      <ToolPrimaryButton
                        credits={TOOL_CREDIT_COSTS.peopleDetailPull}
                        disabled={busy}
                        loading={busy && status === 'Pulling full person details…'}
                        onClick={() => void onPersonDetailPull()}
                      >
                        Deepen person detail
                      </ToolPrimaryButton>
                      <ToolCostNote>1 credit · optional deepen when peo_id is known</ToolCostNote>
                    </div>
                  ) : null}

                  {!publicRecordsEnrichment && !personDetailEnrichment && peoId ? (
                    <div className="space-y-2">
                      <ToolPrimaryButton
                        credits={TOOL_CREDIT_COSTS.peopleDetailPull}
                        disabled={busy}
                        loading={busy && status === 'Pulling full person details…'}
                        onClick={() => void onPersonDetailPull()}
                      >
                        Deepen person detail
                      </ToolPrimaryButton>
                      <ToolCostNote>1 credit · once per person</ToolCostNote>
                    </div>
                  ) : null}

                  {!publicRecordsEnrichment &&
                  !personDetailEnrichment &&
                  !peoId &&
                  peoplePublicRecordsBody ? (
                    <div className="space-y-2">
                      <ToolPrimaryButton
                        credits={TOOL_CREDIT_COSTS.peoplePublicRecords}
                        disabled={busy}
                        loading={busy && status === 'Searching public records…'}
                        onClick={() => void onPersonPublicRecords()}
                      >
                        Search public records
                      </ToolPrimaryButton>
                      <ToolCostNote>1 credit · once per person</ToolCostNote>
                    </div>
                  ) : null}

                  {!publicRecordsEnrichment &&
                  !personDetailEnrichment &&
                  !peoId &&
                  !peoplePublicRecordsBody ? (
                    <p className="text-[13px] leading-snug text-foreground-muted">
                      Add an email, phone, or full name — then come back for Get Info.
                    </p>
                  ) : null}

                  {peopleInfoComplete &&
                  !(!personDetailEnrichment && publicRecordsEnrichment && peoId) ? (
                    <p className="text-[13px] text-foreground-muted">
                      Phones and emails live in details above. More from records below.
                    </p>
                  ) : null}
                </GetInfoSection>
              </div>
            ) : null}

            {!editing && enrichments.length > 0 ? (
              <div className={embedded ? 'px-4' : undefined}>
                <InlineEnrichmentCards
                  enrichments={enrichments}
                  omitPersonContactFields
                />
              </div>
            ) : null}

            {embedded && editing ? (
              <div className="mx-4 overflow-hidden rounded-[10px] bg-white">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDeleteContact()}
                  className="w-full px-4 py-3.5 text-center text-[17px] text-red-600 active:bg-black/[0.04] disabled:opacity-40"
                >
                  Delete Contact
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && !error && address ? (
          <>
            {editing && embedded ? (
              <AddressContactEditForm
                address={address}
                formId="contact-address-edit"
                onSaved={(next) =>
                  setAddress((prev) => (prev ? { ...prev, ...next } : prev))
                }
                onDone={() => setEditing(false)}
              />
            ) : (
              <>
                <section className={embedded ? 'space-y-1' : 'space-y-3'}>
                  {!embedded ? (
                    <div className="px-0.5">
                      <h2 className="truncate text-[1.15rem] font-semibold text-foreground">
                        {address.label}
                      </h2>
                      <p className="mt-0.5 text-[13px] text-foreground-muted">
                        {address.tag ? `Tag · ${address.tag}` : 'Saved address'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center px-4 pb-2 pt-3">
                      <span className="inline-flex h-28 w-28 items-center justify-center rounded-full bg-black/[0.06] text-foreground-muted">
                        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="currentColor" aria-hidden>
                          <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />
                        </svg>
                      </span>
                      <h2 className="mt-3 text-center text-[28px] font-bold leading-tight tracking-tight text-foreground">
                        {address.label}
                      </h2>
                      {address.tag ? (
                        <p className="mt-0.5 text-[13px] text-foreground-muted">Tag · {address.tag}</p>
                      ) : null}
                    </div>
                  )}
                  {embedded ? (
                    <div className="mx-4 overflow-hidden rounded-[10px] bg-white">
                      {address.line1 ? (
                        <div className="flex gap-3 border-b border-black/[0.06] px-4 py-2.5">
                          <span className="w-[4.75rem] shrink-0 text-[12px] text-foreground-muted">street</span>
                          <span className="min-w-0 flex-1 text-[17px] text-foreground">{address.line1}</span>
                        </div>
                      ) : null}
                      {[address.city, address.state, address.postal_code].filter(Boolean).length > 0 ? (
                        <div className="flex gap-3 border-b border-black/[0.06] px-4 py-2.5">
                          <span className="w-[4.75rem] shrink-0 text-[12px] text-foreground-muted">city</span>
                          <span className="min-w-0 flex-1 text-[17px] text-foreground">
                            {[address.city, address.state, address.postal_code]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      ) : null}
                      {address.notes ? (
                        <div className="flex gap-3 px-4 py-2.5">
                          <span className="w-[4.75rem] shrink-0 text-[12px] text-foreground-muted">notes</span>
                          <span className="min-w-0 flex-1 whitespace-pre-line text-[17px] text-foreground">
                            {address.notes}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {address.line1 ? <MetaLine label="Street" value={address.line1} /> : null}
                      {[address.city, address.state, address.postal_code].filter(Boolean).length > 0 ? (
                        <MetaLine
                          label="Locality"
                          value={[address.city, address.state, address.postal_code]
                            .filter(Boolean)
                            .join(', ')}
                        />
                      ) : null}
                      {address.lat != null && address.lng != null ? (
                        <MetaLine
                          label="Coords"
                          value={`${address.lat.toFixed(5)}, ${address.lng.toFixed(5)}`}
                        />
                      ) : null}
                      <MetaLine label="Source" value={formatSource(address.source)} />
                      {address.notes ? <MetaLine label="Notes" value={address.notes} /> : null}
                    </>
                  )}
                </section>

                {linkedPeople.length > 0 && !editing ? (
                  embedded ? (
                    <section className="space-y-2">
                      <p className="px-8 text-[13px] font-normal uppercase tracking-wide text-foreground-muted">
                        Linked people
                      </p>
                      <ul className="mx-4 overflow-hidden rounded-[10px] bg-white">
                        {linkedPeople.map((link, i) => (
                          <li key={link.id}>
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectContact) {
                                  onSelectContact('person', link.id);
                                  return;
                                }
                                openSubpage({
                                  title: link.displayName,
                                  subtitle: 'Contact',
                                  kind: 'contact-detail',
                                  slug: `person:${link.id}`,
                                });
                              }}
                              className={`flex w-full items-center gap-3 bg-transparent px-4 py-3 text-left active:bg-black/[0.04] ${
                                i < linkedPeople.length - 1
                                  ? 'border-b border-black/[0.06]'
                                  : ''
                              }`}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[17px] text-foreground">
                                  {link.displayName}
                                  {link.tag ? ` · ${link.tag}` : ''}
                                </span>
                                <span className="block text-[13px] text-foreground-muted">
                                  {formatRelationship(link.relationship)}
                                </span>
                              </span>
                              <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/40" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : (
                    <DockSection
                      title="Linked people"
                      subtitle="People in your book tied to this address"
                    >
                      {linkedPeople.map((link) => (
                        <div key={link.id} className="space-y-1">
                          <MetaLine label="Relationship" value={formatRelationship(link.relationship)} />
                          <ToolPrimaryButton
                            variant="secondary"
                            onClick={() => {
                              if (onSelectContact) {
                                onSelectContact('person', link.id);
                                return;
                              }
                              openSubpage({
                                title: link.displayName,
                                subtitle: 'Contact',
                                kind: 'contact-detail',
                                slug: `person:${link.id}`,
                              });
                            }}
                          >
                            {link.displayName}
                            {link.tag ? ` · ${link.tag}` : ''}
                          </ToolPrimaryButton>
                        </div>
                      ))}
                    </DockSection>
                  )
                ) : null}

                {!editing ? (
                  <div className={embedded ? 'px-4' : undefined}>
                    <GetInfoSection
                      complete={addressComplete}
                      open={getInfoOpen}
                      onToggle={() => setGetInfoOpen((v) => !v)}
                    >
                      <div className="space-y-2">
                        {!propertyEnrichment ? (
                          <>
                            <ToolPrimaryButton
                              credits={TOOL_CREDIT_COSTS.realEstateProperty}
                              disabled={!addressQuery || busy}
                              loading={busy && status === 'Looking up property…'}
                              onClick={() => void onAddressLookup('zillow')}
                            >
                              Property details
                            </ToolPrimaryButton>
                            <ToolCostNote>1 credit · once per address · cached repeats free</ToolCostNote>
                          </>
                        ) : null}

                        {!ownerEnrichment ? (
                          <>
                            <ToolPrimaryButton
                              variant={propertyEnrichment ? 'primary' : 'secondary'}
                              credits={TOOL_CREDIT_COSTS.realEstateOwner}
                              disabled={!addressQuery || busy}
                              loading={busy && status === 'Looking up owners…'}
                              onClick={() => void onAddressLookup('skiptrace')}
                            >
                              Owner info
                            </ToolPrimaryButton>
                            <ToolCostNote>1 credit · once per address</ToolCostNote>
                          </>
                        ) : null}

                        {addressComplete ? (
                          <p className="text-[13px] text-foreground-muted">
                            Extra details from Get Info are below.
                          </p>
                        ) : null}
                      </div>
                    </GetInfoSection>
                  </div>
                ) : null}

                {!editing && enrichments.length > 0 ? (
                  <div className={embedded ? 'px-4' : undefined}>
                    <InlineEnrichmentCards enrichments={enrichments} />
                  </div>
                ) : null}
              </>
            )}

            {embedded && editing ? (
              <div className="mx-4 overflow-hidden rounded-[10px] bg-white">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDeleteContact()}
                  className="w-full px-4 py-3.5 text-center text-[17px] text-red-600 active:bg-black/[0.04] disabled:opacity-40"
                >
                  Delete Address
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {status ? (
          <div className={embedded ? 'px-4' : undefined}>
            <ToolStatusLine>{status}</ToolStatusLine>
          </div>
        ) : null}
      </div>
  );

  if (embedded) {
    return (
      <>
        <OutOfCreditsDialog open={outOfCredits} onClose={() => setOutOfCredits(false)} />
        {body}
      </>
    );
  }

  return (
    <DockPaneShell>
      <OutOfCreditsDialog open={outOfCredits} onClose={() => setOutOfCredits(false)} />
      {body}
    </DockPaneShell>
  );
}
