'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, AccountService, Account } from '@/features/auth';
import ProfilePhoto from '@/components/ProfilePhoto';
import AppSearch from '@/components/app/AppSearch';

interface TestMapTopNavProps {
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
}

export default function TestMapTopNav({}: TestMapTopNavProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const accountContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const fetchAccount = async () => {
      if (user) {
        try {
          const accountData = await AccountService.getCurrentAccount();
          setAccount(accountData);
        } catch (error) {
          console.error('Error fetching account:', error);
        }
      }
    };

    fetchAccount();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountContainerRef.current && !accountContainerRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isAccountMenuOpen]);

  const displayName = AccountService.getDisplayName(account);

  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-end px-4 py-3 bg-transparent">
      {/* Account Dropdown */}
      <div ref={accountContainerRef} className="relative">
        {!user ? (
          <Link
            href="/?modal=account&tab=settings"
            className="px-4 py-2 text-sm text-white hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors border border-white/20"
          >
            Sign In
          </Link>
        ) : (
          <>
            <button
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className={`
                flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 border
                ${isAccountMenuOpen
                  ? 'bg-white/20 text-white border-white/30'
                  : 'text-white hover:text-white hover:bg-white/10 border-white/20 hover:border-white/30'
                }
              `}
            >
              <ProfilePhoto 
                account={account}
                size="sm"
                editable={false}
              />
              <span className="hidden sm:inline text-xs max-w-[120px] truncate">{displayName}</span>
              <svg 
                className={`w-4 h-4 transition-all duration-200 ${isAccountMenuOpen ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isAccountMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-md z-50 overflow-hidden rounded-lg border border-gray-200 shadow-lg">
                <div className="py-1">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    <p className="text-xs text-gray-500">Account</p>
                  </div>

                  {/* Navigation Links */}
                  <Link
                    href="/account/settings"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Account
                  </Link>
                  <Link
                    href="/account/settings"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                  <Link
                    href="/account/billing"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Billing
                  </Link>
                  
                  {/* Sign Out */}
                  <div className="border-t border-gray-200 mt-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


