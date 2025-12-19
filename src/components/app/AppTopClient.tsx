'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bars3Icon, SparklesIcon, Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Account, AccountService } from '@/features/auth';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profiles/contexts/ProfileContext';
import ProfilePhoto from '@/components/ProfilePhoto';
import AppSearch from './AppSearch';
import { isAccountComplete } from '@/lib/accountCompleteness';
import { appNavItems } from '@/config/navigation';

interface AppTopClientProps {
  user: { id: string; email: string } | null;
  account: Account | null;
  profiles: Array<{ id: string; [key: string]: unknown }>; // Legacy prop, no longer used
  isAuthenticated: boolean;
}

export default function AppTopClient({ 
  user: serverUser,
  account: serverAccount,
  profiles: serverProfiles,
  isAuthenticated,
}: AppTopClientProps) {
  const { user: clientUser, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { profiles: contextProfiles, selectedProfile, setSelectedProfile } = useProfile();
  
  // Use server data as initial state, but allow client updates
  const user = clientUser || (serverUser ? { id: serverUser.id, email: serverUser.email } : null);
  const account = serverAccount;
  const profiles = contextProfiles.length > 0 ? contextProfiles : serverProfiles;
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountContainerRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      setIsAccountMenuOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountContainerRef.current && !accountContainerRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    if (isAccountMenuOpen || isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isAccountMenuOpen, isSidebarOpen]);

  // Use account for display name
  const displayName = account 
    ? AccountService.getDisplayName(account) 
    : user?.email || 'User';

  const planName = account?.plan ? account.plan.charAt(0).toUpperCase() + account.plan.slice(1) : 'Account';

  // Expose sidebar state via custom event for AppContent
  useEffect(() => {
    const handleMenuToggle = () => {
      setIsSidebarOpen(prev => !prev);
    };
    
    window.addEventListener('appMenuToggle', handleMenuToggle);
    return () => window.removeEventListener('appMenuToggle', handleMenuToggle);
  }, []);

  // Dispatch sidebar state changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('appSidebarState', { detail: { isOpen: isSidebarOpen } }));
  }, [isSidebarOpen]);

  // Listen for agent panel state changes from AppWrapper to sync state
  useEffect(() => {
    const handleAgentPanelState = (e: Event) => {
      const customEvent = e as CustomEvent<{ isOpen: boolean }>;
      setIsAgentPanelOpen(customEvent.detail.isOpen);
    };
    
    window.addEventListener('appAgentPanelState', handleAgentPanelState);
    return () => window.removeEventListener('appAgentPanelState', handleAgentPanelState);
  }, []);

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[100] bg-black"
      style={{ 
        width: '100vw',
        height: '3.5rem',
        minHeight: '3.5rem',
      }}
    >
      <div className="w-full h-full" style={{ width: '100%' }}>
        <div className="flex items-center h-full gap-4 w-full px-4">
          {/* Left Section - Hamburger (mobile) / Logo (desktop) */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Hamburger Menu - Below lg (800px), Only show when authenticated */}
            {isAuthenticated && (
              <div ref={menuContainerRef} className="relative lg:hidden">
                <button
                  onClick={() => {
                    setIsSidebarOpen(!isSidebarOpen);
                  }}
                  className={`p-2 text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors ${
                    isSidebarOpen ? 'bg-white/10' : ''
                  }`}
                  aria-label="Toggle menu"
                  aria-expanded={isSidebarOpen}
                >
                  {isSidebarOpen ? (
                    <XMarkIcon className="w-6 h-6" />
                  ) : (
                    <Bars3Icon className="w-6 h-6" />
                  )}
                </button>

                {/* Menu Dropdown - iOS Blur Style */}
                {isSidebarOpen && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-black/80 backdrop-blur-xl backdrop-saturate-150 rounded-lg border border-white/20 z-50 overflow-hidden">
                    <nav className="py-1">
                      {appNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                              active
                                ? 'bg-white/20 text-white'
                                : 'text-white/80 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}

                      {/* Divider */}
                      <div className="my-1 border-t border-white/10" />

                      {/* Settings */}
                      <Link
                        href="/account/settings"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                          isActive('/account/settings')
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Cog6ToothIcon className="w-5 h-5" />
                        <span>Settings</span>
                      </Link>
                    </nav>
                  </div>
                )}
              </div>
            )}

            {/* Logo - lg and up, Left Aligned */}
            <Link 
              href="/" 
              className="hidden lg:flex items-center transition-opacity hover:opacity-80"
              aria-label="Go to homepage"
            >
              <Image
                src="/logo.png"
                alt="MNUDA Emblem"
                width={32}
                height={32}
                className="h-auto w-auto"
                priority
              />
            </Link>
          </div>
          
          {/* Center Section - Search */}
          <div className="flex-1 w-full">
            <AppSearch 
              placeholder="Search" 
              onLocationSelect={(coordinates, placeName, mapboxMetadata) => {
                // Dispatch custom event for map page to handle
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('mapLocationSelect', {
                    detail: { coordinates, placeName, mapboxMetadata }
                  }));
                }
              }}
            />
          </div>

          {/* Right Section - AI Agent, Profile/Login */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* AI Agent Icon - Always visible */}
            <button
              onClick={() => {
                // Dispatch toggle event - AppWrapper will handle state and sync back
                window.dispatchEvent(new CustomEvent('appAgentPanelToggle'));
              }}
              className={`p-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                isAgentPanelOpen
                  ? 'text-gold-400 bg-header-focus/60 border-header-focus'
                  : 'text-gray-300 hover:text-gold-400 hover:bg-header-focus/60 border-transparent hover:border-header-focus'
              }`}
              aria-label="AI Agent"
              aria-expanded={isAgentPanelOpen}
            >
              <SparklesIcon className="w-5 h-5" />
            </button>

            {/* Profile/Login */}
            {user && account ? (
              <div ref={accountContainerRef} className="relative">
                {/* Profile Button */}
                <div className={`flex items-center space-x-2 px-2 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 border ${
                  isAccountMenuOpen
                    ? 'text-gold-400 bg-header-focus/60 border-header-focus'
                    : 'text-gray-300 hover:text-gold-400 hover:bg-header-focus/60 border-transparent hover:border-header-focus'
                }`}>
                  <Link
                    href="/account/settings"
                    className="flex items-center space-x-2 flex-1 min-w-0"
                    onClick={() => setIsAccountMenuOpen(false)}
                  >
                    <ProfilePhoto profile={selectedProfile} account={account} size="sm" />
                    <span className="hidden sm:inline text-xs max-w-[100px] truncate">{displayName}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAccountMenuOpen(!isAccountMenuOpen);
                    }}
                    className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
                    aria-label="Account menu"
                  >
                    <svg 
                      className={`w-4 h-4 transition-all duration-200 ${isAccountMenuOpen ? 'rotate-180 text-gold-400' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Dropdown Menu */}
                {isAccountMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-black/95 backdrop-blur-md z-50 overflow-hidden rounded-lg border border-header-focus">
                    <div className="py-1">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-header-focus">
                        <p className="text-sm font-medium text-gray-100">{user.email}</p>
                        <p className="text-xs text-gray-400">{planName}</p>
                      </div>


                      {/* Navigation Links */}
                      <Link
                        href="/account/settings"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-300 hover:text-gold-400 hover:bg-gray-800/60 transition-all duration-200"
                      >
                        <svg className="w-4 h-4 mr-3 text-gray-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </Link>
                      <Link
                        href="/account/billing"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-300 hover:text-gold-400 hover:bg-gray-800/60 transition-all duration-200"
                      >
                        <svg className="w-4 h-4 mr-3 text-gray-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Billing
                      </Link>
                      {/* Sign Out */}
                      <div className="border-t border-header-focus mt-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:text-gold-400 hover:bg-gray-800/60 transition-all duration-200"
                        >
                          <svg className="w-4 h-4 mr-3 text-gray-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/?modal=account&tab=settings"
                className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-header-focus/60 border border-header-focus rounded transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

