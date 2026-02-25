'use client';

import Link from 'next/link';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useBillingEntitlementsSafe } from '@/contexts/BillingEntitlementsContext';

function formatLimit(feature: {
  limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  limit_value: number | null;
  is_unlimited: boolean;
}): string {
  if (feature.is_unlimited || feature.limit_type === 'unlimited') return '∞';
  if (feature.limit_type === 'boolean') return 'Enabled';
  if (feature.limit_type === 'storage_mb') return feature.limit_value !== null ? `${feature.limit_value}MB` : '—';
  if (feature.limit_type === 'count') return feature.limit_value !== null ? String(feature.limit_value) : '—';
  return 'Enabled';
}

export default function BillingFeaturesCard({ className = '' }: { className?: string }) {
  const { isLoading, error, features } = useBillingEntitlementsSafe();

  const sorted = features.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Enabled Features</h3>
        <Link href="/pricing" className="text-xs text-blue-600 hover:text-blue-800 underline">
          View plans
        </Link>
      </div>

      {isLoading && (
        <p className="text-xs text-gray-600">Loading…</p>
      )}

      {!isLoading && error && (
        <p className="text-xs text-gray-600">{error}</p>
      )}

      {!isLoading && !error && sorted.length === 0 && (
        <p className="text-xs text-gray-600">No plan features available.</p>
      )}

      {!isLoading && !error && sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.slice(0, 12).map((f) => (
            <div key={f.slug} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-xs text-gray-900 truncate">{f.name}</span>
              </div>
              <span className="text-[10px] font-medium text-gray-600 flex-shrink-0">
                {formatLimit(f)}
              </span>
            </div>
          ))}

          {sorted.length > 12 && (
            <div className="pt-1">
              <Link href="/pricing" className="text-xs text-blue-600 hover:text-blue-800 underline">
                View all {sorted.length}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

