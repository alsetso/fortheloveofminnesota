'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import { BuildingOfficeIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import GovOrgModal, { type GovOrgRecord } from './GovOrgModal';

interface OrgRecord {
  id: string;
  name: string;
  slug: string;
  org_type: string | null;
  parent_id: string | null;
  description: string | null;
  website: string | null;
}

function fuzzyMatchOrg(query: string, org: OrgRecord): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const searchable = [org.name, org.slug, org.org_type].filter(Boolean).join(' ').toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => searchable.includes(t));
}

/**
 * Gov page left sidebar: organizations list. Replaces app LeftSidebar on /gov.
 */
export default function GovOrgsSidebar() {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOrg, setModalOrg] = useState<GovOrgRecord | null | 'create'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const civic = typeof (supabase as any).schema === 'function' ? (supabase as any).schema('civic') : supabase;
      const { data, error: e } = await civic
.from('orgs')
          .select('id, name, slug, org_type, parent_id, description, website')
        .order('name');
      if (e) throw e;
      setOrgs((data ?? []) as OrgRecord[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const orgTypes = useMemo(() => {
    const types = [...new Set(orgs.map((o) => o.org_type).filter((t): t is string => t != null))];
    return types.sort((a, b) => a.localeCompare(b));
  }, [orgs]);

  const filteredOrgs = useMemo(() => {
    let list = typeFilter ? orgs.filter((o) => o.org_type === typeFilter) : orgs;
    if (searchQuery.trim()) list = list.filter((o) => fuzzyMatchOrg(searchQuery, o));
    return list;
  }, [orgs, typeFilter, searchQuery]);

  return (
    <div className="flex flex-col border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface">
      <div className="p-2 border-b border-border-muted dark:border-white/10 flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BuildingOfficeIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
          <h2 className="text-xs font-semibold text-foreground">Organizations</h2>
          {!loading && !error && (
            <span className="text-xs text-foreground-muted">({filteredOrgs.length}{typeFilter ? ` of ${orgs.length}` : ''})</span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setModalOrg('create')}
              className="ml-auto w-6 h-6 rounded flex items-center justify-center text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
              aria-label="Add organization"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {!loading && !error && orgTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-border-muted dark:border-white/10 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-foreground-muted"
            aria-label="Filter by organization type"
          >
            <option value="">All types</option>
            {orgTypes.map((t) => (
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
              placeholder="Search organizations…"
              className="w-full text-xs pl-7 pr-2 py-1.5 rounded-md border border-border-muted dark:border-white/10 bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-foreground-muted"
              aria-label="Search organizations"
            />
          </div>
        )}
      </div>
      <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-theme">
        {loading && (
          <p className="text-xs text-foreground-muted py-4">Loading…</p>
        )}
        {error && (
          <p className="text-xs text-foreground-muted py-4">{error}</p>
        )}
        {!loading && !error && (
          <div className="space-y-0">
            {filteredOrgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => setModalOrg({ ...org, description: org.description ?? null, website: org.website ?? null })}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs border-b border-border-muted dark:border-white/10 last:border-0 hover:bg-surface-accent transition-colors"
              >
                <p className="font-medium text-foreground">{org.name}</p>
                {org.org_type && (
                  <p className="text-foreground-muted text-[10px]">{org.org_type}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {(modalOrg === 'create' || modalOrg) && (
        <GovOrgModal
          record={modalOrg === 'create' ? null : modalOrg}
          onClose={() => setModalOrg(null)}
          onSave={load}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
