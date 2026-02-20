'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import type { ComponentType } from 'react';
import type { PeopleSearchRow } from '@/app/api/people/search/recent/route';

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

function UsageBlock({ search_count, pull_request_count }: { search_count: number; pull_request_count: number }) {
  return (
    <div className="px-2 py-1.5 rounded-md bg-surface-accent dark:bg-white/5 border border-border-muted dark:border-white/10">
      <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1">Usage</p>
      <p className="text-xs text-foreground">Search history: {search_count}/1</p>
      <p className="text-xs text-foreground">Pull requests: {pull_request_count}</p>
    </div>
  );
}

function searchRowLabel(row: PeopleSearchRow): string {
  const q = row.query as Record<string, unknown>;
  switch (row.search_type) {
    case 'name': {
      const first = (q.firstName ?? q.first_name) as string | undefined;
      const last = (q.lastName ?? q.last_name) as string | undefined;
      return ([first, last].filter(Boolean).join(' ').trim() || (q.name as string)) ?? 'Name search';
    }
    case 'email':
      return (q.email as string) ?? 'Email search';
    case 'phone':
      return (q.phone as string) ?? 'Phone search';
    default:
      return 'Search';
  }
}

function searchRowIcon(row: PeopleSearchRow) {
  switch (row.search_type) {
    case 'name': return UserIcon;
    case 'email': return EnvelopeIcon;
    case 'phone': return PhoneIcon;
    default: return MagnifyingGlassIcon;
  }
}

export default function PeopleSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { account } = useAuthStateSafe();
  const { data: recentData } = useQuery(
    account?.id
      ? {
          queryKey: ['people', 'search', 'recent', account.id],
          queryFn: async () => {
            const res = await fetch('/api/people/search/recent', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json() as Promise<{ searches: PeopleSearchRow[]; search_count: number; pull_request_count: number }>;
          },
          staleTime: 60 * 1000,
        }
      : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );
  const searches = recentData?.searches ?? [];
  const search_count = recentData?.search_count ?? 0;
  const pull_request_count = recentData?.pull_request_count ?? 0;

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
        {account && (
          <div className="mb-2">
            <UsageBlock search_count={search_count} pull_request_count={pull_request_count} />
          </div>
        )}
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
        {account && (
          <div>
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
              Search history
            </p>
            {searches.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-foreground-muted">No saved search</p>
            ) : (
              <ul className="space-y-0.5">
                {searches.map((row) => {
                  const Icon = searchRowIcon(row);
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/people/search/${row.id}`}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-surface-accent transition-colors text-left"
                      >
                        <Icon className="w-3.5 h-3.5 text-foreground-muted flex-shrink-0" />
                        <span className="truncate flex-1">{searchRowLabel(row)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/people" className="mt-1 block px-2 text-xs text-foreground-muted hover:text-foreground">
              Find anyone
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
