'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  TOOL_FIELD_CLASS,
  ToolPrimaryButton,
  ToolStatusLine,
} from '@/features/tools/core/toolUi';

export type PersonProfileFields = {
  id: string;
  display_name: string;
  emails: string[] | null;
  phones: string[] | null;
  nickname: string | null;
  description: string | null;
  work: string | null;
  notes: string | null;
  tag: string | null;
};

type Suggestions = {
  phones: string[];
  emails: string[];
};

function listToLines(values: string[] | null | undefined): string {
  return (values ?? []).filter(Boolean).join('\n');
}

function linesToList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function addUnique(current: string, next: string): string {
  const list = linesToList(current);
  const key = next.trim().toLowerCase();
  if (!key) return current;
  if (list.some((v) => v.toLowerCase() === key)) return current;
  return listToLines([...list, next.trim()]);
}

const FIELD_CLASS =
  'w-full bg-transparent text-[17px] text-foreground outline-none placeholder:text-foreground-muted/40';

/**
 * Person profile — view (read-only) or edit (fields + save).
 * `chrome="ios"`: grouped inset rows; Done is the nav submit (`formId`).
 */
export function PersonContactEditForm({
  person,
  suggestions,
  editing = true,
  chrome = 'default',
  formId = 'contact-person-edit',
  onSaved,
  onDone,
}: {
  person: PersonProfileFields;
  suggestions?: Suggestions | null;
  /** When false, show a clean read-only summary. */
  editing?: boolean;
  chrome?: 'default' | 'ios';
  /** HTML form id so the nav Done button can submit. */
  formId?: string;
  onSaved: (person: PersonProfileFields) => void;
  /** After successful save (or clean Done). iOS nav uses this to leave edit. */
  onDone?: () => void;
}) {
  const [phones, setPhones] = useState(listToLines(person.phones));
  const [emails, setEmails] = useState(listToLines(person.emails));
  const [nickname, setNickname] = useState(person.nickname ?? '');
  const [description, setDescription] = useState(
    person.description ?? person.notes ?? '',
  );
  const [work, setWork] = useState(person.work ?? '');
  const [tag, setTag] = useState(person.tag ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const syncFromPerson = () => {
    setPhones(listToLines(person.phones));
    setEmails(listToLines(person.emails));
    setNickname(person.nickname ?? '');
    setDescription(person.description ?? person.notes ?? '');
    setWork(person.work ?? '');
    setTag(person.tag ?? '');
    setError(null);
  };

  useEffect(() => {
    syncFromPerson();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount fields when person identity/server values change
  }, [
    person.id,
    person.phones,
    person.emails,
    person.nickname,
    person.description,
    person.notes,
    person.work,
    person.tag,
  ]);

  // Discard local edits when re-entering edit (Cancel → Edit).
  useEffect(() => {
    if (editing) syncFromPerson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const dirty = useMemo(() => {
    const sameList = (a: string[], b: string[]) =>
      a.length === b.length && a.every((v, i) => v === b[i]);
    return (
      !sameList(linesToList(phones), person.phones ?? []) ||
      !sameList(linesToList(emails), person.emails ?? []) ||
      (nickname.trim() || null) !== (person.nickname ?? null) ||
      (description.trim() || null) !==
        (person.description ?? person.notes ?? null) ||
      (work.trim() || null) !== (person.work ?? null) ||
      (tag.trim() || null) !== (person.tag ?? null)
    );
  }, [phones, emails, nickname, description, work, tag, person]);

  const phoneSuggestions = (suggestions?.phones ?? []).filter(
    (p) => !linesToList(phones).some((x) => x.toLowerCase() === p.toLowerCase()),
  );
  const emailSuggestions = (suggestions?.emails ?? []).filter(
    (e) => !linesToList(emails).some((x) => x.toLowerCase() === e.toLowerCase()),
  );

  async function save(): Promise<boolean> {
    if (!dirty) return true;
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${person.id}?kind=person`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phones: linesToList(phones),
          emails: linesToList(emails),
          nickname: nickname.trim() || null,
          description: description.trim() || null,
          work: work.trim() || null,
          tag: tag.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        person?: PersonProfileFields;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Could not save');
      if (json.person) onSaved(json.person);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
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

  if (!editing) {
    const savedPhones = (person.phones ?? []).filter(Boolean);
    const savedEmails = (person.emails ?? []).filter(Boolean);
    // Show enrichment phones/emails in main details until they land on the book record.
    const phoneList = [
      ...savedPhones,
      ...(suggestions?.phones ?? []).filter(
        (p) => !savedPhones.some((x) => x.toLowerCase() === p.toLowerCase()),
      ),
    ];
    const emailList = [
      ...savedEmails,
      ...(suggestions?.emails ?? []).filter(
        (e) => !savedEmails.some((x) => x.toLowerCase() === e.toLowerCase()),
      ),
    ];
    const desc = person.description ?? person.notes;
    const empty =
      phoneList.length === 0 &&
      emailList.length === 0 &&
      !person.nickname &&
      !person.work &&
      !desc &&
      !person.tag;

    if (chrome === 'ios') {
      if (empty) {
        return (
          <p className="px-4 text-center text-[15px] text-foreground-muted">
            No phone or email yet. Tap Edit to add details.
          </p>
        );
      }
      return (
        <div className="space-y-8">
          {phoneList.length > 0 ? (
            <IosGroup>
              {phoneList.map((phone, i) => (
                <IosRow
                  key={`p-${phone}-${i}`}
                  label={i === 0 ? 'phone' : 'phone'}
                  last={i === phoneList.length - 1}
                >
                  <a href={`tel:${phone}`} className="text-[17px] text-lake-blue">
                    {phone}
                  </a>
                </IosRow>
              ))}
            </IosGroup>
          ) : null}
          {emailList.length > 0 ? (
            <IosGroup>
              {emailList.map((email, i) => (
                <IosRow
                  key={`e-${email}-${i}`}
                  label={i === 0 ? 'email' : 'email'}
                  last={i === emailList.length - 1}
                >
                  <a href={`mailto:${email}`} className="break-all text-[17px] text-lake-blue">
                    {email}
                  </a>
                </IosRow>
              ))}
            </IosGroup>
          ) : null}
          {person.nickname || person.work || person.tag || desc ? (
            <IosGroup>
              {person.nickname ? (
                <IosRow label="nickname" last={!person.work && !person.tag && !desc}>
                  <span className="text-[17px] text-foreground">{person.nickname}</span>
                </IosRow>
              ) : null}
              {person.work ? (
                <IosRow label="work" last={!person.tag && !desc}>
                  <span className="text-[17px] text-foreground">{person.work}</span>
                </IosRow>
              ) : null}
              {person.tag ? (
                <IosRow label="tag" last={!desc}>
                  <span className="text-[17px] text-foreground">{person.tag}</span>
                </IosRow>
              ) : null}
              {desc ? (
                <IosRow label="notes" last>
                  <span className="whitespace-pre-line text-[17px] text-foreground">{desc}</span>
                </IosRow>
              ) : null}
            </IosGroup>
          ) : null}
        </div>
      );
    }

    return (
      <section className="space-y-3">
        <div className="px-0.5">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
        </div>
        {empty ? (
          <p className="px-0.5 text-[13px] text-foreground-muted">
            No phones or emails yet. Tap Edit to add them.
          </p>
        ) : (
          <div className="divide-y divide-black/[0.06] overflow-hidden rounded-[1.15rem] border border-black/[0.08] bg-white">
            {phoneList.length ? (
              <div className="flex gap-3 px-4 py-3">
                <span className="w-[5.5rem] shrink-0 text-[13px] text-foreground-muted">Phone</span>
                <span className="min-w-0 flex-1 whitespace-pre-line text-[15px] text-foreground">
                  {phoneList.join('\n')}
                </span>
              </div>
            ) : null}
            {emailList.length ? (
              <div className="flex gap-3 px-4 py-3">
                <span className="w-[5.5rem] shrink-0 text-[13px] text-foreground-muted">Email</span>
                <span className="min-w-0 flex-1 whitespace-pre-line text-[15px] text-foreground">
                  {emailList.join('\n')}
                </span>
              </div>
            ) : null}
            {person.nickname ? (
              <div className="flex gap-3 px-4 py-3">
                <span className="w-[5.5rem] shrink-0 text-[13px] text-foreground-muted">Nickname</span>
                <span className="min-w-0 flex-1 text-[15px] text-foreground">{person.nickname}</span>
              </div>
            ) : null}
            {person.work ? (
              <div className="flex gap-3 px-4 py-3">
                <span className="w-[5.5rem] shrink-0 text-[13px] text-foreground-muted">Work</span>
                <span className="min-w-0 flex-1 text-[15px] text-foreground">{person.work}</span>
              </div>
            ) : null}
            {desc ? (
              <div className="flex gap-3 px-4 py-3">
                <span className="w-[5.5rem] shrink-0 text-[13px] text-foreground-muted">Notes</span>
                <span className="min-w-0 flex-1 whitespace-pre-line text-[15px] text-foreground">
                  {desc}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  if (chrome === 'ios') {
    return (
      <form id={formId} onSubmit={(e) => void onSubmit(e)} className="space-y-8">
        <IosGroup>
          <IosEditRow label="Tag">
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              maxLength={48}
              placeholder="Tag"
              className={FIELD_CLASS}
            />
          </IosEditRow>
          <IosEditRow label="Phone">
            <textarea
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              rows={2}
              placeholder="Phone"
              className={`${FIELD_CLASS} min-h-[2.5rem] resize-none`}
            />
          </IosEditRow>
          <IosEditRow label="Email">
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={2}
              placeholder="Email"
              className={`${FIELD_CLASS} min-h-[2.5rem] resize-none`}
            />
          </IosEditRow>
          <IosEditRow label="Nickname">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nickname"
              className={FIELD_CLASS}
            />
          </IosEditRow>
          <IosEditRow label="Work">
            <input
              value={work}
              onChange={(e) => setWork(e.target.value)}
              placeholder="Company"
              className={FIELD_CLASS}
            />
          </IosEditRow>
          <IosEditRow label="Notes" last>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes"
              className={`${FIELD_CLASS} min-h-[4rem] resize-none`}
            />
          </IosEditRow>
        </IosGroup>

        {phoneSuggestions.length > 0 || emailSuggestions.length > 0 ? (
          <IosGroup>
            <div className="px-4 py-3">
              <p className="text-[13px] font-semibold text-foreground-muted">From enrichment</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {phoneSuggestions.slice(0, 8).map((phone) => (
                  <button
                    key={phone}
                    type="button"
                    onClick={() => setPhones((prev) => addUnique(prev, phone))}
                    className="rounded-full bg-lake-blue/12 px-2.5 py-1 text-[12px] font-medium text-lake-blue"
                  >
                    + {phone}
                  </button>
                ))}
                {emailSuggestions.slice(0, 8).map((email) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => setEmails((prev) => addUnique(prev, email))}
                    className="rounded-full bg-lake-blue/12 px-2.5 py-1 text-[12px] font-medium text-lake-blue"
                  >
                    + {email}
                  </button>
                ))}
              </div>
            </div>
          </IosGroup>
        ) : null}

        {error ? (
          <p className="px-4 text-center text-[14px] text-red-600">{error}</p>
        ) : null}
        {busy ? (
          <p className="px-4 text-center text-[13px] text-foreground-muted">Saving…</p>
        ) : null}
      </form>
    );
  }

  return (
    <section className="space-y-3">
      <div className="px-0.5">
        <h2 className="text-sm font-semibold text-foreground">Editable fields</h2>
        <p className="mt-0.5 text-[12px] text-foreground-muted">
          Set phones, emails, tag, and profile — tap chips to apply enrichment values.
        </p>
      </div>

      <form
        id={formId}
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-3 overflow-hidden rounded-[1.15rem] border border-black/[0.08] bg-white p-3.5"
      >
        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-foreground-muted">Tag</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            maxLength={48}
            placeholder="e.g. Renovation Lead"
            className={TOOL_FIELD_CLASS}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-foreground-muted">
            Main phone(s)
          </span>
          <textarea
            value={phones}
            onChange={(e) => setPhones(e.target.value)}
            rows={2}
            placeholder="One per line"
            className={`${TOOL_FIELD_CLASS} h-auto min-h-[3.25rem] resize-y py-2.5`}
          />
        </label>
        {phoneSuggestions.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-lake-blue">
              From enrichment · tap to set
            </p>
            <div className="flex flex-wrap gap-1.5">
              {phoneSuggestions.slice(0, 8).map((phone) => (
                <button
                  key={phone}
                  type="button"
                  onClick={() => setPhones((prev) => addUnique(prev, phone))}
                  className="rounded-full bg-lake-blue/10 px-2.5 py-1 text-[11px] font-medium text-lake-blue"
                >
                  + {phone}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-foreground-muted">Email(s)</span>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={2}
            placeholder="One per line"
            className={`${TOOL_FIELD_CLASS} h-auto min-h-[3.25rem] resize-y py-2.5`}
          />
        </label>
        {emailSuggestions.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-lake-blue">
              From enrichment · tap to set
            </p>
            <div className="flex flex-wrap gap-1.5">
              {emailSuggestions.slice(0, 8).map((email) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => setEmails((prev) => addUnique(prev, email))}
                  className="rounded-full bg-lake-blue/10 px-2.5 py-1 text-[11px] font-medium text-lake-blue"
                >
                  + {email}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-foreground-muted">Nickname</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Preferred name"
            className={TOOL_FIELD_CLASS}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-foreground-muted">Work</span>
          <input
            value={work}
            onChange={(e) => setWork(e.target.value)}
            placeholder="Employer or role"
            className={TOOL_FIELD_CLASS}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-foreground-muted">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Short note about this person"
            className={`${TOOL_FIELD_CLASS} h-auto min-h-[4.5rem] resize-y py-2.5`}
          />
        </label>

        {error ? <ToolStatusLine>{error}</ToolStatusLine> : null}
        {savedFlash ? <ToolStatusLine>Saved</ToolStatusLine> : null}

        {!onDone ? (
          <ToolPrimaryButton disabled={!dirty || busy} loading={busy} onClick={() => void save()}>
            Save changes
          </ToolPrimaryButton>
        ) : null}
      </form>
    </section>
  );
}

function IosGroup({ children }: { children: ReactNode }) {
  return (
    <div className="mx-4 overflow-hidden rounded-[10px] bg-white">{children}</div>
  );
}

function IosRow({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex gap-3 px-4 py-2.5 ${
        last ? '' : 'border-b border-black/[0.06]'
      }`}
    >
      <span className="w-[4.75rem] shrink-0 pt-0.5 text-[12px] capitalize text-foreground-muted">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function IosEditRow({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex items-start gap-3 px-4 py-2.5 ${
        last ? '' : 'border-b border-black/[0.06]'
      }`}
    >
      <span className="w-[5.5rem] shrink-0 pt-1 text-[17px] text-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}
