'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Contract {
  id: string;
  contract_id: string;
  agency: string | null;
  payee: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  drill: string;
  total_contract_amount: number;
}

interface Filters {
  agency: string;
  payee: string;
  active_year: string;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function CheckbookTable() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    agency: '',
    payee: '',
    active_year: '2026',
    amount_min: '',
    amount_max: '',
  });
  const [agencies, setAgencies] = useState<string[]>([]);
  const [agencySuggestions, setAgencySuggestions] = useState<string[]>([]);
  const [payeeSuggestions, setPayeeSuggestions] = useState<string[]>([]);
  const [showAgencySuggestions, setShowAgencySuggestions] = useState(false);
  const [showPayeeSuggestions, setShowPayeeSuggestions] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }, []);

  // Fetch unique agencies for dropdowns (cached, only once)
  useEffect(() => {
    let cancelled = false;
    
    async function fetchFilterOptions() {
      try {
        const { data: agencyData, error: agencyError } = await supabase
          .from('contracts')
          .select('agency')
          .eq('drill', 'Payments')
          .not('agency', 'is', null)
          .limit(10000);

        if (agencyError) throw agencyError;
        if (cancelled) return;

        const uniqueAgencies = [...new Set(agencyData?.map(d => d.agency).filter(Boolean) || [])].sort();
        setAgencies(uniqueAgencies as string[]);
      } catch (err) {
        if (!cancelled) {
          console.error('[CheckbookTable] Error fetching filter options:', err);
        }
      }
    }

    fetchFilterOptions();
    return () => { cancelled = true; };
  }, [supabase]);

  // Fetch agency suggestions for autocomplete
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
          .from('contracts')
          .select('agency')
          .eq('drill', 'Payments')
          .ilike('agency', `%${searchTerm}%`)
          .not('agency', 'is', null)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set(data?.map(d => d.agency).filter(Boolean) || [])].sort();
        setAgencySuggestions(unique as string[]);
      } catch (err) {
        console.error('[CheckbookTable] Error fetching agency suggestions:', err);
        setAgencySuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.agency, supabase]);

  // Fetch payee suggestions for autocomplete
  useEffect(() => {
    if (!filters.payee || filters.payee.length < 2) {
      setPayeeSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = filters.payee.trim();
        if (!searchTerm || searchTerm.length < 2) {
          setPayeeSuggestions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('contracts')
          .select('payee')
          .eq('drill', 'Payments')
          .ilike('payee', `%${searchTerm}%`)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set(data?.map(d => d.payee) || [])].sort();
        setPayeeSuggestions(unique);
      } catch (err) {
        console.error('[CheckbookTable] Error fetching payee suggestions:', err);
        setPayeeSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.payee, supabase]);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchContracts() {
      // Cancel previous request
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
          .from('contracts')
          .select('*', { count: 'exact' })
          .eq('drill', 'Payments');

        // Apply filters with validation
        if (filters.agency?.trim()) {
          query = query.ilike('agency', `%${filters.agency.trim()}%`);
        }
        if (filters.payee?.trim()) {
          query = query.ilike('payee', `%${filters.payee.trim()}%`);
        }
        if (filters.active_year && filters.active_year !== 'all') {
          const year = parseInt(filters.active_year, 10);
          if (!isNaN(year) && year >= 2000 && year <= 2100) {
            const yearStart = `${year}-01-01`;
            const yearEnd = `${year}-12-31`;
            query = query
              .lte('start_date', yearEnd)
              .or(`end_date.is.null,end_date.gte.${yearStart}`);
          }
        }
        if (filters.amount_min?.trim()) {
          const minAmount = parseFloat(filters.amount_min.trim());
          if (!isNaN(minAmount) && minAmount >= 0) {
            query = query.gte('total_contract_amount', minAmount);
          }
        }
        if (filters.amount_max?.trim()) {
          const maxAmount = parseFloat(filters.amount_max.trim());
          if (!isNaN(maxAmount) && maxAmount >= 0) {
            query = query.lte('total_contract_amount', maxAmount);
          }
        }

        const { data, error: fetchError, count } = await query
          .order('start_date', { ascending: false })
          .range(from, to);

        if (cancelled) return;

        if (fetchError) {
          throw fetchError;
        }

        setContracts(data || []);
        setTotalCount(count || 0);
        setHasMore((count || 0) > to + 1);
      } catch (err) {
        if (cancelled) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to load contracts';
        setError(errorMessage);
        console.error('[CheckbookTable] Error:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchContracts();
    
    return () => {
      cancelled = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [page, filters, supabase]);

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.agency?.trim() || '') !== '' ||
      (filters.payee?.trim() || '') !== '' ||
      (filters.active_year !== '2026' && filters.active_year !== 'all') ||
      (filters.amount_min?.trim() || '') !== '' ||
      (filters.amount_max?.trim() || '') !== ''
    );
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters({
      agency: '',
      payee: '',
      active_year: '2026',
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
            This information is pulled directly from{' '}
            <a
              href="https://mn.gov/mmb/transparency-mn/contracts-grants.jsp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900 underline hover:text-gray-700"
            >
              Transparency Minnesota
            </a>{' '}
            live contracts only. Contracts can be filtered by year using the "Active In" filter. When a year is selected, contracts shown are active in that year, meaning they started on or before December 31 of that year, and have not ended before January 1 of that year (or have no end date).
          </p>
          <p>
            Payments may be in progress or scheduled. Contract amounts represent the total contract value, not necessarily the amount paid to date. Some contracts may have a $0 amount if they are master contracts or framework agreements where individual work orders are issued separately.
          </p>
          <p>
            This data reflects government spending transparency and allows citizens to see how public funds are allocated across agencies, payees, and contract types.
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

          {/* Payee Filter */}
          <div className="relative">
            <label className="block text-xs text-gray-600 mb-0.5">Payee</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.payee}
                onChange={(e) => {
                  setFilters(f => ({ ...f, payee: e.target.value }));
                  setPage(1);
                  setShowPayeeSuggestions(true);
                }}
                onFocus={() => setShowPayeeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPayeeSuggestions(false), 200)}
                placeholder="Search payee..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
              {showPayeeSuggestions && payeeSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {payeeSuggestions.map((payee) => (
                    <button
                      key={payee}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, payee }));
                        setPage(1);
                        setShowPayeeSuggestions(false);
                      }}
                      className="w-full px-2 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-900"
                    >
                      {payee}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active In */}
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">Active In</label>
            <select
              value={filters.active_year}
              onChange={(e) => {
                setFilters(f => ({ ...f, active_year: e.target.value }));
                setPage(1);
              }}
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
            >
              <option value="all">All</option>
              <option value="2026">2026</option>
            </select>
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
        {loading && contracts.length === 0 ? (
          <div className="p-[10px] text-center">
            <div className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            <p className="text-xs text-gray-600 mt-2">Loading contracts...</p>
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
                      Contract ID
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Agency
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Payee
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Type
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      Start Date
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200">
                      End Date
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract) => (
                    <tr
                      key={contract.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-[10px] text-gray-900 border-r border-gray-100 font-mono text-[11px]">
                        {contract.contract_id}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100">
                        {contract.agency || '—'}
                      </td>
                      <td className="p-[10px] text-gray-900 border-r border-gray-100">
                        {contract.payee}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100">
                        {contract.contract_type}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100">
                        {formatDate(contract.start_date)}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100">
                        {formatDate(contract.end_date)}
                      </td>
                      <td className="p-[10px] text-right text-gray-900 font-medium">
                        {formatCurrency(contract.total_contract_amount)}
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

