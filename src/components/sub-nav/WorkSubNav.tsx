'use client';

import Link from 'next/link';
import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  MapPinIcon,
  EyeIcon,
  UserPlusIcon,
  PlusCircleIcon,
  BookmarkIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import { useWorkView, type WorkViewRole } from '@/contexts/WorkViewContext';
import WorkForceProfileCard from '@/components/work/WorkForceProfileCard';

interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled: true;
}

const WORKER_ENTRY_POINTS: NavItem[] = [
  { label: 'Jobs', icon: BriefcaseIcon, disabled: true },
  { label: 'Employers', icon: BuildingOfficeIcon, disabled: true },
  { label: 'Training', icon: AcademicCapIcon, disabled: true },
  { label: 'By location', icon: MapPinIcon, disabled: true },
];

const EMPLOYER_ENTRY_POINTS: NavItem[] = [
  { label: 'Post a job', icon: PlusCircleIcon, disabled: true },
  { label: 'Find candidates', icon: UserPlusIcon, disabled: true },
  { label: 'Training programs', icon: AcademicCapIcon, disabled: true },
  { label: 'By location', icon: MapPinIcon, disabled: true },
];

const VIEW_AS_OPTIONS: { value: WorkViewRole; label: string }[] = [
  { value: 'worker', label: 'Worker' },
  { value: 'employer', label: 'Employer' },
];

export default function WorkSubNav() {
  const { account } = useAuthStateSafe();
  const { viewAs, setViewAs } = useWorkView();
  const isAdmin = account?.role === 'admin';

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border-muted dark:border-white/10 bg-white dark:bg-surface">
        <Link href="/work" className="block">
          <h2 className="text-xs font-semibold text-foreground">Work</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">MN jobs &amp; workforce</p>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-3">
        {isAdmin && (
          <div>
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
              <EyeIcon className="w-3 h-3" />
              View as
            </p>
            <select
              value={viewAs}
              onChange={(e) => setViewAs(e.target.value as WorkViewRole)}
              className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              {VIEW_AS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
            Entry points
          </p>
          <div className="space-y-0.5">
            {(viewAs === 'employer' ? EMPLOYER_ENTRY_POINTS : WORKER_ENTRY_POINTS).map((item) => {
              const Icon = item.icon;
              return (
                <span
                  key={item.label}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted/40 cursor-default select-none"
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-foreground-muted/30">
                    Soon
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {viewAs === 'worker' && (
          <>
            <div>
              <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
                Bookmarked
              </p>
              <div className="space-y-0.5">
                <span className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted/40 cursor-default select-none">
                  <BookmarkIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>—</span>
                  <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-foreground-muted/30">
                    Soon
                  </span>
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
                My Jobs
              </p>
              <div className="space-y-0.5">
                <span className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted/40 cursor-default select-none">
                  <ClipboardDocumentListIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>—</span>
                  <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-foreground-muted/30">
                    Soon
                  </span>
                </span>
              </div>
            </div>
          </>
        )}

        {viewAs === 'employer' && (
          <div>
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
              My businesses
            </p>
            <div className="space-y-0.5">
              <span className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted/40 cursor-default select-none">
                <BuildingOfficeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>—</span>
                <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-foreground-muted/30">
                  Soon
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <WorkForceProfileCard />
      </div>
    </div>
  );
}
