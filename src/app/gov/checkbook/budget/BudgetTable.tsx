'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface BudgetRecord {
  id: string;
  budget_period: number;
  agency: string | null;
  fund: string | null;
  program: string | null;
  activity: string | null;
  available_amount: number;
  obligated_amount: number;
  spend_amount: number;
  remaining_amount: number;
  budget_amount: number;
  budget_remaining_amount: number;
}

interface Filters {
  budget_period: string;
  agency: string;
  fund: string;
  program: string;
  amount_min: string;
  amount_max: string;
}

const PAGE_SIZE = 15;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BudgetTable() {
  const [records, setRecords] = useState<BudgetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    budget_period: 'all',
    agency: '',
    fund: '',
    program: '',
    amount_min: '',
    amount_max: '',
  });
  const [agencySuggestions, setAgencySuggestions] = useState<string[]>([]);
  const [fundSuggestions, setFundSuggestions] = useState<string[]>([]);
  const [programSuggestions, setProgramSuggestions] = useState<string[]>([]);
  const [showAgencySuggestions, setShowAgencySuggestions] = useState(false);
  const [showFundSuggestions, setShowFundSuggestions] = useState(false);
  const [showProgramSuggestions, setShowProgramSuggestions] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }, []);

  // Fetch suggestions for autocomplete
  useEffect(() => {
    if (!filters.agency || filters.agency.length < 2) {
      setAgencySuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = filters.agency.trim();
        if (!searchTerm || searchTerm.length < 2) {
          setAgencySuggestions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('budgets')
          .select('agency')
          .ilike('agency', `%${searchTerm}%`)
          .not('agency', 'is', null)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set(data?.map(d => d.agency).filter(Boolean) || [])].sort();
        setAgencySuggestions(unique as string[]);
      } catch (err) {
        console.error('[BudgetTable] Error fetching agency suggestions:', err);
        setAgencySuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.agency, supabase]);

  useEffect(() => {
    if (!filters.fund || filters.fund.length < 2) {
      setFundSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = filters.fund.trim();
        if (!searchTerm || searchTerm.length < 2) {
          setFundSuggestions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('budgets')
          .select('fund')
          .ilike('fund', `%${searchTerm}%`)
          .not('fund', 'is', null)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set(data?.map(d => d.fund).filter(Boolean) || [])].sort();
        setFundSuggestions(unique as string[]);
      } catch (err) {
        console.error('[BudgetTable] Error fetching fund suggestions:', err);
        setFundSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.fund, supabase]);

  useEffect(() => {
    if (!filters.program || filters.program.length < 2) {
      setProgramSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = filters.program.trim();
        if (!searchTerm || searchTerm.length < 2) {
          setProgramSuggestions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('budgets')
          .select('program')
          .ilike('program', `%${searchTerm}%`)
          .not('program', 'is', null)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set(data?.map(d => d.program).filter(Boolean) || [])].sort();
        setProgramSuggestions(unique as string[]);
      } catch (err) {
        console.error('[BudgetTable] Error fetching program suggestions:', err);
        setProgramSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.program, supabase]);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchBudgets() {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      setLoading(true);
      setError(null);

      try {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
          .from('budgets')
          .select('*', { count: 'exact' });

        // Apply filters
        if (filters.budget_period && filters.budget_period !== 'all') {
          const period = parseInt(filters.budget_period, 10);
          if (!isNaN(period) && period >= 2000 && period <= 2100) {
            query = query.eq('budget_period', period);
          }
        }
        if (filters.agency?.trim()) {
          query = query.ilike('agency', `%${filters.agency.trim()}%`);
        }
        if (filters.fund?.trim()) {
          query = query.ilike('fund', `%${filters.fund.trim()}%`);
        }
        if (filters.program?.trim()) {
          query = query.ilike('program', `%${filters.program.trim()}%`);
        }
        if (filters.amount_min?.trim()) {
          const minAmount = parseFloat(filters.amount_min.trim());
          if (!isNaN(minAmount) && minAmount >= 0) {
            query = query.gte('budget_amount', minAmount);
          }
        }
        if (filters.amount_max?.trim()) {
          const maxAmount = parseFloat(filters.amount_max.trim());
          if (!isNaN(maxAmount) && maxAmount >= 0) {
            query = query.lte('budget_amount', maxAmount);
          }
        }

        const { data, error: fetchError, count } = await query
          .order('budget_period', { ascending: false })
          .order('budget_amount', { ascending: false })
          .range(from, to);

        if (cancelled) return;

        if (fetchError) {
          throw fetchError;
        }

        setRecords(data || []);
        setTotalCount(count || 0);
        setHasMore((count || 0) > to + 1);
      } catch (err) {
        if (cancelled) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to load budget records';
        setError(errorMessage);
        console.error('[BudgetTable] Error:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchBudgets();
    
    return () => {
      cancelled = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [page, filters, supabase]);

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.budget_period !== 'all') ||
      (filters.agency?.trim() || '') !== '' ||
      (filters.fund?.trim() || '') !== '' ||
      (filters.program?.trim() || '') !== '' ||
      (filters.amount_min?.trim() || '') !== '' ||
      (filters.amount_max?.trim() || '') !== ''
    );
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters({
      budget_period: 'all',
      agency: '',
      fund: '',
      program: '',
      amount_min: '',
      amount_max: '',
    });
    setPage(1);
  }, []);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-3">
      {/* Understanding This Data */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          Understanding This Data
        </h2>
        <div className="space-y-1 text-xs text-gray-600 leading-relaxed">
          <p>
            This budget data represents government budget allocations and spending by period, agency, fund, program, and activity. The data shows available amounts, obligated amounts, spend amounts, remaining amounts, and budget amounts for each budget line item.
          </p>
          <p>
            Budget periods represent fiscal years (2020-2026). Budget amounts represent the total allocated budget, while spend amounts show actual expenditures. Remaining amounts indicate funds still available for use. This data helps provide transparency into how government budgets are allocated and spent across different agencies and programs.
          </p>
          <p>
            Data is sourced from Minnesota state budget systems and reflects budget allocations and actual spending for each fiscal year period.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-900">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <XMarkIcon className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {/* Budget Period Filter */}
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">Budget Period</label>
            <select
              value={filters.budget_period}
              onChange={(e) => {
                setFilters(f => ({ ...f, budget_period: e.target.value }));
                setPage(1);
              }}
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
            >
              <option value="all">All</option>
              <option value="2020">2020</option>
              <option value="2021">2021</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>

          {/* Agency Filter */}
          <div className="relative">
            <label className="block text-xs text-gray-600 mb-0.5">Agency</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.agency}
                onChange={(e) => {
                  setFilters(f => ({ ...f, agency: e.target.value }));
                  setPage(1);
                  setShowAgencySuggestions(true);
                }}
                onFocus={() => setShowAgencySuggestions(true)}
                onBlur={() => setTimeout(() => setShowAgencySuggestions(false), 200)}
                placeholder="Search agency..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
              {showAgencySuggestions && agencySuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {agencySuggestions.map((agency) => (
                    <button
                      key={agency}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, agency }));
                        setPage(1);
                        setShowAgencySuggestions(false);
                      }}
                      className="w-full px-2 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-900"
                    >
                      {agency}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fund Filter */}
          <div className="relative">
            <label className="block text-xs text-gray-600 mb-0.5">Fund</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.fund}
                onChange={(e) => {
                  setFilters(f => ({ ...f, fund: e.target.value }));
                  setPage(1);
                  setShowFundSuggestions(true);
                }}
                onFocus={() => setShowFundSuggestions(true)}
                onBlur={() => setTimeout(() => setShowFundSuggestions(false), 200)}
                placeholder="Search fund..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
              {showFundSuggestions && fundSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {fundSuggestions.map((fund) => (
                    <button
                      key={fund}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, fund }));
                        setPage(1);
                        setShowFundSuggestions(false);
                      }}
                      className="w-full px-2 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-900"
                    >
                      {fund}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Program Filter */}
          <div className="relative">
            <label className="block text-xs text-gray-600 mb-0.5">Program</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.program}
                onChange={(e) => {
                  setFilters(f => ({ ...f, program: e.target.value }));
                  setPage(1);
                  setShowProgramSuggestions(true);
                }}
                onFocus={() => setShowProgramSuggestions(true)}
                onBlur={() => setTimeout(() => setShowProgramSuggestions(false), 200)}
                placeholder="Search program..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
              {showProgramSuggestions && programSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {programSuggestions.map((program) => (
                    <button
                      key={program}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, program }));
                        setPage(1);
                        setShowProgramSuggestions(false);
                      }}
                      className="w-full px-2 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-900"
                    >
                      {program}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Min Amount</label>
              <input
                type="number"
                value={filters.amount_min}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setFilters(f => ({ ...f, amount_min: value }));
                    setPage(1);
                  }
                }}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Max Amount</label>
              <input
                type="number"
                value={filters.amount_max}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setFilters(f => ({ ...f, amount_max: value }));
                    setPage(1);
                  }
                }}
                placeholder="No limit"
                min="0"
                step="0.01"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        {loading && records.length === 0 ? (
          <div className="p-[10px] text-center">
            <div className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            <p className="text-xs text-gray-600 mt-2">Loading budget records...</p>
          </div>
        ) : error ? (
          <div className="p-[10px]">
            <p className="text-xs text-red-700">Error: {error}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Period
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Agency
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Fund
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Program
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Activity
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900 border-r border-gray-200">
                      Budget Amount
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900">
                      Spend Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-[10px] text-gray-900 border-r border-gray-100">
                        {record.budget_period}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100">
                        {record.agency || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100">
                        {record.fund || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100">
                        {record.program || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100">
                        {record.activity || '—'}
                      </td>
                      <td className="p-[10px] text-right text-gray-900 font-medium border-r border-gray-100">
                        {formatCurrency(record.budget_amount)}
                      </td>
                      <td className="p-[10px] text-right text-gray-900 font-medium">
                        {formatCurrency(record.spend_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-[10px] border-t border-gray-200 flex items-center justify-between gap-2">
              <div className="text-xs text-gray-600">
                Showing {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore || loading}
                  className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

