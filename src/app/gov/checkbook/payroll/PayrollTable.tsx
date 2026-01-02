'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface PayrollRecord {
  id: string;
  temporary_id: string;
  fiscal_year: string | null;
  record_nbr: number | null;
  employee_name: string | null;
  agency_nbr: string | null;
  agency_name: string | null;
  department_nbr: string | null;
  department_name: string | null;
  branch_code: string | null;
  branch_name: string | null;
  job_code: string | null;
  job_title: string | null;
  location_nbr: string | null;
  location_name: string | null;
  location_county_name: string | null;
  reg_temp_code: string | null;
  reg_temp_desc: string | null;
  classified_code: string | null;
  classified_desc: string | null;
  original_hire_date: number | null;
  last_hire_date: string | null;
  job_entry_date: number | null;
  full_part_time_code: string | null;
  full_part_time_desc: string | null;
  active_on_june_30: string | null;
  salary_plan_grid: string | null;
  salary_grade_range: number | null;
  max_salary_step: number | null;
  compensation_rate: number | null;
  comp_frequency_code: string | null;
  comp_frequency_desc: string | null;
  position_fte: number | null;
  bargaining_unit_nbr: number | null;
  bargaining_unit_name: string | null;
  regular_wages: number;
  overtime_wages: number;
  other_wages: number;
  total_wages: number;
}

interface Filters {
  fiscal_year: string;
  employee_name: string;
  agency_name: string;
  department_name: string;
  job_title: string;
  wage_min: string;
  wage_max: string;
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

function formatExcelDate(serialDate: number | null): string {
  if (!serialDate) return '—';
  // Excel serial date: days since January 1, 1900
  const excelEpoch = new Date(1900, 0, 1);
  const date = new Date(excelEpoch.getTime() + (serialDate - 2) * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PayrollTable() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    fiscal_year: 'all',
    employee_name: '',
    agency_name: '',
    department_name: '',
    job_title: '',
    wage_min: '',
    wage_max: '',
  });
  const [employeeSuggestions, setEmployeeSuggestions] = useState<string[]>([]);
  const [agencySuggestions, setAgencySuggestions] = useState<string[]>([]);
  const [departmentSuggestions, setDepartmentSuggestions] = useState<string[]>([]);
  const [jobTitleSuggestions, setJobTitleSuggestions] = useState<string[]>([]);
  const [showEmployeeSuggestions, setShowEmployeeSuggestions] = useState(false);
  const [showAgencySuggestions, setShowAgencySuggestions] = useState(false);
  const [showDepartmentSuggestions, setShowDepartmentSuggestions] = useState(false);
  const [showJobTitleSuggestions, setShowJobTitleSuggestions] = useState(false);
  
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
    if (!filters.employee_name || filters.employee_name.length < 2) {
      setEmployeeSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = filters.employee_name.trim();
        if (!searchTerm || searchTerm.length < 2) {
          setEmployeeSuggestions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('payroll')
          .select('employee_name')
          .ilike('employee_name', `%${searchTerm}%`)
          .not('employee_name', 'is', null)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set((data || []).map((d: any) => d.employee_name).filter(Boolean) as string[])].sort();
        setEmployeeSuggestions(unique as string[]);
      } catch (err) {
        console.error('[PayrollTable] Error fetching employee suggestions:', err);
        setEmployeeSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.employee_name, supabase]);

  useEffect(() => {
    if (!filters.agency_name || filters.agency_name.length < 2) {
      setAgencySuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = filters.agency_name.trim();
        if (!searchTerm || searchTerm.length < 2) {
          setAgencySuggestions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('payroll')
          .select('agency_name')
          .ilike('agency_name', `%${searchTerm}%`)
          .not('agency_name', 'is', null)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set((data || []).map((d: any) => d.agency_name).filter(Boolean) as string[])].sort();
        setAgencySuggestions(unique as string[]);
      } catch (err) {
        console.error('[PayrollTable] Error fetching agency suggestions:', err);
        setAgencySuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.agency_name, supabase]);

  useEffect(() => {
    if (!filters.department_name || filters.department_name.length < 2) {
      setDepartmentSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = filters.department_name.trim();
        if (!searchTerm || searchTerm.length < 2) {
          setDepartmentSuggestions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('payroll')
          .select('department_name')
          .ilike('department_name', `%${searchTerm}%`)
          .not('department_name', 'is', null)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set((data || []).map((d: any) => d.department_name).filter(Boolean) as string[])].sort();
        setDepartmentSuggestions(unique as string[]);
      } catch (err) {
        console.error('[PayrollTable] Error fetching department suggestions:', err);
        setDepartmentSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.department_name, supabase]);

  useEffect(() => {
    if (!filters.job_title || filters.job_title.length < 2) {
      setJobTitleSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = filters.job_title.trim();
        if (!searchTerm || searchTerm.length < 2) {
          setJobTitleSuggestions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('payroll')
          .select('job_title')
          .ilike('job_title', `%${searchTerm}%`)
          .not('job_title', 'is', null)
          .limit(10);

        if (fetchError) throw fetchError;

        const unique = [...new Set((data || []).map((d: any) => d.job_title).filter(Boolean) as string[])].sort();
        setJobTitleSuggestions(unique as string[]);
      } catch (err) {
        console.error('[PayrollTable] Error fetching job title suggestions:', err);
        setJobTitleSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters.job_title, supabase]);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchPayroll() {
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
          .from('payroll')
          .select('*', { count: 'exact' });

        // Apply filters
        if (filters.fiscal_year && filters.fiscal_year !== 'all') {
          query = query.eq('fiscal_year', filters.fiscal_year);
        }
        if (filters.employee_name?.trim()) {
          query = query.ilike('employee_name', `%${filters.employee_name.trim()}%`);
        }
        if (filters.agency_name?.trim()) {
          query = query.ilike('agency_name', `%${filters.agency_name.trim()}%`);
        }
        if (filters.department_name?.trim()) {
          query = query.ilike('department_name', `%${filters.department_name.trim()}%`);
        }
        if (filters.job_title?.trim()) {
          query = query.ilike('job_title', `%${filters.job_title.trim()}%`);
        }
        if (filters.wage_min?.trim()) {
          const minWage = parseFloat(filters.wage_min.trim());
          if (!isNaN(minWage) && minWage >= 0) {
            query = query.gte('total_wages', minWage);
          }
        }
        if (filters.wage_max?.trim()) {
          const maxWage = parseFloat(filters.wage_max.trim());
          if (!isNaN(maxWage) && maxWage >= 0) {
            query = query.lte('total_wages', maxWage);
          }
        }

        const { data, error: fetchError, count } = await query
          .order('total_wages', { ascending: false })
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
        const errorMessage = err instanceof Error ? err.message : 'Failed to load payroll records';
        setError(errorMessage);
        console.error('[PayrollTable] Error:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPayroll();
    
    return () => {
      cancelled = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [page, filters, supabase]);

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.fiscal_year !== 'all') ||
      (filters.employee_name?.trim() || '') !== '' ||
      (filters.agency_name?.trim() || '') !== '' ||
      (filters.department_name?.trim() || '') !== '' ||
      (filters.job_title?.trim() || '') !== '' ||
      (filters.wage_min?.trim() || '') !== '' ||
      (filters.wage_max?.trim() || '') !== ''
    );
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters({
      fiscal_year: 'all',
      employee_name: '',
      agency_name: '',
      department_name: '',
      job_title: '',
      wage_min: '',
      wage_max: '',
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
            This payroll data represents government employee compensation information from Minnesota state agencies. The data includes employee names, agencies, departments, job titles, and total wages earned during each fiscal year.
          </p>
          <p>
            Wages shown include regular wages, overtime wages, and other wages. Compensation rates and position FTE (Full-Time Equivalent) are also provided where available. This data reflects actual payroll transactions and helps provide transparency into government employee compensation.
          </p>
          <p>
            Data is sourced from Minnesota state payroll systems and represents fiscal year data from 2020-2025. Some employees may appear in multiple fiscal years if they were employed across those periods.
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
          {/* Fiscal Year Filter */}
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">Fiscal Year</label>
            <select
              value={filters.fiscal_year}
              onChange={(e) => {
                setFilters(f => ({ ...f, fiscal_year: e.target.value }));
                setPage(1);
              }}
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
            >
              <option value="all">All Years</option>
              <option value="2020">2020</option>
              <option value="2021">2021</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {/* Employee Name Filter */}
          <div className="relative">
            <label className="block text-xs text-gray-600 mb-0.5">Employee Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.employee_name}
                onChange={(e) => {
                  setFilters(f => ({ ...f, employee_name: e.target.value }));
                  setPage(1);
                  setShowEmployeeSuggestions(true);
                }}
                onFocus={() => setShowEmployeeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowEmployeeSuggestions(false), 200)}
                placeholder="Search employee..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
              {showEmployeeSuggestions && employeeSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {employeeSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, employee_name: name }));
                        setPage(1);
                        setShowEmployeeSuggestions(false);
                      }}
                      className="w-full px-2 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-900"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                value={filters.agency_name}
                onChange={(e) => {
                  setFilters(f => ({ ...f, agency_name: e.target.value }));
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
                        setFilters(f => ({ ...f, agency_name: agency }));
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

          {/* Department Filter */}
          <div className="relative">
            <label className="block text-xs text-gray-600 mb-0.5">Department</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.department_name}
                onChange={(e) => {
                  setFilters(f => ({ ...f, department_name: e.target.value }));
                  setPage(1);
                  setShowDepartmentSuggestions(true);
                }}
                onFocus={() => setShowDepartmentSuggestions(true)}
                onBlur={() => setTimeout(() => setShowDepartmentSuggestions(false), 200)}
                placeholder="Search department..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
              {showDepartmentSuggestions && departmentSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {departmentSuggestions.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, department_name: dept }));
                        setPage(1);
                        setShowDepartmentSuggestions(false);
                      }}
                      className="w-full px-2 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-900"
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Job Title Filter */}
          <div className="relative">
            <label className="block text-xs text-gray-600 mb-0.5">Job Title</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.job_title}
                onChange={(e) => {
                  setFilters(f => ({ ...f, job_title: e.target.value }));
                  setPage(1);
                  setShowJobTitleSuggestions(true);
                }}
                onFocus={() => setShowJobTitleSuggestions(true)}
                onBlur={() => setTimeout(() => setShowJobTitleSuggestions(false), 200)}
                placeholder="Search job title..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none"
              />
              {showJobTitleSuggestions && jobTitleSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {jobTitleSuggestions.map((title) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, job_title: title }));
                        setPage(1);
                        setShowJobTitleSuggestions(false);
                      }}
                      className="w-full px-2 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-900"
                    >
                      {title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Wage Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Min Wage</label>
              <input
                type="number"
                value={filters.wage_min}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setFilters(f => ({ ...f, wage_min: value }));
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
              <label className="block text-xs text-gray-600 mb-0.5">Max Wage</label>
              <input
                type="number"
                value={filters.wage_max}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setFilters(f => ({ ...f, wage_max: value }));
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
            <p className="text-xs text-gray-600 mt-2">Loading payroll records...</p>
          </div>
        ) : error ? (
          <div className="p-[10px]">
            <p className="text-xs text-red-700">Error: {error}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Fiscal Year
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Employee Name
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Agency Nbr
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Agency Name
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Department Nbr
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Department Name
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Branch Code
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Branch Name
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Job Code
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Job Title
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Location Name
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      County
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Reg/Temp
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Classified
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Original Hire
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Last Hire
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Job Entry
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Full/Part Time
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Active Jun 30
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Salary Plan
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Grade Range
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Max Step
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Comp Rate
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Comp Freq
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      FTE
                    </th>
                    <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Bargaining Unit
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Regular Wages
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Overtime Wages
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      Other Wages
                    </th>
                    <th className="p-[10px] text-right font-semibold text-gray-900 whitespace-nowrap">
                      Total Wages
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-[10px] text-gray-900 border-r border-gray-100 whitespace-nowrap">
                        {record.fiscal_year ?? '—'}
                      </td>
                      <td className="p-[10px] text-gray-900 border-r border-gray-100 whitespace-nowrap">
                        {record.employee_name || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.agency_nbr || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.agency_name || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.department_nbr || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.department_name || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.branch_code || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.branch_name || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.job_code || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.job_title || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.location_name || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.location_county_name || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.reg_temp_desc || record.reg_temp_code || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.classified_desc || record.classified_code || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {formatExcelDate(record.original_hire_date)}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.last_hire_date || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {formatExcelDate(record.job_entry_date)}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.full_part_time_desc || record.full_part_time_code || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.active_on_june_30 || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.salary_plan_grid || '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.salary_grade_range ?? '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.max_salary_step ?? '—'}
                      </td>
                      <td className="p-[10px] text-right text-gray-900 border-r border-gray-100 whitespace-nowrap">
                        {record.compensation_rate ? formatCurrency(record.compensation_rate) : '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.comp_frequency_desc || record.comp_frequency_code || '—'}
                      </td>
                      <td className="p-[10px] text-right text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.position_fte ?? '—'}
                      </td>
                      <td className="p-[10px] text-gray-600 border-r border-gray-100 whitespace-nowrap">
                        {record.bargaining_unit_name || (record.bargaining_unit_nbr ? String(record.bargaining_unit_nbr) : null) || '—'}
                      </td>
                      <td className="p-[10px] text-right text-gray-900 border-r border-gray-100 whitespace-nowrap">
                        {formatCurrency(record.regular_wages)}
                      </td>
                      <td className="p-[10px] text-right text-gray-900 border-r border-gray-100 whitespace-nowrap">
                        {formatCurrency(record.overtime_wages)}
                      </td>
                      <td className="p-[10px] text-right text-gray-900 border-r border-gray-100 whitespace-nowrap">
                        {formatCurrency(record.other_wages)}
                      </td>
                      <td className="p-[10px] text-right text-gray-900 font-medium whitespace-nowrap">
                        {formatCurrency(record.total_wages)}
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

