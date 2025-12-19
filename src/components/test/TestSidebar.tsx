'use client';

import { useState } from 'react';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  GlobeAltIcon,
  BuildingLibraryIcon,
  UsersIcon,
  HeartIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import ProfilePhoto from '@/components/ProfilePhoto';
import { Account } from '@/features/auth';
import SecondarySidebar from './SecondarySidebar';
import ExploreSecondaryContent from './ExploreSecondaryContent';
import CivicSecondaryContent from './CivicSecondaryContent';
import MentionsSecondaryContent from './MentionsSecondaryContent';

import type { MapboxMapInstance } from '@/types/mapbox-events';

interface TestSidebarProps {
  account: Account | null;
  map: MapboxMapInstance | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  secondaryContent?: React.ReactNode;
}

const navItems: NavItem[] = [
  { 
    href: '/explore', 
    label: 'Explore', 
    icon: GlobeAltIcon,
    secondaryContent: <ExploreSecondaryContent />,
  },
  { 
    href: '/civic', 
    label: 'Civil', 
    icon: BuildingLibraryIcon,
    secondaryContent: <CivicSecondaryContent />,
  },
  { href: '/profile', label: 'People', icon: UsersIcon },
  { 
    href: '#', 
    label: 'Mentions', 
    icon: HeartIcon,
    secondaryContent: <MentionsSecondaryContent />,
  },
];

export default function TestSidebar({ account, map }: TestSidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredNavItem, setHoveredNavItem] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Top Nav */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 h-14">
        <div className="relative flex items-center justify-end h-full px-3">
          {/* Logo - Centered */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2">
            <Image
              src="/logo.png"
              alt="Logo"
              width={24}
              height={24}
              className="w-6 h-6"
              unoptimized
            />
          </Link>

          {/* Right side - Hamburger and Account */}
          <div className="flex items-center gap-2">
            {account && (
              <div className="flex-shrink-0">
                <ProfilePhoto account={account} size="xs" />
              </div>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/20 z-[99]"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Menu */}
            <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-[101]">
              <div className="py-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const isMentions = item.href === '#';

                  return isMentions ? (
                    <div
                      key={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer
                        ${
                          active
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon className="w-6 h-6" />
                      <span>{item.label}</span>
                    </div>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors
                        ${
                          active
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon className="w-6 h-6" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex relative w-16 flex-shrink-0 flex-col h-full bg-white border-r border-gray-200">
        {/* Navigation items - large vertical container */}
        <nav className="flex-1 flex flex-col overflow-y-auto p-2 border-b border-gray-200">
          <ul className="flex-1 space-y-2">
            {/* Logo - centered, vertically inline with nav icons, matches secondary sidebar header height */}
            <li className="h-11 flex items-center"> {/* h-11 = 2.75rem = 44px, matches secondary sidebar header */}
              <Link
                href="/"
                className="flex flex-col items-center justify-center w-full px-1 group"
                title="Home"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-md transition-colors group-hover:bg-gray-100">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={28}
                    height={28}
                    className="w-7 h-7"
                    unoptimized
                  />
                </div>
              </Link>
            </li>

            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const isHovered = hoveredNavItem === item.href;
              const isMentions = item.href === '#';

              return (
                <li 
                  key={item.href}
                  onMouseEnter={() => setHoveredNavItem(item.href)}
                  onMouseLeave={() => setHoveredNavItem(null)}
                >
                  {isMentions ? (
                    <div
                      className="flex flex-col items-center justify-center gap-1 px-1 py-2 group cursor-pointer"
                      title={item.label}
                    >
                      <div className={`
                        w-8 h-8 flex items-center justify-center rounded-md transition-colors
                        ${
                          active
                            ? 'bg-gray-200'
                            : 'group-hover:bg-gray-100'
                        }
                      `}>
                        <Icon className={`w-5 h-5 ${
                          active ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'
                        }`} />
                      </div>
                      <span className={`text-[10px] leading-tight text-center ${
                        active ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex flex-col items-center justify-center gap-1 px-1 py-2 group"
                      title={item.label}
                    >
                      <div className={`
                        w-8 h-8 flex items-center justify-center rounded-md transition-colors
                        ${
                          active
                            ? 'bg-gray-200'
                            : 'group-hover:bg-gray-100'
                        }
                      `}>
                        <Icon className={`w-5 h-5 ${
                          active ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'
                        }`} />
                      </div>
                      <span className={`text-[10px] leading-tight text-center ${
                        active ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {item.label}
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Account image at bottom */}
        <div className="p-2 border-t border-gray-200">
          {account && (
            <div className="flex justify-center">
              <ProfilePhoto account={account} size="sm" />
            </div>
          )}
        </div>

        {/* Secondary Sidebar - Shows on hover */}
        {hoveredNavItem && (() => {
          const navItem = navItems.find(item => item.href === hoveredNavItem);
          const content = navItem?.secondaryContent;
          return (
            <SecondarySidebar
              isOpen={true}
              label={navItem?.label || ''}
              onMouseEnter={() => setHoveredNavItem(hoveredNavItem)}
              onMouseLeave={() => setHoveredNavItem(null)}
            >
              {content && React.isValidElement(content)
                ? React.cloneElement(content, { map })
                : content
              }
            </SecondarySidebar>
          );
        })()}
      </aside>
    </>
  );
}

