'use client';

import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  HomeIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';

interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled: true;
}

const REALESTATE_ENTRY_POINTS: NavItem[] = [
  { label: 'Explore the Market', icon: MagnifyingGlassIcon, disabled: true },
  { label: 'Buy', icon: HomeIcon, disabled: true },
  { label: 'Sell', icon: ArrowTrendingUpIcon, disabled: true },
  { label: 'Connect', icon: UserGroupIcon, disabled: true },
];

export default function RealEstateSubNav() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border-muted dark:border-white/10 bg-white dark:bg-surface">
        <Link href="/realestate" className="block">
          <h2 className="text-xs font-semibold text-foreground">Real Estate</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">MN properties &amp; market</p>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-3">
        <div>
          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
            Entry points
          </p>
          <div className="space-y-0.5">
            {REALESTATE_ENTRY_POINTS.map((item) => {
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
      </div>
    </div>
  );
}
