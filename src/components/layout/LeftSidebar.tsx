'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  UserCircleIcon,
  BuildingOfficeIcon,
  NewspaperIcon,
  HeartIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import {
  UserCircleIcon as UserCircleIconSolid,
  HeartIcon as HeartIconSolid,
  BuildingOfficeIcon as BuildingOfficeIconSolid,
  NewspaperIcon as NewspaperIconSolid,
  MapIcon as MapIconSolid,
} from '@heroicons/react/24/solid';

interface LeftSidebarProps {
  children?: ReactNode;
}

/**
 * Left Sidebar - Sticky, scrollable
 * Shows navigation, shortcuts with colorful icons, and footer links
 */
export default function LeftSidebar({ children }: LeftSidebarProps) {
  const pathname = usePathname();

  const mainNav = [
    { label: 'Documentation', icon: UserCircleIcon, iconSolid: UserCircleIconSolid, href: '/docs' },
    { label: 'Love of Minnesota', icon: HeartIcon, iconSolid: HeartIconSolid, href: '/' },
    { label: 'Explore', icon: MapIcon, iconSolid: MapIconSolid, href: '/explore' },
    { label: 'Government', icon: BuildingOfficeIcon, iconSolid: BuildingOfficeIconSolid, href: '/gov' },
    { label: 'News', icon: NewspaperIcon, iconSolid: NewspaperIconSolid, href: '/news' },
  ];

  const isNavActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Main Navigation */}
      <div className="p-3 space-y-1">
        {mainNav.map((item) => {
          const isActive = isNavActive(item.href);
          const Icon = isActive ? item.iconSolid : item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                isActive 
                  ? 'bg-surface-accent text-foreground' 
                  : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer Links */}
      <div className="mt-auto px-3 py-3 border-t border-border-muted dark:border-white/10">
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-foreground-subtle">
          <Link href="/privacy" className="hover:underline hover:text-foreground-muted">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:underline hover:text-foreground-muted">Terms</Link>
          <span>·</span>
          <Link href="/cookies" className="hover:underline hover:text-foreground-muted">Cookies</Link>
        </div>
        <div className="text-xs text-foreground-subtle mt-2">
          Love of Minnesota 2026
        </div>
      </div>

      {/* Custom Content */}
      {children && (
        <div className="flex-1 overflow-y-auto p-3">
          {children}
        </div>
      )}
    </div>
  );
}
