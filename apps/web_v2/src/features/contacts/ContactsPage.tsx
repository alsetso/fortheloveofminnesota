'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import {
  CONTACT_INDEX_LETTERS,
  groupBySectionLetter,
  type ContactIndexLetter,
} from '@/features/contacts/logic/contactSheetGrouping';
import type { ContactsSheetKind } from '@/features/contacts/state/contactsSheetTypes';
import ContactDetailPane from '@/features/contacts/ui/ContactDetailPane';
import { TopBar } from '@/features/appShell/TopBar';
import { useAuthSafe } from '@/features/auth';
import {
  IconArrowLeft,
  IconHome,
  IconSearch,
} from '@/features/map/dockCore/core/icons';
import { safePadTop } from '@/lib/despia/safeArea';
import { CONTACTS_PATH, GAME_PATH, PAGE_PATH } from '@/lib/routes/routePolicy';

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

type SheetBusiness = {
  id: string;
  slug: string;
  title: string;
  pageTypeLabel?: string | null;
  addressLine?: string | null;
  logoUrl?: string | null;
};

function personSortKey(p: SheetPerson): string {
  return (p.last_name || p.display_name || '').trim() || '#';
}

function addressSortKey(a: SheetAddress): string {
  return (a.label || a.line1 || a.city || '').trim() || '#';
}

function businessSortKey(b: SheetBusiness): string {
  return (b.title || '').trim() || '#';
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
 * /contacts — People / Addresses / Businesses book.
 * Header Find opens lookup (or the map for businesses).
 */
export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account } = useAuthSafe();
  const [kind, setKind] = useState<ContactsSheetKind>('people');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<SheetPerson[]>([]);
  const [addresses, setAddresses] = useState<SheetAddress[]>([]);
  const [businesses, setBusinesses] = useState<SheetBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    kind: 'person' | 'address';
    id: string;
  } | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<ContactIndexLetter, HTMLElement | null>>>({});

  const deepLinkKey = (() => {
    const personId = searchParams.get('person')?.trim();
    if (personId) return `person:${personId}`;
    const addressId = searchParams.get('address')?.trim();
    if (addressId) return `address:${addressId}`;
    return null;
  })();

  useEffect(() => {
    if (!deepLinkKey) return;
    if (deepLinkKey.startsWith('person:')) {
      const id = deepLinkKey.slice('person:'.length);
      setKind('people');
      setSelected({ kind: 'person', id });
    } else {
      const id = deepLinkKey.slice('address:'.length);
      setKind('addresses');
      setSelected({ kind: 'address', id });
    }
    setDetailEditing(false);
  }, [deepLinkKey]);

  const load = useCallback(async () => {
    if (!account) {
      setPeople([]);
      setAddresses([]);
      setBusinesses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [contactsRes, favoritesRes] = await Promise.all([
        fetch('/api/contacts', { credentials: 'include' }),
        fetch('/api/directory/favorites', { credentials: 'include', cache: 'no-store' }),
      ]);
      const contactsJson = (await contactsRes.json()) as {
        people?: SheetPerson[];
        addresses?: SheetAddress[];
        error?: string;
      };
      if (!contactsRes.ok) {
        throw new Error(contactsJson.error ?? 'Failed to load contacts');
      }
      setPeople(contactsJson.people ?? []);
      setAddresses(contactsJson.addresses ?? []);

      if (favoritesRes.ok) {
        const favJson = (await favoritesRes.json()) as { pages?: SheetBusiness[] };
        setBusinesses(favJson.pages ?? []);
      } else {
        setBusinesses([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPeople = useMemo(() => {
    const q = query.trim();
    return people.filter((p) =>
      matchesQuery(
        [p.display_name, p.first_name, p.last_name, p.tag, ...(p.emails ?? []), ...(p.phones ?? [])]
          .filter(Boolean)
          .join(' '),
        q,
      ),
    );
  }, [people, query]);

  const filteredAddresses = useMemo(() => {
    const q = query.trim();
    return addresses.filter((a) =>
      matchesQuery(
        [a.label, a.line1, a.city, a.state, a.postal_code, a.tag].filter(Boolean).join(' '),
        q,
      ),
    );
  }, [addresses, query]);

  const filteredBusinesses = useMemo(() => {
    const q = query.trim();
    return businesses.filter((b) =>
      matchesQuery(
        [b.title, b.pageTypeLabel, b.addressLine].filter(Boolean).join(' '),
        q,
      ),
    );
  }, [businesses, query]);

  const peopleSections = useMemo(
    () => groupBySectionLetter(filteredPeople, personSortKey),
    [filteredPeople],
  );
  const addressSections = useMemo(
    () => groupBySectionLetter(filteredAddresses, addressSortKey),
    [filteredAddresses],
  );
  const businessSections = useMemo(
    () => groupBySectionLetter(filteredBusinesses, businessSortKey),
    [filteredBusinesses],
  );

  const sections =
    kind === 'people'
      ? peopleSections
      : kind === 'addresses'
        ? addressSections
        : businessSections;
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
    setSelected({ kind: 'person', id: p.id });
    listRef.current?.scrollTo({ top: 0 });
  };

  const openAddress = (a: SheetAddress) => {
    setDetailEditing(false);
    setSelected({ kind: 'address', id: a.id });
    listRef.current?.scrollTo({ top: 0 });
  };

  const openBusiness = (b: SheetBusiness) => {
    router.push(`${PAGE_PATH}/${encodeURIComponent(b.slug || b.id)}`);
  };

  const backFromDetail = () => {
    setSelected(null);
    setDetailEditing(false);
    void load();
    if (searchParams.get('person') || searchParams.get('address')) {
      router.replace(CONTACTS_PATH);
    }
  };

  const onFind = () => {
    if (kind === 'businesses') {
      router.push(GAME_PATH);
      return;
    }
    router.push(`${CONTACTS_PATH}/new?kind=${kind}`);
  };

  const emptyLabel =
    kind === 'people'
      ? query.trim()
        ? 'No matching people'
        : 'No people saved'
      : kind === 'addresses'
        ? query.trim()
          ? 'No matching addresses'
          : 'No addresses saved'
        : query.trim()
          ? 'No matching businesses'
          : 'No businesses saved';

  const emptyHint =
    kind === 'people'
      ? 'Tap Find to look someone up and save them.'
      : kind === 'addresses'
        ? 'Tap Find to look up an address and save it.'
        : 'Open a page and tap Save to book.';

  const kindToggle = (
    <div className="space-y-2.5 pb-3">
      <div
        role="tablist"
        aria-label="People, addresses, or businesses"
        className="flex gap-5 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {(
          [
            { id: 'people' as const, label: 'People' },
            { id: 'addresses' as const, label: 'Addresses' },
            { id: 'businesses' as const, label: 'Businesses' },
          ] as const
        ).map((seg) => {
          const isActive = kind === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setKind(seg.id)}
              className={`relative shrink-0 pb-2.5 pt-1 text-[15px] transition-colors active:opacity-70 ${
                isActive
                  ? 'font-bold text-foreground'
                  : 'font-medium text-foreground-muted'
              }`}
            >
              {seg.label}
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 mx-auto h-[3px] w-full rounded-full bg-foreground"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="px-4">
        <label className="relative block min-w-0">
          <span className="sr-only">
            Search{' '}
            {kind === 'people'
              ? 'contacts'
              : kind === 'addresses'
                ? 'addresses'
                : 'businesses'}
          </span>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            autoComplete="off"
            enterKeyHint="search"
            className="h-9 w-full rounded-full border border-black/[0.08] bg-white pl-9 pr-3 text-[15px] text-foreground outline-none placeholder:text-foreground-muted shadow-sm"
          />
        </label>
      </div>
    </div>
  );

  if (selected) {
    const editFormId =
      selected.kind === 'person' ? 'contact-person-edit' : 'contact-address-edit';
    return (
      <PageScroll>
        <header
          className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
          style={{ paddingTop: safePadTop('0.2rem') }}
        >
          <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
            {detailEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setDetailEditing(false)}
                  className="justify-self-start px-1.5 py-1.5 text-[16px] font-semibold text-lake-blue transition active:opacity-70"
                >
                  Cancel
                </button>
                <h1 className="truncate text-center text-[17px] font-bold tracking-tight text-foreground">
                  {selected.kind === 'person' ? 'Edit Contact' : 'Edit Address'}
                </h1>
                <button
                  type="submit"
                  form={editFormId}
                  className="justify-self-end px-1.5 py-1.5 text-[16px] font-semibold text-lake-blue transition active:opacity-70"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={backFromDetail}
                  aria-label="Back to Contacts"
                  className="inline-flex h-9 items-center gap-0.5 justify-self-start rounded-full px-1.5 text-lake-blue transition active:opacity-70"
                >
                  <IconArrowLeft className="h-5 w-5" />
                  <span className="text-[16px] font-semibold">Contacts</span>
                </button>
                <h1 className="truncate text-center text-[17px] font-bold tracking-tight text-foreground">
                  {selected.kind === 'person' ? 'Contact' : 'Address'}
                </h1>
                <button
                  type="button"
                  onClick={() => setDetailEditing(true)}
                  className="justify-self-end px-1.5 py-1.5 text-[16px] font-semibold text-lake-blue transition active:opacity-70"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </header>
        <div ref={listRef}>
          <ContactDetailPane
            key={`${selected.kind}:${selected.id}`}
            embedded
            kind={selected.kind}
            id={selected.id}
            query={searchParams.get('q')}
            editing={detailEditing}
            onEditingChange={setDetailEditing}
            onBack={backFromDetail}
            onSelectContact={(k, id) => {
              setDetailEditing(false);
              setSelected({ kind: k, id });
              listRef.current?.scrollTo({ top: 0 });
            }}
          />
        </div>
      </PageScroll>
    );
  }

  return (
    <PageScroll onRefresh={account ? load : undefined}>
      <TopBar
        title="Contacts"
        below={kindToggle}
        trailing={
          account ? (
            <button
              type="button"
              onClick={onFind}
              className="px-1 py-1.5 text-[16px] font-semibold text-lake-blue transition active:opacity-70"
            >
              Find
            </button>
          ) : null
        }
      />

      <div className="relative min-h-0 flex-1">
        {!account ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[16px] font-semibold text-foreground">Sign in to use Contacts</p>
            <p className="mt-1 text-[13px] text-foreground-muted">
              Save people, addresses, and businesses to your book.
            </p>
          </div>
        ) : (
          <div ref={listRef} className="relative pb-4">
            <nav
              className="pointer-events-none absolute bottom-8 right-1 top-2 z-[2] flex w-5 flex-col items-center justify-center gap-px"
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
                    className={`pointer-events-auto text-[9px] font-semibold leading-none transition ${
                      enabled
                        ? 'text-lake-blue active:opacity-60'
                        : 'text-foreground-muted/35'
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </nav>

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
                <p className="text-[16px] font-semibold text-foreground">{emptyLabel}</p>
                <p className="mt-1 text-[13px] text-foreground-muted">{emptyHint}</p>
                {error ? (
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-4 text-[14px] font-semibold text-lake-blue"
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
                    <div className="sticky top-0 z-[1] bg-[#f7f5f1]/92 px-4 py-1 backdrop-blur-sm">
                      <span className="text-[13px] font-semibold text-foreground-muted">
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
                                  <span className="block truncate text-[16px] leading-snug text-foreground">
                                    <PersonDisplayName person={p} />
                                    {p.tag ? (
                                      <span className="font-normal text-foreground-muted">
                                        {' '}
                                        ({p.tag})
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))
                        : kind === 'addresses'
                          ? (section.items as SheetAddress[]).map((a, i, arr) => (
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
                                      <span className="font-semibold text-foreground">
                                        {a.label}
                                      </span>
                                      {a.tag ? (
                                        <span className="font-normal text-foreground-muted">
                                          {' '}
                                          ({a.tag})
                                        </span>
                                      ) : null}
                                    </span>
                                    {[a.city, a.state].filter(Boolean).length ? (
                                      <span className="mt-0.5 block truncate text-[13px] text-foreground-muted">
                                        {[a.city, a.state].filter(Boolean).join(', ')}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            ))
                          : (section.items as SheetBusiness[]).map((b, i, arr) => (
                              <li key={b.id}>
                                <button
                                  type="button"
                                  onClick={() => openBusiness(b)}
                                  className="flex w-full items-center gap-3 bg-transparent px-4 py-2.5 text-left transition active:bg-black/[0.04]"
                                >
                                  <ListAvatar name={b.title} src={b.logoUrl} />
                                  <span
                                    className={`min-w-0 flex-1 border-b border-black/[0.06] pb-2.5 pt-0.5 ${
                                      i === arr.length - 1 ? 'border-transparent' : ''
                                    }`}
                                  >
                                    <span className="block truncate text-[16px] font-semibold leading-snug text-foreground">
                                      {b.title}
                                    </span>
                                    {b.pageTypeLabel || b.addressLine ? (
                                      <span className="mt-0.5 block truncate text-[13px] text-foreground-muted">
                                        {[b.pageTypeLabel, b.addressLine]
                                          .filter(Boolean)
                                          .join(' · ')}
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
          </div>
        )}
      </div>
    </PageScroll>
  );
}
