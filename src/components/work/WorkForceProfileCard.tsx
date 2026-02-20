'use client';

import { UserIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useWorkView } from '@/contexts/WorkViewContext';

export default function WorkForceProfileCard() {
  const { viewAs } = useWorkView();

  if (viewAs === 'employer') {
    return (
      <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-surface">
        <div className="rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-[10px] space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gray-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
              <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider">
                View as
              </p>
              <p className="text-xs font-semibold text-gray-900 dark:text-foreground truncate">
                Employer
              </p>
            </div>
          </div>
          <div className="space-y-0.5 pt-0.5 border-t border-gray-200 dark:border-white/10">
            <p className="text-[11px] text-gray-600 dark:text-foreground-muted">
              Your company
            </p>
            <p className="text-[10px] text-gray-500 dark:text-foreground-muted">
              Open roles: —
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-surface">
      <div className="rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-[10px] space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gray-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-4 h-4 text-gray-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider">
              View as
            </p>
            <p className="text-xs font-semibold text-gray-900 dark:text-foreground truncate">
              Worker
            </p>
          </div>
        </div>
        <div className="space-y-0.5 pt-0.5 border-t border-gray-200 dark:border-white/10">
          <p className="text-[11px] text-gray-600 dark:text-foreground-muted">
            Your profile
          </p>
          <p className="text-[10px] text-gray-500 dark:text-foreground-muted">
            Saved jobs: —
          </p>
        </div>
      </div>
    </div>
  );
}
