'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import { UserIcon, PlusIcon } from '@heroicons/react/24/outline';
import GovPageViewTracker from './GovPageViewTracker';
import GovPeopleModal, { type GovPeopleRecord } from './GovPeopleModal';

interface PersonRecord {
  id: string;
  name: string;
  slug: string | null;
  party: string | null;
  photo_url: string | null;
  district: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  building_id: string | null;
  roles: string[];
}

const extractDistrictNumber = (district: string | null): number => {
  if (!district) return 999999;
  const match = district.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
};

const extractDistrictSuffix = (district: string | null): string => {
  if (!district) return '';
  const match = district.match(/\d+([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '';
};

const sortPeopleByDistrict = (a: PersonRecord, b: PersonRecord) => {
  const numA = extractDistrictNumber(a.district);
  const numB = extractDistrictNumber(b.district);
  if (numA !== numB) return numA - numB;
  const suffixA = extractDistrictSuffix(a.district);
  const suffixB = extractDistrictSuffix(b.district);
  if (suffixA !== suffixB) return suffixA.localeCompare(suffixB);
  return a.name.localeCompare(b.name);
};

const normalizeParty = (party: string | null): string | null => {
  if (!party) return null;
  const p = party.trim().toLowerCase();
  if (p.includes('democrat') || p === 'dfl' || p === 'd') return 'democrat';
  if (p.includes('republican') || p === 'gop' || p === 'r') return 'republican';
  return null;
};

const getPartyStyles = (party: string | null): { border: string; text: string } => {
  const n = normalizeParty(party);
  if (n === 'democrat') return { border: 'border-l-2 border-l-blue-600', text: 'text-blue-600 dark:text-blue-400' };
  if (n === 'republican') return { border: 'border-l-2 border-l-red-600 dark:border-l-red-500', text: 'text-red-600 dark:text-red-400' };
  return { border: '', text: 'text-foreground-muted' };
};

const SECTION_DFL = 'DFL' as const;
const SECTION_REPUBLICAN = 'Republican' as const;
const SECTION_OTHER = 'Other' as const;

const getSection = (party: string | null): typeof SECTION_DFL | typeof SECTION_REPUBLICAN | typeof SECTION_OTHER => {
  const n = normalizeParty(party);
  if (n === 'democrat') return SECTION_DFL;
  if (n === 'republican') return SECTION_REPUBLICAN;
  return SECTION_OTHER;
};

function fuzzyMatchPerson(query: string, p: PersonRecord): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const searchable = [p.name, p.slug, p.party, p.district, p.title, ...(p.roles ?? [])].filter(Boolean).join(' ').toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => searchable.includes(t));
}

interface GovDashboardProps {
  leaderSearchQuery?: string;
}

/**
 * Gov page main content: people & roles only. Orgs and buildings are in GovOrgsSidebar and GovBuildingsSidebar.
 */
export default function GovDashboard({ leaderSearchQuery = '' }: GovDashboardProps) {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalPerson, setModalPerson] = useState<GovPeopleRecord | null | 'create'>(null);
  const [titleFilter, setTitleFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const civic = typeof (supabase as any).schema === 'function' ? (supabase as any).schema('civic') : supabase;
      const [peopleRes, rolesRes] = await Promise.all([
        civic.from('people').select('id, name, slug, party, photo_url, district, title, email, phone, address, building_id'),
        civic.from('roles').select('person_id, title'),
      ]);
      if (peopleRes.error) throw peopleRes.error;
      const rolesByPerson = new Map<string, string[]>();
      (rolesRes.data ?? []).forEach((r: { person_id: string; title: string }) => {
        if (!r.person_id) return;
        if (!rolesByPerson.has(r.person_id)) rolesByPerson.set(r.person_id, []);
        rolesByPerson.get(r.person_id)!.push(r.title);
      });
      const peopleWithRoles = (peopleRes.data ?? []).map((p: PersonRecord) => ({
        ...p,
        roles: rolesByPerson.get(p.id) ?? [],
      }));
      setPeople(peopleWithRoles.sort(sortPeopleByDistrict));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load people');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const TITLE_FILTER_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'House of Representatives', label: 'House of Representatives' },
    { value: 'Senate', label: 'Senate' },
  ] as const;

  const filteredPeople = useMemo(() => {
    let list = people;
    if (leaderSearchQuery.trim()) {
      list = list.filter((p) => fuzzyMatchPerson(leaderSearchQuery, p));
    }
    if (titleFilter) {
      list = list.filter(
        (p) =>
          p.title === titleFilter || (p.roles && p.roles.includes(titleFilter))
      );
    }
    return list;
  }, [people, leaderSearchQuery, titleFilter]);

  const bySection = useMemo(() => {
    const dfl: PersonRecord[] = [];
    const rep: PersonRecord[] = [];
    const other: PersonRecord[] = [];
    filteredPeople.forEach((p) => {
      const section = getSection(p.party);
      if (section === SECTION_DFL) dfl.push(p);
      else if (section === SECTION_REPUBLICAN) rep.push(p);
      else other.push(p);
    });
    return { dfl, republican: rep, other };
  }, [filteredPeople]);

  const sections = useMemo(
    () => [
      { key: 'dfl', title: 'DFL', people: bySection.dfl, labelClass: 'text-blue-600 dark:text-blue-400' },
      { key: 'republican', title: 'Republican', people: bySection.republican, labelClass: 'text-red-600 dark:text-red-400' },
      ...(bySection.other.length > 0 ? [{ key: 'other', title: 'Other', people: bySection.other, labelClass: 'text-foreground-muted' }] : []),
    ],
    [bySection]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-xs text-foreground-muted">Loading people…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 border border-border-muted dark:border-white/10 rounded-md bg-surface">
        <p className="text-xs text-foreground-muted">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <GovPageViewTracker />
      <div className="p-2 border-b border-border-muted dark:border-white/10 flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-foreground-muted" />
          <h2 className="text-xs font-semibold text-foreground">People & roles</h2>
          <span className="text-xs text-foreground-muted">
            ({filteredPeople.length}{titleFilter ? ` of ${people.length}` : ''})
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setModalPerson('create')}
              className="ml-auto w-6 h-6 rounded flex items-center justify-center text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
              aria-label="Add person"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value)}
          className="w-full max-w-[220px] text-xs px-2 py-1.5 rounded-md border border-border-muted dark:border-white/10 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-foreground-muted"
          aria-label="Filter by title (chamber)"
        >
          {TITLE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-3">
        {sections.map(({ key, title, people: sectionPeople, labelClass }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <h3 className={`text-xs font-semibold ${labelClass}`}>{title}</h3>
            <div className="flex flex-wrap gap-2">
              {sectionPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setModalPerson({
                    id: person.id,
                    name: person.name,
                    slug: person.slug,
                    party: person.party,
                    photo_url: person.photo_url,
                    district: person.district,
                    title: person.title ?? null,
                    email: person.email ?? null,
                    phone: person.phone ?? null,
                    address: person.address ?? null,
                    building_id: person.building_id ?? null,
                    roles: person.roles,
                  })}
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border-muted dark:border-white/10 bg-surface hover:bg-surface-accent transition-colors text-left min-w-0"
                >
                  {person.photo_url ? (
                    <img
                      src={person.photo_url}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-surface-accent flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-3 h-3 text-foreground-muted" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate leading-tight">{person.name}</p>
                    <p className="text-[10px] text-foreground-muted leading-tight">
                      {person.district ?? '—'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {(modalPerson === 'create' || modalPerson) && (
        <GovPeopleModal
          record={modalPerson === 'create' ? null : modalPerson}
          onClose={() => setModalPerson(null)}
          onSave={load}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
