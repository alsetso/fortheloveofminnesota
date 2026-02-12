'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import PinsMediaMigrationDebug from './PinsMediaMigrationDebug';
import { formatCellValue, formatJSON, isURL, truncateText } from '@/lib/admin/dataFormatter';

interface TableDataViewerProps {
  schema: string;
  table: string;
}

interface TableRow {
  [key: string]: any;
}

type SortDirection = 'ASC' | 'DESC' | null;
type FilterOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';

interface ColumnFilter {
  operator: FilterOperator;
  value: string;
}

export default function TableDataViewer({ schema, table }: TableDataViewerProps) {
  const [data, setData] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [total, setTotal] = useState(0);
  
  // Search and filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  
  // Row selection
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Initialize visible columns from localStorage or default to all
  useEffect(() => {
    const stored = localStorage.getItem(`admin_table_columns_${schema}_${table}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setVisibleColumns(new Set(parsed));
      } catch {
        setVisibleColumns(new Set(columns));
      }
    } else {
      setVisibleColumns(new Set(columns));
    }
  }, [schema, table, columns]);

  // Save visible columns to localStorage
  useEffect(() => {
    if (visibleColumns.size > 0) {
      localStorage.setItem(
        `admin_table_columns_${schema}_${table}`,
        JSON.stringify(Array.from(visibleColumns))
      );
    }
  }, [visibleColumns, schema, table]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (debouncedSearch) {
          params.append('search', debouncedSearch);
        }

        if (sortColumn && sortDirection) {
          params.append('orderBy', sortColumn);
          params.append('orderDirection', sortDirection);
        }

        if (Object.keys(filters).length > 0) {
          const filtersObj: Record<string, Record<string, string>> = {};
          Object.entries(filters).forEach(([col, filter]) => {
            if (filter.value || filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
              filtersObj[col] = { [filter.operator]: filter.value };
            }
          });
          if (Object.keys(filtersObj).length > 0) {
            params.append('filters', JSON.stringify(filtersObj));
          }
        }

        const res = await fetch(`/api/admin/database/${schema}/${table}?${params.toString()}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to fetch table data');
        }
        
        const result = await res.json();
        setData(result.data || []);
        setColumns(result.columns || []);
        setTotal(result.total || 0);
        
        // Initialize visible columns if not set
        if (visibleColumns.size === 0 && result.columns) {
          setVisibleColumns(new Set(result.columns));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load table data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [schema, table, page, limit, debouncedSearch, sortColumn, sortDirection, filters]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'ASC') {
        setSortDirection('DESC');
      } else if (sortDirection === 'DESC') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('ASC');
    }
    setPage(1);
  };

  const handleFilterChange = (column: string, operator: FilterOperator, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value || operator === 'IS NULL' || operator === 'IS NOT NULL') {
        next[column] = { operator, value };
      } else {
        delete next[column];
      }
      return next;
    });
    setPage(1);
  };

  const toggleColumnVisibility = (column: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) {
        next.delete(column);
      } else {
        next.add(column);
      }
      return next;
    });
  };

  const toggleRowSelection = (index: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data.map((_, idx) => idx)));
    }
  };

  const handleExportCSV = () => {
    const visibleCols = columns.filter((col) => visibleColumns.has(col));
    const headers = visibleCols.join(',');
    const rows = data.map((row) =>
      visibleCols
        .map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          const str = String(value);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema}_${table}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema}_${table}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleColumnsArray = useMemo(
    () => columns.filter((col) => visibleColumns.has(col)),
    [columns, visibleColumns]
  );

  const hasActiveFilters = Object.keys(filters).length > 0 || debouncedSearch;

  // Close column menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showColumnMenu && !target.closest('.column-menu-container')) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnMenu]);

  if (loading && data.length === 0) {
    return (
      <div className="p-[10px]">
        <div className="text-xs text-foreground-muted">Loading table data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-[10px]">
        <div className="text-xs text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="p-[10px] border-b border-border-muted flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-sm font-semibold text-white mb-0.5">
              {schema}.{table}
            </h1>
            <p className="text-xs text-foreground-muted">
              {total.toLocaleString()} total row{total !== 1 ? 's' : ''} • Showing {data.length} on page {page}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRows.size > 0 && (
              <div className="text-xs text-foreground-muted">
                {selectedRows.size} selected
              </div>
            )}
            <button
              onClick={handleExportCSV}
              className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-white border border-border-muted rounded transition-colors"
              title="Export CSV"
            >
              <ArrowDownTrayIcon className="w-3 h-3" />
            </button>
            <button
              onClick={handleExportJSON}
              className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-white border border-border-muted rounded transition-colors"
              title="Export JSON"
            >
              JSON
            </button>
            <div className="relative column-menu-container">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-white border border-border-muted rounded transition-colors flex items-center gap-1"
              >
                <EyeIcon className="w-3 h-3" />
                Columns
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border-muted rounded p-2 z-50 max-h-64 overflow-y-auto min-w-[200px] column-menu-container">
                  <div className="text-xs font-semibold text-white mb-2">Visible Columns</div>
                  {columns.map((col) => (
                    <label
                      key={col}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-surface-accent rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col)}
                        onChange={() => toggleColumnVisibility(col)}
                        className="w-3 h-3"
                      />
                      <span className="text-xs text-white">{col}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-foreground-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all columns..."
              className="w-full pl-7 pr-2 py-1 text-xs bg-surface border border-border-muted rounded text-white placeholder-foreground-muted focus:outline-none focus:border-lake-blue"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-2 py-1 text-xs font-medium border rounded transition-colors ${
              hasActiveFilters
                ? 'bg-lake-blue/20 border-lake-blue text-lake-blue'
                : 'border-border-muted text-foreground-muted hover:text-white'
            }`}
          >
            <FunnelIcon className="w-3 h-3" />
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-2 p-2 bg-surface-accent rounded border border-border-muted">
            <div className="text-xs font-semibold text-white mb-2">Column Filters</div>
            <div className="grid grid-cols-3 gap-2">
              {columns.slice(0, 6).map((col) => (
                <div key={col} className="flex items-center gap-1">
                  <select
                    value={filters[col]?.operator || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        col,
                        e.target.value as FilterOperator,
                        filters[col]?.value || ''
                      )
                    }
                    className="flex-1 px-1 py-0.5 text-[10px] bg-surface border border-border-muted rounded text-white"
                  >
                    <option value="">No filter</option>
                    <option value="=">=</option>
                    <option value="!=">≠</option>
                    <option value=">">&gt;</option>
                    <option value=">=">≥</option>
                    <option value="<">&lt;</option>
                    <option value="<=">≤</option>
                    <option value="LIKE">Contains</option>
                    <option value="IS NULL">Is NULL</option>
                    <option value="IS NOT NULL">Not NULL</option>
                  </select>
                  {filters[col]?.operator !== 'IS NULL' && filters[col]?.operator !== 'IS NOT NULL' && (
                    <input
                      type="text"
                      value={filters[col]?.value || ''}
                      onChange={(e) =>
                        handleFilterChange(col, filters[col]?.operator || '=', e.target.value)
                      }
                      placeholder={col}
                      className="flex-1 px-1 py-0.5 text-[10px] bg-surface border border-border-muted rounded text-white placeholder-foreground-muted"
                    />
                  )}
                </div>
              ))}
            </div>
            {columns.length > 6 && (
              <div className="text-[10px] text-foreground-muted mt-1">
                Showing first 6 columns. Add more filters as needed.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Debug Map for maps.pins */}
      {schema === 'maps' && table === 'pins' && (
        <div className="h-[500px] border-b border-border-muted flex-shrink-0 relative">
          <PinsMediaMigrationDebug schema={schema} table={table} />
        </div>
      )}

      {/* Table */}
      {visibleColumnsArray.length > 0 && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full w-full overflow-x-auto overflow-y-auto scrollbar-hide">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-surface-accent border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="p-[10px] border-r border-border-muted w-8">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.length && data.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3 h-3"
                    />
                  </th>
                  {visibleColumnsArray.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="p-[10px] text-left font-semibold text-white border-r border-border-muted cursor-pointer hover:bg-surface-muted transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>{col}</span>
                        {sortColumn === col && (
                          sortDirection === 'ASC' ? (
                            <ChevronUpIcon className="w-3 h-3" />
                          ) : (
                            <ChevronDownIcon className="w-3 h-3" />
                          )
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => {
                  const isSelected = selectedRows.has(idx);
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-border-muted hover:bg-surface-accent transition-colors ${
                        isSelected ? 'bg-lake-blue/10' : ''
                      }`}
                    >
                      <td className="p-[10px] border-r border-border-muted">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(idx)}
                          className="w-3 h-3"
                        />
                      </td>
                      {visibleColumnsArray.map((col) => {
                        const value = row[col];
                        const displayValue = formatCellValue(value, col);
                        const isTruncated = typeof displayValue === 'string' && displayValue.length > 50;
                        const cellContent = isTruncated ? truncateText(displayValue, 50) : displayValue;
                        
                        return (
                          <td
                            key={col}
                            className="p-[10px] text-white border-r border-border-muted font-mono text-[10px]"
                          >
                            {isURL(displayValue) ? (
                              <a
                                href={displayValue}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lake-blue hover:underline"
                              >
                                {cellContent}
                              </a>
                            ) : typeof value === 'object' && value !== null ? (
                              <div
                                className="max-w-xs truncate cursor-pointer hover:text-lake-blue"
                                title={formatJSON(value)}
                                onClick={() => {
                                  const modal = window.open('', '_blank');
                                  if (modal) {
                                    modal.document.write(
                                      `<pre style="padding: 20px; font-family: monospace; white-space: pre-wrap;">${formatJSON(value)}</pre>`
                                    );
                                  }
                                }}
                              >
                                {cellContent}
                              </div>
                            ) : (
                              <div className="max-w-xs truncate" title={displayValue}>
                                {cellContent}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <div className="p-[10px] border-t border-border-muted flex items-center justify-between flex-shrink-0 bg-surface-accent">
          <div className="text-xs text-white">
            {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedRows(new Set())}
              className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-white"
            >
              Clear
            </button>
            <button
              onClick={() => {
                // TODO: Implement bulk delete
                alert('Bulk delete not yet implemented');
              }}
              className="px-2 py-1 text-xs font-medium text-red-500 hover:text-red-400 flex items-center gap-1"
            >
              <TrashIcon className="w-3 h-3" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="p-[10px] border-t border-border-muted flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-xs text-foreground-muted">
          Page {page} of {Math.ceil(total / limit)}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= Math.ceil(total / limit)}
          className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
