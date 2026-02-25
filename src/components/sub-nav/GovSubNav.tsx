'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  BanknotesIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';

const GOV_NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/gov', icon: BuildingOfficeIcon, exact: true },
      { label: 'Directory', href: '/gov/directory', icon: UserGroupIcon },
      { label: 'Checkbook', href: '/gov/checkbook', icon: BanknotesIcon },
    ],
  },
  {
    label: 'Branches',
    items: [
      { label: 'Executive', href: '/gov/executive', icon: BuildingOfficeIcon },
      { label: 'Legislative', href: '/gov/legislative', icon: DocumentTextIcon },
      { label: 'Judicial', href: '/gov/judicial', icon: ScaleIcon },
    ],
  },
  {
    label: 'Community',
    items: [
      { label: 'Community Edits', href: '/gov/community-edits', icon: ChatBubbleLeftRightIcon },
    ],
  },
];

export default function GovSubNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border-muted dark:border-white/10 bg-white dark:bg-surface">
        <h2 className="text-xs font-semibold text-foreground">Government</h2>
        <p className="text-[10px] text-foreground-muted mt-0.5">Civic data & transparency</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-3">
        {GOV_NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.exact);
                const Icon = item.icon;
                const comingSoon = 'comingSoon' in item && item.comingSoon;
                if (comingSoon) {
                  return (
                    <div
                      key={item.href}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted"
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                      <span>{item.label}</span>
                      <span className="text-[10px] text-foreground-muted/80 ml-auto">Coming soon</span>
                    </div>
                  );
                }
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
