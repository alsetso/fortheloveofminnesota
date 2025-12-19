'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { appNavItems } from '@/config/navigation';

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isAuthenticated?: boolean;
  /**
   * If true, manages its own state via window events (for AppSidebarClient behavior)
   * If false, uses controlled props (isOpen/onClose)
   */
  useClientState?: boolean;
}

const navItems = appNavItems;

export default function AppSidebar({ 
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  isAuthenticated = true,
  useClientState = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [clientIsOpen, setClientIsOpen] = useState(false);

  // Use client state management if enabled
  const isOpen = useClientState ? clientIsOpen : (controlledIsOpen ?? false);
  const handleClose = useClientState 
    ? () => setClientIsOpen(false)
    : (controlledOnClose || (() => {}));

  // Listen for sidebar toggle events when using client state
  useEffect(() => {
    if (!useClientState) return;

    const handleMenuToggle = () => {
      setClientIsOpen(prev => !prev);
    };
    
    const handleSidebarState = (e: Event) => {
      const customEvent = e as CustomEvent<{ isOpen: boolean }>;
      setClientIsOpen(customEvent.detail.isOpen);
    };
    
    window.addEventListener('appMenuToggle', handleMenuToggle);
    window.addEventListener('appSidebarState', handleSidebarState);
    
    return () => {
      window.removeEventListener('appMenuToggle', handleMenuToggle);
      window.removeEventListener('appSidebarState', handleSidebarState);
    };
  }, [useClientState]);

  // Dispatch state changes when using client state
  useEffect(() => {
    if (!useClientState) return;
    window.dispatchEvent(new CustomEvent('appSidebarState', { detail: { isOpen: clientIsOpen } }));
  }, [clientIsOpen, useClientState]);

  if (!isAuthenticated) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Overlay - Below lg (800px) - Transparent to allow backdrop-blur to work */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[150] lg:hidden"
          onClick={handleClose}
          style={{ top: '3.5rem' }}
        />
      )}

      {/* Sidebar - Desktop: Inside main content area (lg and up) */}
      <aside
        className={`
          relative h-full z-[200]
          bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out
          ${useClientState && !isOpen ? '-translate-x-full' : 'translate-x-0'}
          lg:translate-x-0
          hidden lg:flex
          w-20 flex-shrink-0 flex-col
        `}
        style={{ borderTopLeftRadius: '1.5rem' }}
      >
        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 flex flex-col overflow-y-auto p-2">
            <ul className="flex-1 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        flex flex-col items-center justify-center gap-0 px-2 py-3 rounded-lg
                        transition-colors
                        group
                        ${
                          active
                            ? 'bg-gray-200 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }
                      `}
                      title={item.label}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span 
                        className="text-[6px] font-medium mt-[2px]"
                        style={{ fontSize: '6px', marginTop: '2px' }}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Settings Section - Pinned to bottom */}
            <div className="mt-auto pt-6 border-t border-gray-200">
              <Link
                href="/account/settings"
                className={`
                  flex flex-col items-center justify-center gap-0 px-2 py-3 rounded-lg
                  transition-colors
                  group
                  ${
                    isActive('/account/settings')
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }
                `}
                title="Settings"
              >
                <Cog6ToothIcon className="w-5 h-5 flex-shrink-0" />
                <span 
                  className="text-[6px] font-medium mt-[2px]"
                  style={{ fontSize: '6px', marginTop: '2px' }}
                >
                  Settings
                </span>
              </Link>
            </div>
          </nav>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay - Below lg (800px) */}
      {isOpen && (
        <aside
          className={`
            fixed inset-y-0 left-0 z-[200]
            bg-white/60 backdrop-blur-2xl backdrop-saturate-[1.8]
            border-r border-white/40
            transition-transform duration-300 ease-in-out
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            w-64 flex-shrink-0 flex-col
            lg:hidden
            isolate
          `}
          style={{ 
            top: '3.5rem', 
            borderTopLeftRadius: '1.5rem',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          }}
        >
          <div className="flex flex-col h-full">
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-white/20">
              <h2 className="text-sm font-semibold text-gray-900">Menu</h2>
              <button
                onClick={handleClose}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white/40 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col overflow-y-auto p-4">
              <ul className="flex-1 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={handleClose}
                        className={`
                          flex items-center gap-3 px-4 py-4 rounded-lg
                          text-sm font-medium transition-colors
                          ${
                            active
                              ? 'bg-white/50 text-gray-900'
                              : 'text-gray-700 hover:bg-white/40 hover:text-gray-900'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Settings Section - Pinned to bottom */}
              <div className="mt-auto pt-6 border-t border-white/20">
                <Link
                  href="/account/settings"
                  onClick={handleClose}
                  className={`
                    flex items-center gap-3 px-4 py-4 rounded-lg
                    text-sm font-medium transition-colors
                    ${
                      isActive('/account/settings')
                        ? 'bg-white/50 text-gray-900'
                        : 'text-gray-700 hover:bg-white/40 hover:text-gray-900'
                    }
                  `}
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  <span>Settings</span>
                </Link>
              </div>
            </nav>
          </div>
        </aside>
      )}
    </>
  );
}
