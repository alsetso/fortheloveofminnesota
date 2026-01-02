'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import ProfileDropdown from './ProfileDropdown';
import { SessionData } from '../services/sessionStorage';
import { useAuth } from '@/features/auth';
import { useServerAuth } from '@/components/providers/ServerAuthProvider';
import type { ServerAuthUser } from '@/lib/authServer';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface AppHeaderProps {
  currentSession: SessionData | null;
  sessions: SessionData[];
  onNewSession: () => Promise<SessionData>;
  onSessionSwitch: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, newName: string) => void;
  onUpdateSession?: (updates: {
    name: string;
    description: string;
    isActive: boolean;
    locationTrackingActive: boolean;
  }) => Promise<void>;
  updateUrl?: boolean; // Optional prop to enable URL updates
  showSessionSelector?: boolean; // Optional prop to show/hide session selector
  // Mobile view toggle props
  showMobileToggle?: boolean;
  mobileView?: 'map' | 'results';
  onMobileViewToggle?: () => void;
  // Desktop sidebar toggle props
  showSidebarToggle?: boolean;
  isSidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  // Skip trace sidebar toggle props
  showSkipTraceToggle?: boolean;
  isSkipTraceSidebarOpen?: boolean;
  onSkipTraceSidebarToggle?: () => void;
  skipTracePinsCount?: number;
  // Server-side auth data to prevent flash
  serverAuth?: ServerAuthUser | null;
}

export default function AppHeader({
  currentSession: _currentSession,
  sessions: _sessions,
  onNewSession: _onNewSession,
  onSessionSwitch: _onSessionSwitch,
  onSessionRename: _onSessionRename,
  onUpdateSession: _onUpdateSession,
  showMobileToggle = false,
  mobileView = 'map',
  onMobileViewToggle,
  showSidebarToggle = false,
  isSidebarOpen = true,
  onSidebarToggle,
  serverAuth,
}: AppHeaderProps) {
  // Prefer server auth to prevent flash, fallback to client auth
  const serverAuthUser = useServerAuth();
  const { user: clientUser } = useAuth();
  const user = serverAuth || serverAuthUser || clientUser;
  const pathname = usePathname();
  const _router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Determine page types
  const isMapPage = pathname === '/maps' || pathname?.startsWith('/map/');
  const _needsSessionManagement = isMapPage;
  const _isDashboardPage = pathname === '/';

  // Navigation links
  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/maps', label: 'Maps' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-black backdrop-blur-md">
        <div className="w-full px-3 sm:px-4 lg:px-8">
          <div className="flex items-center h-12">
            {/* Left Section - Navigation Links (Desktop) / Mobile Menu Button */}
            <div className="flex-1 flex items-center justify-start space-x-1 sm:space-x-4 pr-4">
              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-2 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive(link.href)
                        ? 'text-gold-400 bg-header-focus/60'
                        : 'text-gray-300 hover:text-gold-400 hover:bg-header-focus/60'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-gray-300 hover:text-gold-400 hover:bg-header-focus/60 rounded-lg transition-all"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <XMarkIcon className="w-6 h-6" />
                ) : (
                  <Bars3Icon className="w-6 h-6" />
                )}
              </button>
            </div>
            
            {/* Center Section - Logo */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <Link 
                href="/" 
                className="group relative inline-block transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:ring-offset-2 focus:ring-offset-black rounded-lg p-1 -m-1"
                aria-label="Go to homepage"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="absolute inset-0 bg-gold-500/0 group-hover:bg-gold-500/10 rounded-lg transition-colors duration-300 blur-sm group-hover:blur-none" />
                <div className="relative">
                  <Image
                    src="/logo.png"
                    alt="For the Love of Minnesota Emblem"
                    width={40}
                    height={40}
                    className="h-auto w-auto"
                    priority
                  />
                </div>
              </Link>
            </div>
            
            {/* Right Section - Profile Dropdown */}
            <div className="flex-1 flex items-center justify-end space-x-1.5 sm:space-x-3 pl-4">

              {/* Map-specific controls */}
              {isMapPage && (
                <>
                  {/* Mobile View Toggle - Only show on mobile */}
                  {showMobileToggle && onMobileViewToggle && (
                    <div className="md:hidden">
                      <button
                        onClick={onMobileViewToggle}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:ring-offset-2 focus:ring-offset-black shadow-lg ${
                          mobileView === 'results' ? 'bg-gold-500 shadow-gold-500/50' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                        title={`Switch to ${mobileView === 'map' ? 'Results' : 'Map'} view`}
                        aria-label={`Switch to ${mobileView === 'map' ? 'Results' : 'Map'} view`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-200 ${
                            mobileView === 'results' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                  
                  {/* Sidebar Toggle - Only show on desktop */}
                  {showSidebarToggle && onSidebarToggle && (
                    <div className="hidden md:block">
                      <button
                        onClick={onSidebarToggle}
                        className="p-2.5 text-gray-300 hover:text-gold-400 hover:bg-header-focus/60 border border-header-focus/50 hover:border-header-focus rounded-lg transition-all duration-200 touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:ring-offset-2 focus:ring-offset-black"
                        title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                        aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                      >
                        {isSidebarOpen ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Usage indicator removed */}
              
              {/* Profile Dropdown - Show only when logged in, Login button when logged out */}
              {user ? (
                <ProfileDropdown />
              ) : (
                <Link
                  href="/?modal=account&tab=settings"
                  className="px-4 py-2 text-sm font-semibold text-black bg-gold-500 hover:bg-gold-400 rounded-lg transition-all duration-200 shadow-md hover:shadow-gold-500/50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:ring-offset-2 focus:ring-offset-black"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-header-focus/50 bg-black/95 backdrop-blur-md">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive(link.href)
                      ? 'text-gold-400 bg-header-focus/60'
                      : 'text-gray-300 hover:text-gold-400 hover:bg-header-focus/60'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
