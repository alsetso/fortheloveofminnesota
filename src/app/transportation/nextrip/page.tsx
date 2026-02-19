'use client';

import { useState, useEffect, useMemo } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import TransportSubNav from '@/components/sub-nav/TransportSubNav';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface Agency {
  agency_id: number;
  agency_name: string;
}

interface Route {
  route_id: string;
  agency_id: number;
  route_label: string;
}

function classifyRoute(label: string): 'rail' | 'brt' | 'express' | 'local' {
  if (/blue|green|gold|orange|red/i.test(label) && /line/i.test(label)) return 'rail';
  if (/\b[A-E]\s+line/i.test(label) || /metro\s+[a-e]/i.test(label)) return 'brt';
  if (parseInt(label.replace(/\D/g, ''), 10) >= 250) return 'express';
  return 'local';
}

const TYPE_BADGES: Record<ReturnType<typeof classifyRoute>, { label: string; cls: string }> = {
  rail: { label: 'Rail', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  brt: { label: 'BRT', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  express: { label: 'Express', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  local: { label: 'Local', cls: 'bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-400' },
};

function SkeletonCard() {
  return (
    <div className="p-[10px] rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface space-y-2">
      <div className="h-3.5 w-32 rounded bg-surface-accent animate-pulse" />
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-surface-accent animate-pulse" style={{ width: `${50 + (i % 3) * 15}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function NexTripPage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgencies, setExpandedAgencies] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/transportation/nextrip');
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setAgencies(data.agencies ?? []);
          setRoutes(data.routes ?? []);
          if (data.agencies?.length) {
            setExpandedAgencies(new Set([data.agencies[0].agency_id]));
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load NexTrip data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const routesByAgency = useMemo(() => {
    const map = new Map<number, Route[]>();
    for (const r of routes) {
      const arr = map.get(r.agency_id) ?? [];
      arr.push(r);
      map.set(r.agency_id, arr);
    }
    return map;
  }, [routes]);

  const filteredAgencies = useMemo(() => {
    if (!filter.trim()) return agencies;
    const q = filter.toLowerCase();
    return agencies.filter((a) => {
      if (a.agency_name.toLowerCase().includes(q)) return true;
      const agencyRoutes = routesByAgency.get(a.agency_id) ?? [];
      return agencyRoutes.some((r) => r.route_label.toLowerCase().includes(q) || r.route_id.includes(q));
    });
  }, [agencies, filter, routesByAgency]);

  const toggleAgency = (id: number) => {
    setExpandedAgencies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<TransportSubNav />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      subSidebarLabel="Transport"
      rightSidebar={<RightSidebar />}
    >
      <div className="p-4 space-y-3 max-w-3xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-foreground">NexTrip — Metro Transit API</h1>
          <p className="text-xs text-gray-500 dark:text-foreground-muted">
            Real-time agencies and routes from <code className="text-[11px] px-1 py-0.5 bg-gray-100 dark:bg-white/5 rounded">svc.metrotransit.org/nextrip</code>
          </p>
        </div>

        {/* Stats bar */}
        {!loading && !error && (
          <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-foreground-muted">
            <span>{agencies.length} agencies</span>
            <span className="text-gray-300 dark:text-white/20">|</span>
            <span>{routes.length} routes</span>
          </div>
        )}

        {/* Filter */}
        {!loading && !error && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
              <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter agencies or routes..."
              className="w-full py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-foreground-muted bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-[10px] rounded-md border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Agencies + Routes */}
        {!loading && !error && (
          <div className="space-y-2">
            {filteredAgencies.map((agency) => {
              const agencyRoutes = routesByAgency.get(agency.agency_id) ?? [];
              const filteredRoutes = filter.trim()
                ? agencyRoutes.filter((r) =>
                    r.route_label.toLowerCase().includes(filter.toLowerCase()) ||
                    r.route_id.includes(filter) ||
                    agency.agency_name.toLowerCase().includes(filter.toLowerCase())
                  )
                : agencyRoutes;
              const expanded = expandedAgencies.has(agency.agency_id);

              return (
                <div
                  key={agency.agency_id}
                  className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface"
                >
                  <button
                    type="button"
                    onClick={() => toggleAgency(agency.agency_id)}
                    className="w-full flex items-center justify-between p-[10px] text-left hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors rounded-md"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {expanded
                        ? <ChevronDownIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                        : <ChevronRightIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      }
                      <span className="text-xs font-medium text-gray-900 dark:text-foreground truncate">
                        {agency.agency_name}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-foreground-muted flex-shrink-0 ml-2">
                      {filteredRoutes.length} route{filteredRoutes.length !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {expanded && filteredRoutes.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-white/5 px-[10px] pb-[10px]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1.5">
                        {filteredRoutes.map((route) => {
                          const type = classifyRoute(route.route_label);
                          const badge = TYPE_BADGES[type];
                          return (
                            <div
                              key={route.route_id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
                            >
                              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${badge.cls} flex-shrink-0`}>
                                {badge.label}
                              </span>
                              <span className="text-xs text-gray-700 dark:text-foreground-muted truncate">
                                {route.route_label}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-foreground-subtle ml-auto flex-shrink-0">
                                #{route.route_id}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {expanded && filteredRoutes.length === 0 && (
                    <div className="border-t border-gray-100 dark:border-white/5 px-[10px] py-2">
                      <p className="text-[10px] text-gray-400 dark:text-foreground-muted">No routes match filter</p>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredAgencies.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-foreground-muted px-2 py-4 text-center">
                No agencies or routes match &ldquo;{filter}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>
    </NewPageWrapper>
  );
}
