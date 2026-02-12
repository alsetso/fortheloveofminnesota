'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface SubRecordsLeftSidebarProps {
  /** Parent table (state | counties) */
  parentTable: string;
  /** Parent record - used for header and county_name filter */
  parentRecord: { id: string; name: string; details?: Record<string, unknown> };
  /** Child table to show (counties | cities-and-towns) */
  childTable: 'counties' | 'cities-and-towns';
  onRecordSelect?: (record: {
    layer: 'state' | 'county' | 'ctu' | 'district';
    id: string;
    name: string;
    lat: number;
    lng: number;
    details?: Record<string, unknown>;
  }) => void;
}

interface LayerRecord {
  id: string;
  name: string;
  [key: string]: unknown;
}

const CHILD_CONFIG = {
  counties: {
    apiEndpoint: '/api/civic/county-boundaries',
    nameField: 'county_name',
    label: 'Counties',
  },
  'cities-and-towns': {
    apiEndpoint: '/api/civic/ctu-boundaries',
    nameField: 'feature_name',
    label: 'Cities & Towns',
  },
} as const;

/**
 * Left sidebar showing sub-records when a parent area is selected.
 * State → counties; County → cities/towns within that county.
 */
export default function SubRecordsLeftSidebar({
  parentTable,
  parentRecord,
  childTable,
  onRecordSelect,
}: SubRecordsLeftSidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<LayerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const config = CHILD_CONFIG[childTable];

  const fetchUrl = useMemo(() => {
    if (childTable === 'counties') return config.apiEndpoint;
    const countyName = parentRecord.details?.county_name as string | undefined;
    if (!countyName) return config.apiEndpoint;
    return `${config.apiEndpoint}?county_name=${encodeURIComponent(countyName)}&limit=500`;
  }, [childTable, config.apiEndpoint, parentRecord.details?.county_name]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(fetchUrl)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [data];
        const transformed: LayerRecord[] = list.map((r: Record<string, unknown>) => ({
          id: (r.id ?? r.county_id ?? (r.district_number as number)?.toString() ?? '') as string,
          name: (r[config.nameField] ?? r.feature_name ?? r.county_name ?? 'Unknown') as string,
          ...r,
        }));
        transformed.sort((a, b) =>
          String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase())
        );
        setRecords(transformed);
      })
      .catch((err) => {
        if (!cancelled) console.error('[SubRecordsLeftSidebar] fetch error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchUrl, config.nameField]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => {
      const n = String(r.name || '').toLowerCase();
      const c = String((r as Record<string, unknown>).county_name || '').toLowerCase();
      return n.includes(q) || c.includes(q);
    });
  }, [records, searchQuery]);

  const handleRecordClick = (record: LayerRecord) => {
    router.push(`/explore/${childTable}/${record.id}`, { scroll: false });
    onRecordSelect?.({
      layer: childTable === 'counties' ? 'county' : 'ctu',
      id: record.id,
      name: record.name as string,
      lat: 0,
      lng: 0,
      details: record as Record<string, unknown>,
    });
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Back + parent context */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <Link
          href={`/explore/${parentTable}`}
          className="flex items-center gap-2 text-xs text-foreground-muted hover:text-foreground transition-colors mb-1.5"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to {parentTable === 'counties' ? 'Counties' : 'State'}</span>
        </Link>
        <h2 className="text-sm font-semibold text-foreground">{config.label}</h2>
        <p className="text-[10px] text-foreground-muted">{records.length.toLocaleString()} in {parentRecord.name}</p>
      </div>

      {/* Search */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-xs text-foreground placeholder:text-foreground-muted border-none focus:outline-none focus:ring-2 focus:ring-lake-blue"
          />
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        </div>
      </div>

      {/* Records List */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="p-[10px] text-xs text-foreground-muted">Loading...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-[10px] text-xs text-foreground-muted">
            {searchQuery ? 'No results found' : 'No records'}
          </div>
        ) : (
          <div className="p-[10px] space-y-0.5">
            {filteredRecords.map((record) => {
              const displayName = record.name || 'Unknown';
              const countyName = (record as Record<string, unknown>).county_name as string | undefined;
              const ctuClass = (record as Record<string, unknown>).ctu_class as string | undefined;
              const population = (record as Record<string, unknown>).population as number | undefined;

              return (
                <button
                  key={record.id}
                  onClick={() => handleRecordClick(record)}
                  className="w-full text-left px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
                >
                  <div className="font-medium truncate">{displayName}</div>
                  {countyName && childTable === 'cities-and-towns' && (
                    <div className="text-[10px] text-foreground-subtle truncate">{countyName}</div>
                  )}
                  {ctuClass && (
                    <div className="text-[10px] text-foreground-subtle truncate">{ctuClass}</div>
                  )}
                  {population != null && (
                    <div className="text-[10px] text-foreground-subtle">
                      {population.toLocaleString()} people
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
