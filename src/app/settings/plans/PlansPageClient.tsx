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
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Plans & Features</h2>
            <p className="text-xs text-foreground/60 mt-0.5">
              Compare plans and their features
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/70">View Mode:</span>
              <button
                onClick={() => setIsAdminMode(false)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  !isAdminMode
                    ? 'bg-lake-blue text-foreground'
                    : 'bg-surface-accent text-foreground/70 hover:bg-surface-accent/80'
                }`}
              >
                Public
              </button>
              <button
                onClick={() => setIsAdminMode(true)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isAdminMode
                    ? 'bg-lake-blue text-foreground'
                    : 'bg-surface-accent text-foreground/70 hover:bg-surface-accent/80'
                }`}
              >
                Admin
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Plans Comparison Table */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <PlansComparisonTable 
          currentPlanSlug={currentPlanSlug} 
          isAdmin={isAdminMode && isAdmin}
        />
      </div>
    </div>
  );
}
