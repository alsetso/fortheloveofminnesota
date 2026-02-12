'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import { BuildingStorefrontIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import GovBuildingModal, { type GovBuildingRecord } from './GovBuildingModal';

interface BuildingRecord {
  id: string;
  type: string | null;
  name: string | null;
  full_address: string | null;
  cover_images: string[] | null;
  description?: string | null;
  website?: string | null;
  lat?: number | null;
  lng?: number | null;
}

function fuzzyMatchBuilding(query: string, b: BuildingRecord): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const searchable = [b.name, b.type, b.full_address].filter(Boolean).join(' ').toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => searchable.includes(t));
}

/**
 * Gov page right sidebar: buildings list. Replaces app RightSidebar on /gov.
 */
export default function GovBuildingsSidebar() {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalBuilding, setModalBuilding] = useState<GovBuildingRecord | null | 'create'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const civic = typeof (supabase as any).schema === 'function' ? (supabase as any).schema('civic') : supabase;
      const { data, error: e } = await civic
        .from('buildings')
        .select('id, type, name, full_address, cover_images, description, website, lat, lng')
        .order('name');
      if (e) throw e;
      setBuildings((data ?? []) as BuildingRecord[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load buildings');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const buildingTypes = useMemo(() => {
    const types = [...new Set(buildings.map((b) => b.type).filter((t): t is string => t != null))];
    return types.sort((a, b) => a.localeCompare(b));
  }, [buildings]);

  const filteredBuildings = useMemo(() => {
    let list = typeFilter ? buildings.filter((b) => b.type === typeFilter) : buildings;
    if (searchQuery.trim()) list = list.filter((b) => fuzzyMatchBuilding(searchQuery, b));
    return list;
  }, [buildings, typeFilter, searchQuery]);

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-surface border-l border-border-muted dark:border-white/10">
      <div className="p-2 border-b border-border-muted dark:border-white/10 flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BuildingStorefrontIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
          <h2 className="text-xs font-semibold text-foreground">Buildings</h2>
          {!loading && !error && (
            <span className="text-xs text-foreground-muted">({filteredBuildings.length}{typeFilter ? ` of ${buildings.length}` : ''})</span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setModalBuilding('create')}
              className="ml-auto w-6 h-6 rounded flex items-center justify-center text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
              aria-label="Add building"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {!loading && !error && buildingTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-border-muted dark:border-white/10 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-foreground-muted"
            aria-label="Filter by building type"
          >
            <option value="">All types</option>
            {buildingTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {!loading && !error && (
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search buildings…"
              className="w-full text-xs pl-7 pr-2 py-1.5 rounded-md border border-border-muted dark:border-white/10 bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-foreground-muted"
              aria-label="Search buildings"
            />
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 bg-surface-muted scrollbar-theme">
        {loading && (
          <p className="text-xs text-foreground-muted py-4">Loading…</p>
        )}
        {error && (
          <p className="text-xs text-foreground-muted py-4">{error}</p>
        )}
        {!loading && !error && (
          <div className="space-y-0">
            {filteredBuildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setModalBuilding({
                  id: b.id,
                  type: b.type,
                  name: b.name,
                  description: b.description ?? null,
                  full_address: b.full_address,
                  website: b.website ?? null,
                  cover_images: b.cover_images ?? null,
                  lat: b.lat ?? null,
                  lng: b.lng ?? null,
                })}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs border-b border-border-muted dark:border-white/10 last:border-0 hover:bg-surface-accent transition-colors flex items-center gap-2"
              >
                <div className="w-10 h-10 rounded-md bg-surface-accent flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {b.cover_images?.[0] ? (
                    <img
                      src={b.cover_images[0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <BuildingStorefrontIcon className="w-5 h-5 text-foreground-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{b.name || b.type || 'Unnamed'}</p>
                  {b.type && b.name && (
                    <p className="text-foreground-muted text-[10px]">{b.type}</p>
                  )}
                  {b.full_address && (
                    <p className="text-foreground-muted text-[10px] truncate">{b.full_address}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {(modalBuilding === 'create' || modalBuilding) && (
        <GovBuildingModal
          record={modalBuilding === 'create' ? null : modalBuilding}
          onClose={() => setModalBuilding(null)}
          onSave={load}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
