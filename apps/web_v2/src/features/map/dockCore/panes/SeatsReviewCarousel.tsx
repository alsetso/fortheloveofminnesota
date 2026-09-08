'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconPencil, IconSearch, IconSpinner, IconUser } from '@/features/map/dockCore/core/icons';
import { ENTRY_ROW_GLASS_CLASS } from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { TOOL_FIELD_CLASS } from '@/features/tools/core/toolUi';
import {
  emptySeatDetailFields,
  sanitizeSeatProposal,
  type SeatCompareCard,
  type SeatEnrichField,
  type SeatProposal,
} from '@/lib/ai/unitSeatsFacts';

type EnrichTranscript = {
  prompt: string;
  answer: string;
};

// ─── Avatar (local copy — keeps this component self-contained) ─────────────

function CardAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  if (initials) {
    return (
      <span
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lake-blue/15 text-[13px] font-semibold text-lake-blue"
        aria-hidden
      >
        {initials}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue"
      aria-hidden
    >
      <IconUser className="h-6 w-6" />
    </span>
  );
}

function enrichFieldLabel(key: SeatEnrichField): string {
  switch (key) {
    case 'party':
      return 'party';
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'website_url':
      return 'website';
    case 'bio':
      return 'bio';
  }
}

function missingDetailCount(draft: SeatProposal): number {
  return emptySeatDetailFields(draft).length;
}

// ─── Individual review card ────────────────────────────────────────────────

function ReviewCard({
  card,
  draft,
  active,
  onSelect,
}: {
  card: SeatCompareCard;
  draft: SeatProposal;
  active: boolean;
  onSelect: () => void;
}) {
  const status = card.status;
  const name = draft.full_name.trim();
  const missing = status === 'pending' ? missingDetailCount(draft) : 0;

  const statusTint =
    status === 'accepted'
      ? 'ring-2 ring-lake-blue/50 bg-lake-blue/8'
      : status === 'rejected'
        ? 'opacity-40'
        : active
          ? 'ring-2 ring-lake-blue/60 bg-lake-blue/8'
          : ENTRY_ROW_GLASS_CLASS;

  return (
    <button
      type="button"
      onClick={status === 'pending' ? onSelect : undefined}
      disabled={status !== 'pending'}
      aria-pressed={active}
      className={`relative flex w-[6.5rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl px-2 pt-3.5 pb-3 text-center transition disabled:cursor-default active:scale-[0.97] ${statusTint}`}
    >
      <CardAvatar name={name || draft.title} />

      <div className="mt-1 w-full min-w-0">
        <p className="truncate text-[12px] font-semibold text-foreground leading-tight">
          {name || '—'}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-foreground-muted leading-tight">
          {[draft.title, draft.sub_label].filter(Boolean).join(' · ')}
        </p>
      </div>

      {draft.party?.trim() ? (
        <span className="mt-0.5 rounded-full bg-map-ink-subtle px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-foreground-muted">
          {draft.party.trim()}
        </span>
      ) : missing > 0 ? (
        <span className="mt-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
          {missing} empty
        </span>
      ) : null}

      {status === 'accepted' ? (
        <span className="absolute top-1.5 right-1.5 rounded-full bg-lake-blue/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-lake-blue">
          Saved
        </span>
      ) : status === 'rejected' ? (
        <span className="absolute top-1.5 right-1.5 rounded-full bg-foreground/8 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-foreground-muted">
          Skipped
        </span>
      ) : (
        <span className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-lake-blue/60">
          <IconPencil className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

// ─── Inline edit form (About-section style) ────────────────────────────────

type FormFieldKey =
  | 'full_name'
  | 'party'
  | 'email'
  | 'phone'
  | 'website_url'
  | 'bio'
  | 'source_urls';

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function TranscriptBlock({
  label,
  text,
  defaultOpen,
}: {
  label: string;
  text: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-map-ink-subtle bg-black/[0.02] open:bg-black/[0.03]"
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </summary>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-map-ink-subtle px-3 py-2.5 text-[11px] leading-snug text-foreground">
        {text}
      </pre>
    </details>
  );
}

function InlineRow({
  label,
  value,
  editAction,
}: {
  label: string;
  value: ReactNode;
  editAction?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
          {label}
        </p>
        {editAction}
      </div>
      <div className="mt-0.5 text-sm leading-snug text-foreground break-words">{value}</div>
    </div>
  );
}

function EditForm({
  draft,
  existingName,
  saving,
  enriching,
  error,
  enrichNote,
  transcript,
  onChange,
  onAccept,
  onSkip,
  onEnrich,
}: {
  draft: SeatProposal;
  existingName: string | null;
  saving: boolean;
  enriching: boolean;
  error: string | null;
  enrichNote: string | null;
  transcript: EnrichTranscript | null;
  onChange: (next: SeatProposal) => void;
  onAccept: () => void;
  onSkip: () => void;
  onEnrich: () => void;
}) {
  const [editingKey, setEditingKey] = useState<FormFieldKey | null>(null);
  const [fieldDraft, setFieldDraft] = useState('');
  const emptyFields = emptySeatDetailFields(draft);
  const canEnrich = Boolean(draft.full_name.trim());
  const busy = saving || enriching;
  const empty = <span className="text-foreground-muted">Not set</span>;
  const sources = draft.source_urls ?? [];

  const beginEdit = (key: FormFieldKey) => {
    if (busy) return;
    if (key === 'source_urls') setFieldDraft(sources.join('\n'));
    else setFieldDraft((draft[key] as string | null | undefined) ?? '');
    setEditingKey(key);
  };

  const cancelField = () => {
    setEditingKey(null);
    setFieldDraft('');
  };

  const commitField = () => {
    if (!editingKey) return;
    if (editingKey === 'source_urls') {
      onChange({
        ...draft,
        source_urls: fieldDraft
          .split(/\n|;/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } else if (editingKey === 'full_name') {
      onChange({ ...draft, full_name: fieldDraft });
    } else {
      onChange({ ...draft, [editingKey]: fieldDraft });
    }
    cancelField();
  };

  const pencil = (key: FormFieldKey, label: string) =>
    !busy && editingKey !== key ? (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        onClick={() => beginEdit(key)}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lake-blue hover:bg-map-ink-subtle"
      >
        <IconPencil className="h-3.5 w-3.5" />
      </button>
    ) : null;

  const fieldEditor = (multiline?: boolean, placeholder?: string) => (
    <div className="space-y-2 pt-1">
      {multiline ? (
        <textarea
          value={fieldDraft}
          disabled={busy}
          onChange={(e) => setFieldDraft(e.target.value)}
          rows={3}
          className={`${TOOL_FIELD_CLASS} h-auto min-h-[4.5rem] resize-y py-2.5`}
          placeholder={placeholder}
          autoFocus
        />
      ) : (
        <input
          type="text"
          value={fieldDraft}
          disabled={busy}
          onChange={(e) => setFieldDraft(e.target.value)}
          className={TOOL_FIELD_CLASS}
          placeholder={placeholder}
          autoFocus
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={commitField}
          className="flex-1 rounded-xl bg-lake-blue px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          Done
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={cancelField}
          className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold text-foreground ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className={`space-y-2.5 rounded-2xl px-3.5 py-3.5 ${ENTRY_ROW_GLASS_CLASS}`}>
      <div className="flex items-start justify-between gap-2 pb-0.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            {[draft.title, draft.sub_label].filter(Boolean).join(' · ')}
          </p>
          {existingName ? (
            <p className="mt-0.5 text-[10px] text-foreground-muted">
              Currently: <span className="text-foreground">{existingName}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-foreground-muted">Vacant in current data</p>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={busy || !canEnrich}
        onClick={onEnrich}
        title={
          canEnrich
            ? emptyFields.length
              ? `Search for: ${emptyFields.map(enrichFieldLabel).join(', ')} + sources`
              : 'Search again for sources / missing details'
            : 'Add a name first'
        }
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-lake-blue/30 bg-lake-blue/8 px-3 py-2.5 text-[12px] font-semibold text-lake-blue transition active:scale-[0.99] disabled:opacity-40"
      >
        {enriching ? (
          <IconSpinner className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <IconSearch className="h-3.5 w-3.5" />
        )}
        {enriching
          ? 'Searching…'
          : emptyFields.length > 0
            ? `Enrich empty details (${emptyFields.length})`
            : 'Enrich / find sources'}
      </button>

      {enrichNote ? (
        <p className="text-[11px] text-lake-blue">{enrichNote}</p>
      ) : emptyFields.length > 0 ? (
        <p className="text-[11px] text-foreground-muted">
          Missing: {emptyFields.map(enrichFieldLabel).join(', ')}. Tap a pencil to edit inline —
          Enrich fills blanks + captures sources.
        </p>
      ) : null}

      {transcript ? (
        <div className="space-y-1.5">
          <TranscriptBlock label="Enrich prompt" text={transcript.prompt} />
          <TranscriptBlock label="Enrich response" text={transcript.answer} defaultOpen />
        </div>
      ) : null}

      <div className="space-y-2.5 border-t border-map-ink-subtle pt-2.5">
        <InlineRow
          label="Name"
          editAction={pencil('full_name', 'Name')}
          value={
            editingKey === 'full_name'
              ? fieldEditor(false, 'Full name')
              : draft.full_name.trim() || empty
          }
        />
        <InlineRow
          label="Party"
          editAction={pencil('party', 'Party')}
          value={
            editingKey === 'party'
              ? fieldEditor(false, 'Party')
              : draft.party?.trim() || empty
          }
        />
        <InlineRow
          label="Email"
          editAction={pencil('email', 'Email')}
          value={
            editingKey === 'email' ? (
              fieldEditor(false, 'email@example.gov')
            ) : draft.email?.trim() ? (
              <a
                href={`mailto:${draft.email.trim()}`}
                className="text-lake-blue underline-offset-2 hover:underline"
              >
                {draft.email.trim()}
              </a>
            ) : (
              empty
            )
          }
        />
        <InlineRow
          label="Phone"
          editAction={pencil('phone', 'Phone')}
          value={
            editingKey === 'phone' ? (
              fieldEditor(false, '(555) 555-5555')
            ) : draft.phone?.trim() ? (
              <a
                href={`tel:${draft.phone.trim().replace(/[^\d+]/g, '')}`}
                className="text-lake-blue underline-offset-2 hover:underline"
              >
                {draft.phone.trim()}
              </a>
            ) : (
              empty
            )
          }
        />
        <InlineRow
          label="Website"
          editAction={pencil('website_url', 'Website')}
          value={
            editingKey === 'website_url' ? (
              fieldEditor(false, 'https://')
            ) : draft.website_url?.trim() ? (
              <a
                href={draft.website_url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lake-blue underline-offset-2 hover:underline"
              >
                {hostLabel(draft.website_url.trim())}
              </a>
            ) : (
              empty
            )
          }
        />
        <InlineRow
          label="Bio"
          editAction={pencil('bio', 'Bio')}
          value={
            editingKey === 'bio'
              ? fieldEditor(true, 'Short public bio')
              : draft.bio?.trim() || empty
          }
        />
        <InlineRow
          label="Sources"
          editAction={pencil('source_urls', 'Sources')}
          value={
            editingKey === 'source_urls' ? (
              fieldEditor(true, 'One URL per line')
            ) : sources.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {sources.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={url}
                    className="inline-flex max-w-full items-center rounded-full bg-lake-blue/15 px-2.5 py-1 text-[11px] font-medium text-lake-blue ring-1 ring-lake-blue/25"
                  >
                    <span className="truncate">{hostLabel(url)}</span>
                  </a>
                ))}
              </div>
            ) : (
              empty
            )
          }
        />
      </div>

      {error ? (
        <p className="text-[12px] text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          disabled={busy || !draft.full_name.trim()}
          onClick={onAccept}
          className="flex-1 rounded-xl bg-lake-blue px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save seat'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold text-foreground ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ─── Main carousel component ───────────────────────────────────────────────

export type SeatsReviewDecision = {
  key: string;
  decision: 'accept' | 'reject';
  proposed?: SeatProposal;
};

export function SeatsReviewCarousel({
  unitId,
  cards,
  status,
  busy,
  onDecide,
}: {
  /** Territory unit id — required for per-seat Enrich search. */
  unitId: string;
  cards: SeatCompareCard[];
  status?: 'pending' | 'applied' | 'dismissed';
  busy: boolean;
  onDecide: (decisions: SeatsReviewDecision[]) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, SeatProposal>>(() => {
    const init: Record<string, SeatProposal> = {};
    for (const c of cards) init[c.key] = sanitizeSeatProposal(c.proposed);
    return init;
  });
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [enrichingKey, setEnrichingKey] = useState<string | null>(null);
  const [enrichNote, setEnrichNote] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, EnrichTranscript>>({});
  const formRef = useRef<HTMLDivElement | null>(null);

  // Re-sanitize when new AI cards arrive (e.g. reopen / new Fill Officials turn).
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, SeatProposal> = { ...prev };
      for (const c of cards) {
        if (!next[c.key]) next[c.key] = sanitizeSeatProposal(c.proposed);
        else next[c.key] = sanitizeSeatProposal(next[c.key]!);
      }
      return next;
    });
  }, [cards]);

  useEffect(() => {
    if (activeKey) {
      requestAnimationFrame(() =>
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      );
    }
  }, [activeKey]);

  const pending = cards.filter((c) => c.status === 'pending');
  const accepted = cards.filter((c) => c.status === 'accepted');
  const rejected = cards.filter((c) => c.status === 'rejected');

  const updateDraft = (key: string, next: SeatProposal) => {
    // Keep typing fluid, but never persist placeholder tokens into draft state.
    setDrafts((prev) => ({ ...prev, [key]: sanitizeSeatProposal(next) }));
    setEnrichNote(null);
  };

  const handleAccept = (key: string) => {
    setSaveError(null);
    setEnrichNote(null);
    const draft = sanitizeSeatProposal(drafts[key] ?? { seat_type: '', title: '', full_name: '' });
    if (!draft.full_name.trim()) {
      setSaveError('Name is required');
      return;
    }
    setDrafts((prev) => ({ ...prev, [key]: draft }));
    setActiveKey(null);
    onDecide([{ key, decision: 'accept', proposed: draft }]);
  };

  const handleSkip = (key: string) => {
    setSaveError(null);
    setEnrichNote(null);
    if (activeKey === key) setActiveKey(null);
    onDecide([{ key, decision: 'reject' }]);
  };

  const handleEnrich = async (key: string) => {
    const draft = sanitizeSeatProposal(
      drafts[key] ?? { seat_type: '', title: '', full_name: '' },
    );
    if (!draft.full_name.trim() || !unitId || enrichingKey) return;
    setDrafts((prev) => ({ ...prev, [key]: draft }));

    setEnrichingKey(key);
    setSaveError(null);
    setEnrichNote(null);
    try {
      const res = await fetch(`/api/ai/territory/${unitId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich_seat', seat: draft }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        proposed?: SeatProposal;
        filled?: SeatEnrichField[];
        sources_added?: number;
        message?: string;
        prompt?: string | null;
        answer?: string | null;
      };
      if (!res.ok) {
        setSaveError(json.error ?? 'Enrich search failed');
        return;
      }
      if (json.prompt || json.answer) {
        setTranscripts((prev) => ({
          ...prev,
          [key]: {
            prompt: json.prompt?.trim() || '(prompt unavailable)',
            answer: json.answer?.trim() || '(empty response)',
          },
        }));
      }
      if (json.proposed) {
        setDrafts((prev) => ({
          ...prev,
          [key]: sanitizeSeatProposal(json.proposed!),
        }));
      }
      const filled = json.filled ?? [];
      const sourcesAdded = json.sources_added ?? 0;
      const bits: string[] = [];
      if (filled.length) bits.push(`filled ${filled.map(enrichFieldLabel).join(', ')}`);
      if (sourcesAdded > 0) bits.push(`added ${sourcesAdded} source${sourcesAdded === 1 ? '' : 's'}`);
      if (bits.length > 0) {
        setEnrichNote(`${bits.join(' · ')}. Review, then Save seat.`);
      } else {
        setEnrichNote(
          json.message ??
            'No new details found — check the response below or edit fields manually.',
        );
      }
    } catch {
      setSaveError('Enrich search failed');
    } finally {
      setEnrichingKey(null);
    }
  };

  const handleAcceptAll = () => {
    setSaveError(null);
    setEnrichNote(null);
    setActiveKey(null);
    onDecide(
      pending.flatMap((c): SeatsReviewDecision[] => {
        const draft = sanitizeSeatProposal(
          drafts[c.key] ?? { seat_type: '', title: '', full_name: '' },
        );
        if (!draft.full_name.trim()) return [];
        return [{ key: c.key, decision: 'accept', proposed: draft }];
      }),
    );
  };

  const handleSkipAll = () => {
    setSaveError(null);
    setEnrichNote(null);
    setActiveKey(null);
    onDecide(pending.map((c) => ({ key: c.key, decision: 'reject' as const })));
  };

  const activeCard = activeKey ? cards.find((c) => c.key === activeKey) : null;
  const activeDraft = activeKey ? drafts[activeKey] : null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-map-ink-subtle">
      <div className="flex items-center justify-between gap-2 border-b border-map-ink-subtle bg-black/[0.03] px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
          Officials — Existing vs Proposed
        </p>
      </div>

      <div className="space-y-2.5 p-2.5">
        <div
          role="list"
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((card) => {
            const draft = drafts[card.key] ?? card.proposed;
            return (
              <div key={card.key} role="listitem">
                <ReviewCard
                  card={card}
                  draft={draft}
                  active={activeKey === card.key}
                  onSelect={() => {
                    setSaveError(null);
                    setEnrichNote(null);
                    setActiveKey((prev) => (prev === card.key ? null : card.key));
                  }}
                />
              </div>
            );
          })}
        </div>

        {activeCard && activeDraft ? (
          <div ref={formRef}>
            <EditForm
              draft={sanitizeSeatProposal(activeDraft)}
              existingName={activeCard.existing_name}
              saving={busy}
              enriching={enrichingKey === activeCard.key}
              error={saveError}
              enrichNote={enrichNote}
              transcript={transcripts[activeCard.key] ?? null}
              onChange={(next) => updateDraft(activeCard.key, next)}
              onAccept={() => handleAccept(activeCard.key)}
              onSkip={() => handleSkip(activeCard.key)}
              onEnrich={() => void handleEnrich(activeCard.key)}
            />
          </div>
        ) : null}

        {pending.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy || Boolean(enrichingKey)}
              onClick={handleAcceptAll}
              className="rounded-full bg-lake-blue px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              Save all ({pending.length})
            </button>
            <button
              type="button"
              disabled={busy || Boolean(enrichingKey)}
              onClick={handleSkipAll}
              className="rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-semibold text-foreground-muted disabled:opacity-40"
            >
              Skip remaining
            </button>
            {busy ? (
              <span className="text-[11px] text-foreground-muted">Saving…</span>
            ) : null}
          </div>
        ) : (
          <p className="pt-1 text-[11px] text-foreground-muted">
            {status === 'dismissed' || (!accepted.length && rejected.length)
              ? 'All proposed officials skipped — nothing saved.'
              : accepted.length
                ? `Saved ${accepted.length} official${accepted.length === 1 ? '' : 's'}${
                    rejected.length ? ` · skipped ${rejected.length}` : ''
                  }.`
                : 'Review complete.'}
          </p>
        )}
      </div>
    </div>
  );
}
