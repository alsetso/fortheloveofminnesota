'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface RightSidebarProps {
  children?: ReactNode;
}

const EXPLORE_SECTIONS = [
  {
    label: 'Places',
    links: [
      { label: 'Counties', href: '/explore/counties' },
      { label: 'Cities & Towns', href: '/explore/cities-and-towns' },
      { label: 'Water Bodies', href: '/explore/water' },
    ],
  },
  {
    label: 'Government',
    links: [
      { label: 'Congressional Districts', href: '/explore/congressional-districts' },
    ],
  },
  {
    label: 'Schools',
    links: [
      { label: 'School Districts', href: '/explore/school-districts' },
      { label: 'School Buildings', href: '/explore/school-buildings' },
    ],
  },
  {
    label: 'More',
    links: [
      { label: 'Minnesota News', href: '/news' },
    ],
  },
] as const;

/**
 * Default right sidebar: explore-style sections (Places, Government, Schools, More).
 * Matches ExploreRightSidebar UI: header + section labels + link rows with chevron.
 */
function DefaultRightSidebarContent() {
  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      <div className="p-[10px] border-b border-border-muted dark:border-white/10 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Explore</h2>
        <p className="text-[10px] text-foreground-muted mt-0.5">Browse Minnesota data.</p>
      </div>
      {EXPLORE_SECTIONS.map((section) => (
        <div
          key={section.label}
          className="p-[10px] border-b border-border-muted dark:border-white/10 flex-shrink-0"
        >
          <h3 className="text-xs font-semibold text-foreground mb-2">{section.label}</h3>
          <nav className="space-y-0.5">
            {section.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between px-2 py-1.5 rounded text-xs text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
              >
                {link.label}
                <ChevronRightIcon className="w-3 h-3 flex-shrink-0" />
              </Link>
            ))}
          </nav>
        </div>
      ))}
    </div>
  );
}

/**
 * Right Sidebar - Sticky, scrollable.
 * When no children are passed, shows explore-style sections: Places, Government, Schools, More (links to /explore/* and /news).
 */
export default function RightSidebar({ children }: RightSidebarProps) {
  if (children !== undefined && children !== null) {
    return (
      <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-white dark:bg-header border-l border-border-muted dark:border-white/10">
        <div className="p-3">{children}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-white dark:bg-header border-l border-border-muted dark:border-white/10">
      <DefaultRightSidebarContent />
    </div>
  );
}
