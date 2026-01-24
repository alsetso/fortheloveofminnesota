'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';

interface NavLink {
  label: string;
  href: string;
  requiresAuth?: boolean;
}

const navLinks: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Live Map', href: '/map/live' },
  { label: 'Maps', href: '/maps' },
  { label: 'Profile', href: '/profile', requiresAuth: true },
  { label: 'Account', href: '/account', requiresAuth: true },
  { label: 'Settings', href: '/account/settings', requiresAuth: true },
  { label: 'Billing', href: '/billing', requiresAuth: true },
  { label: 'Groups', href: '/groups' },
  { label: 'Feed', href: '/feed' },
  { label: 'Gov', href: '/gov' },
  { label: 'Admin', href: '/admin', requiresAuth: true },
];

interface HamburgerMenuProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export default function HamburgerMenu({ isOpen: controlledIsOpen, onOpenChange }: HamburgerMenuProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { account, user } = useAuthStateSafe();
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = useCallback((value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalIsOpen(value);
    }
  }, [onOpenChange]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleLinkClick = (href: string, requiresAuth?: boolean) => {
    if (requiresAuth && !user) {
      // Could open login modal here if needed
      return;
    }
    router.push(href);
    setIsOpen(false);
  };

  const filteredLinks = navLinks.map(link => {
    // For Profile, use the user's username if available
    if (link.href === '/profile' && account?.username) {
      return { ...link, href: `/profile/${account.username}` };
    }
    return link;
  }).filter(link => {
    if (link.requiresAuth && !user) return false;
    // Filter out Admin if not admin
    if (link.href === '/admin' && account?.role !== 'admin') return false;
    return true;
  });

  return (
    <>
      {/* Hamburger Button - Only show if not controlled (standalone mode) */}
      {controlledIsOpen === undefined && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-white hover:text-gray-300 transition-colors"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      )}

      {/* Full Screen Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Close Button */}
          <div className="absolute top-6 right-6 z-10">
            <button
              onClick={() => setIsOpen(false)}
              className="w-12 h-12 flex items-center justify-center text-white hover:text-gray-300 transition-colors"
              aria-label="Close menu"
            >
              <XMarkIcon className="w-8 h-8" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
            {filteredLinks.map((link) => {
              const isActive = pathname === link.href || 
                (link.href.startsWith('/profile/') && pathname?.startsWith('/profile/'));
              
              return (
                <button
                  key={link.href}
                  onClick={() => handleLinkClick(link.href, link.requiresAuth)}
                  className={`text-white transition-colors hover:text-gray-300 ${
                    isActive ? 'text-gray-400' : ''
                  }`}
                  style={{ fontSize: '40px', lineHeight: '1.2' }}
                >
                  {link.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
