'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TruckIcon,
  MapIcon,
  PaperAirplaneIcon,
  SignalIcon,
  ArrowsRightLeftIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  disabled?: boolean;
}

const TRANSPORT_NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Transit',
    items: [
      { label: 'NexTrip', href: '/transportation/nextrip', icon: TruckIcon },
      { label: 'Trip Planner', href: '/transportation/trip-planner', icon: ArrowsRightLeftIcon },
      { label: 'Metro (•Live)', href: '/transportation/metro', icon: SignalSlashIcon },
    ],
  },
  {
    label: 'Roads',
    items: [
      { label: 'MnDOT Traffic', href: '/transportation/mndot', icon: SignalIcon, disabled: true },
    ],
  },
  {
    label: 'Air',
    items: [
      { label: 'Flight Tracker', href: '/transportation/flights', icon: PaperAirplaneIcon },
      { label: 'Airports', href: '/transportation/airports', icon: PaperAirplaneIcon, disabled: true },
    ],
  },
  {
    label: 'Active',
    items: [
      { label: 'Bike & Trail', href: '/transportation/bike-trail', icon: MapIcon, disabled: true },
    ],
  },
];

export default function TransportSubNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border-muted dark:border-white/10 bg-white dark:bg-surface">
        <Link href="/transportation" className="block">
          <h2 className="text-xs font-semibold text-foreground">Transportation</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">MN transit, roads & travel</p>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-3">
        {TRANSPORT_NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.exact);
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <span
                      key={item.href}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted/40 cursor-default select-none"
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{item.label}</span>
                      <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-foreground-muted/30">Soon</span>
                    </span>
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
