'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import {
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 25;

/** Application tables available for browsing (admin-only) */
const BROWSABLE_TABLES = [
  'accounts',
  'billing_features',
  'billing_plan_features',
  'billing_plans',
  'budgets',
  'businesses',
  'civic_events',
  'collections',
  'congressional_districts',
  'contracts',
  'county_boundaries',
  'ctu_boundaries',
  'map_pins',
  'mention_types',
  'orgs',
  'payments',
  'payroll',
  'people',
  'roles',
  'state_boundary',
  'stripe_events',
  'subscriptions',
  'url_visits',
  'water_features',
] as const;

type TableName = (typeof BROWSABLE_TABLES)[number];

/**
 * Data Explorer - Admin-only
 * Browse all public tables with pagination.
 */
export default function DataExplorerClient() {
  const { account } = useSettings();
  const supabase = useSupabaseClient();
  const isAdmin = account?.role === 'admin';

  const [selectedTable, setSelectedTable] = useState<TableName>('accounts');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Get count
      const { count } = await supabase
        .from(selectedTable)
        .select('*', { count: 'exact', head: true });

      setTotalCount(count || 0);

      // Get rows
      const { data, error } = await supabase
        .from(selectedTable)
        .select('*')
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: try without ordering
        const fallback = await supabase
          .from(selectedTable)
          .select('*')
          .range(from, to);

        if (fallback.data) {
          const rowData = fallback.data as Record<string, unknown>[];
          setRows(rowData);
          setColumns(rowData.length > 0 ? Object.keys(rowData[0]) : []);
        }
        return;
      }

      const rowData = (data || []) as Record<string, unknown>[];
      setRows(rowData);
      setColumns(rowData.length > 0 ? Object.keys(rowData[0]) : []);
    } catch {
      setRows([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedTable, page, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when table changes
  useEffect(() => {
    setPage(0);
    setSearchFilter('');
  }, [selectedTable]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ExclamationTriangleIcon className="w-8 h-8 text-foreground-muted mb-3" />
        <h2 className="text-sm font-semibold text-foreground mb-1">Admin Access Required</h2>
        <p className="text-xs text-foreground-muted">This section is restricted to administrators.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Filter tables by search
  const filteredTables = BROWSABLE_TABLES.filter((t) =>
    t.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-foreground">Data Explorer</h1>
          <p className="text-xs text-foreground-muted mt-0.5">Browse public database tables</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-foreground-muted hover:text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Table Selector */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md">
        <div className="p-2 border-b border-border-muted dark:border-white/10">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter tables..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-transparent text-foreground placeholder:text-foreground-muted border-none focus:outline-none"
            />
          </div>
        </div>
        <div className="max-h-40 overflow-y-auto scrollbar-hide">
          {filteredTables.map((table) => (
            <button
              key={table}
              onClick={() => setSelectedTable(table)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                selectedTable === table
                  ? 'bg-surface-accent text-foreground font-medium'
                  : 'text-foreground-muted hover:bg-surface-accent/50 dark:hover:bg-white/5 hover:text-foreground'
              }`}
            >
              <TableCellsIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{table}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-muted dark:border-white/10">
          <div className="flex items-center gap-2">
            <TableCellsIcon className="w-3.5 h-3.5 text-foreground-muted" />
            <span className="text-xs font-medium text-foreground">{selectedTable}</span>
            <span className="text-[10px] text-foreground-muted">
              {totalCount.toLocaleString()} rows
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="p-1 text-foreground-muted hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-foreground-muted tabular-nums">
              {page + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="p-1 text-foreground-muted hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-4">
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 bg-surface-accent rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-foreground-muted">No rows found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-muted dark:border-white/10">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-medium text-foreground-muted whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted dark:divide-white/10">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-accent/30 dark:hover:bg-white/5 transition-colors">
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 text-foreground whitespace-nowrap max-w-[200px] truncate"
                        title={String(row[col] ?? '')}
                      >
                        {formatCellValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  const str = String(value);
  return str.length > 60 ? `${str.slice(0, 60)}...` : str;
}
