'use client';

/**
 * Weather sub-nav (Overview, Hourly, 7-Day, Alerts, Stations, City Lookup).
 * Currently unused: the weather page is a single dashboard with in-page jump links.
 * Kept in case you add /weather/hourly, /weather/forecast, etc. later.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CloudIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  MapPinIcon,
  ClockIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

const WEATHER_NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/weather', icon: CloudIcon, exact: true },
    ],
  },
  {
    label: 'Forecast',
    items: [
      { label: 'Today / Hourly', href: '/weather/hourly', icon: ClockIcon },
      { label: '7-Day Forecast', href: '/weather/forecast', icon: CalendarDaysIcon },
    ],
  },
  {
    label: 'Conditions',
    items: [
      { label: 'Active Alerts', href: '/weather/alerts', icon: ExclamationTriangleIcon },
      { label: 'Stations', href: '/weather/stations', icon: SignalIcon },
    ],
  },
  {
    label: 'Search',
    items: [
      { label: 'City Lookup', href: '/weather/search', icon: MapPinIcon },
    ],
  },
];

export default function WeatherSubNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border-muted dark:border-white/10 bg-white dark:bg-surface">
        <Link href="/weather" className="block">
          <h2 className="text-xs font-semibold text-foreground">Weather</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">Minnesota conditions & forecast</p>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-3">
        {WEATHER_NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item: { label: string; href: string; icon: typeof CloudIcon; exact?: boolean }) => {
                const active = isActive(item.href, item.exact);
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
