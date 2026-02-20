'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import GovSubNav from '@/components/sub-nav/GovSubNav';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import type { LegislativeMember } from '@/features/civic/services/civicService';

type SortField = 'name' | 'district' | 'party';
type SortDir = 'asc' | 'desc';
type Chamber = 'senate' | 'house';

interface Props {
  senators: LegislativeMember[];
  houseMembers: LegislativeMember[];
}

function partyColor(party: string | null) {
  if (party === 'DFL') return 'text-blue-600';
  if (party === 'R') return 'text-red-600';
  return 'text-gray-500';
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
      className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-900 transition-colors"
    >
      {label}
      {sortField === field && (
        <span className="text-gray-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_50px] gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <SortHeader field="name" label="Name" />
        <SortHeader field="district" label="District" />
        <SortHeader field="party" label="Party" />
      </div>
      {filtered.length === 0 && (
        <div className="px-3 py-4 text-xs text-gray-400 text-center">No members match your search.</div>
      )}
      {filtered.map((m) => (
        <Link
          key={m.person_id}
          href={`/gov/person/${m.slug ?? m.person_id}`}
          className="grid grid-cols-[1fr_80px_50px] gap-2 px-3 py-1.5 text-xs border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
        >
          <span className="text-gray-900 truncate">{m.name}</span>
          <span className="text-gray-500 font-mono text-[11px]">{m.district ?? '—'}</span>
          <span className={`font-medium ${partyColor(m.party)}`}>{partyLabel(m.party)}</span>
        </Link>
      ))}
    </div>
  );
}

export default function LegislativePageClient({ senators, houseMembers }: Props) {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);
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

  const activeMembrs = chamber === 'senate' ? senators : houseMembers;

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<GovSubNav />}
      subSidebarLabel="Government"
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
    >
      <div className="max-w-4xl mx-auto px-[10px] py-3">
        <Breadcrumbs
          items={[
            { label: 'Minnesota', href: '/' },
            { label: 'Government', href: '/gov' },
            { label: 'Legislative Branch', href: null },
          ]}
        />

        <h1 className="text-sm font-semibold text-gray-900 mt-2">Minnesota Legislature</h1>
        <p className="text-xs text-gray-600 mt-1">
          The Minnesota Legislature consists of the Senate and House of Representatives.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 mb-2">
          <button
            onClick={() => { setChamber('senate'); setSearch(''); }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              chamber === 'senate'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Senate ({senators.length})
          </button>
          <button
            onClick={() => { setChamber('house'); setSearch(''); }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              chamber === 'house'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            House ({houseMembers.length})
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${chamber === 'senate' ? 'senators' : 'representatives'}…`}
          aria-label={`Search ${chamber === 'senate' ? 'senators' : 'representatives'}`}
          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 mb-2"
        />

        <MemberTable
          members={activeMembrs}
          search={search}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>
    </NewPageWrapper>
  );
}
