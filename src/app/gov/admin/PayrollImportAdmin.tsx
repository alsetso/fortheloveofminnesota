'use client';

import { useState } from 'react';

interface ImportStatus {
  year: string;
  status: 'idle' | 'importing' | 'success' | 'error';
  message?: string;
  recordsInserted?: number;
  recordsSkipped?: number;
}

const FISCAL_YEARS = [
  { year: '2020', active: true },
  { year: '2021', active: false },
  { year: '2022', active: false },
  { year: '2023', active: false },
  { year: '2024', active: false },
  { year: '2025', active: false },
];

export default function PayrollImportAdmin() {
  const [statuses, setStatuses] = useState<Record<string, ImportStatus>>(() => {
    const initial: Record<string, ImportStatus> = {};
    FISCAL_YEARS.forEach(({ year }) => {
      initial[year] = { year, status: 'idle' };
    });
    return initial;
  });

  const handleImport = async (year: string) => {
    const yearConfig = FISCAL_YEARS.find(y => y.year === year);
    if (!yearConfig?.active) {
      return;
    }

    setStatuses(prev => ({
      ...prev,
      [year]: { year, status: 'importing', message: 'Starting import...' },
    }));

    try {
      const response = await fetch('/api/admin/payroll/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscal_year: year }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setStatuses(prev => ({
        ...prev,
        [year]: {
          year,
          status: 'success',
          message: data.message || 'Import completed successfully',
          recordsInserted: data.recordsInserted,
          recordsSkipped: data.recordsSkipped,
        },
      }));
    } catch (error) {
      setStatuses(prev => ({
        ...prev,
        [year]: {
          year,
          status: 'error',
          message: error instanceof Error ? error.message : 'Import failed',
        },
      }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {FISCAL_YEARS.map(({ year, active }) => {
          const status = statuses[year];
          const isImporting = status.status === 'importing';
          const isSuccess = status.status === 'success';
          const isError = status.status === 'error';

          return (
            <div
              key={year}
              className={`bg-white border rounded-md p-[10px] space-y-2 ${
                active
                  ? 'border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors'
                  : 'border-gray-100 opacity-60 cursor-not-allowed'
              }`}
              onClick={() => active && !isImporting && handleImport(year)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-900">
                  Fiscal Year {year}
                </h3>
                {!active && (
                  <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded">
                    Coming
                  </span>
                )}
                {isImporting && (
                  <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                )}
                {isSuccess && (
                  <span className="text-xs text-green-700 font-medium">✓</span>
                )}
                {isError && (
                  <span className="text-xs text-red-700 font-medium">✗</span>
                )}
              </div>

              {status.message && (
                <p className={`text-xs ${
                  isError ? 'text-red-700' : isSuccess ? 'text-green-700' : 'text-gray-600'
                }`}>
                  {status.message}
                </p>
              )}

              {status.recordsInserted !== undefined && (
                <div className="space-y-0.5 text-xs text-gray-600">
                  <p>Inserted: {status.recordsInserted.toLocaleString()}</p>
                  {status.recordsSkipped !== undefined && status.recordsSkipped > 0 && (
                    <p>Skipped: {status.recordsSkipped.toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

