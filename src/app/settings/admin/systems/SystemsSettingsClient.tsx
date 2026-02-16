'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import Link from 'next/link';
import {
  ServerStackIcon,
  CircleStackIcon,
  TableCellsIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface TableInfo {
  table_name: string;
  row_count: number;
}

/**
 * Systems Settings - Admin-only
 * Shows all public database tables, row counts, and links to manage them.
 */
export default function SystemsSettingsClient() {
  const { account } = useSettings();
  const supabase = useSupabaseClient();
  const isAdmin = account?.role === 'admin';

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    async function fetchTables() {
      setLoading(true);
      setError(null);
      try {
        // Fetch table names and approximate row counts from pg_stat
        const { data, error: rpcError } = await supabase.rpc('get_public_table_stats');

        if (rpcError) {
          // Fallback: just show known tables without counts
          setTables(KNOWN_TABLES.map((t) => ({ table_name: t, row_count: -1 })));
          return;
        }

        setTables((data as TableInfo[]) || []);
      } catch {
        setTables(KNOWN_TABLES.map((t) => ({ table_name: t, row_count: -1 })));
      } finally {
        setLoading(false);
      }
    }

    fetchTables();
  }, [isAdmin, supabase]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ExclamationTriangleIcon className="w-8 h-8 text-foreground-muted mb-3" />
        <h2 className="text-sm font-semibold text-foreground mb-1">Admin Access Required</h2>
        <p className="text-xs text-foreground-muted">This section is restricted to administrators.</p>
      </div>
    );
  }

  const appTables = tables.filter(
    (t) => !SYSTEM_TABLES.has(t.table_name)
  );

  const systemTables = tables.filter(
    (t) => SYSTEM_TABLES.has(t.table_name)
  );

  return (
    <div className="space-y-4">
      {/* Admin Verification Header */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-semibold text-foreground">Systems</h2>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/50">
            <CheckCircleIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Admin Verified</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-[10px] border border-green-200 dark:border-green-500/50 rounded-md bg-green-50 dark:bg-green-900/20">
          <div className="flex-1">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">Admin Access Granted</p>
            <p className="text-[10px] text-green-600 dark:text-green-400/80 mt-0.5">
              Account role: <span className="font-medium">{account?.role}</span>
            </p>
          </div>
        </div>
        <p className="text-xs text-foreground-muted mt-2">
          Database tables and system overview. This page is restricted to administrators only.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-foreground">Systems</h1>
          <p className="text-xs text-foreground-muted mt-0.5">Database tables and system overview</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-foreground-muted hover:text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3 text-center">
          <CircleStackIcon className="w-4 h-4 text-foreground-muted mx-auto mb-1" />
          <p className="text-lg font-semibold text-foreground">{appTables.length}</p>
          <p className="text-[10px] text-foreground-muted">App Tables</p>
        </div>
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3 text-center">
          <TableCellsIcon className="w-4 h-4 text-foreground-muted mx-auto mb-1" />
          <p className="text-lg font-semibold text-foreground">
            {appTables.reduce((sum, t) => sum + Math.max(t.row_count, 0), 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-foreground-muted">Total Rows</p>
        </div>
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3 text-center">
          <ServerStackIcon className="w-4 h-4 text-foreground-muted mx-auto mb-1" />
          <p className="text-lg font-semibold text-foreground">{systemTables.length}</p>
          <p className="text-[10px] text-foreground-muted">System Tables</p>
        </div>
      </div>

      {/* App Tables */}
      <div>
        <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2 px-1">
          Application Tables
        </h3>
        {loading ? (
          <div className="space-y-1.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-surface-accent rounded-md animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md divide-y divide-border-muted dark:divide-white/10">
            {appTables.map((table) => {
              const settingsHref = TABLE_SETTINGS_MAP[table.table_name];
              return (
                <div
                  key={table.table_name}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-accent/50 dark:hover:bg-white/5 transition-colors"
                >
                  <TableCellsIcon className="w-3.5 h-3.5 text-foreground-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{table.table_name}</p>
                  </div>
                  <span className="text-[10px] text-foreground-muted tabular-nums flex-shrink-0">
                    {table.row_count >= 0 ? `${table.row_count.toLocaleString()} rows` : '—'}
                  </span>
                  {settingsHref ? (
                    <Link
                      href={settingsHref}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-lake-blue hover:text-lake-blue/80 transition-colors"
                    >
                      Manage
                      <ChevronRightIcon className="w-3 h-3" />
                    </Link>
                  ) : (
                    <span className="text-[10px] text-foreground-muted/50 px-2 py-1">View only</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* System Tables */}
      {systemTables.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2 px-1">
            System Tables (PostGIS)
          </h3>
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md divide-y divide-border-muted dark:divide-white/10">
            {systemTables.map((table) => (
              <div
                key={table.table_name}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <ServerStackIcon className="w-3.5 h-3.5 text-foreground-muted/50 flex-shrink-0" />
                <p className="text-xs text-foreground-muted flex-1 truncate">{table.table_name}</p>
                <span className="text-[10px] text-foreground-muted/50 tabular-nums">
                  {table.row_count >= 0 ? `${table.row_count.toLocaleString()} rows` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}
    </div>
  );
}

/* ─── Constants ─── */

const SYSTEM_TABLES = new Set([
  'geography_columns',
  'geometry_columns',
  'spatial_ref_sys',
]);

/** Map of table name → settings page where user can manage that table's data */
const TABLE_SETTINGS_MAP: Record<string, string> = {
  accounts: '/settings/account',
  map_pins: '/settings/pins',
  collections: '/settings/collections',
  businesses: '/settings/business',
  subscriptions: '/settings/billing',
  url_visits: '/settings/history',
};

/** Fallback table list if RPC fails */
const KNOWN_TABLES = [
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
  'geography_columns',
  'geometry_columns',
  'map_pins',
  'mention_types',
  'orgs',
  'payments',
  'payroll',
  'people',
  'roles',
  'spatial_ref_sys',
  'state_boundary',
  'stripe_events',
  'subscriptions',
  'url_visits',
  'water_features',
];
