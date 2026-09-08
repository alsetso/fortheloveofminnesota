'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DockPaneShell } from '@/features/map/dockCore/panes/DockPaneShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  IconPost,
  IconPlus,
  IconBookmark,
  IconDrop,
  IconEye,
  IconChevronRight,
} from '@/features/map/dockCore/core/icons';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  MAP_DOCK_GLASS_CHIP_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
  MAP_DOCK_GLASS_BORDER_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import {
  getPointAtLocationCacheSnapshot,
  pointAtLocationCacheKey,
  subscribePointAtLocationCache,
} from '@/features/map/dockCore/store/pointAtLocationCache';
import { addressCandidateFromPoint } from '@/features/contacts/logic/buildContactCandidates';
import { useSelectedPointCoords } from '@/map/location/camera/useSelectedPointCoords';
import {
  getSelectedPointGateError,
  subscribeSelectedPointGateError,
} from '@/features/map/game/selectedPointGateStore';
import {
  getSelectedPinMode,
  resetSelectedPinMode,
  setSelectedPinMode,
  subscribeSelectedPinMode,
} from '@/map/points/selectedPinModeStore';
import { useAuthSafe } from '@/features/auth';
import { useContactMatches } from '@/features/contacts/state/useContactMatches';
import { useContactTags } from '@/features/contacts/state/useContactTags';
import {
  refreshSavedAddressPins,
  removeSavedAddressPin,
  getSavedAddressPins,
  subscribeSavedAddressPins,
  type KnownSavedAddress,
  type SavedAddressPin,
} from '@/features/map/savedAddresses';

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-2 py-1 disabled:opacity-35"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${MAP_DOCK_GLASS_CHIP_CLASS} ${
          active ? 'text-[#9E9EA5]' : 'text-lake-blue'
        }`}
      >
        {icon}
      </span>
      <span className="text-[11px] font-medium leading-none text-foreground-muted">{label}</span>
    </button>
  );
}

// ─── Save form (shown when save-pending) ──────────────────────────────────────

const GHOST_INPUT =
  'w-full bg-transparent text-[13px] text-foreground placeholder:text-foreground/30 outline-none disabled:opacity-50';

const EMPTY_SAVED_PINS: SavedAddressPin[] = [];

/** Same dropped point as a saved pin — tighter than reverse-geocode address match. */
function coordsMatchSavedPin(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

function SaveForm({
  address,
  tag,
  setTag,
  notes,
  setNotes,
  saving,
  onSave,
  onCancel,
  alreadySaved,
  accountId,
}: {
  address: string | null;
  tag: string;
  setTag: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  alreadySaved: boolean;
  accountId: string | undefined;
}) {
  const { tags: existingTags } = useContactTags(Boolean(accountId));

  if (alreadySaved) {
    return (
      <div className="flex flex-col gap-2 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#9E9EA5] ring-2 ring-[#9E9EA5]/25" />
          <span className="text-[11px] font-medium text-foreground/40">Already in your saved addresses</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-[12px] font-semibold text-foreground-muted transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 pb-1">

      {/* Privacy badge + address */}
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 truncate text-[15px] font-semibold leading-snug text-foreground">
          {address ?? 'Selected location'}
        </p>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#9E9EA5]/12 px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9E9EA5]" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9E9EA5]">Private</span>
        </span>
      </div>

      {/* Tag chips + custom input */}
      <div className={`rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} px-3 py-2.5`}>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/35">Tag</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {existingTags.map((t) => {
            const selected = tag.trim().toLowerCase() === t.toLowerCase();
            return (
              <button
                key={t}
                type="button"
                disabled={saving}
                onClick={() => setTag(selected ? '' : t)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition active:scale-95 ${
                  selected
                    ? 'bg-[#9E9EA5] text-white'
                    : `${MAP_DOCK_GLASS_CHIP_CLASS} text-foreground-muted hover:text-foreground`
                }`}
              >
                {t}
              </button>
            );
          })}
          <input
            className={`${GHOST_INPUT} min-w-[80px] flex-1`}
            placeholder={existingTags.length > 0 ? '+ custom…' : 'e.g. Home · Work'}
            value={existingTags.some((t) => t.toLowerCase() === tag.trim().toLowerCase()) ? '' : tag}
            maxLength={48}
            autoComplete="off"
            disabled={saving}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>
      </div>

      {/* Notes — single ghost line, grows on input */}
      <div className={`rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} px-3 py-2.5`}>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/35">Notes</p>
        <textarea
          className={`${GHOST_INPUT} resize-none`}
          placeholder="Gate code, parking tips…"
          rows={notes.length > 60 ? 3 : 1}
          value={notes}
          maxLength={500}
          autoComplete="off"
          disabled={saving}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* CTA */}
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="flex h-11 w-full items-center justify-center rounded-2xl bg-[#9E9EA5] text-[14px] font-bold tracking-wide text-white transition active:scale-[0.97] hover:bg-[#8a8a91] disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Pin it'}
      </button>

      <button
        type="button"
        disabled={saving}
        onClick={onCancel}
        className="w-full text-center text-[12px] font-semibold text-foreground/40 transition hover:text-foreground disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Saved confirmation banner ────────────────────────────────────────────────

function SavedBanner({
  address,
  savedNotes,
  notingOpen,
  noteDraft,
  setNoteDraft,
  noting,
  noteError,
  onOpenNote,
  onCancelNote,
  onSaveNote,
  removing,
  removeError,
  onRemove,
}: {
  address: string | null;
  savedNotes: string | null;
  notingOpen: boolean;
  noteDraft: string;
  setNoteDraft: (v: string) => void;
  noting: boolean;
  noteError: string | null;
  onOpenNote: () => void;
  onCancelNote: () => void;
  onSaveNote: () => void;
  removing: boolean;
  removeError: string | null;
  onRemove: () => void;
}) {
  const busy = removing || noting;
  const hasNote = Boolean(savedNotes?.trim());

  return (
    <div className="flex flex-col gap-2.5 pb-1">
      {address ? (
        <p className="text-[15px] font-semibold leading-snug text-foreground">{address}</p>
      ) : null}
      <p
        className={`flex items-start gap-2 rounded-[1.15rem] px-3 py-2.5 text-[12px] leading-snug text-foreground-muted ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <IconEye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Only you can see this — saved addresses stay private on your map.</span>
      </p>

      {notingOpen ? (
        <div className={`rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} px-3 py-2.5`}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/35">Notes</p>
          <textarea
            className={`${GHOST_INPUT} resize-none`}
            placeholder="Gate code, parking tips…"
            rows={noteDraft.length > 60 ? 3 : 2}
            value={noteDraft}
            maxLength={500}
            autoComplete="off"
            autoFocus
            disabled={busy}
            onChange={(e) => setNoteDraft(e.target.value)}
          />
        </div>
      ) : hasNote ? (
        <p
          className={`whitespace-pre-wrap rounded-[1.15rem] px-3 py-2.5 text-[13px] leading-snug text-foreground ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {savedNotes}
        </p>
      ) : null}

      {noteError ? <p className="text-[12px] text-red-600">{noteError}</p> : null}
      {removeError ? <p className="text-[12px] text-red-600">{removeError}</p> : null}

      {notingOpen ? (
        <button
          type="button"
          disabled={busy}
          onClick={onSaveNote}
          className="flex h-11 w-full items-center justify-center rounded-2xl bg-[#9E9EA5] text-[14px] font-bold tracking-wide text-white transition active:scale-[0.97] hover:bg-[#8a8a91] disabled:opacity-60"
        >
          {noting ? 'Saving…' : hasNote ? 'Update note' : 'Save note'}
        </button>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-0.5">
        {notingOpen ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancelNote}
            className="text-[12px] font-semibold text-foreground/40 transition hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onOpenNote}
            className="text-[12px] font-semibold text-lake-blue transition hover:text-lake-blue/80 disabled:opacity-50"
          >
            {hasNote ? 'Edit note' : '+Note'}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="text-[12px] font-semibold text-red-600/80 transition hover:text-red-700 disabled:opacity-50"
        >
          {removing ? 'Removing…' : 'Remove from saved'}
        </button>
      </div>
    </div>
  );
}

// ─── Pane ─────────────────────────────────────────────────────────────────────

/**
 * Selected point dock pane.
 *
 * Quarter: compact action strip only — route, save, post, page, expand.
 * Save: inline grey-pin save form with optional tag.
 * Saved (exact coords of a saved pin): banner, notes, remove — no action strip.
 * Same street address at different coords: keep the action strip.
 */
export default function DockSelectedPointPane() {
  const { snap, setSnap, openPostCompose, openSubpage, setQuarterContentPx, openDockCard, openDetails } = useMapDock();
  const { coords } = useSelectedPointCoords();
  const { account } = useAuthSafe();

  const cache = useSyncExternalStore(
    subscribePointAtLocationCache,
    getPointAtLocationCacheSnapshot,
    () => null,
  );
  const entry = useMemo(() => {
    if (!coords) return null;
    const key = pointAtLocationCacheKey(coords.lat, coords.lng);
    return cache?.key === key ? cache : null;
  }, [coords, cache]);

  const address = entry?.address ?? null;

  const ctu = useMemo(
    () => entry?.jurisdictions.find((j) => j.kind === 'ctu') ?? null,
    [entry],
  );

  const addressCandidate = useMemo(
    () =>
      coords && address
        ? addressCandidateFromPoint({ label: address, lat: coords.lat, lng: coords.lng, source: 'map' })
        : null,
    [coords, address],
  );

  // ── Contact match — detect already-saved state ────────────────────────────
  const matchKeys = useMemo(
    () => (addressCandidate ? [addressCandidate.key] : []),
    [addressCandidate],
  );
  const { matches } = useContactMatches(matchKeys);
  const existing = addressCandidate ? (matches[addressCandidate.key] ?? null) : null;

  const savedPins = useSyncExternalStore(
    subscribeSavedAddressPins,
    getSavedAddressPins,
    () => EMPTY_SAVED_PINS,
  );
  const savedPinHere = useMemo(() => {
    if (!coords) return null;
    return savedPins.find((p) => coordsMatchSavedPin(coords, p)) ?? null;
  }, [savedPins, coords?.lat, coords?.lng]);

  // ── Local save / remove state ─────────────────────────────────────────────
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLocal, setSavedLocal] = useState<KnownSavedAddress | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<string | null>(null);
  const [notingOpen, setNotingOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noting, setNoting] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const saved: KnownSavedAddress | null =
    savedLocal ??
    (savedPinHere
      ? { id: savedPinHere.id, title: savedPinHere.label, tag: savedPinHere.tag }
      : null);

  // ── Pin mode ──────────────────────────────────────────────────────────────
  const pinMode = useSyncExternalStore(
    subscribeSelectedPinMode,
    getSelectedPinMode,
    () => 'default' as const,
  );

  // Reset everything when a new point is dropped.
  useEffect(() => {
    resetSelectedPinMode();
    setTag('');
    setNotes('');
    setSaveError(null);
    setSavedLocal(null);
    setRemoveError(null);
    setSavedNotes(null);
    setNotingOpen(false);
    setNoteDraft('');
    setNoteError(null);
  }, [coords?.lat, coords?.lng]);

  // Auto-enter saved state only when this drop is the saved pin's exact coords.
  // Same address at a different point stays a normal selected location.
  useEffect(() => {
    if (savedPinHere && pinMode === 'default') {
      setSelectedPinMode('saved');
    }
  }, [savedPinHere?.id, pinMode]);

  // Hydrate notes for an already-saved pin (skip when we just created it locally).
  useEffect(() => {
    if (pinMode !== 'saved' || !saved?.id || savedLocal) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/contacts/${saved.id}?kind=address`, {
          credentials: 'include',
          signal: ac.signal,
        });
        const json = (await res.json()) as { address?: { notes?: string | null } };
        if (ac.signal.aborted || !res.ok) return;
        const n = json.address?.notes?.trim();
        setSavedNotes(n || null);
      } catch {
        /* ignore — +Note still works from a blank draft */
      }
    })();
    return () => ac.abort();
  }, [pinMode, saved?.id, savedLocal]);

  // Content-fit quarter — action strip ≈ 77px + CTU row ≈ 36px when present.
  useEffect(() => {
    setQuarterContentPx(ctu ? 120 : 84);
    return () => setQuarterContentPx(null);
  }, [ctu, setQuarterContentPx]);

  const gateError = useSyncExternalStore(
    subscribeSelectedPointGateError,
    getSelectedPointGateError,
    () => null,
  );

  const isSavePending    = pinMode === 'save-pending';
  const isSaved          = pinMode === 'saved';

  // ── Handlers ─────────────────────────────────────────────────────────────

  const onDrop = () => openDockCard('drop-catalog');

  const onSave = () => {
    if (!addressCandidate) return;
    setSelectedPinMode('save-pending');
    setSnap('half');
  };

  const onCancelSave = () => {
    resetSelectedPinMode();
  };

  const onPost = () => {
    if (!coords) return;
    setSelectedPinMode('post-composing');
    openPostCompose({ lat: coords.lat, lng: coords.lng, address });
  };

  const onPage = () => {
    if (!coords) return;
    setSelectedPinMode('page-composing');
    openSubpage({ title: 'Create a page', subtitle: address ?? 'Launch', kind: 'page-launch' });
  };

  function onOpenNote() {
    setNoteDraft(savedNotes ?? '');
    setNoteError(null);
    setNotingOpen(true);
    if (snap === 'quarter' || snap === 'collapsed') setSnap('half');
  }

  function onCancelNote() {
    setNotingOpen(false);
    setNoteDraft(savedNotes ?? '');
    setNoteError(null);
  }

  async function onSaveNote() {
    if (!saved || !account?.id) return;
    setNoting(true);
    setNoteError(null);
    const next = noteDraft.trim() || null;
    try {
      const res = await fetch(`/api/contacts/${saved.id}?kind=address`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: next }),
      });
      const json = (await res.json()) as { error?: string; address?: { notes?: string | null } };
      if (!res.ok) throw new Error(json.error ?? 'Could not save note');
      setSavedNotes(json.address?.notes?.trim() || next);
      setNotingOpen(false);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Could not save note');
    } finally {
      setNoting(false);
    }
  }

  async function onConfirmSave() {
    if (!addressCandidate || saved || existing || !account?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'address',
          confirm: true,
          label: addressCandidate.label,
          line1: addressCandidate.line1,
          city: addressCandidate.city,
          state: addressCandidate.state,
          postalCode: addressCandidate.postalCode,
          lat: addressCandidate.lat,
          lng: addressCandidate.lng,
          tag: tag.trim() || null,
          notes: notes.trim() || null,
          source: 'map',
          raw: addressCandidate.raw,
        }),
      });
      const json = (await res.json()) as { error?: string; address?: { id?: string } };
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      const id = json.address?.id?.trim();
      if (!id) throw new Error('Save succeeded but no id returned');
      const knownSaved: KnownSavedAddress = { id, title: addressCandidate.label, tag: tag.trim() || null };
      setSavedLocal(knownSaved);
      setSavedNotes(notes.trim() || null);
      setNotingOpen(false);
      setSelectedPinMode('saved');
      void refreshSavedAddressPins();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!saved || !account?.id) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/contacts/${saved.id}?kind=address`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Remove failed');
      removeSavedAddressPin(saved.id);
      setSavedLocal(null);
      setSavedNotes(null);
      setNotingOpen(false);
      resetSelectedPinMode();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <DockPaneShell>
      <div className="space-y-4 pb-2">

        {/* ── Out-of-range gate error ───────────────────────────────────── */}
        {gateError && (
          <p
            role="alert"
            className="rounded-xl bg-red-500/10 px-3 py-2 text-center text-[12px] font-medium text-red-600"
          >
            {gateError}
          </p>
        )}

        {/* ── Save form (pending) ───────────────────────────────────────── */}
        {isSavePending ? (
          <>
            {saveError ? (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-600">
                {saveError}
              </p>
            ) : null}
            <SaveForm
              address={address}
              tag={tag}
              setTag={setTag}
              notes={notes}
              setNotes={setNotes}
              saving={saving}
              onSave={() => void onConfirmSave()}
              onCancel={onCancelSave}
              alreadySaved={Boolean(existing)}
              accountId={account?.id}
            />
          </>
        ) : (
          <>
            {/* ── Saved confirmation banner ─────────────────────────────── */}
            {isSaved ? (
              <SavedBanner
                address={address}
                savedNotes={savedNotes}
                notingOpen={notingOpen}
                noteDraft={noteDraft}
                setNoteDraft={setNoteDraft}
                noting={noting}
                noteError={noteError}
                onOpenNote={onOpenNote}
                onCancelNote={onCancelNote}
                onSaveNote={() => void onSaveNote()}
                removing={removing}
                removeError={removeError}
                onRemove={() => void onRemove()}
              />
            ) : null}

            {!isSaved ? (
              <>
                {/* ── City / Town for this point ──────────────────────────── */}
                {ctu ? (
                  <button
                    type="button"
                    onClick={() => {
                      const entity: DockEntity = {
                        id: ctu.id,
                        kind: 'ctu',
                        title: ctu.name,
                        kindLabel: ctu.kindLabel,
                        subtitle: ctu.subtitle ?? undefined,
                      };
                      openDetails(entity);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition active:bg-black/[0.05]"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-lake-blue" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                      {ctu.name}
                    </span>
                    <span className="shrink-0 text-[11px] capitalize text-foreground-muted">
                      {ctu.ctu_class ?? ctu.kindLabel}
                    </span>
                    <IconChevronRight className="h-3 w-3 shrink-0 text-foreground-muted/40" />
                  </button>
                ) : entry === null ? (
                  <div className="flex items-center gap-2.5 px-2 py-2">
                    <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-black/10" />
                    <div className="h-3 w-28 animate-pulse rounded-full bg-black/[0.06]" />
                  </div>
                ) : null}

                <div className="flex items-start justify-around pb-3">
                  <ActionBtn
                    icon={<IconBookmark className="h-4 w-4" />}
                    label="Save"
                    onClick={onSave}
                    disabled={!addressCandidate}
                  />
                  <ActionBtn
                    icon={<IconPost className="h-4 w-4" />}
                    label="Post"
                    onClick={onPost}
                    disabled={!coords}
                  />
                  <ActionBtn
                    icon={<IconPlus className="h-4 w-4" />}
                    label="Page"
                    onClick={onPage}
                    disabled={!coords}
                  />
                  <ActionBtn
                    icon={<IconDrop className="h-4 w-4" />}
                    label="Drop"
                    onClick={onDrop}
                    disabled={!coords}
                  />
                </div>
              </>
            ) : null}
          </>
        )}

      </div>
    </DockPaneShell>
  );
}
