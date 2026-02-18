'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ChevronUpDownIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

/* ─── Types ─── */

interface DiscoveredSchool {
  nutrislice_name: string;
  nutrislice_slug: string;
  menu_types: { lunch: string | null; breakfast: string | null };
  address: string | null;
  logo: string | null;
}

interface NutrisliceSchoolConfig {
  school_slug?: string;
  menu_types?: Record<string, string>;
}

interface AtlasSchool {
  id: string;
  name: string;
  slug: string;
  nutrislice_connected: boolean;
  nutrislice_config: NutrisliceSchoolConfig | null;
}

interface ConfiguredDistrict {
  id: string;
  district_id: string;
  district_name: string;
  config: { subdomain?: string };
  enabled: boolean;
}

interface AllDistrict {
  id: string;
  name: string;
}

/* ─── Fuzzy match helper ─── */

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fuzzyScore(nutrisliceName: string, atlasName: string): number {
  const a = normalizeForMatch(nutrisliceName);
  const b = normalizeForMatch(atlasName);
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.8;

  const aWords = nutrisliceName.toLowerCase().split(/\s+/);
  const bWords = atlasName.toLowerCase().split(/\s+/);
  const matched = aWords.filter((w) => bWords.some((bw) => bw.includes(w) || w.includes(bw)));
  if (matched.length >= 2) return 0.5;
  if (matched.length === 1 && aWords.length <= 2) return 0.3;
  return 0;
}

function bestMatch(nutrisliceName: string, atlasSchools: AtlasSchool[]): { school: AtlasSchool; score: number } | null {
  let best: { school: AtlasSchool; score: number } | null = null;
  for (const s of atlasSchools) {
    const score = fuzzyScore(nutrisliceName, s.name);
    if (score > 0 && (!best || score > best.score)) {
      best = { school: s, score };
    }
  }
  return best;
}

/* ─── Searchable Dropdown ─── */

function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  renderOption,
  disabled,
}: {
  options: { id: string; label: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  renderOption?: (opt: { id: string; label: string }) => React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  const selected = options.find((o) => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-accent transition-colors"
      >
        <span className={selected ? 'text-foreground' : 'text-foreground-muted'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronUpDownIcon className="w-3 h-3 text-foreground-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-surface shadow-sm max-h-48 overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full text-xs bg-transparent border-none outline-none text-foreground placeholder:text-foreground-subtle"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-36">
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-[10px] text-foreground-muted text-center">No results</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                  setSearch('');
                }}
                className={`w-full text-left px-2 py-1.5 text-xs hover:bg-surface-accent transition-colors ${
                  opt.id === value ? 'bg-surface-accent font-medium' : ''
                }`}
              >
                {renderOption ? renderOption(opt) : opt.label}
              </button>
            ))}
          </div>
          {value && (
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
                className="w-full text-left px-2 py-1 text-[10px] text-foreground-muted hover:text-foreground transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Discovery Row ─── */

interface RowState {
  linkedAtlasId: string | null;
  matchConfidence: 'exact' | 'partial' | 'none';
  connected: boolean;
  connecting: boolean;
}

function DiscoveryRow({
  discovered,
  atlasSchools,
  state,
  onLink,
  onConnect,
}: {
  discovered: DiscoveredSchool;
  atlasSchools: AtlasSchool[];
  state: RowState;
  onLink: (atlasId: string | null) => void;
  onConnect: () => void;
}) {
  const menuLabels: string[] = [];
  if (discovered.menu_types.lunch) menuLabels.push('Lunch');
  if (discovered.menu_types.breakfast) menuLabels.push('Breakfast');

  const options = atlasSchools.map((s) => ({ id: s.id, label: s.name }));

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-2 py-2 text-xs text-foreground">
        <div className="font-medium">{discovered.nutrislice_name}</div>
        <div className="text-[10px] text-foreground-muted">{discovered.nutrislice_slug}</div>
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {menuLabels.length > 0 ? menuLabels.map((l) => (
            <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-accent text-foreground-muted">{l}</span>
          )) : (
            <span className="text-[10px] text-foreground-subtle italic">None</span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 min-w-[180px]">
        {state.connected ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-foreground-muted">
              {atlasSchools.find((s) => s.id === state.linkedAtlasId)?.name ?? 'Linked'}
            </span>
          </div>
        ) : (
          <SearchableDropdown
            options={options}
            value={state.linkedAtlasId}
            onChange={onLink}
            placeholder="Select school..."
          />
        )}
        {!state.connected && state.linkedAtlasId && state.matchConfidence === 'partial' && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <ExclamationTriangleIcon className="w-2.5 h-2.5 text-amber-500" />
            <span className="text-[9px] text-amber-600">Verify match</span>
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        {state.connected ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
            <CheckCircleIcon className="w-3 h-3" />
            Connected
          </span>
        ) : (
          <button
            type="button"
            disabled={!state.linkedAtlasId || state.connecting}
            onClick={onConnect}
            className="text-[10px] font-medium px-2 py-1 rounded border border-border bg-surface hover:bg-surface-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {state.connecting ? (
              <ArrowPathIcon className="w-3 h-3 animate-spin inline" />
            ) : (
              'Connect'
            )}
          </button>
        )}
      </td>
    </tr>
  );
}

/* ─── Add District Form ─── */

function AddDistrictForm({
  onCreated,
  onCancel,
}: {
  onCreated: (districtId: string, districtName: string, subdomain: string) => void;
  onCancel: () => void;
}) {
  const [allDistricts, setAllDistricts] = useState<AllDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/atlas/integrations/nutrislice/district?all=true')
      .then((r) => {
        if (!r.ok) throw new Error('Forbidden');
        return r.json() as Promise<AllDistrict[]>;
      })
      .then((data) => { if (Array.isArray(data)) setAllDistricts(data); })
      .catch(() => setError('Failed to load districts'))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(
    () => allDistricts.map((d) => ({ id: d.id, label: d.name })),
    [allDistricts],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDistrict || !subdomain.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/atlas/integrations/nutrislice/district', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districtId: selectedDistrict, subdomain: subdomain.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed to create');
      }
      const districtName = allDistricts.find((d) => d.id === selectedDistrict)?.name ?? '';
      onCreated(selectedDistrict, districtName, subdomain.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-md border border-border bg-surface p-4">
        <div className="h-3 w-48 bg-surface-accent animate-pulse rounded" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-surface p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">Add District to Nutrislice</h4>
        <button type="button" onClick={onCancel} className="text-foreground-muted hover:text-foreground transition-colors">
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-1">
            District
          </label>
          <SearchableDropdown
            options={options}
            value={selectedDistrict}
            onChange={setSelectedDistrict}
            placeholder="Search districts..."
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-1">
            Nutrislice Subdomain
          </label>
          <input
            type="text"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            placeholder="isd728"
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground placeholder:text-foreground-subtle outline-none focus:border-foreground-muted transition-colors"
          />
          <p className="text-[9px] text-foreground-subtle mt-0.5">
            From the URL: https://[subdomain].nutrislice.com
          </p>
        </div>
      </div>

      {error && (
        <p className="text-[10px] text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={!selectedDistrict || !subdomain.trim() || submitting}
        className="text-[10px] font-medium px-3 py-1.5 rounded border border-border bg-surface hover:bg-surface-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? 'Creating...' : 'Add District'}
      </button>
    </form>
  );
}

/* ─── Main Panel ─── */

export default function NutrisliceDiscoveryPanel() {
  const [configuredDistricts, setConfiguredDistricts] = useState<ConfiguredDistrict[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [showAddDistrict, setShowAddDistrict] = useState(false);

  const [discovered, setDiscovered] = useState<DiscoveredSchool[]>([]);
  const [atlasSchools, setAtlasSchools] = useState<AtlasSchool[]>([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const [rowStates, setRowStates] = useState<Map<string, RowState>>(new Map());

  /* Load configured districts */
  const fetchConfiguredDistricts = useCallback(async () => {
    setLoadingDistricts(true);
    try {
      const res = await fetch('/api/atlas/integrations/nutrislice/district');
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (Array.isArray(data)) setConfiguredDistricts(data as ConfiguredDistrict[]);
    } catch {
      /* silent */
    } finally {
      setLoadingDistricts(false);
    }
  }, []);

  useEffect(() => { fetchConfiguredDistricts(); }, [fetchConfiguredDistricts]);

  const selectedDistrict = configuredDistricts.find((d) => d.district_id === selectedDistrictId);

  /* Run discovery when district is selected */
  useEffect(() => {
    if (!selectedDistrict) {
      setDiscovered([]);
      setAtlasSchools([]);
      setRowStates(new Map());
      return;
    }

    const subdomain = selectedDistrict.config.subdomain;
    if (!subdomain) return;

    setLoadingDiscovery(true);
    setDiscoveryError(null);

    Promise.all([
      fetch(`/api/atlas/integrations/nutrislice/discover?subdomain=${encodeURIComponent(subdomain)}`).then((r) => {
        if (!r.ok) throw new Error(`Discovery failed (${r.status})`);
        return r.json() as Promise<DiscoveredSchool[]>;
      }),
      fetch(`/api/atlas/integrations/nutrislice/atlas-schools?districtId=${encodeURIComponent(selectedDistrict.district_id)}`).then((r) => {
        if (!r.ok) throw new Error(`Atlas schools failed (${r.status})`);
        return r.json() as Promise<AtlasSchool[]>;
      }),
    ])
      .then(([disc, atlas]) => {
        setDiscovered(disc);
        setAtlasSchools(atlas);

        const states = new Map<string, RowState>();
        for (const d of disc) {
          const alreadyConnected = atlas.find(
            (a) => a.nutrislice_connected && a.nutrislice_config?.school_slug === d.nutrislice_slug,
          );

          if (alreadyConnected) {
            states.set(d.nutrislice_slug, {
              linkedAtlasId: alreadyConnected.id,
              matchConfidence: 'exact',
              connected: true,
              connecting: false,
            });
          } else {
            const match = bestMatch(d.nutrislice_name, atlas.filter((a) => !a.nutrislice_connected));
            states.set(d.nutrislice_slug, {
              linkedAtlasId: match ? match.school.id : null,
              matchConfidence: match ? (match.score >= 0.8 ? 'exact' : 'partial') : 'none',
              connected: false,
              connecting: false,
            });
          }
        }
        setRowStates(states);
      })
      .catch((err) => {
        setDiscoveryError(err instanceof Error ? err.message : 'Discovery failed');
      })
      .finally(() => setLoadingDiscovery(false));
  }, [selectedDistrict]);

  /* Connect a single school */
  const connectSchool = useCallback(
    async (nutrisliceSlug: string) => {
      const disc = discovered.find((d) => d.nutrislice_slug === nutrisliceSlug);
      const state = rowStates.get(nutrisliceSlug);
      if (!disc || !state?.linkedAtlasId) return;

      const atlasSchool = atlasSchools.find((a) => a.id === state.linkedAtlasId);
      if (!atlasSchool) return;

      setRowStates((prev) => {
        const next = new Map(prev);
        next.set(nutrisliceSlug, { ...state, connecting: true });
        return next;
      });

      try {
        const menuTypes: Record<string, string> = {};
        if (disc.menu_types.lunch) menuTypes.lunch = disc.menu_types.lunch;
        if (disc.menu_types.breakfast) menuTypes.breakfast = disc.menu_types.breakfast;

        const res = await fetch('/api/atlas/schools/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolSlug: atlasSchool.slug,
            provider: 'nutrislice',
            config: {
              school_slug: disc.nutrislice_slug,
              menu_types: menuTypes,
            },
          }),
        });

        if (!res.ok) throw new Error('Failed to connect');

        setRowStates((prev) => {
          const next = new Map(prev);
          next.set(nutrisliceSlug, { ...state, connected: true, connecting: false });
          return next;
        });

        setAtlasSchools((prev) =>
          prev.map((a) =>
            a.id === atlasSchool.id
              ? { ...a, nutrislice_connected: true, nutrislice_config: { school_slug: disc.nutrislice_slug, menu_types: menuTypes } }
              : a,
          ),
        );
      } catch {
        setRowStates((prev) => {
          const next = new Map(prev);
          next.set(nutrisliceSlug, { ...state, connecting: false });
          return next;
        });
      }
    },
    [discovered, rowStates, atlasSchools],
  );

  /* District picker options */
  const districtOptions = useMemo(
    () =>
      configuredDistricts.map((d) => ({
        id: d.district_id,
        label: `${d.district_name} (${d.config.subdomain ?? '?'})`,
      })),
    [configuredDistricts],
  );

  /* Stats */
  const connectedCount = Array.from(rowStates.values()).filter((s) => s.connected).length;
  const totalCount = discovered.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon className="w-4 h-4 text-foreground-muted" />
          <h2 className="text-sm font-semibold text-foreground">Nutrislice Discovery</h2>
          <span className="text-[8px] font-medium px-1 py-0.5 rounded leading-none bg-amber-500/10 text-amber-600">
            Platform Admin
          </span>
        </div>
        {!showAddDistrict && (
          <button
            type="button"
            onClick={() => setShowAddDistrict(true)}
            className="flex items-center gap-1 text-[10px] font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            <PlusIcon className="w-3 h-3" />
            Add District
          </button>
        )}
      </div>

      {/* Add District Form */}
      {showAddDistrict && (
        <AddDistrictForm
          onCreated={(districtId, districtName, subdomain) => {
            setShowAddDistrict(false);
            setConfiguredDistricts((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                district_id: districtId,
                district_name: districtName,
                config: { subdomain },
                enabled: true,
              },
            ]);
            setSelectedDistrictId(districtId);
          }}
          onCancel={() => setShowAddDistrict(false)}
        />
      )}

      {/* District Picker */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block">
          Select District
        </label>
        {loadingDistricts ? (
          <div className="h-8 rounded-md bg-surface-accent animate-pulse" />
        ) : configuredDistricts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-surface p-4 text-center">
            <p className="text-xs text-foreground-muted">No districts have Nutrislice configured yet.</p>
            <button
              type="button"
              onClick={() => setShowAddDistrict(true)}
              className="mt-2 text-[10px] font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              Add your first district
            </button>
          </div>
        ) : (
          <SearchableDropdown
            options={districtOptions}
            value={selectedDistrictId}
            onChange={setSelectedDistrictId}
            placeholder="Choose a district..."
          />
        )}
      </div>

      {/* Loading */}
      {loadingDiscovery && (
        <div className="space-y-2">
          <div className="h-4 w-64 rounded bg-surface-accent animate-pulse" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-surface-accent animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {discoveryError && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/10 p-3">
          <p className="text-xs text-red-600">{discoveryError}</p>
        </div>
      )}

      {/* Discovery Table */}
      {!loadingDiscovery && discovered.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-foreground-muted">
              {connectedCount} of {totalCount} schools connected
            </p>
            <p className="text-[10px] text-foreground-subtle">
              {atlasSchools.length} schools in district
            </p>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-accent">
                    <th className="px-2 py-1.5 text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
                      Nutrislice School
                    </th>
                    <th className="px-2 py-1.5 text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
                      Menu Types
                    </th>
                    <th className="px-2 py-1.5 text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
                      Link to Atlas School
                    </th>
                    <th className="px-2 py-1.5 text-[10px] font-semibold text-foreground-muted uppercase tracking-wider text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface">
                  {discovered.map((d) => {
                    const state = rowStates.get(d.nutrislice_slug) ?? {
                      linkedAtlasId: null,
                      matchConfidence: 'none' as const,
                      connected: false,
                      connecting: false,
                    };
                    return (
                      <DiscoveryRow
                        key={d.nutrislice_slug}
                        discovered={d}
                        atlasSchools={atlasSchools}
                        state={state}
                        onLink={(atlasId) => {
                          setRowStates((prev) => {
                            const next = new Map(prev);
                            next.set(d.nutrislice_slug, {
                              ...state,
                              linkedAtlasId: atlasId,
                              matchConfidence: atlasId ? 'exact' : 'none',
                            });
                            return next;
                          });
                        }}
                        onConnect={() => connectSchool(d.nutrislice_slug)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state after selecting a district with no Nutrislice schools */}
      {!loadingDiscovery && selectedDistrictId && discovered.length === 0 && !discoveryError && (
        <div className="rounded-md border border-dashed border-border bg-surface p-6 text-center">
          <p className="text-xs text-foreground-muted">No schools found on Nutrislice for this district.</p>
          <p className="text-[10px] text-foreground-subtle mt-1">Verify the subdomain is correct.</p>
        </div>
      )}
    </div>
  );
}
