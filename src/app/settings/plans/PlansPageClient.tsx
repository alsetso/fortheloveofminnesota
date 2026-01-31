'use client';

import { useState } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import PlansComparisonTable from '@/components/billing/PlansComparisonTable';

interface PlansPageClientProps {
  currentPlanSlug?: string | null;
}

export default function PlansPageClient({ currentPlanSlug }: PlansPageClientProps) {
  const { account } = useAuthStateSafe();
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const isAdmin = account?.role === 'admin';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Plans & Features</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Compare plans and their features
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">View Mode:</span>
              <button
                onClick={() => setIsAdminMode(false)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  !isAdminMode
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Public
              </button>
              <button
                onClick={() => setIsAdminMode(true)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isAdminMode
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Admin
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Plans Comparison Table */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <PlansComparisonTable 
          currentPlanSlug={currentPlanSlug} 
          isAdmin={isAdminMode && isAdmin}
        />
      </div>
    </div>
  );
}
