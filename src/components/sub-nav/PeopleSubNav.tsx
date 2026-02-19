'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

const PEOPLE_NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Find',
    items: [
      { label: 'Find someone', href: '/people', icon: MagnifyingGlassIcon, exact: true },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Active users', href: '/people/users', icon: UserGroupIcon },
    ],
  },
  {
    label: 'Connections',
    items: [
      { label: 'Following', href: '/people/users?tab=following', icon: UserPlusIcon },
      { label: 'Followers', href: '/people/users?tab=followers', icon: UsersIcon },
    ],
  },
];

export default function PeopleSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    const base = href.split('?')[0];
    if (pathname === base) return true;
    if (pathname.startsWith(base + '/')) return true;
    if (base === '/people/users' && pathname === '/people') return false;
    return pathname.startsWith(base);
  };

  const isSearchActive = (href: string) => {
    if (href.includes('?')) {
      const [base, qs] = href.split('?');
      const tab = new URLSearchParams(qs).get('tab');
      if (pathname !== base) return false;
      return searchParams.get('tab') === tab;
    }
    return isActive(href, true);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border-muted dark:border-white/10 bg-white dark:bg-surface">
        <Link href="/people" className="block">
          <h2 className="text-xs font-semibold text-foreground">People</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">Find Minnesotans &amp; connect</p>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-3">
        {PEOPLE_NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href.includes('?') ? isSearchActive(item.href) : isActive(item.href, item.exact);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${
                      active
                        ? 'bg-surface-accent text-foreground font-medium'
                        : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
