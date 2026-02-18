'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { getLayerConfigBySlug } from '@/features/map/config/layersConfig';
import {
  getStateBoundary,
  getCountyBoundaries,
  getCTUBoundaries,
  getCongressionalDistricts,
  getWater,
  getSchoolDistricts,
} from '@/features/map/services/liveBoundaryCache';

type LayerType = 'state' | 'county' | 'ctu' | 'district' | 'water' | 'school-district';

interface LayerDetailLeftSidebarProps {
  layerSlug: string;
  selectedRecordId?: string;
  onRecordSelect?: (record: {
    layer: LayerType;
    id: string;
    name: string;
    lat: number;
    lng: number;
    details?: Record<string, any>;
  }) => void;
}

interface LayerRecord {
  id: string;
  name: string;
  [key: string]: any;
}

const SLUG_TO_LAYER: Record<string, LayerType> = {
  state: 'state',
  counties: 'county',
  'cities-and-towns': 'ctu',
  'congressional-districts': 'district',
  water: 'water',
  'school-districts': 'school-district',
};

/**
 * Left Sidebar for Layer Detail Page.
 * Civic boundary layers (state, county, CTU, district) use liveBoundaryCache
 * so they share the same in-memory data as the map layer components — no
 * duplicate API calls. Water uses its own paginated API endpoint.
 */
export default function LayerDetailLeftSidebar({
  layerSlug,
  selectedRecordId,
  onRecordSelect,
}: LayerDetailLeftSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<LayerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const layerConfig = useMemo(() => {
    const config = getLayerConfigBySlug(layerSlug);
    if (!config) return null;
    return {
      apiEndpoint: config.apiEndpoint,
      nameField: config.nameField,
      displayName: config.label,
      icon: config.icon,
    };
  }, [layerSlug]);

  useEffect(() => {
    if (!layerConfig) return;

    let cancelled = false;
    setLoading(true);

    const transformRecords = (rawList: any[], nameField: string): LayerRecord[] => {
      const list = rawList.map((record: any) => ({
        id: record.id || record.county_id || record.district_number?.toString() || '',
        name:
          record[nameField] ||
          record.short_name ||
          record.feature_name ||
          record.county_name ||
          (record.district_number != null ? `District ${record.district_number}` : '') ||
          'Unknown',
        ...record,
      }));
      list.sort((a: LayerRecord, b: LayerRecord) =>
        String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase())
      );
      return list;
    };

    const handleResult = (data: any) => {
      if (cancelled) return;
      const arr = Array.isArray(data) ? data : [data];
      setRecords(transformRecords(arr, layerConfig.nameField));
    };

    // Civic boundary layers: reuse liveBoundaryCache (same promise the map layer uses)
    if (layerSlug === 'state') {
      getStateBoundary()
        .then((d) => handleResult([d]))
        .catch(() => !cancelled && setRecords([]))
        .finally(() => !cancelled && setLoading(false));
      return () => { cancelled = true; };
    }
    if (layerSlug === 'counties') {
      getCountyBoundaries()
        .then(handleResult)
        .catch(() => !cancelled && setRecords([]))
        .finally(() => !cancelled && setLoading(false));
      return () => { cancelled = true; };
    }
    if (layerSlug === 'cities-and-towns') {
      getCTUBoundaries()
        .then(handleResult)
        .catch(() => !cancelled && setRecords([]))
        .finally(() => !cancelled && setLoading(false));
      return () => { cancelled = true; };
    }
    if (layerSlug === 'congressional-districts') {
      getCongressionalDistricts()
        .then(handleResult)
        .catch(() => !cancelled && setRecords([]))
        .finally(() => !cancelled && setLoading(false));
      return () => { cancelled = true; };
    }
    if (layerSlug === 'water') {
      getWater()
        .then(handleResult)
        .catch(() => !cancelled && setRecords([]))
        .finally(() => !cancelled && setLoading(false));
      return () => { cancelled = true; };
    }
    if (layerSlug === 'school-districts') {
      getSchoolDistricts()
        .then(handleResult)
        .catch(() => !cancelled && setRecords([]))
        .finally(() => !cancelled && setLoading(false));
      return () => { cancelled = true; };
    }

    // Fallback: fetch from API (e.g. future layers)
    fetch(layerConfig.apiEndpoint)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [data];
        setRecords(transformRecords(arr, layerConfig.nameField));
      })
      .catch(() => !cancelled && setRecords([]))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [layerConfig, layerSlug]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const query = searchQuery.toLowerCase();
    return records.filter((record) => {
      const name = String(record.name || '').toLowerCase();
      const countyName = String(record.county_name || '').toLowerCase();
      return name.includes(query) || countyName.includes(query);
    });
  }, [records, searchQuery]);

  const handleRecordClick = (record: LayerRecord) => {
    const layerType = SLUG_TO_LAYER[layerSlug] ?? 'state';
    onRecordSelect?.({
      layer: layerType,
      id: record.id,
      name: record.name || 'Unknown',
      lat: 0,
      lng: 0,
    });
  };

  if (!layerConfig) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-xs text-foreground-muted">Invalid layer</div>
      </div>
    );
  }

  const Icon = layerConfig.icon;

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-lake-blue" />
          <h2 className="text-sm font-semibold text-foreground">{layerConfig.displayName}</h2>
        </div>
        <p className="text-[10px] text-foreground-muted">{records.length.toLocaleString()} total</p>
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
          <div className="p-[10px]">
            <div className="text-xs text-foreground-muted">Loading...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-[10px]">
            <div className="text-xs text-foreground-muted">
              {searchQuery ? 'No results found' : 'No records available'}
            </div>
          </div>
        ) : (
          <div className="p-[10px] space-y-0.5">
            {filteredRecords.map((record) => {
              const isSelected = selectedRecordId === record.id;
              const displayName = record.name || 'Unknown';
              const countyName = record.county_name;

              return (
                <ScrollIntoViewButton
                  key={record.id}
                  isSelected={isSelected}
                  onClick={() => handleRecordClick(record)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                    isSelected
                      ? 'bg-lake-blue/10 text-foreground font-semibold border-l-2 border-lake-blue'
                      : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
                  }`}
                >
                  <div className="truncate">{displayName}</div>
                  {countyName && (
                    <div className="text-[10px] text-foreground-subtle truncate">{countyName}</div>
                  )}
                  {record.ctu_class && (
                    <div className="text-[10px] text-foreground-subtle truncate">{record.ctu_class}</div>
                  )}
                  {record.population && (
                    <div className="text-[10px] text-foreground-subtle">
                      {record.population.toLocaleString()} people
                    </div>
                  )}
                </ScrollIntoViewButton>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Auto-scrolls into view on mount when selected */
function ScrollIntoViewButton({
  isSelected,
  onClick,
  className,
  children,
}: {
  isSelected: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  return (
    <button ref={ref} onClick={onClick} className={className}>
      {children}
    </button>
  );
}
