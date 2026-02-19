'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GlobeAltIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  HomeModernIcon,
  RectangleStackIcon,
  CloudIcon,
  AcademicCapIcon,
  UserGroupIcon,
  NewspaperIcon,
  SunIcon,
  HeartIcon,
  BuildingLibraryIcon,
  PaperAirplaneIcon,
  FlagIcon,
  TrophyIcon,
  SparklesIcon,
  SignalIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const EXPLORE_NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Boundaries',
    items: [
      { label: 'State', href: '/explore/state', icon: GlobeAltIcon },
      { label: 'Counties', href: '/explore/counties', icon: MapPinIcon },
      { label: 'Cities & Towns', href: '/explore/cities-and-towns', icon: BuildingOfficeIcon },
      { label: 'Cities', href: '/explore/cities', icon: BuildingOfficeIcon },
      { label: 'Towns', href: '/explore/towns', icon: HomeModernIcon },
      { label: 'Congressional Districts', href: '/explore/congressional-districts', icon: RectangleStackIcon },
    ],
  },
  {
    label: 'Education',
    items: [
      { label: 'School Districts', href: '/explore/school-districts', icon: AcademicCapIcon },
      { label: 'School Buildings', href: '/explore/school-buildings', icon: AcademicCapIcon },
      { label: 'Schools', href: '/explore/schools', icon: AcademicCapIcon },
    ],
  },
  {
    label: 'Nature',
    items: [
      { label: 'Water Bodies', href: '/explore/water', icon: CloudIcon },
      { label: 'Lakes', href: '/explore/lakes', icon: CloudIcon },
      { label: 'Parks', href: '/explore/parks', icon: SunIcon },
    ],
  },
  {
    label: 'Community',
    items: [
      { label: 'Hospitals', href: '/explore/hospitals', icon: HeartIcon },
      { label: 'Churches', href: '/explore/churches', icon: BuildingLibraryIcon },
      { label: 'Municipal Buildings', href: '/explore/municipals', icon: BuildingOfficeIcon },
      { label: 'Neighborhoods', href: '/explore/neighborhoods', icon: HomeModernIcon },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { label: 'Airports', href: '/explore/airports', icon: PaperAirplaneIcon },
      { label: 'Water Towers', href: '/explore/watertowers', icon: SparklesIcon },
      { label: 'Golf Courses', href: '/explore/golf-courses', icon: TrophyIcon },
      { label: 'Roads', href: '/explore/roads', icon: MapIcon },
      { label: 'Radio & News', href: '/explore/radio-and-news', icon: SignalIcon },
      { label: 'Cemeteries', href: '/explore/cemeteries', icon: FlagIcon },
    ],
  },
  {
    label: 'Other',
    items: [
      { label: 'Officials', href: '/explore/officials', icon: UserGroupIcon },
      { label: 'News', href: '/explore/news', icon: NewspaperIcon },
    ],
  },
];

export default function ExploreSubNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <Link href="/explore" className="block">
          <h2 className="text-xs font-semibold text-foreground">Explore</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">Browse Minnesota data layers</p>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-3">
        {EXPLORE_NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
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
