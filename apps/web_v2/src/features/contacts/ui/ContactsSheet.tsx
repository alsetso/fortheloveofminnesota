'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  CONTACT_INDEX_LETTERS,
  groupBySectionLetter,
  type ContactIndexLetter,
} from '@/features/contacts/logic/contactSheetGrouping';
import type {
  ContactsSheetKind,
  ContactsSheetState,
} from '@/features/contacts/state/contactsSheetTypes';
import ContactDetailPane from '@/features/contacts/ui/ContactDetailPane';
import ContactsSheetShell from '@/features/contacts/ui/ContactsSheetShell';
import { PENDING_CONTACT_TAG_KEY } from '@/features/contacts/state/pendingContactTag';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  IconArrowLeft,
  IconHome,
  IconMapPin,
  IconPeopleGroup,
  IconPlus,
  IconSearch,
} from '@/features/map/dockCore/core/icons';

type SheetPerson = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  emails: string[] | null;
  phones: string[] | null;
  tag?: string | null;
  avatar_url?: string | null;
};

type SheetAddress = {
  id: string;
  label: string;
  line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  tag?: string | null;
};

function personSortKey(p: SheetPerson): string {
  return (p.last_name || p.display_name || '').trim() || '#';
}

function addressSortKey(a: SheetAddress): string {
  return (a.label || a.line1 || a.city || '').trim() || '#';
}

function matchesQuery(haystack: string, q: string): boolean {
  if (!q) return true;
  return haystack.toLowerCase().includes(q.toLowerCase());
}

function PersonDisplayName({ person }: { person: SheetPerson }) {
  const first = person.first_name?.trim() ?? '';
  const last = person.last_name?.trim() ?? '';
  if (last) {
    return (
      <>
        {first ? <span className="font-normal">{first} </span> : null}
        <span className="font-semibold">{last}</span>
      </>
    );
  }
  const parts = person.display_name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const head = parts.slice(0, -1).join(' ');
    const tail = parts[parts.length - 1]!;
    return (
      <>
        <span className="font-normal">{head} </span>
        <span className="font-semibold">{tail}</span>
      </>
    );
  }
  return <span className="font-semibold">{person.display_name || 'Person'}</span>;
}

function ListAvatar({
  name,
  src,
  fallback,
}: {
  name: string;
  src?: string | null;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        onError={() => setFailed(true)}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (fallback && !initials) {
    return (
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lake-blue/15 text-lake-blue">
        {fallback}
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tracking-wide text-white"
      style={{
        background:
          'linear-gradient(145deg, rgb(var(--lake-blue)) 0%, rgb(var(--lake-blue) / 0.72) 100%)',
      }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}

/**
 * Full-viewport iOS-style Contacts sheet — people or addresses, A–Z index,
 * floating search + add. Mounted over the map stage (not inside the dock).
 * Layout lives in ContactsSheetShell (keyboard-aware footer; sub-pages swap content).
 */
export default function ContactsSheet({
  state,
  onClose,
}: {
  state: ContactsSheetState;
  onClose: (opts?: { reopenLists?: boolean }) => void;
}) {
  const { account } = useAuthSafe();
  const { openSubpage } = useMapDock();
  const [kind, setKind] = useState<ContactsSheetKind>(
    state.kind === 'businesses' ? 'people' : state.kind,
  );
  const [query, setQuery] = useState(state.query);
  const [activeTag, setActiveTag] = useState<string | null>(state.tag);
  const [tagDraft, setTagDraft] = useState(state.tag ?? '');
  const [renamingTag, setRenamingTag] = useState(false);
  const [people, setPeople] = useState<SheetPerson[]>([]);
  const [addresses, setAddresses] = useState<SheetAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState(true);
  const [selected, setSelected] = useState<{
    kind: 'person' | 'address';
    id: string;
  } | null>(null);
  const [detailTitle, setDetailTitle] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<ContactIndexLetter, HTMLElement | null>>>({});
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setKind(state.kind === 'businesses' ? 'people' : state.kind);
    setQuery(state.query);
    setActiveTag(state.tag);
    setTagDraft(state.tag ?? '');
    setSelected(null);
    setDetailTitle(null);
    setDetailEditing(false);
  }, [state.kind, state.query, state.tag]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected) {
        setSelected(null);
        return;
      }
      onClose({ reopenLists: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, selected]);

  const load = useCallback(async () => {
    if (!account) {
      setPeople([]);
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contacts', { credentials: 'include' });
      const json = (await res.json()) as {
        people?: SheetPerson[];
        addresses?: SheetAddress[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load contacts');
      setPeople(json.people ?? []);
      setAddresses(json.addresses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeTag || loading) return;
    const tag = activeTag.trim().toLowerCase();
    const peopleHit = people.some((p) => (p.tag ?? '').trim().toLowerCase() === tag);
    const addressHit = addresses.some((a) => (a.tag ?? '').trim().toLowerCase() === tag);
    if (!peopleHit && addressHit) setKind('addresses');
  }, [activeTag, loading, people, addresses]);

  const tagFilter = activeTag?.trim().toLowerCase() ?? '';
  const inTagList = Boolean(activeTag?.trim());

  const filteredPeople = useMemo(() => {
    const q = query.trim();
    return people.filter((p) => {
      if (tagFilter && (p.tag ?? '').trim().toLowerCase() !== tagFilter) return false;
      return matchesQuery(
        [p.display_name, p.first_name, p.last_name, p.tag, ...(p.emails ?? []), ...(p.phones ?? [])]
          .filter(Boolean)
          .join(' '),
        q,
      );
    });
  }, [people, query, tagFilter]);

  const filteredAddresses = useMemo(() => {
    const q = query.trim();
    return addresses.filter((a) => {
      if (tagFilter && (a.tag ?? '').trim().toLowerCase() !== tagFilter) return false;
      return matchesQuery(
        [a.label, a.line1, a.city, a.state, a.postal_code, a.tag].filter(Boolean).join(' '),
        q,
      );
    });
  }, [addresses, query, tagFilter]);

  const peopleSections = useMemo(
    () => groupBySectionLetter(filteredPeople, personSortKey),
    [filteredPeople],
  );
  const addressSections = useMemo(
    () => groupBySectionLetter(filteredAddresses, addressSortKey),
    [filteredAddresses],
  );

  const sections = kind === 'people' ? peopleSections : addressSections;
  const recordCount =
    kind === 'people' ? filteredPeople.length : filteredAddresses.length;
  const activeLetters = useMemo(
    () => new Set(sections.map((s) => s.letter)),
    [sections],
  );

  const scrollToLetter = (letter: ContactIndexLetter) => {
    const el = sectionRefs.current[letter];
    const root = listRef.current;
    if (!el || !root) return;
    root.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
  };

  const openPerson = (p: SheetPerson) => {
    setDetailEditing(false);
    setDetailTitle(p.display_name);
    setSelected({ kind: 'person', id: p.id });
    listRef.current?.scrollTo({ top: 0 });
  };

  const openAddress = (a: SheetAddress) => {
    setDetailEditing(false);
    setDetailTitle(a.label);
    setSelected({ kind: 'address', id: a.id });
    listRef.current?.scrollTo({ top: 0 });
  };

  const backFromDetail = () => {
    setSelected(null);
    setDetailTitle(null);
    setDetailEditing(false);
    void load();
  };

  const onAdd = () => {
    if (inTagList && activeTag) {
      try {
        sessionStorage.setItem(PENDING_CONTACT_TAG_KEY, activeTag);
      } catch {
        /* ignore */
      }
    }
    onClose();
    openSubpage({
      title: kind === 'people' ? 'People' : 'Addresses',
      subtitle: inTagList && activeTag ? `Tag as ${activeTag}` : kind === 'people' ? 'Name, email, or phone' : 'Property & owner lookup',
      kind,
    });
  };

  const commitTagRename = async () => {
    if (!activeTag) return;
    const next = tagDraft.trim().slice(0, 48);
    if (!next) {
      setTagDraft(activeTag);
      return;
    }
    if (next === activeTag) return;

    setRenamingTag(true);
    try {
      const res = await fetch('/api/contacts/tags', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: activeTag, to: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not rename tag');

      const from = activeTag;
      setPeople((prev) =>
        prev.map((p) => ((p.tag ?? '').trim() === from ? { ...p, tag: next } : p)),
      );
      setAddresses((prev) =>
        prev.map((a) => ((a.tag ?? '').trim() === from ? { ...a, tag: next } : a)),
      );
      setActiveTag(next);
      setTagDraft(next);
    } catch {
      setTagDraft(activeTag);
    } finally {
      setRenamingTag(false);
    }
  };

  const emptyLabel =
    kind === 'people'
      ? query.trim() || tagFilter
        ? 'No matching people'
        : 'No people saved'
      : query.trim() || tagFilter
        ? 'No matching addresses'
        : 'No addresses saved';

  const glassChrome =
    'border border-black/[0.08] bg-white/70 shadow-[0_4px_24px_rgba(0,0,0,0.08)] backdrop-blur-2xl backdrop-saturate-150';

  const sheetAriaLabel = selected
    ? 'Contact'
    : inTagList
      ? `Tag · ${activeTag}`
      : 'Contacts';

  const header = (
    <>
      <div
        className="pointer-events-none absolute inset-0 backdrop-blur-xl"
        style={{
          maskImage:
            'linear-gradient(to bottom, black 0%, black 55%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 55%, transparent 100%)',
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.72) 55%, rgba(255,255,255,0) 100%)',
        }}
        aria-hidden
      />
      <div className="pointer-events-auto relative px-3 pb-2">
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => {
              if (selected) {
                backFromDetail();
                return;
              }
              onClose({ reopenLists: true });
            }}
            aria-label={selected ? 'Back to contacts' : 'Back to Lists'}
            className={`relative z-[1] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1C1C1E] transition active:scale-95 ${glassChrome}`}
          >
            <IconArrowLeft className="h-4 w-4" />
          </button>

          {selected ? (
            <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-[1.05rem] font-semibold tracking-tight">
              {detailTitle ?? 'Contact'}
            </h1>
          ) : inTagList ? (
            <div className="absolute inset-x-12 flex flex-col items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">
                Tag
              </span>
              <input
                ref={tagInputRef}
                value={tagDraft}
                disabled={renamingTag}
                maxLength={48}
                onChange={(e) => setTagDraft(e.target.value)}
                onBlur={() => void commitTagRename()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setTagDraft(activeTag ?? '');
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                aria-label="Edit tag name"
                className="w-full max-w-[14rem] bg-transparent text-center text-[1.05rem] font-semibold tracking-tight text-[#1C1C1E] outline-none disabled:opacity-60"
              />
            </div>
          ) : (
            <h1 className="pointer-events-none absolute inset-x-0 text-center text-[1.05rem] font-semibold tracking-tight">
              Contacts
            </h1>
          )}

          {!selected ? (
            <div
              className={`relative z-[1] ml-auto inline-flex shrink-0 items-center rounded-full p-0.5 ${glassChrome}`}
              role="group"
              aria-label="People or addresses"
            >
              <button
                type="button"
                onClick={() => setKind('people')}
                aria-label="People"
                aria-pressed={kind === 'people'}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                  kind === 'people'
                    ? 'bg-white text-lake-blue shadow-sm shadow-black/10'
                    : 'text-[#8E8E93]'
                }`}
              >
                <IconPeopleGroup className="h-4 w-4" />
              </button>
              <span
                className="min-w-[1.25rem] px-1 text-center text-[12px] font-semibold tabular-nums text-[#8E8E93]"
                aria-live="polite"
              >
                {loading ? '—' : recordCount}
              </span>
              <button
                type="button"
                onClick={() => setKind('addresses')}
                aria-label="Addresses"
                aria-pressed={kind === 'addresses'}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                  kind === 'addresses'
                    ? 'bg-white text-lake-blue shadow-sm shadow-black/10'
                    : 'text-[#8E8E93]'
                }`}
              >
                <IconMapPin className="h-4 w-4" />
              </button>
            </div>
          ) : selected.kind === 'person' ? (
            <button
              type="button"
              onClick={() => setDetailEditing((v) => !v)}
              className={`relative z-[1] ml-auto inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3.5 text-[15px] font-semibold text-lake-blue transition active:scale-95 ${glassChrome}`}
            >
              {detailEditing ? 'Done' : 'Edit'}
            </button>
          ) : (
            <span className="ml-auto inline-flex h-9 w-[4.5rem] shrink-0" aria-hidden />
          )}
        </div>
      </div>
    </>
  );

  const sideChrome = !selected ? (
    <nav
      className="flex h-full w-5 flex-col items-center justify-center gap-px py-2"
      aria-label="Alphabet index"
    >
      {CONTACT_INDEX_LETTERS.map((letter) => {
        const enabled = activeLetters.has(letter);
        return (
          <button
            key={letter}
            type="button"
            disabled={!enabled}
            onClick={() => scrollToLetter(letter)}
            className={`text-[9px] font-semibold leading-none transition ${
              enabled
                ? 'text-[rgb(var(--lake-blue))] active:opacity-60'
                : 'text-[#C7C7CC]'
            }`}
          >
            {letter}
          </button>
        );
      })}
    </nav>
  ) : null;

  const footer = !selected ? (
    <div className="flex items-center gap-2.5 px-3">
      <label className="pointer-events-auto relative min-w-0 flex-1">
        <span className="sr-only">
          Search {kind === 'people' ? 'contacts' : 'addresses'}
        </span>
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          autoComplete="off"
          enterKeyHint="search"
          className={`h-11 w-full rounded-full pl-10 pr-4 text-[16px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] ${glassChrome}`}
        />
      </label>
      <button
        type="button"
        onClick={onAdd}
        aria-label={kind === 'people' ? 'Find people to save' : 'Look up address'}
        className={`pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#1C1C1E] transition active:scale-95 ${glassChrome}`}
      >
        <IconPlus className="h-5 w-5" />
      </button>
    </div>
  ) : null;

  return (
    <ContactsSheetShell
      ariaLabel={sheetAriaLabel}
      entering={entering}
      onEnterEnd={() => setEntering(false)}
      bodyRef={listRef}
      header={header}
      footer={footer}
      sideChrome={sideChrome}
      headerClear={selected ? '3.5rem' : inTagList ? '4rem' : '3.5rem'}
      footerClear="4rem"
      bodyBottomClear="1.5rem"
      sideChromeTop={inTagList ? '4.25rem' : '3.75rem'}
    >
      {selected ? (
        <ContactDetailPane
          key={`${selected.kind}:${selected.id}`}
          embedded
          kind={selected.kind}
          id={selected.id}
          editing={detailEditing}
          onEditingChange={setDetailEditing}
          onTitleChange={setDetailTitle}
          onBack={backFromDetail}
          onSelectContact={(k, id) => {
            setDetailEditing(false);
            setDetailTitle(null);
            setSelected({ kind: k, id });
            listRef.current?.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <>
          {loading ? (
            <div className="space-y-0 px-4 pt-1">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-black/[0.06] py-3"
                >
                  <div className="h-10 w-10 animate-pulse rounded-full bg-black/[0.06]" />
                  <div className="h-4 w-40 animate-pulse rounded bg-black/[0.06]" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && sections.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-[16px] font-semibold text-[#1C1C1E]">{emptyLabel}</p>
              <p className="mt-1 text-[13px] text-[#8E8E93]">
                {inTagList
                  ? kind === 'people'
                    ? 'No people with this tag yet. Tap + to find someone.'
                    : 'No addresses with this tag yet. Tap + to look one up.'
                  : kind === 'people'
                    ? 'Save someone from People lookup, or tap + below.'
                    : 'Save an address from the map or Addresses lookup.'}
              </p>
              {error ? (
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-4 text-[14px] font-semibold text-[rgb(var(--lake-blue))]"
                >
                  {error} — tap to retry
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading
            ? sections.map((section) => (
                <section
                  key={section.letter}
                  ref={(el) => {
                    sectionRefs.current[section.letter] = el;
                  }}
                >
                  <div className="sticky top-0 z-[1] bg-transparent px-4 py-1">
                    <span className="text-[13px] font-semibold text-[#8E8E93]">
                      {section.letter}
                    </span>
                  </div>
                  <ul className="bg-white">
                    {kind === 'people'
                      ? (section.items as SheetPerson[]).map((p, i, arr) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => openPerson(p)}
                              className="flex w-full items-center gap-3 bg-transparent px-4 py-2.5 text-left transition active:bg-black/[0.04]"
                            >
                              <ListAvatar name={p.display_name} src={p.avatar_url} />
                              <span
                                className={`min-w-0 flex-1 border-b border-black/[0.06] pb-2.5 pt-0.5 ${
                                  i === arr.length - 1 ? 'border-transparent' : ''
                                }`}
                              >
                                <span className="block truncate text-[16px] leading-snug text-[#1C1C1E]">
                                  <PersonDisplayName person={p} />
                                  {!inTagList && p.tag ? (
                                    <span className="font-normal text-[#8E8E93]">
                                      {' '}
                                      ({p.tag})
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))
                      : (section.items as SheetAddress[]).map((a, i, arr) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => openAddress(a)}
                              className="flex w-full items-center gap-3 bg-transparent px-4 py-2.5 text-left transition active:bg-black/[0.04]"
                            >
                              <ListAvatar
                                name={a.label}
                                fallback={<IconHome className="h-5 w-5" />}
                              />
                              <span
                                className={`min-w-0 flex-1 border-b border-black/[0.06] pb-2.5 pt-0.5 ${
                                  i === arr.length - 1 ? 'border-transparent' : ''
                                }`}
                              >
                                <span className="block truncate text-[16px] leading-snug">
                                  <span className="font-semibold text-[#1C1C1E]">{a.label}</span>
                                  {!inTagList && a.tag ? (
                                    <span className="font-normal text-[#8E8E93]">
                                      {' '}
                                      ({a.tag})
                                    </span>
                                  ) : null}
                                </span>
                                {[a.city, a.state].filter(Boolean).length ? (
                                  <span className="mt-0.5 block truncate text-[13px] text-[#8E8E93]">
                                    {[a.city, a.state].filter(Boolean).join(', ')}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        ))}
                  </ul>
                </section>
              ))
            : null}
        </>
      )}
    </ContactsSheetShell>
  );
}
