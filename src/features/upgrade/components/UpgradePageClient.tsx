'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { UserIcon, Cog6ToothIcon, CreditCardIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import UpgradeContent from './UpgradeContent';

export default function UpgradePageClient() {
  const router = useRouter();
  const { account, signOut } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
    };

    if (showAccountDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showAccountDropdown]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Same style as /add page */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex items-center"
            >
              <Image
                src="/logo.png"
                alt="For the Love of Minnesota"
                width={120}
                height={32}
                className="h-6 w-auto"
                priority
              />
            </button>
          </div>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-900">
            Billing
          </h1>
          <div ref={accountDropdownRef} className="relative">
            {account ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className={`w-6 h-6 rounded-full overflow-hidden transition-all ${
                    (account.plan === 'contributor' || account.plan === 'plus')
                      ? 'p-[1px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                      : 'border border-gray-200'
                  } ${showAccountDropdown ? 'ring-2 ring-gray-300' : ''}`}
                  aria-label="Account menu"
                  aria-expanded={showAccountDropdown}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-white">
                    {account.image_url ? (
                      <Image
                        src={account.image_url}
                        alt={account.username || 'Account'}
                        width={24}
                        height={24}
                        className="w-full h-full object-cover"
                        unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <UserIcon className="w-3 h-3 text-gray-500" />
                      </div>
                    )}
                  </div>
                </button>

                {/* Dropdown Menu */}
                {showAccountDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountDropdown(false);
                        if (account.username) {
                          router.push(`/${account.username}`);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <UserIcon className="w-4 h-4 text-gray-500" />
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountDropdown(false);
                        router.push('/settings');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountDropdown(false);
                        router.push('/billing');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <CreditCardIcon className="w-4 h-4 text-gray-500" />
                      Billing
                    </button>
                    <div className="border-t border-gray-200 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountDropdown(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4 text-red-600" />
                      Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => openWelcome()}
                className="w-6 h-6 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                aria-label="Sign in"
              >
                <UserIcon className="w-3 h-3 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="pt-0">
        <UpgradeContent />
      </div>
    </div>
  );
}
