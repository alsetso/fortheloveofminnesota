'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ContactCandidate } from '@/features/contacts/logic/identifyCandidates';
import { addressIdentityKeys } from '@/features/contacts/logic/identifyCandidates';
import type { ContactSaveSource } from '@/features/contacts/state/contactConfirmDraft';
import { useContactMatches } from '@/features/contacts/state/useContactMatches';
import { useContactTags } from '@/features/contacts/state/useContactTags';
import { PENDING_CONTACT_TAG_KEY } from '@/features/contacts/state/pendingContactTag';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { DockSection } from '@/features/map/dockCore/panes/DockPaneShell';
import {
  TOOL_FIELD_CLASS,
  ToolCostNote,
  ToolPrimaryButton,
  ToolStatusLine,
} from '@/features/tools/core/toolUi';

export type ConfirmSaveResult = {
  kind: 'person' | 'address';
  id: string;
  name: string;
  tag: string | null;
};

function candidateMatchKeys(candidate: ContactCandidate): string[] {
  if (candidate.kind === 'person') return [candidate.key];
  return addressIdentityKeys({
    line1: candidate.line1,
    city: candidate.city,
    state: candidate.state,
    postalCode: candidate.postalCode,
    label: candidate.label,
  });
}

export type ConfirmSaveIntent = 'save';

/**
 * Confirm → POST /api/contacts with confirm: true.
 * If identity already exists, open the saved contact.
 */
export function ContactConfirmSave({
  candidate,
  source,
  sourceLookupId = null,
  sourceLookupKind = null,
  onBack,
  onSaved,
}: {
  candidate: ContactCandidate;
  source: ContactSaveSource;
  sourceLookupId?: string | null;
  sourceLookupKind?: 'people' | 'properties' | null;
  /** @deprecated Ignored — save only; deepen from the contact via Get Info. */
  intent?: ConfirmSaveIntent | 'save_and_enhance';
  /** @deprecated Ignored. */
  enhanceCredits?: number;
  onBack: () => void;
  onSaved: (result: ConfirmSaveResult) => void;
}) {
  const matchKeys = useMemo(() => candidateMatchKeys(candidate), [candidate]);
  const { matches } = useContactMatches(matchKeys);
  const existing =
    matches[candidate.key] ?? matchKeys.map((k) => matches[k]).find(Boolean);
  const { tags: existingTags } = useContactTags(!existing);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  useEffect(() => {
    if (existing) return;
    try {
      const pending = sessionStorage.getItem(PENDING_CONTACT_TAG_KEY)?.trim();
      if (!pending) return;
      setTag(pending.slice(0, 48));
      sessionStorage.removeItem(PENDING_CONTACT_TAG_KEY);
    } catch {
      /* ignore */
    }
  }, [existing, candidate.key]);

  async function confirmSave() {
    if (existing) {
      onSaved({
        kind: existing.kind,
        id: existing.id,
        name: existing.title,
        tag: existing.tag,
      });
      return;
    }
    setSaving(true);
    setSaveError(null);
    const normalizedTag = tag.trim() || null;
    try {
      const body =
        candidate.kind === 'person'
          ? {
              kind: 'person' as const,
              confirm: true,
              displayName: candidate.displayName,
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              emails: candidate.emails,
              phones: candidate.phones,
              linkedAccountId: candidate.linkedAccountId ?? null,
              avatarUrl:
                typeof candidate.raw.image_url === 'string'
                  ? candidate.raw.image_url
                  : typeof candidate.raw.imageUrl === 'string'
                    ? candidate.raw.imageUrl
                    : null,
              tag: normalizedTag,
              source,
              sourceLookupId,
              sourceLookupKind,
              raw: candidate.raw,
            }
          : {
              kind: 'address' as const,
              confirm: true,
              label: candidate.label,
              line1: candidate.line1,
              city: candidate.city,
              state: candidate.state,
              postalCode: candidate.postalCode,
              lat: candidate.lat,
              lng: candidate.lng,
              tag: normalizedTag,
              source,
              sourceLookupId,
              sourceLookupKind,
              raw: candidate.raw,
            };

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        error?: string;
        person?: { id?: string };
        address?: { id?: string };
      };
      if (!res.ok) throw new Error(json.error ?? 'Save failed');

      const id =
        candidate.kind === 'person'
          ? json.person?.id?.trim()
          : json.address?.id?.trim();
      if (!id) throw new Error('Save succeeded but no contact id returned');

      onSaved({
        kind: candidate.kind,
        id,
        name: candidate.kind === 'person' ? candidate.displayName : candidate.label,
        tag: normalizedTag,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DockSection
      title={existing ? 'Already saved' : 'Confirm save'}
      subtitle={
        existing
          ? 'This identity is already in your contact book.'
          : 'Review what will be added to your contact book.'
      }
    >
      <div
        className={`space-y-3 rounded-2xl px-4 py-4 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          {candidate.kind === 'person' ? 'Person' : 'Address'}
        </p>
        <p className="text-[17px] font-semibold text-foreground">
          {candidate.kind === 'person' ? candidate.displayName : candidate.label}
        </p>
        {existing ? (
          <p className="text-[13px] text-foreground-muted">
            Open the record to view or get more info — no duplicate will be created.
          </p>
        ) : candidate.kind === 'person' ? (
          <ul className="space-y-1 text-[13px] text-foreground-muted">
            {candidate.linkedAccountId ? (
              <li className="font-medium text-lake-blue">
                Linked account · {candidate.linkedAccountId.slice(0, 8)}…
              </li>
            ) : null}
            {candidate.emails.map((e) => (
              <li key={e}>{e}</li>
            ))}
            {candidate.phones.map((p) => (
              <li key={p}>{p}</li>
            ))}
            {!candidate.linkedAccountId &&
            candidate.emails.length === 0 &&
            candidate.phones.length === 0 ? (
              <li>No email or phone on this record</li>
            ) : null}
          </ul>
        ) : (
          <ul className="space-y-1 text-[13px] text-foreground-muted">
            {candidate.line1 ? <li>{candidate.line1}</li> : null}
            <li>
              {[candidate.city, candidate.state, candidate.postalCode]
                .filter(Boolean)
                .join(', ') || '—'}
            </li>
            {candidate.lat != null && candidate.lng != null ? (
              <li className="tabular-nums">
                {candidate.lat.toFixed(5)}°, {candidate.lng.toFixed(5)}°
              </li>
            ) : null}
          </ul>
        )}

        {!existing ? (
          <div className="space-y-1.5 pt-1">
            <label
              htmlFor="contact-save-tag"
              className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-muted"
            >
              Tag <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            {existingTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pb-0.5">
                {existingTags.map((t) => {
                  const selected = tag.trim().toLowerCase() === t.toLowerCase();
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={saving}
                      onClick={() => setTag(selected ? '' : t)}
                      className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition ${
                        selected
                          ? 'bg-lake-blue text-white'
                          : 'bg-map-ink-subtle text-foreground-muted hover:bg-map-ink-subtle hover:text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <input
              id="contact-save-tag"
              className={TOOL_FIELD_CLASS}
              placeholder={
                existingTags.length > 0
                  ? 'Pick above or type a new tag'
                  : 'e.g. Home · Work · Lead'
              }
              value={tag}
              maxLength={48}
              autoComplete="off"
              onChange={(e) => setTag(e.target.value)}
            />
            <p className="px-0.5 text-[11px] leading-snug text-foreground-muted">
              {existingTags.length > 0
                ? 'Tap a tag to reuse it, or type a new one. Leave blank to save untagged.'
                : 'Leave blank to save untagged.'}
            </p>
          </div>
        ) : null}
      </div>

      {saveError ? <ToolStatusLine>{saveError}</ToolStatusLine> : null}

      <div className="space-y-2">
        <ToolPrimaryButton loading={saving} onClick={() => void confirmSave()}>
          {existing ? 'Open contact' : 'Add to Contacts'}
        </ToolPrimaryButton>
        <ToolPrimaryButton variant="secondary" disabled={saving} onClick={onBack}>
          Back
        </ToolPrimaryButton>
      </div>
      <ToolCostNote>
        {existing
          ? 'Identity match · email, phone, account, or normalized address.'
          : 'Duplicates merge by identity (email, phone, account, or address).'}
      </ToolCostNote>
    </DockSection>
  );
}
