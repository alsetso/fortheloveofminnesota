'use client';

import { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

interface BudgetStats {
  total_budget: number;
  total_spend: number;
  remaining: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BudgetSummary() {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [stats, setStats] = useState<BudgetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      setError(null);

      try {
        // Use RPC function for efficient database aggregation
        const period = selectedYear === 'all' ? null : parseInt(selectedYear, 10);
        
        const { data, error: fetchError } = await (supabase.rpc as any)('get_budget_stats', {
          p_period: period && !isNaN(period) && period >= 2000 && period <= 2100 ? period : null
        });

        if (cancelled) return;

        if (fetchError) {
          throw fetchError;
        }

        if (!data || data.length === 0) {
          setStats({
            total_budget: 0,
            total_spend: 0,
            remaining: 0,
          });
          return;
        }

        const result = data[0];
        const totalBudget = Number(result.total_budget) || 0;
        const totalSpend = Number(result.total_spend) || 0;
        const remaining = totalBudget - totalSpend;

        setStats({
          total_budget: totalBudget,
          total_spend: totalSpend,
          remaining: remaining,
        });
      } catch (err) {
        if (cancelled) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to load budget stats';
        setError(errorMessage);
        console.error('[BudgetSummary] Error:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [selectedYear, supabase]);

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-900">Budget Summary</h2>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
        >
          <option value="all">All Years</option>
          <option value="2020">2020</option>
          <option value="2021">2021</option>
          <option value="2022">2022</option>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-xs text-red-700">Error: {error}</div>
      ) : stats ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-0.5">
            <p className="text-xs text-gray-500">Total Budget</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(stats.total_budget)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-gray-500">Total Spend</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(stats.total_spend)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-gray-500">Remaining</p>
            <p className={`text-sm font-semibold ${
              stats.remaining >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {formatCurrency(stats.remaining)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

