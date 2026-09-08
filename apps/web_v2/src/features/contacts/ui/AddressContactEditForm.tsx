'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

export type AddressProfileFields = {
  id: string;
  label: string;
  notes: string | null;
  tag: string | null;
};

const FIELD_CLASS =
  'w-full bg-transparent text-[17px] text-foreground outline-none placeholder:text-foreground-muted/40';

/**
 * Address profile edit — iOS Contacts–style grouped fields.
 * Nav Done submits via `formId`.
 */
export function AddressContactEditForm({
  address,
  formId = 'contact-address-edit',
  onSaved,
  onDone,
}: {
  address: AddressProfileFields;
  formId?: string;
  onSaved: (address: AddressProfileFields) => void;
  onDone?: () => void;
}) {
  const [label, setLabel] = useState(address.label);
  const [tag, setTag] = useState(address.tag ?? '');
  const [notes, setNotes] = useState(address.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = () => {
    setLabel(address.label);
    setTag(address.tag ?? '');
    setNotes(address.notes ?? '');
    setError(null);
  };

  useEffect(() => {
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.id, address.label, address.tag, address.notes]);

  const dirty = useMemo(
    () =>
      label.trim() !== address.label ||
      (tag.trim() || null) !== (address.tag ?? null) ||
      (notes.trim() || null) !== (address.notes ?? null),
    [label, tag, notes, address],
  );

  async function save(): Promise<boolean> {
    if (!dirty) return true;
    if (busy) return false;
    if (!label.trim()) {
      setError('Label is required');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${address.id}?kind=address`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          label: label.trim(),
          tag: tag.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        address?: AddressProfileFields;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Could not save');
      if (json.address) onSaved(json.address);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await save();
    if (ok) onDone?.();
  }

  return (
    <form id={formId} onSubmit={(e) => void onSubmit(e)} className="space-y-8">
      <div className="mx-4 overflow-hidden rounded-[10px] bg-white">
        <label className="flex items-start gap-3 border-b border-black/[0.06] px-4 py-2.5">
          <span className="w-[5.5rem] shrink-0 pt-1 text-[17px] text-foreground">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex items-start gap-3 border-b border-black/[0.06] px-4 py-2.5">
          <span className="w-[5.5rem] shrink-0 pt-1 text-[17px] text-foreground">Tag</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            maxLength={48}
            placeholder="Tag"
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex items-start gap-3 px-4 py-2.5">
          <span className="w-[5.5rem] shrink-0 pt-1 text-[17px] text-foreground">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes"
            className={`${FIELD_CLASS} min-h-[4rem] resize-none`}
          />
        </label>
      </div>
      {error ? (
        <p className="px-4 text-center text-[14px] text-red-600">{error}</p>
      ) : null}
      {busy ? (
        <p className="px-4 text-center text-[13px] text-foreground-muted">Saving…</p>
      ) : null}
    </form>
  );
}
