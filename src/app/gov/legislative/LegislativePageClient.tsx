'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import { partyColorClass } from '@/components/gov/PartyBadge';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import type { LegislativeMember } from '@/features/civic/services/civicService';

type SortField = 'name' | 'district' | 'party';
type SortDir = 'asc' | 'desc';
type Chamber = 'senate' | 'house';

interface Props {
  senators: LegislativeMember[];
  houseMembers: LegislativeMember[];
}

function partyLabel(party: string | null) {
  if (party === 'DFL') return 'DFL';
  if (party === 'R') return 'R';
  return party ?? '—';
}

function districtNum(d: string | null): number {
  if (!d) return 9999;
  const m = d.match(/\d+/);
  return m ? parseInt(m[0], 10) : 9999;
}

function partySeatCounts(members: LegislativeMember[]) {
  const counts: Record<string, number> = {};
  for (const m of members) {
    const p = m.party ?? 'Other';
    counts[p] = (counts[p] ?? 0) + 1;
  }
  return counts;
}

function MemberTable({
  members,
  search,
  sortField,
  sortDir,
  onSort,
}: {
  members: LegislativeMember[];
  search: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = members;
    if (q) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.district ?? '').toLowerCase().includes(q) ||
          (m.party ?? '').toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'district') cmp = districtNum(a.district) - districtNum(b.district);
      else if (sortField === 'party') cmp = (a.party ?? '').localeCompare(b.party ?? '');
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [members, search, sortField, sortDir]);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-0.5 text-[10px] font-semibold text-foreground-muted uppercase tracking-wide hover:text-foreground transition-colors"
    >
      {label}
      {sortField === field && (
        <span className="text-foreground-muted">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  );

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="grid grid-cols-[20px_1fr_72px_46px] gap-2 px-3 py-1.5 bg-surface-muted border-b border-border">
        <div />
        <SortHeader field="name" label="Name" />
        <SortHeader field="district" label="District" />
        <SortHeader field="party" label="Party" />
      </div>
      {filtered.length === 0 && (
        <div className="px-3 py-4 text-xs text-foreground-muted text-center">
          No members match your search.
        </div>
      )}
      {filtered.map((m) => (
        <div
          key={m.person_id}
          className="grid grid-cols-[20px_1fr_72px_46px] gap-2 px-3 py-1.5 text-xs border-b border-border last:border-b-0 hover:bg-surface-muted transition-colors items-center"
        >
          <PersonAvatar name={m.name} photoUrl={m.photo_url} size="xs" />
          <Link
            href={`/gov/legislative/person/${m.slug ?? m.person_id}`}
            className="text-foreground truncate hover:underline"
          >
            {m.name}
          </Link>
          <Link
            href={`/gov/legislative/person/${m.slug ?? m.person_id}`}
            className="text-foreground-muted font-mono text-[11px] hover:underline truncate"
          >
            {m.district ?? '—'}
          </Link>
          <span className={`font-medium ${partyColorClass(m.party)}`}>{partyLabel(m.party)}</span>
        </div>
      ))}
    </div>
  );
}

export default function LegislativePageClient({ senators, houseMembers }: Props) {
  const [chamber, setChamber] = useState<Chamber>('senate');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const activeMembers = chamber === 'senate' ? senators : houseMembers;
  const seatCounts = partySeatCounts(activeMembers);

  return (
    <div className="max-w-4xl mx-auto px-[10px] py-3">
      <Breadcrumbs
        items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Legislative Branch', href: null },
        ]}
      />

      <h1 className="text-sm font-semibold text-foreground mt-2">Minnesota Legislature</h1>
      <p className="text-xs text-foreground-muted mt-1">
        The Minnesota Legislature consists of the Senate and House of Representatives.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mt-3 mb-2">
        <button
          onClick={() => { setChamber('senate'); setSearch(''); }}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            chamber === 'senate'
              ? 'bg-foreground text-background dark:bg-foreground dark:text-background'
              : 'bg-surface-muted text-foreground-muted hover:bg-surface-accent'
          }`}
        >
          Senate ({senators.length})
        </button>
        <button
          onClick={() => { setChamber('house'); setSearch(''); }}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            chamber === 'house'
              ? 'bg-foreground text-background dark:bg-foreground dark:text-background'
              : 'bg-surface-muted text-foreground-muted hover:bg-surface-accent'
          }`}
        >
          House ({houseMembers.length})
        </button>
      </div>

      {/* Seat count summary */}
      {Object.keys(seatCounts).length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 text-[10px] text-foreground-muted">
          {Object.entries(seatCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([party, count], i, arr) => (
              <span key={party} className="flex items-center gap-1.5">
                <span className={`font-semibold ${partyColorClass(party)}`}>
                  {count} {party}
                </span>
                {i < arr.length - 1 && <span className="text-foreground-muted">·</span>}
              </span>
            ))}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${chamber === 'senate' ? 'senators' : 'representatives'}…`}
        aria-label={`Search ${chamber === 'senate' ? 'senators' : 'representatives'}`}
        className="w-full border border-border rounded-md px-3 py-1.5 text-xs placeholder:text-foreground-muted bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-border mb-2"
      />

      <MemberTable
        members={activeMembers}
        search={search}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  );
}
