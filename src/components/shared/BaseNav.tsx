'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Bars3Icon, XMarkIcon, BellIcon } from '@heroicons/react/24/outline';

export interface NavLink {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }> | null;
  isNotification?: boolean;
  isAccount?: boolean;
  unreadCount?: number;
  account?: { id: string; username: string | null; [key: string]: unknown } | null;
}

interface BaseNavProps {
  /** Navigation links to display */
  navLinks: NavLink[];
  /** Logo source path */
  logo?: string;
  /** Logo alt text */
  logoAlt?: string;
  /** Background color classes */
  bgColor?: string;
  /** Border color classes */
  borderColor?: string;
  /** Text color classes for links */
  textColor?: string;
  /** Active link color classes */
  activeColor?: string;
  /** Right section content (auth buttons, etc.) */
  rightSection?: ReactNode;
  /** Search section (displayed between nav links and right section) */
  searchSection?: ReactNode;
  /** Show scroll effect */
  showScrollEffect?: boolean;
  /** Custom mobile menu content */
  mobileMenuContent?: ReactNode;
  /** Sticky positioning */
  sticky?: boolean;
  /** Notification dropdown component */
  notificationDropdown?: ReactNode;
  /** Account dropdown component */
  accountDropdown?: ReactNode;
  /** Handler for notification click */
  onNotificationClick?: () => void;
  /** Handler for account click */
  onAccountClick?: () => void;
  /** Profile photo component for account nav item */
  profilePhotoComponent?: ReactNode;
}

export default function BaseNav({
  navLinks,
  logo = '/word_logo.png',
  logoAlt = 'For the Love of Minnesota',
  bgColor = 'bg-white',
  borderColor = 'border-gray-200',
  textColor = 'text-gray-600',
  activeColor = 'text-black',
  rightSection,
  searchSection,
  showScrollEffect = false,
  mobileMenuContent,
  sticky = true,
  notificationDropdown,
  accountDropdown,
  onNotificationClick,
  onAccountClick,
  profilePhotoComponent,
}: BaseNavProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!showScrollEffect) return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showScrollEffect]);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const stickyClass = sticky ? 'sticky top-0 z-50' : '';

  return (
    <nav className={`${bgColor} ${stickyClass} border-b ${borderColor} transition-all duration-200 h-14 flex-shrink-0`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-full">
        <div className="grid grid-cols-3 items-center h-full gap-2">
          {/* Left Column: Navigation Links (Desktop) / Hamburger (Mobile) */}
          <div className="flex items-center gap-0 min-w-0 h-full">
            {/* Desktop: Show nav links */}
            <div className="hidden md:flex items-center gap-0 min-w-0 justify-start h-full">
              {navLinks.map((link, index) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                
                // Handle special nav items (notifications)
                if (link.isNotification) {
                  const hasUnread = (link.unreadCount ?? 0) > 0;
                  return (
                    <div key={`notification-${index}`} className="relative flex-shrink-0 h-full">
                      <button
                        onClick={onNotificationClick}
                        className="flex flex-col items-center justify-center px-2 h-full min-w-[44px] transition-colors text-gray-600 hover:text-gray-900"
                        aria-label={`Notifications${hasUnread ? ` (${link.unreadCount} unread)` : ''}`}
                      >
                        <div className="relative">
                          <BellIcon className="w-4 h-4" />
                          {hasUnread && (
                            <span 
                              className="absolute -top-0.5 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full"
                              aria-label={`${link.unreadCount} unread notifications`}
                            />
                          )}
                        </div>
                        <span className="text-[9px] font-medium mt-0.5 leading-none">Notify</span>
                      </button>
                      {notificationDropdown}
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex flex-col items-center justify-center px-2 h-full min-w-[44px] transition-colors flex-shrink-0 ${
                      active
                        ? `${activeColor}`
                        : `${textColor} hover:text-gray-900`
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className={`text-[9px] font-medium mt-0.5 leading-none ${
                      active ? 'border-b border-current' : ''
                    }`}>
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </div>
            
            {/* Mobile: Show hamburger menu */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 transition-colors text-gray-600 hover:text-gray-900 flex-shrink-0"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-5 h-5" />
              ) : (
                <Bars3Icon className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Center Column: Logo/Emblem (Always Centered) */}
          <div className="flex items-center justify-center min-w-0 h-full">
            <Link href="/" className="hover:opacity-80 transition-opacity flex-shrink-0" aria-label="Home">
              <div className="w-8 h-8 relative overflow-hidden flex-shrink-0">
                <Image
                  src={logo}
                  alt={logoAlt}
                  fill
                  className="object-contain"
                  sizes="32px"
                  priority
                />
              </div>
            </Link>
          </div>

          {/* Right Column: Right Section (Desktop) / Me Icon (Mobile) */}
          <div className="flex items-center justify-end gap-0 min-w-0 h-full">
            {rightSection}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden border-t ${borderColor} py-4 bg-white`}>
            {mobileMenuContent ? (
              <div onClick={(e) => {
                // Close menu when clicking on links
                const target = e.target as HTMLElement;
                if (target.tagName === 'A' || target.closest('a')) {
                  setIsMobileMenuOpen(false);
                }
              }}>
                {mobileMenuContent}
              </div>
            ) : (
              <div className="space-y-2">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block px-3 py-2 text-base font-medium transition-colors flex items-center gap-2 ${
                        isActive(link.href)
                          ? `${activeColor} bg-gray-100`
                          : `${textColor} hover:${activeColor} hover:bg-gray-100`
                      }`}
                    >
                      {Icon && <Icon className="w-5 h-5" />}
                      {link.label}
                    </Link>
                  );
                })}
                {rightSection && (
                  <div className="pt-4 border-t border-gray-200">
                    {rightSection}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

