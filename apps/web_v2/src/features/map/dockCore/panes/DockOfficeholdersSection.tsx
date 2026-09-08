'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconPencil, IconPlus, IconSparkles, IconUser } from '@/features/map/dockCore/core/icons';
import {
  DockSection,
  DockSkeletonRows,
  ENTRY_ROW_GLASS_CLASS,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { TOOL_FIELD_CLASS } from '@/features/tools/core/toolUi';
import { buildFillOfficialsPrompt } from '@/lib/ai/placeAiTools';

/** Atlas kinds whose feature id matches territory.units.id. */
const UNIT_BACKED_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
  'district',
  'senate_district',
  'house_district',
]);

export type DockSeatCard = {
  seat_id: string | null;
  seat_type: string;
  title: string;
  sub_label: string | null;
  seat_number: number | null;
  is_placeholder: boolean;
  officeholder_id: string | null;
  full_name: string | null;
  photo_url: string | null;
  party: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  source_urls?: string[];
  term_start: string | null;
  term_end: string | null;
};

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

type EditorState = {
  seatKey: string;
  /** True when creating a wholly new seat (not filling/editing an existing one). */
  isNewSeat: boolean;
  seat_id: string | null;
  seat_type: string;
  seat_title: string;
  sub_label: string | null;
  officeholder_id: string | null;
  full_name: string;
  party: string;
  email: string;
  phone: string;
  website_url: string;
  bio: string;
};

const NEW_SEAT_KEY = '__new__';

function seatKey(s: DockSeatCard, index: number): string {
  return s.seat_id ?? `placeholder:${s.seat_type}:${s.sub_label ?? ''}:${index}`;
}

function seatSubtitle(s: DockSeatCard): string {
  const bits = [s.title];
  if (s.sub_label?.trim()) bits.push(s.sub_label.trim());
  return bits.join(' · ');
}

function openEditor(seat: DockSeatCard, index: number): EditorState {
  return {
    seatKey: seatKey(seat, index),
    isNewSeat: false,
    seat_id: seat.seat_id,
    seat_type: seat.seat_type,
    seat_title: seat.title,
    sub_label: seat.sub_label,
    officeholder_id: seat.officeholder_id,
    full_name: seat.full_name ?? '',
    party: seat.party ?? '',
    email: seat.email ?? '',
    phone: seat.phone ?? '',
    website_url: seat.website_url ?? '',
    bio: seat.bio ?? '',
  };
}

function blankEditor(): EditorState {
  return {
    seatKey: NEW_SEAT_KEY,
    isNewSeat: true,
    seat_id: null,
    seat_type: '',
    seat_title: '',
    sub_label: null,
    officeholder_id: null,
    full_name: '',
    party: '',
    email: '',
    phone: '',
    website_url: '',
    bio: '',
  };
}

function unitTypeLabel(kind: string): string {
  switch (kind) {
    case 'county': return 'county';
    case 'ctu': return 'city or township';
    case 'school_district': return 'school district';
    case 'district': return 'congressional district';
    case 'senate_district': return 'senate district';
    case 'house_district': return 'house district';
    case 'zipcode': return 'ZIP code';
    default: return kind.replace(/_/g, ' ');
  }
}

function HolderAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl?.trim() || null;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover"
        onError={() => setFailed(true)}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

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

/**
 * A single seat profile card in the horizontal carousel.
 * Filled seats show avatar + name + title + party.
 * Vacant seats show a dashed "+" card.
 */
function SeatCard({
  seat,
  index,
  editable,
  active,
  onSelect,
}: {
  seat: DockSeatCard;
  index: number;
  editable: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const hasHolder = Boolean(seat.full_name?.trim());
  const key = seatKey(seat, index);

  if (hasHolder) {
    return (
      <button
        key={key}
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={`relative flex w-[6.5rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl px-2 pt-3.5 pb-3 text-center transition active:scale-[0.97] ${
          active
            ? 'ring-2 ring-lake-blue/60 bg-lake-blue/8'
            : ENTRY_ROW_GLASS_CLASS
        }`}
      >
        <HolderAvatar name={seat.full_name!} photoUrl={seat.photo_url} />
        <div className="mt-1 w-full min-w-0">
          <p className="truncate text-[12px] font-semibold text-foreground leading-tight">
            {seat.full_name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-foreground-muted leading-tight">
            {seatSubtitle(seat)}
          </p>
        </div>
        {seat.party?.trim() ? (
          <span className="mt-0.5 rounded-full bg-map-ink-subtle px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-foreground-muted">
            {seat.party.trim()}
          </span>
        ) : null}
        {editable ? (
          <span className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-lake-blue/60">
            <IconPencil className="h-3 w-3" />
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      key={key}
      type="button"
      onClick={editable ? onSelect : undefined}
      disabled={!editable}
      aria-pressed={active}
      className={`flex w-[6.5rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl px-2 pt-3.5 pb-3 text-center transition disabled:opacity-50 active:scale-[0.97] ${
        active
          ? 'ring-2 ring-lake-blue/60 bg-lake-blue/8'
          : editable
            ? `border border-dashed border-lake-blue/30 ${MAP_DOCK_GLASS_FILL_CLASS}`
            : 'border border-dashed border-map-ink-subtle'
      }`}
    >
      <span
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
          editable ? 'bg-lake-blue/10 text-lake-blue' : 'bg-map-ink-subtle text-foreground-muted'
        }`}
      >
        <IconPlus className="h-5 w-5" />
      </span>
      <div className="mt-1 w-full min-w-0">
        <p
          className={`text-[12px] font-semibold leading-tight ${editable ? 'text-lake-blue' : 'text-foreground-muted'}`}
        >
          {editable ? 'Add' : 'Vacant'}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-foreground-muted leading-tight">
          {seatSubtitle(seat)}
        </p>
      </div>
    </button>
  );
}

/** Trailing "New seat" card — only shown to editable admins. */
function AddSeatCard({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-[6.5rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-2 pt-3.5 pb-3 text-center transition active:scale-[0.97] ${
        active
          ? 'border-lake-blue bg-lake-blue/8'
          : 'border-lake-blue/35 bg-lake-blue/5'
      }`}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-lake-blue/15 text-lake-blue">
        <IconPlus className="h-5 w-5" />
      </span>
      <div className="mt-1 w-full min-w-0">
        <p className="text-[12px] font-semibold text-lake-blue leading-tight">New seat</p>
        <p className="mt-0.5 text-[10px] text-lake-blue/60 leading-tight">Add holder</p>
      </div>
    </button>
  );
}

/** Read-only holder sheet opened from a filled seat card (users + preview-as-user). */
function HolderDetailPanel({ seat }: { seat: DockSeatCard }) {
  const name = seat.full_name?.trim() ?? '';
  const party = seat.party?.trim() || null;
  const email = seat.email?.trim() || null;
  const phone = seat.phone?.trim() || null;
  const website = seat.website_url?.trim() || null;
  const bio = seat.bio?.trim() || null;
  const sources = (seat.source_urls ?? []).filter((u) => u.trim());

  return (
    <div className={`space-y-2.5 rounded-2xl px-3.5 py-3.5 ${ENTRY_ROW_GLASS_CLASS}`}>
      <div className="flex items-start gap-3">
        <HolderAvatar name={name || '?'} photoUrl={seat.photo_url} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[15px] font-semibold text-foreground leading-tight">{name}</p>
          <p className="mt-0.5 text-[12px] text-foreground-muted leading-tight">
            {seatSubtitle(seat)}
          </p>
          {party ? (
            <span className="mt-1.5 inline-block rounded-full bg-map-ink-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              {party}
            </span>
          ) : null}
        </div>
      </div>

      {email || phone || website ? (
        <div className="space-y-1.5 border-t border-map-ink-subtle/60 pt-2.5">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="block text-[13px] text-lake-blue underline-offset-2 hover:underline"
            >
              {email}
            </a>
          ) : null}
          {phone ? (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, '')}`}
              className="block text-[13px] text-lake-blue underline-offset-2 hover:underline"
            >
              {phone}
            </a>
          ) : null}
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[13px] text-lake-blue underline-offset-2 hover:underline"
            >
              {hostLabel(website)}
            </a>
          ) : null}
        </div>
      ) : null}

      {bio ? (
        <p className="border-t border-map-ink-subtle/60 pt-2.5 text-[13px] leading-relaxed text-foreground/85">
          {bio}
        </p>
      ) : null}

      {sources.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-map-ink-subtle/60 pt-2.5">
          {sources.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium text-lake-blue ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
            >
              {hostLabel(url)}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Officials carousel for a selected territory.
 * Users see filled seats as clickable cards with a read-only detail panel.
 * place_ai on: edit seats and run Fill Officials.
 */
export function DockOfficeholdersSection({ entity }: { entity: DockEntity }) {
  const enabled = UNIT_BACKED_KINDS.has(entity.kind);
  const { openSubpage } = useMapDock();
  const [seats, setSeats] = useState<DockSeatCard[]>([]);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const formRef = useRef<HTMLDivElement | null>(null);
  /** Edit / add / Place AI — admin surface with write access. */
  const canConfigure = editable;
  /** Full seat list including vacant seats. */
  const showAllSeats = true;

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setSeats([]);
      setEditable(false);
      setLoading(false);
      setError(null);
      setEditor(null);
      setDetailKey(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditor(null);
    setDetailKey(null);

    void (async () => {
      try {
        const res = await fetch(`/api/territory/units/${entity.id}/officeholders`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? 'Failed to load seats');
        }
        const body = (await res.json()) as {
          seats?: DockSeatCard[];
          editable?: boolean;
        };
        if (!cancelled) {
          setSeats(body.seats ?? []);
          setEditable(Boolean(body.editable));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setSeats([]);
          setEditable(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, entity.id, reloadToken]);

  // Scroll the edit / detail panel into view whenever it opens.
  useEffect(() => {
    if (editor || detailKey) {
      requestAnimationFrame(() =>
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      );
    }
  }, [editor?.seatKey, detailKey]);

  const beginEdit = (e: EditorState) => {
    setDetailKey(null);
    setSaveError(null);
    setEditor(e);
  };

  const cancelEdit = () => {
    setEditor(null);
    setSaveError(null);
  };

  const toggleDetail = (key: string) => {
    setEditor(null);
    setSaveError(null);
    setDetailKey((prev) => (prev === key ? null : key));
  };

  const saveEditor = async () => {
    if (!editor || !canConfigure) return;
    const name = editor.full_name.trim();
    if (!name) {
      setSaveError('Name is required');
      return;
    }
    if (editor.isNewSeat && !editor.seat_title.trim()) {
      setSaveError('Seat title is required');
      return;
    }
    if (editor.isNewSeat && !editor.seat_type.trim()) {
      setSaveError('Seat type is required');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/territory/units/${entity.id}/officeholders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seat_id: editor.seat_id,
          seat_type: editor.seat_type || undefined,
          title: editor.seat_title || undefined,
          sub_label: editor.sub_label,
          officeholder: {
            id: editor.officeholder_id,
            full_name: name,
            party: editor.party.trim() || null,
            email: editor.email.trim() || null,
            phone: editor.phone.trim() || null,
            website_url: editor.website_url.trim() || null,
            bio: editor.bio.trim() || null,
          },
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? 'Save failed');
      setEditor(null);
      reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const openFillOfficialsAi = () => {
    const typeLabel = unitTypeLabel(entity.kind);
    const prompt = buildFillOfficialsPrompt(entity.title, typeLabel);
    openSubpage({
      title: entity.title,
      subtitle: 'AI',
      kind: 'territory-ai',
      slug: entity.id,
      query: prompt,
    });
  };

  if (!enabled) return null;

  const filledSeats = seats.filter((s) => s.full_name?.trim());
  const visibleSeats = showAllSeats ? seats : filledSeats;
  const filledCount = filledSeats.length;


  const detailSeat =
    detailKey == null
      ? null
      : seats.find((s, i) => seatKey(s, i) === detailKey && s.full_name?.trim()) ?? null;

  return (
    <DockSection
      title="Officials"
      subtitle={
        loading
          ? 'Loading…'
          : seats.length === 0
              ? 'No seats for this area'
              : `${filledCount} of ${seats.length} filled`
      }
    >
      {error ? <p className="px-0.5 text-sm text-red-700">{error}</p> : null}

      {loading ? <DockSkeletonRows count={2} /> : null}

      {!loading && !error ? (
        <>
          {/* ── Horizontal carousel ── */}
          <div
            role="list"
            className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
          >
            {visibleSeats.map((seat) => {
              const index = seats.indexOf(seat);
              const key = seatKey(seat, index);
              return (
                <div key={key} role="listitem">
                  <SeatCard
                    seat={seat}
                    index={index}
                    editable={canConfigure}
                    active={
                      canConfigure
                        ? editor?.seatKey === key
                        : detailKey === key
                    }
                    onSelect={() => {
                      if (canConfigure) {
                        if (editor?.seatKey === key) cancelEdit();
                        else beginEdit(openEditor(seat, index));
                        return;
                      }
                      toggleDetail(key);
                    }}
                  />
                </div>
              );
            })}

            {canConfigure ? (
              <div role="listitem">
                <AddSeatCard
                  active={editor?.seatKey === NEW_SEAT_KEY}
                  onSelect={() =>
                    editor?.seatKey === NEW_SEAT_KEY ? cancelEdit() : beginEdit(blankEditor())
                  }
                />
              </div>
            ) : null}

            {canConfigure && seats.length === 0 ? (
              <p className="px-0.5 text-sm text-foreground-muted">No seats listed yet.</p>
            ) : null}
          </div>

          {/* ── Read-only detail (users) ── */}
          {detailSeat ? (
            <div ref={formRef}>
              <HolderDetailPanel seat={detailSeat} />
            </div>
          ) : null}

          {/* ── Inline edit panel ── */}
          {canConfigure && editor ? (
            <div
              ref={formRef}
              className={`space-y-2.5 rounded-2xl px-3.5 py-3.5 ${ENTRY_ROW_GLASS_CLASS}`}
            >
              <div className="pb-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                  {editor.isNewSeat
                    ? 'New seat'
                    : editor.full_name.trim()
                      ? `Editing · ${editor.full_name.trim()}`
                      : `${editor.seat_title} · Add holder`}
                </p>
              </div>

              {editor.isNewSeat ? (
                <>
                  <input
                    className={TOOL_FIELD_CLASS}
                    placeholder="Seat title (e.g. Mayor, Council Member)"
                    value={editor.seat_title}
                    onChange={(e) => setEditor({ ...editor, seat_title: e.target.value })}
                    autoFocus
                  />
                  <input
                    className={TOOL_FIELD_CLASS}
                    placeholder="Seat type key (e.g. mayor, council_member)"
                    value={editor.seat_type}
                    onChange={(e) => setEditor({ ...editor, seat_type: e.target.value })}
                  />
                </>
              ) : null}

              <input
                className={TOOL_FIELD_CLASS}
                placeholder="Full name"
                value={editor.full_name}
                onChange={(e) => setEditor({ ...editor, full_name: e.target.value })}
                autoFocus={!editor.isNewSeat}
              />
              <input
                className={TOOL_FIELD_CLASS}
                placeholder="Party (optional)"
                value={editor.party}
                onChange={(e) => setEditor({ ...editor, party: e.target.value })}
              />
              <input
                className={TOOL_FIELD_CLASS}
                placeholder="Email (optional)"
                value={editor.email}
                onChange={(e) => setEditor({ ...editor, email: e.target.value })}
              />
              <input
                className={TOOL_FIELD_CLASS}
                placeholder="Phone (optional)"
                value={editor.phone}
                onChange={(e) => setEditor({ ...editor, phone: e.target.value })}
              />
              <input
                className={TOOL_FIELD_CLASS}
                placeholder="Website (optional)"
                value={editor.website_url}
                onChange={(e) => setEditor({ ...editor, website_url: e.target.value })}
              />
              <textarea
                className={`${TOOL_FIELD_CLASS} h-20 resize-none py-2.5`}
                placeholder="Bio (optional)"
                value={editor.bio}
                onChange={(e) => setEditor({ ...editor, bio: e.target.value })}
              />

              {saveError ? (
                <p className="text-[12px] text-red-700" role="alert">
                  {saveError}
                </p>
              ) : null}

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEditor()}
                  className="flex-1 rounded-xl bg-lake-blue px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={cancelEdit}
                  className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold text-foreground ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {/* ── Fill Officials via Place AI ── */}
          {canConfigure ? (
            <button
              type="button"
              onClick={openFillOfficialsAi}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-lake-blue shadow transition active:scale-95 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
            >
              <IconSparkles className="h-3 w-3" />
              Fill Officials · Place AI
            </button>
          ) : null}
        </>
      ) : null}
    </DockSection>
  );
}
